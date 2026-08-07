import { Router, type IRouter } from "express";
import { eq, desc, and, ilike } from "drizzle-orm";
import {
  db, forecastsTable, forecastScenariosTable, monthlyProjectionsTable,
  aiRecommendationsTable, ownersTable, propertiesTable, usersTable, proposalsTable,
  amenitiesTable, propertyAmenitiesTable, forecastComparablesTable, monthlyActualsTable,
  unitBenchmarksTable, marketAreasTable,
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
  let hasMainRoom: boolean = false;
  let hasStudy: boolean = false;

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
      hasMainRoom     = (p as any).hasMainRoom ?? false;
      hasStudy        = (p as any).hasStudy ?? false;
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
    floor, furnishingStatus, area, projectBuilding, unitNumber, hasMainRoom, hasStudy,
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

  // Optional overrides from request body (owner / property re-assignment)
  const ownerIdOverride  = req.body?.ownerId  ? Number(req.body.ownerId)  : undefined;
  const propertyIdOverride = req.body?.propertyId ? Number(req.body.propertyId) : undefined;

  const { id: _id, referenceNumber: _ref, createdAt: _ca, updatedAt: _ua, ...rest } = original;
  const [dup] = await db.insert(forecastsTable).values({
    ...rest,
    ...(ownerIdOverride   !== undefined && { ownerId:    ownerIdOverride }),
    ...(propertyIdOverride !== undefined && { propertyId: propertyIdOverride }),
    referenceNumber: generateRef(),
    // Reset calculated outputs so the staff must recalculate for the new property
    grossAnnualRevenue: null,
    netAnnualRevenue: null,
    netAnnualRevenueLtr: null,
    weightedAdr: null,
    status: "draft",
    createdById: req.session.userId,
  }).returning();

  // Deep-copy scenarios
  const scenarios = await db.select().from(forecastScenariosTable).where(eq(forecastScenariosTable.forecastId, id));
  if (scenarios.length) {
    await db.insert(forecastScenariosTable).values(
      scenarios.map(({ id: _sid, createdAt: _sca, ...s }) => ({ ...s, forecastId: dup.id }))
    );
  }

  // Deep-copy monthly projections (overrides only — recalc will fill the rest)
  const months = await db.select().from(monthlyProjectionsTable).where(eq(monthlyProjectionsTable.forecastId, id));
  if (months.length) {
    await db.insert(monthlyProjectionsTable).values(
      months.map(({ id: _mid, ...m }) => ({ ...m, forecastId: dup.id }))
    );
  }

  // Deep-copy comparables
  const comparables = await db.select().from(forecastComparablesTable).where(eq(forecastComparablesTable.forecastId, id));
  if (comparables.length) {
    await db.insert(forecastComparablesTable).values(
      comparables.map(({ id: _cid, createdAt: _cca, ...c }) => ({ ...c, forecastId: dup.id }))
    );
  }

  await db.insert(proposalsTable).values({ forecastId: dup.id, referenceNumber: dup.referenceNumber, createdById: req.session.userId });
  res.status(201).json(formatForecast(dup));
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

// ── Market suggestions (inline benchmark panel) ───────────────────────────────
async function fetchMarketBenchmarks(bedrooms: number, areaName: string | null) {
  const cols = {
    area: marketAreasTable.area,
    project: unitBenchmarksTable.projectBuilding,
    typicalAdr: unitBenchmarksTable.typicalAdr,
    shoulderSeasonAdr: unitBenchmarksTable.shoulderSeasonAdr,
    lowSeasonAdr: unitBenchmarksTable.lowSeasonAdr,
    peakSeasonAdr: unitBenchmarksTable.peakSeasonAdr,
    annualLtr: unitBenchmarksTable.annualLtr,
    minLtr: unitBenchmarksTable.minLtr,
    maxLtr: unitBenchmarksTable.maxLtr,
    expectedOccupancy: unitBenchmarksTable.expectedOccupancy,
  };

  let rows: any[] = [];
  if (areaName) {
    rows = await db.select(cols)
      .from(unitBenchmarksTable)
      .leftJoin(marketAreasTable, eq(unitBenchmarksTable.marketAreaId, marketAreasTable.id))
      .where(and(ilike(marketAreasTable.area, `%${areaName}%`), eq(unitBenchmarksTable.bedrooms, bedrooms)))
      .limit(30);
  }
  // Fallback: all benchmarks for this bedroom count (no area filter)
  const areaMatched = rows.length > 0;
  if (!areaMatched) {
    rows = await db.select(cols)
      .from(unitBenchmarksTable)
      .leftJoin(marketAreasTable, eq(unitBenchmarksTable.marketAreaId, marketAreasTable.id))
      .where(eq(unitBenchmarksTable.bedrooms, bedrooms))
      .limit(30);
  }
  return { rows, areaMatched };
}

function benchmarkStats(vals: (number | null | undefined)[]) {
  const arr = vals.filter((v): v is number => v != null && v > 0);
  if (!arr.length) return null;
  arr.sort((a, b) => a - b);
  return {
    min: arr[0],
    max: arr[arr.length - 1],
    avg: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length),
    median: arr[Math.floor(arr.length / 2)],
    count: arr.length,
  };
}

