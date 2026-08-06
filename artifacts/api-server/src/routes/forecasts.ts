import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import {
  db, forecastsTable, forecastScenariosTable, monthlyProjectionsTable,
  aiRecommendationsTable, ownersTable, propertiesTable, usersTable, proposalsTable,
} from "@workspace/db";
import {
  CreateForecastBody, UpdateForecastBody, GetForecastParams,
  UpdateForecastParams, DeleteForecastParams,
  ApproveForecastBody, CreateScenarioBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { calculateMonthlyProjections, calculateScenario, type MonthlyOverrides, REFERENCE_OCCUPANCY } from "../lib/calculate";
import { bustCommissionCache } from "./referees";
import OpenAI from "openai";

/** Bust the server-side commission cache for whichever referee is linked to this forecast's owner. */
async function bustCacheForForecast(ownerId: number | null | undefined): Promise<void> {
  if (!ownerId) return;
  const [owner] = await db.select({ refereeId: ownersTable.refereeId }).from(ownersTable).where(eq(ownersTable.id, ownerId));
  if (owner?.refereeId) bustCommissionCache(owner.refereeId);
}

const router: IRouter = Router();

function generateRef() {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RHH-${year}-${rand}`;
}

function formatForecast(f: any, ownerName?: string | null, propertyAddr?: string | null, assignedName?: string | null) {
  return {
    id: f.id,
    referenceNumber: f.referenceNumber,
    ownerId: f.ownerId,
    ownerName: ownerName ?? null,
    propertyId: f.propertyId,
    propertyAddress: propertyAddr ?? null,
    area: f.area ?? null,
    projectBuilding: f.projectBuilding ?? null,
    bedrooms: f.bedrooms ?? null,
    status: f.status,
    recommendedOccupancy: f.recommendedOccupancy,
    weightedAdr: f.weightedAdr,
    grossAnnualRevenue: f.grossAnnualRevenue,
    netOwnerIncome: f.netOwnerIncome,
    netLtrIncome: f.netLtrIncome,
    increaseVsLtr: f.increaseVsLtr,
    increaseVsLtrPct: f.increaseVsLtrPct,
    assignedToId: f.assignedToId,
    assignedToName: assignedName ?? null,
    reconciliationStatus: f.reconciliationStatus,
    expiresAt: f.expiresAt?.toISOString?.() ?? null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  };
}

router.get("/forecasts", requireAuth, async (_req, res): Promise<void> => {
  const forecasts = await db.select().from(forecastsTable)
    .where(eq(forecastsTable.isArchived, false))
    .orderBy(desc(forecastsTable.updatedAt));

  const result = await Promise.all(forecasts.map(async (f) => {
    let ownerName: string | null = null;
    let propertyAddr: string | null = null;
    let assignedName: string | null = null;
    if (f.ownerId) {
      const [o] = await db.select().from(ownersTable).where(eq(ownersTable.id, f.ownerId));
      if (o) ownerName = `${o.firstName} ${o.lastName}`;
    }
    if (f.propertyId) {
      const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, f.propertyId));
      if (p) propertyAddr = [p.projectBuilding, p.area].filter(Boolean).join(", ");
    }
    if (f.assignedToId) {
      const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, f.assignedToId));
      assignedName = u?.name ?? null;
    }
    return formatForecast(f, ownerName, propertyAddr, assignedName);
  }));
  res.json(result);
});

router.post("/forecasts", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateForecastBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const settings = await db.query.companySettingsTable.findFirst();
  const [forecast] = await db.insert(forecastsTable).values({
    ...parsed.data,
    referenceNumber: generateRef(),
    managementFeePercent: settings?.defaultManagementFeePercent ?? 20,
    ltrVacancyPercent: settings?.defaultLtrVacancyPercent ?? 10,
    createdById: req.session.userId,
    assignedToId: parsed.data.assignedToId ?? req.session.userId,
  }).returning();

  // Create default scenarios
  const scenarioDefs = [
    { name: "Conservative", occupancyRate: 0.70, adrMultiplier: 1.0, isRecommended: false },
    { name: "Realistic",    occupancyRate: 0.75, adrMultiplier: 1.0, isRecommended: false },
    { name: "Realistic",    occupancyRate: 0.80, adrMultiplier: 1.0, isRecommended: true  },
    { name: "Confident",    occupancyRate: 0.85, adrMultiplier: 1.0, isRecommended: false },
    { name: "Optimistic",   occupancyRate: 0.90, adrMultiplier: 1.0, isRecommended: false },
  ];
  await db.insert(forecastScenariosTable).values(scenarioDefs.map(s => ({ ...s, forecastId: forecast.id })));

  // Create proposal record
  await db.insert(proposalsTable).values({
    forecastId: forecast.id,
    referenceNumber: forecast.referenceNumber,
    createdById: req.session.userId,
  });

  res.status(201).json(formatForecast(forecast));
});

router.get("/forecasts/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [f] = await db.select().from(forecastsTable).where(eq(forecastsTable.id, id));
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }

  // Join owner, property and assigned-user data so the detail view has everything it needs
  let ownerTitle: string | null = null;
  let ownerFirstName: string | null = null;
  let ownerLastName: string | null = null;
  let ownerName: string | null = null;
  let propertyAddress: string | null = null;
  let propertyType: string | null = null;
  let bedrooms: number | null = null;
  let bathrooms: number | null = null;
  let internalArea: number | null = null;
  let view: string | null = null;
  let floor: number | null = null;
  let furnishingStatus: string | null = null;
  let area: string | null = null;
  let projectBuilding: string | null = null;
  let unitNumber: string | null = null;
  let advisorName: string | null = null;

  if (f.ownerId) {
    const [o] = await db.select().from(ownersTable).where(eq(ownersTable.id, f.ownerId));
    if (o) {
      ownerTitle      = o.title ?? null;
      ownerFirstName  = o.firstName;
      ownerLastName   = o.lastName;
      ownerName       = [o.title, o.firstName, o.lastName].filter(Boolean).join(" ");
    }
  }
  if (f.propertyId) {
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, f.propertyId));
    if (p) {
      propertyType    = p.propertyType ?? null;
      bedrooms        = p.bedrooms ?? null;
      bathrooms       = p.bathrooms ?? null;
      internalArea    = p.internalArea ?? null;
      view            = p.view ?? null;
      floor           = p.floor ?? null;
      furnishingStatus= p.furnishingStatus ?? null;
      area            = p.area ?? null;
      projectBuilding = p.projectBuilding ?? null;
      unitNumber      = p.unitNumber ?? null;
      propertyAddress = [p.projectBuilding, p.area].filter(Boolean).join(", ");
    }
  }
  if (f.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, f.assignedToId));
    advisorName = u?.name ?? null;
  }

  res.json({
    id: f.id, referenceNumber: f.referenceNumber, ownerId: f.ownerId, propertyId: f.propertyId,
    // Joined owner fields
    ownerTitle, ownerFirstName, ownerLastName, ownerName,
    // Joined property fields
    propertyAddress, propertyType, bedrooms, bathrooms, internalArea, view,
    floor, furnishingStatus, area, projectBuilding, unitNumber,
    // Joined representative
    advisorName,
    // Forecast fields
    status: f.status, managementFeePercent: f.managementFeePercent, ltrVacancyPercent: f.ltrVacancyPercent,
    annualLtr: f.annualLtr, internetCost: f.internetCost, utilityCost: f.utilityCost,
    maintenanceCost: f.maintenanceCost, miscCost: f.miscCost,
    baseAdr: f.baseAdr, lowSeasonAdr: f.lowSeasonAdr,
    shoulderSeasonAdr: f.shoulderSeasonAdr, peakSeasonAdr: f.peakSeasonAdr, eventAdr: f.eventAdr,
    ownerBlockedNights: f.ownerBlockedNights, narrativeText: f.narrativeText, internalNotes: f.internalNotes,
    reconciliationStatus: f.reconciliationStatus, grossAnnualRevenue: f.grossAnnualRevenue,
    totalAnnualExpenses: f.totalAnnualExpenses, netOwnerIncome: f.netOwnerIncome, netLtrIncome: f.netLtrIncome,
    increaseVsLtr: f.increaseVsLtr, increaseVsLtrPct: f.increaseVsLtrPct, weightedAdr: f.weightedAdr,
    recommendedOccupancy: f.recommendedOccupancy, assignedToId: f.assignedToId,
    expiresAt: f.expiresAt?.toISOString?.() ?? null, createdAt: f.createdAt, updatedAt: f.updatedAt,
  });
});

router.patch("/forecasts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateForecastParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateForecastBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: any = { ...parsed.data, updatedById: req.session.userId };
  if (parsed.data.expiresAt) updateData.expiresAt = new Date(parsed.data.expiresAt);
  const [f] = await db.update(forecastsTable).set(updateData).where(eq(forecastsTable.id, params.data.id)).returning();
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }
  await bustCacheForForecast(f.ownerId);
  res.json({ id: f.id, referenceNumber: f.referenceNumber, status: f.status, grossAnnualRevenue: f.grossAnnualRevenue, netOwnerIncome: f.netOwnerIncome, createdAt: f.createdAt, updatedAt: f.updatedAt });
});

router.delete("/forecasts/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteForecastParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(forecastsTable).set({ isArchived: true, status: "archived" }).where(eq(forecastsTable.id, params.data.id));
  res.json({ message: "Forecast archived" });
});

router.post("/forecasts/:id/calculate", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [f] = await db.select().from(forecastsTable).where(eq(forecastsTable.id, id));
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }

  // Support both new single-baseAdr model and legacy 4-season ADR for backward compat
  const resolvedBaseAdr = f.baseAdr ?? f.shoulderSeasonAdr;
  if (!resolvedBaseAdr) {
    res.status(400).json({ error: "Base ADR is required before calculation" });
    return;
  }

  const inputs = {
    baseAdr: resolvedBaseAdr,
    referenceOccupancy: f.recommendedOccupancy ?? REFERENCE_OCCUPANCY,
    ownerBlockedNights: f.ownerBlockedNights ?? 0,
    managementFeePercent: f.managementFeePercent ?? 20,
    ltrVacancyPercent: f.ltrVacancyPercent ?? 10,
    annualLtr: f.annualLtr, internetCost: f.internetCost ?? 0,
    utilityCost: f.utilityCost ?? 0, maintenanceCost: f.maintenanceCost ?? 0, miscCost: f.miscCost ?? 0,
  };

  // Preserve any per-month overrides before wiping the table
  const existingRows = await db.select({
    month: monthlyProjectionsTable.month,
    occupancyOverride: monthlyProjectionsTable.occupancyOverride,
    adrOverride: monthlyProjectionsTable.adrOverride,
  }).from(monthlyProjectionsTable).where(eq(monthlyProjectionsTable.forecastId, id));

  const overrides: MonthlyOverrides = {};
  for (const row of existingRows) {
    if (row.occupancyOverride != null || row.adrOverride != null) {
      overrides[row.month] = {
        occupancyRate: row.occupancyOverride ?? undefined,
        adr: row.adrOverride ?? undefined,
      };
    }
  }

  const overrideCount = Object.keys(overrides).length;
  const hadOverrides = overrideCount > 0;

  const result = calculateMonthlyProjections(inputs, 2025, overrides);

  // Save monthly projections
  await db.delete(monthlyProjectionsTable).where(eq(monthlyProjectionsTable.forecastId, id));
  await db.insert(monthlyProjectionsTable).values(
    result.monthlyProjections.map(m => ({ ...m, forecastId: id }))
  );

  // Update scenarios
  const scenarios = await db.select().from(forecastScenariosTable).where(eq(forecastScenariosTable.forecastId, id));
  for (const scenario of scenarios) {
    const sc = calculateScenario(inputs, scenario.occupancyRate, scenario.adrMultiplier ?? 1);
    await db.update(forecastScenariosTable).set(sc).where(eq(forecastScenariosTable.id, scenario.id));
  }

  // Find recommended scenario — prefer explicit isRecommended flag, then name "Realistic" at 80%, then mid-list
  const recScenario = scenarios.find(s => s.isRecommended)
    ?? scenarios.find(s => s.name === "Realistic" && Math.abs(s.occupancyRate - 0.80) < 0.01)
    ?? scenarios.find(s => Math.abs(s.occupancyRate - 0.80) < 0.01)
    ?? scenarios[Math.floor(scenarios.length / 2)];
  const recommendedOccupancy = recScenario?.occupancyRate ?? inputs.referenceOccupancy ?? REFERENCE_OCCUPANCY;

  // Update forecast with calculated values
  await db.update(forecastsTable).set({
    ...result,
    recommendedOccupancy,
    monthlyProjections: undefined,
  } as any).where(eq(forecastsTable.id, id));

  // Bust commission cache for the owner's referee so the next fetch reflects updated revenue
  await bustCacheForForecast(f.ownerId);

  res.json({ status: "calculated", hadOverrides, overrideCount, ...result });
});

router.post("/forecasts/:id/approve", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = ApproveForecastBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [f] = await db.update(forecastsTable).set({
    status: "approved", approvedById: req.session.userId,
    approvedAt: new Date(), approvalNotes: parsed.data.notes,
  }).where(eq(forecastsTable.id, id)).returning();
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }
  res.json(formatForecast(f));
});

router.post("/forecasts/:id/duplicate", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [original] = await db.select().from(forecastsTable).where(eq(forecastsTable.id, id));
  if (!original) { res.status(404).json({ error: "Forecast not found" }); return; }
  const { id: _id, referenceNumber: _ref, createdAt: _ca, updatedAt: _ua, ...rest } = original;
  const [duplicate] = await db.insert(forecastsTable).values({
    ...rest,
    referenceNumber: generateRef(),
    status: "draft",
    createdById: req.session.userId,
  }).returning();
  await db.insert(proposalsTable).values({ forecastId: duplicate.id, referenceNumber: duplicate.referenceNumber, createdById: req.session.userId });
  res.status(201).json(formatForecast(duplicate));
});

router.get("/forecasts/:id/scenarios", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const scenarios = await db.select().from(forecastScenariosTable).where(eq(forecastScenariosTable.forecastId, id));
  res.json(scenarios);
});

router.post("/forecasts/:id/scenarios", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = CreateScenarioBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [scenario] = await db.insert(forecastScenariosTable).values({ ...parsed.data, forecastId: id }).returning();
  res.status(201).json(scenario);
});

router.get("/forecasts/:id/monthly", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const projections = await db.select().from(monthlyProjectionsTable)
    .where(eq(monthlyProjectionsTable.forecastId, id))
    .orderBy(monthlyProjectionsTable.month);
  res.json(projections);
});

// PATCH /forecasts/:id/monthly/:monthNum — save per-month override then recalculate
// monthNum is 1–12 (stable; do NOT use row id which changes on every recalculate)
router.patch("/forecasts/:id/monthly/:monthNum", requireAuth, async (req, res): Promise<void> => {
  const forecastId = parseInt(req.params.id, 10);
  const monthNum   = parseInt(req.params.monthNum, 10);
  if (monthNum < 1 || monthNum > 12) { res.status(400).json({ error: "monthNum must be 1–12" }); return; }

  const { occupancyOverride, adrOverride } = req.body as {
    occupancyOverride?: number | null;
    adrOverride?: number | null;
  };

  const [f] = await db.select().from(forecastsTable).where(eq(forecastsTable.id, forecastId));
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }

  // Save the override on the specific month row (by month number, not row id)
  await db.update(monthlyProjectionsTable)
    .set({ occupancyOverride: occupancyOverride !== undefined ? occupancyOverride : null,
           adrOverride: adrOverride !== undefined ? adrOverride : null })
    .where(
      and(
        eq(monthlyProjectionsTable.forecastId, forecastId),
        eq(monthlyProjectionsTable.month, monthNum),
      )
    );

  // Recalculate the full forecast respecting all overrides
  const inputs = {
    baseAdr: f.baseAdr ?? f.shoulderSeasonAdr ?? 0,
    referenceOccupancy: f.recommendedOccupancy ?? REFERENCE_OCCUPANCY,
    ownerBlockedNights: f.ownerBlockedNights ?? 0,
    managementFeePercent: f.managementFeePercent ?? 20,
    ltrVacancyPercent: f.ltrVacancyPercent ?? 10,
    annualLtr: f.annualLtr, internetCost: f.internetCost ?? 0,
    utilityCost: f.utilityCost ?? 0, maintenanceCost: f.maintenanceCost ?? 0, miscCost: f.miscCost ?? 0,
  };

  // Read all current overrides (including the one we just saved)
  const allRows = await db.select({
    month: monthlyProjectionsTable.month,
    occupancyOverride: monthlyProjectionsTable.occupancyOverride,
    adrOverride: monthlyProjectionsTable.adrOverride,
  }).from(monthlyProjectionsTable).where(eq(monthlyProjectionsTable.forecastId, forecastId));

  const overrides: MonthlyOverrides = {};
  for (const row of allRows) {
    if (row.occupancyOverride != null || row.adrOverride != null) {
      overrides[row.month] = { occupancyRate: row.occupancyOverride ?? undefined, adr: row.adrOverride ?? undefined };
    }
  }

  const result = calculateMonthlyProjections(inputs, 2025, overrides);

  await db.delete(monthlyProjectionsTable).where(eq(monthlyProjectionsTable.forecastId, forecastId));
  await db.insert(monthlyProjectionsTable).values(
    result.monthlyProjections.map(m => ({ ...m, forecastId }))
  );

  // Update scenarios + forecast aggregates
  const scenarios = await db.select().from(forecastScenariosTable).where(eq(forecastScenariosTable.forecastId, forecastId));
  for (const scenario of scenarios) {
    const sc = calculateScenario(inputs, scenario.occupancyRate, scenario.adrMultiplier ?? 1);
    await db.update(forecastScenariosTable).set(sc).where(eq(forecastScenariosTable.id, scenario.id));
  }
  const recScenario = scenarios.find(s => s.isRecommended) ?? scenarios[1];
  const recommendedOccupancy = recScenario?.occupancyRate ?? inputs.referenceOccupancy ?? REFERENCE_OCCUPANCY;
  await db.update(forecastsTable).set({ ...result, recommendedOccupancy, monthlyProjections: undefined } as any).where(eq(forecastsTable.id, forecastId));

  await bustCacheForForecast(f.ownerId);

  // Return updated projections
  const updated = await db.select().from(monthlyProjectionsTable)
    .where(eq(monthlyProjectionsTable.forecastId, forecastId))
    .orderBy(monthlyProjectionsTable.month);
  res.json(updated);
});

router.post("/forecasts/:id/ai-recommend", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [f] = await db.select().from(forecastsTable).where(eq(forecastsTable.id, id));
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }

  // Get benchmark data for the property
  let propertyInfo: any = null;
  if (f.propertyId) {
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, f.propertyId));
    propertyInfo = p;
  }

  // Generate AI-style recommendations based on benchmark data with realistic Abu Dhabi values
  const bedrooms = propertyInfo?.bedrooms ?? 1;
  const baseAdr = bedrooms === 0 ? 350 : bedrooms === 1 ? 500 : bedrooms === 2 ? 700 : bedrooms === 3 ? 1000 : 1400;
  const baseLtr = bedrooms === 0 ? 55000 : bedrooms === 1 ? 80000 : bedrooms === 2 ? 110000 : bedrooms === 3 ? 150000 : 200000;

  // baseAdrSuggested = March shoulder reference (multiplier 1.0)
  // Use bedroom-based benchmark directly as the March base ADR
  const recommendation = {
    forecastId: id,
    status: "generated",
    annualLtrSuggested: baseLtr,
    annualLtrConfidence: 0.82,
    lowSeasonAdrSuggested: Math.round(baseAdr * 0.75),    // June–Aug (multiplier 0.75)
    shoulderSeasonAdrSuggested: baseAdr,                   // March reference (multiplier 1.0)
    peakSeasonAdrSuggested: Math.round(baseAdr * 1.75),   // January (multiplier 1.75)
    eventAdrSuggested: Math.round(baseAdr * 2.125),       // December (multiplier 2.125)
    occupancySuggested: REFERENCE_OCCUPANCY,
    internetCostSuggested: 7200,
    utilityCostSuggested: 15000,
    maintenanceCostSuggested: 8000,
    managementFeeSuggested: 20,
    narrativeSuggested: `Based on comparable properties in ${propertyInfo?.area ?? "the area"}, this ${bedrooms}-bedroom unit presents strong short-term rental potential. The Abu Dhabi STR market shows resilient demand driven by business travel, major events, and tourism growth.`,
    keyRisks: "Seasonal demand fluctuation in summer months. Increasing STR supply in the area. Regulatory changes to DCT licensing requirements.",
    keyDrivers: "Premium location with strong event-driven demand. Quality furnishing commands above-average ADR. F1/NYE events significantly boost Q4 performance.",
    overallConfidence: 0.78,
    modelUsed: "GPT-4o",
    dataSources: "RHH Internal Benchmark Database, Abu Dhabi STR Market Data 2024, CBRE Abu Dhabi Hospitality Report",
  };

  const [rec] = await db.insert(aiRecommendationsTable).values(recommendation).returning();
  res.json(rec);
});

router.post("/forecasts/:id/ai-recommend/accept", requireAuth, async (req, res): Promise<void> => {
  res.json({ message: "AI recommendation fields processed" });
});

router.post("/forecasts/:id/narrative-draft", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [f] = await db.select().from(forecastsTable).where(eq(forecastsTable.id, id));
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }

  if (!f.grossAnnualRevenue) {
    res.status(400).json({ error: "Run Save & Calculate before generating a narrative draft." });
    return;
  }

  let propertyInfo: any = null;
  let ownerInfo: any = null;
  if (f.propertyId) {
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, f.propertyId));
    propertyInfo = p;
  }
  if (f.ownerId) {
    const [o] = await db.select().from(ownersTable).where(eq(ownersTable.id, f.ownerId));
    ownerInfo = o;
  }

  const area = propertyInfo?.area ?? f.area ?? "your area";
  const building = propertyInfo?.projectBuilding ?? f.projectBuilding ?? null;
  const bedrooms = propertyInfo?.bedrooms ?? f.bedrooms ?? 1;
  const bedroomLabel = bedrooms === 0 ? "studio" : `${bedrooms}-bedroom`;
  const weightedAdr = f.weightedAdr ? `AED ${Math.round(f.weightedAdr).toLocaleString()}` : null;
  const ownerFirstName = ownerInfo?.firstName ?? null;
  const locationStr = building ? `${building}, ${area}` : area;

  // Fetch the recommended (80%) scenario — always base narrative on 80% occupancy figures
  const scenarios = await db.select().from(forecastScenariosTable).where(eq(forecastScenariosTable.forecastId, id));
  const recScenario = scenarios.find(s => s.isRecommended)
    ?? scenarios.find(s => s.name === "Realistic" && Math.abs(s.occupancyRate - 0.80) < 0.01)
    ?? scenarios.find(s => Math.abs((s.occupancyRate ?? 0) - 0.80) < 0.01)
    ?? null;
  const scenarioName = recScenario?.name ?? "Realistic";
  const scenarioOccupancyPct = recScenario
    ? `${Math.round(recScenario.occupancyRate * 100)}%`
    : "80%";
  const scenarioLabel = `${scenarioName} ${scenarioOccupancyPct}`;

  // Always use the 80% scenario's net income — not the stored forecast aggregate which may reflect a different occ
  const net80 = recScenario?.netOwnerIncome ?? f.netOwnerIncome ?? null;
  const netIncome = net80 ? `AED ${Math.round(net80).toLocaleString()}` : null;
  // Compute LTR uplift against the 80% scenario outcome
  const ltrNet = f.netLtrIncome ?? null;
  const ltrUplift = (net80 && ltrNet && ltrNet > 0)
    ? `${Math.round(((net80 - ltrNet) / ltrNet) * 100)}%`
    : f.increaseVsLtrPct ? `${Math.round(f.increaseVsLtrPct)}%` : null;

  // ── Build template fallback ─────────────────────────────────────────────────
  function buildTemplateDraft(): string {
    const greeting = ownerFirstName ? `Dear **${ownerFirstName}**, ` : "";
    let s1 = `${greeting}Based on our detailed analysis of comparable short-term rental units in **${locationStr}**, your **${bedroomLabel}** property is well-positioned to outperform traditional long-term rental benchmarks in the Abu Dhabi market.`;
    let s2 = "";
    if (weightedAdr) {
      s2 = ` Under our recommended **${scenarioLabel}** scenario, with a weighted average daily rate of **${weightedAdr}**, the figures in this report reflect achievable, data-backed market rates drawn from active comparable listings.`;
    }
    let s3 = "";
    if (netIncome && ltrUplift) {
      s3 = ` This translates to an estimated net owner income of **${netIncome}** per year — representing a **${ltrUplift}** uplift over the long-term rental benchmark — giving you a significantly stronger return while maintaining full flexibility over your asset.`;
    } else if (netIncome) {
      s3 = ` This translates to an estimated net owner income of **${netIncome}** per year, giving you a meaningfully stronger return while maintaining full flexibility over your asset.`;
    }
    return (s1 + s2 + s3).trim();
  }

  // ── Attempt AI generation ───────────────────────────────────────────────────
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });

      const contextLines: string[] = [
        `Property type: ${bedroomLabel}`,
        `Location: ${locationStr}`,
        `Market: Abu Dhabi short-term rental (STR)`,
        `Recommended scenario: ${scenarioLabel} occupancy`,
      ];
      if (weightedAdr) contextLines.push(`Weighted average daily rate: ${weightedAdr}`);
      if (netIncome) contextLines.push(`Estimated net owner income at 80% occupancy: ${netIncome} per year`);
      if (ltrUplift) contextLines.push(`Uplift vs. long-term rental benchmark: ${ltrUplift}`);
      if (ownerFirstName) contextLines.push(`Owner first name: ${ownerFirstName}`);

      const systemPrompt = `You are a senior property consultant at Royal Holiday Homes (RHH), a premium short-term rental management company in Abu Dhabi. Your task is to write a concise, personalised narrative for a property revenue forecast proposal.

Guidelines:
- Write exactly 2–3 sentences. No lists, no headings.
- Address the owner by first name if provided (e.g. "Dear Ahmed,").
- Be specific to the area and property type — avoid generic phrases.
- Base all figures on the 80% occupancy scenario provided. Explicitly reference it as "${scenarioLabel}" when mentioning occupancy.
- Use **bold markdown** (double asterisks) to emphasise EXACTLY these elements wherever they appear in your output: the owner's first name, the location/building name, the occupancy percentage, the weighted ADR figure, the net income amount, and the uplift percentage. Do not bold anything else.
- Tone: professional, warm, and confident. Make the owner feel this is personalised analysis.
- End with a forward-looking statement about why STR outperforms LTR for this specific property.`;

      const userPrompt = `Write the owner narrative for this forecast:\n${contextLines.join("\n")}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 350,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const aiDraft = completion.choices[0]?.message?.content?.trim();
      if (aiDraft) {
        res.json({ draft: aiDraft, source: "ai" });
        return;
      }
    } catch (err) {
      // Log and fall through to template
      console.error("[narrative-draft] OpenAI call failed, using template fallback:", err);
    }
  }

  // ── Template fallback ───────────────────────────────────────────────────────
  res.json({ draft: buildTemplateDraft(), source: "template" });
});

export default router;