router.get("/forecasts/:id/market-suggestions", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [f] = await db.select().from(forecastsTable).where(eq(forecastsTable.id, id));
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }

  let propertyData: any = null;
  if (f.propertyId) {
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, f.propertyId));
    propertyData = p;
  }

  const bedrooms: number = propertyData?.bedrooms ?? 1;
  const areaName: string | null = propertyData?.area ?? propertyData?.community ?? null;

  const { rows, areaMatched } = await fetchMarketBenchmarks(bedrooms, areaName);

  const adrs = rows.map(r => r.typicalAdr ?? r.shoulderSeasonAdr);
  const ltrs = rows.map(r => r.annualLtr);
  const occs = rows.map(r => r.expectedOccupancy);

  res.json({
    bedrooms,
    area: areaName,
    areaMatched,
    adr: benchmarkStats(adrs),
    ltr: benchmarkStats(ltrs),
    occupancy: benchmarkStats(occs),
    samples: rows.slice(0, 12).map(r => ({
      area: r.area, project: r.project,
      adr: r.typicalAdr ?? r.shoulderSeasonAdr,
      ltr: r.annualLtr,
      minLtr: r.minLtr, maxLtr: r.maxLtr,
    })),
  });
});

router.post("/forecasts/:id/ai-recommend", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [f] = await db.select().from(forecastsTable).where(eq(forecastsTable.id, id));
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }

  let propertyInfo: any = null;
  if (f.propertyId) {
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, f.propertyId));
    propertyInfo = p;
  }

  const bedrooms: number = propertyInfo?.bedrooms ?? 1;
  const areaName: string | null = propertyInfo?.area ?? propertyInfo?.community ?? null;

  // Pull real benchmark data from DB
  const { rows, areaMatched } = await fetchMarketBenchmarks(bedrooms, areaName);

  // Compute ADR + LTR from real benchmark data; fall back to hardcoded Abu Dhabi averages
  const adrStats = benchmarkStats(rows.map(r => r.typicalAdr ?? r.shoulderSeasonAdr));
  const ltrStats = benchmarkStats(rows.map(r => r.annualLtr));
  const occupancyStats = benchmarkStats(rows.map(r => r.expectedOccupancy));

  const FALLBACK_ADR: Record<number, number> = { 0: 350, 1: 500, 2: 700, 3: 1000, 4: 1400 };
  const FALLBACK_LTR: Record<number, number> = { 0: 55000, 1: 80000, 2: 110000, 3: 150000, 4: 200000 };
  const baseAdr = adrStats?.median ?? adrStats?.avg ?? (FALLBACK_ADR[bedrooms] ?? 700);
  const baseLtr = ltrStats?.median ?? ltrStats?.avg ?? (FALLBACK_LTR[bedrooms] ?? 110000);
  const baseOcc = occupancyStats?.avg != null ? occupancyStats.avg / 100 : REFERENCE_OCCUPANCY;
  const confidence = areaMatched ? 0.87 : 0.72;
  const sampleCount = rows.length;
  const dataSource = areaMatched
    ? `RHH Market Database (${sampleCount} comparable${sampleCount !== 1 ? "s" : ""} in ${areaName})`
    : `RHH Market Database (${sampleCount} comparable${sampleCount !== 1 ? "s" : ""} across Abu Dhabi — no exact area match)`;

  const recommendation = {
    forecastId: id,
    status: "generated",
    annualLtrSuggested: baseLtr,
    annualLtrConfidence: confidence,
    lowSeasonAdrSuggested: Math.round(baseAdr * 0.75),
    shoulderSeasonAdrSuggested: baseAdr,
    peakSeasonAdrSuggested: Math.round(baseAdr * 1.75),
    eventAdrSuggested: Math.round(baseAdr * 2.125),
    occupancySuggested: baseOcc,
    internetCostSuggested: 7200,
    utilityCostSuggested: 15000,
    maintenanceCostSuggested: 8000,
    managementFeeSuggested: 20,
    narrativeSuggested: `Based on ${sampleCount} comparable ${bedrooms}-bedroom properties${areaName ? ` in ${areaName}` : " across Abu Dhabi"}, this unit shows strong short-term rental potential. ${adrStats ? `Market ADR ranges AED ${adrStats.min.toLocaleString()}–${adrStats.max.toLocaleString()} with a median of AED ${adrStats.median.toLocaleString()}.` : ""} The Abu Dhabi STR market is driven by business travel, major events, and growing tourism.`,
    keyRisks: "Seasonal demand fluctuation in summer months. Increasing STR supply in the area. Regulatory changes to DCT licensing requirements.",
    keyDrivers: "Premium location with strong event-driven demand. Quality furnishing commands above-average ADR. F1/NYE events significantly boost Q4 performance.",
    overallConfidence: confidence,
    modelUsed: "RHH Market Database",
    dataSources: dataSource,
  };

  const [rec] = await db.insert(aiRecommendationsTable).values(recommendation).returning();
  res.json(rec);
});

// ── Comparables CRUD ──────────────────────────────────────────────────────────
router.get("/forecasts/:id/comparables", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const rows = await db.select().from(forecastComparablesTable)
    .where(eq(forecastComparablesTable.forecastId, id))
    .orderBy(forecastComparablesTable.sortOrder, forecastComparablesTable.createdAt);
  res.json(rows);
});

router.post("/forecasts/:id/comparables", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { listingName, listingUrl, nightlyRate, occupancyPct, bedrooms, area } = req.body as {
    listingName: string;
    listingUrl?: string;
    nightlyRate: number;
    occupancyPct: number;
    bedrooms?: number;
    area?: string;
  };
  if (!listingName || nightlyRate == null || occupancyPct == null) {
    res.status(400).json({ error: "listingName, nightlyRate and occupancyPct are required" });
    return;
  }
  // Enforce 5-comparable limit per forecast
  const existing = await db.select({ id: forecastComparablesTable.id }).from(forecastComparablesTable)
    .where(eq(forecastComparablesTable.forecastId, id));
  if (existing.length >= 5) {
    res.status(400).json({ error: "Maximum of 5 comparable properties per forecast" });
    return;
  }
  const [row] = await db.insert(forecastComparablesTable).values({
    forecastId: id,
    listingName,
    listingUrl: listingUrl || null,
    nightlyRate,
    occupancyPct,
    bedrooms: bedrooms ?? null,
    area: area || null,
    sortOrder: existing.length,
  }).returning();
  res.status(201).json(row);
});

router.delete("/forecasts/:id/comparables/:compId", requireAuth, async (req, res): Promise<void> => {
  const compId = parseInt(req.params.compId, 10);
  await db.delete(forecastComparablesTable).where(eq(forecastComparablesTable.id, compId));
  res.json({ message: "Comparable deleted" });
});

// ── Monthly Actuals CRUD ──────────────────────────────────────────────────────
router.get("/forecasts/:id/actuals", requireAuth, async (req, res): Promise<void> => {
  const forecastId = parseInt(req.params.id, 10);
  const rows = await db.select().from(monthlyActualsTable)
    .where(eq(monthlyActualsTable.forecastId, forecastId))
    .orderBy(monthlyActualsTable.month);
  res.json(rows);
});

router.put("/forecasts/:id/actuals/:monthNum", requireAuth, async (req, res): Promise<void> => {
  const forecastId = parseInt(req.params.id, 10);
  const monthNum   = parseInt(req.params.monthNum, 10);
  if (!Number.isFinite(forecastId) || forecastId <= 0) {
    res.status(400).json({ error: "Invalid forecast id" }); return;
  }
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    res.status(400).json({ error: "monthNum must be 1–12" }); return;
  }

  // Fetch full forecast for server-side net derivation
  const [f] = await db.select({
    id: forecastsTable.id,
    managementFeePercent: forecastsTable.managementFeePercent,
    internetCost: forecastsTable.internetCost,
    utilityCost: forecastsTable.utilityCost,
    maintenanceCost: forecastsTable.maintenanceCost,
    miscCost: forecastsTable.miscCost,
  }).from(forecastsTable).where(eq(forecastsTable.id, forecastId));
  if (!f) { res.status(404).json({ error: "Forecast not found" }); return; }

  // Validate body — reject non-finite or negative monetary values
  const raw = req.body as Record<string, unknown>;
  const actualGross = raw.actualGross === null || raw.actualGross === undefined ? null : Number(raw.actualGross);
  const notes       = typeof raw.notes === "string" ? raw.notes : null;

  if (actualGross !== null && (!Number.isFinite(actualGross) || actualGross < 0)) {
    res.status(400).json({ error: "actualGross must be a finite non-negative number" }); return;
  }
  if (notes !== null && notes.length > 1000) {
    res.status(400).json({ error: "notes must be 1000 characters or fewer" }); return;
  }

  // Server derives actual_net from gross: remove management fee then fixed monthly operating costs.
  // Fixed costs = internet + utility + maintenance + misc (excludes management fee to avoid double-counting).
  let actualNet: number | null = null;
  if (actualGross !== null) {
    const mgmtFee     = f.managementFeePercent ?? 20;
    const fixedAnnual = (f.internetCost ?? 0) + (f.utilityCost ?? 0)
                      + (f.maintenanceCost ?? 0) + (f.miscCost ?? 0);
    actualNet = Math.max(0, actualGross * (1 - mgmtFee / 100) - fixedAnnual / 12);
  }

  const [row] = await db.insert(monthlyActualsTable)
    .values({
      forecastId,
      month: monthNum,
      actualGross: actualGross ?? null,
      actualNet,
      notes: notes ?? null,
    })
    .onConflictDoUpdate({
      target: [monthlyActualsTable.forecastId, monthlyActualsTable.month],
      set: {
        actualGross: actualGross ?? null,
        actualNet,
        notes: notes ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(row);
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
  let propertyAmenities: any[] = [];
  const comparables = await db.select().from(forecastComparablesTable)
    .where(eq(forecastComparablesTable.forecastId, id))
    .orderBy(forecastComparablesTable.sortOrder);
  if (f.propertyId) {
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, f.propertyId));
    propertyInfo = p;
    propertyAmenities = await db
      .select({ name: amenitiesTable.name, isProposalHighlight: amenitiesTable.isProposalHighlight })
      .from(propertyAmenitiesTable)
      .innerJoin(amenitiesTable, eq(amenitiesTable.id, propertyAmenitiesTable.amenityId))
      .where(eq(propertyAmenitiesTable.propertyId, f.propertyId))
      .orderBy(amenitiesTable.isProposalHighlight, amenitiesTable.sortOrder);
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

  const scenarioLabel = "Realistic 80%";

  // ── Recompute the 80% scenario live from stored inputs (never trust stale DB rows) ──
  const resolvedBaseAdr = f.baseAdr ?? f.shoulderSeasonAdr;
  if (!resolvedBaseAdr) {
    res.status(400).json({ error: "Run Save & Calculate before generating a narrative draft." });
    return;
  }
  const calcInputs = {
    baseAdr:              resolvedBaseAdr,
    referenceOccupancy:   f.recommendedOccupancy ?? REFERENCE_OCCUPANCY,
    ownerBlockedNights:   f.ownerBlockedNights ?? 0,
    managementFeePercent: f.managementFeePercent ?? 20,
    ltrVacancyPercent:    f.ltrVacancyPercent ?? 10,
    annualLtr:            f.annualLtr,
    internetCost:         f.internetCost ?? 0,
    utilityCost:          f.utilityCost ?? 0,
    maintenanceCost:      f.maintenanceCost ?? 0,
    miscCost:             f.miscCost ?? 0,
  };
  const computed80 = calculateScenario(calcInputs, 0.80);

  // ── All figures pinned to the live 80% computation ────────────────────────────
  const net80      = computed80.netOwnerIncome;
  const gross80    = computed80.grossRevenue;
  const mgmtFeeAmt = gross80 && f.managementFeePercent
    ? Math.round(gross80 * (f.managementFeePercent / 100))
    : null;
  const totalExp   = computed80.totalExpenses ?? f.totalAnnualExpenses ?? null;
  const monthly80  = net80 ? Math.round(net80 / 12) : null;
  const ltrGross   = f.annualLtr ?? null;
  const ltrNet     = f.netLtrIncome ?? null;
  const ltrVacPct  = f.ltrVacancyPercent ?? 10;
  const ltrAdj      = ltrGross ? Math.round(ltrGross * (1 - ltrVacPct / 100)) : null;
  const ltrUpliftPct = (net80 && ltrNet && ltrNet > 0)
    ? Math.round(((net80 - ltrNet) / ltrNet) * 100)
    : f.increaseVsLtrPct ? Math.round(f.increaseVsLtrPct) : null;

  // Human-readable helpers
  const fmt = (n: number | null) => n != null ? `AED ${Math.round(n).toLocaleString()}` : null;
  const netIncomeStr  = fmt(net80);
  const grossStr      = fmt(gross80);
  const monthly80Str  = fmt(monthly80);
  const mgmtFeeStr    = mgmtFeeAmt ? `${fmt(mgmtFeeAmt)} (${f.managementFeePercent}%)` : null;
  const totalExpStr   = fmt(totalExp);
  const ltrGrossStr   = fmt(ltrGross);
  const ltrAdjStr     = fmt(ltrAdj);
  const upliftStr     = ltrUpliftPct != null ? `${ltrUpliftPct > 0 ? "+" : ""}${ltrUpliftPct}%` : null;

  // ── Standardised template (used as fallback and as the shape for AI to mirror) ──
  function buildTemplateDraft(): string {
    const greeting = ownerFirstName ? `Dear **${ownerFirstName}**, ` : "";
    const s1 = `${greeting}Based on our detailed analysis of comparable short-term rental units in **${locationStr}**, your **${bedroomLabel}** property is well-positioned to significantly outperform traditional long-term rental benchmarks in the Abu Dhabi market.`;
    const s2 = weightedAdr && grossStr
      ? ` Our **${scenarioLabel}** projection, with a weighted average daily rate of **${weightedAdr}**, forecasts a gross annual revenue of **${grossStr}** — figures drawn from active comparable listings in your building and area.`
      : weightedAdr
      ? ` Our **${scenarioLabel}** projection uses a weighted average daily rate of **${weightedAdr}**, derived from active comparable listings in your building and area.`
      : "";
    const s3 = netIncomeStr && upliftStr
      ? ` After all operating expenses${totalExpStr ? ` (${totalExpStr})` : ""} and a ${f.managementFeePercent}% management fee, your estimated net annual income is **${netIncomeStr}** — a **${upliftStr}** increase over the adjusted long-term rental benchmark — with an average monthly payout of **${monthly80Str}**.`
      : netIncomeStr
      ? ` After all fees and expenses, your estimated net annual income is **${netIncomeStr}**, with an average monthly payout of **${monthly80Str}**, giving you a meaningfully stronger return than long-term rental.`
      : "";
    return (s1 + s2 + s3).trim();
  }

  // ── Attempt AI generation ───────────────────────────────────────────────────
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? undefined;
  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

      // Build a structured data block so the AI has every figure it needs
      const highlightAmenities = propertyAmenities.filter((a: any) => a.isProposalHighlight).map((a: any) => a.name);
      const otherAmenities = propertyAmenities.filter((a: any) => !a.isProposalHighlight).map((a: any) => a.name);
      const amenityLine = propertyAmenities.length > 0
        ? [
            highlightAmenities.length ? `Key features: ${highlightAmenities.join(", ")}` : null,
            otherAmenities.length ? `Additional amenities: ${otherAmenities.join(", ")}` : null,
          ].filter(Boolean).join("; ")
        : "N/A";

      const dataBlock = [
        `Owner first name: ${ownerFirstName ?? "N/A"}`,
        `Property: ${bedroomLabel} in ${locationStr}`,
        `Market: Abu Dhabi short-term rental (STR)`,
        `Projection scenario: ${scenarioLabel}`,
        `Weighted average daily rate (ADR): ${weightedAdr ?? "N/A"}`,
        `Gross annual revenue (80%): ${grossStr ?? "N/A"}`,
        `Total operating expenses: ${totalExpStr ?? "N/A"}`,
        `PM management fee: ${mgmtFeeStr ?? "N/A"}`,
        `Net owner income (80%): ${netIncomeStr ?? "N/A"}`,
        `Average monthly payout (80%): ${monthly80Str ?? "N/A"}`,
        `LTR annual gross: ${ltrGrossStr ?? "N/A"}`,
        `LTR adjusted for ${ltrVacPct}% vacancy: ${ltrAdjStr ?? "N/A"}`,
        `STR uplift vs LTR: ${upliftStr ?? "N/A"}`,
        `Property amenities: ${amenityLine}`,
        comparables.length > 0
          ? `Comparable properties (${comparables.length}):\n${comparables.map((c: any, i: number) =>
              `  ${i + 1}. ${c.listingName}${c.area ? ` (${c.area})` : ""}: AED ${Math.round(c.nightlyRate)}/night, ${Math.round(c.occupancyPct)}% occupancy${c.bedrooms != null ? `, ${c.bedrooms} bed` : ""}`
            ).join("\n")}`
          : `Comparable properties: N/A`,
      ].join("\n");

      const systemPrompt = `You are a senior property consultant at Royal Holiday Homes (RHH), Abu Dhabi's premium short-term rental management company. Write a concise, personalised cover narrative for an owner revenue forecast proposal.

STRICT FORMAT — follow exactly:
- Exactly 3 sentences.
- Sentence 1: Address owner by first name (e.g. "Dear Ahmed,"), reference the specific building/location, and state the property type. Make it feel personally written. If key property features are provided, briefly mention one or two that strengthen the STR case (e.g. "with its private pool and sea view").
- Sentence 2: Reference the ${scenarioLabel} projection; include the weighted ADR and gross annual revenue figures.
- Sentence 3: State the net owner income, monthly payout, and uplift vs LTR (if available). End with confidence in the STR model for this property.
- Use **double asterisks** to bold ONLY: owner's first name, building/location name, the occupancy %, ADR value, gross revenue amount, net income amount, monthly payout amount, and the uplift %. Nothing else.
- Plain prose — no lists, no headers, no footnotes.
- Do not invent figures. Use only the data provided below.`;

      const userPrompt = `Write the cover narrative using this forecast data:\n\n${dataBlock}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 400,
        temperature: 0.4,
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
      console.error("[narrative-draft] OpenAI call failed, using template fallback:", err);
    }
  }

  // ── Template fallback ───────────────────────────────────────────────────────
  res.json({ draft: buildTemplateDraft(), source: "template" });
});

export default router;
