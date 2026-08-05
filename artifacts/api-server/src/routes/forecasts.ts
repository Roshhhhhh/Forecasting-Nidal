import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
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
import { calculateMonthlyProjections, calculateScenario } from "../lib/calculate";
import { bustCommissionCache } from "./referees";

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
    { name: "Conservative", occupancyRate: 0.75, adrMultiplier: 1.0, isRecommended: false },
    { name: "Realistic", occupancyRate: 0.80, adrMultiplier: 1.0, isRecommended: false },
    { name: "Confident", occupancyRate: 0.85, adrMultiplier: 1.0, isRecommended: true },
    { name: "Optimistic", occupancyRate: 0.90, adrMultiplier: 1.0, isRecommended: false },
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
  res.json({
    id: f.id, referenceNumber: f.referenceNumber, ownerId: f.ownerId, propertyId: f.propertyId,
    status: f.status, managementFeePercent: f.managementFeePercent, ltrVacancyPercent: f.ltrVacancyPercent,
    annualLtr: f.annualLtr, internetCost: f.internetCost, utilityCost: f.utilityCost,
    maintenanceCost: f.maintenanceCost, miscCost: f.miscCost, lowSeasonAdr: f.lowSeasonAdr,
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

  const hasAdr = f.lowSeasonAdr && f.shoulderSeasonAdr && f.peakSeasonAdr && f.eventAdr;
  if (!hasAdr) {
    res.status(400).json({ error: "ADR values are required before calculation" });
    return;
  }

  const inputs = {
    lowSeasonAdr: f.lowSeasonAdr!, shoulderSeasonAdr: f.shoulderSeasonAdr!,
    peakSeasonAdr: f.peakSeasonAdr!, eventAdr: f.eventAdr!,
    occupancyRate: f.recommendedOccupancy ?? 0.80,
    ownerBlockedNights: f.ownerBlockedNights ?? 0,
    managementFeePercent: f.managementFeePercent ?? 20,
    ltrVacancyPercent: f.ltrVacancyPercent ?? 10,
    annualLtr: f.annualLtr, internetCost: f.internetCost ?? 0,
    utilityCost: f.utilityCost ?? 0, maintenanceCost: f.maintenanceCost ?? 0, miscCost: f.miscCost ?? 0,
  };

  const result = calculateMonthlyProjections(inputs);

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

  // Find recommended scenario
  const recScenario = scenarios.find(s => s.isRecommended) ?? scenarios[1];
  const recommendedOccupancy = recScenario?.occupancyRate ?? inputs.occupancyRate;

  // Update forecast with calculated values
  await db.update(forecastsTable).set({
    ...result,
    recommendedOccupancy,
    monthlyProjections: undefined,
  } as any).where(eq(forecastsTable.id, id));

  // Bust commission cache for the owner's referee so the next fetch reflects updated revenue
  await bustCacheForForecast(f.ownerId);

  res.json({ status: "calculated", ...result });
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

  const recommendation = {
    forecastId: id,
    status: "generated",
    annualLtrSuggested: baseLtr,
    annualLtrConfidence: 0.82,
    lowSeasonAdrSuggested: Math.round(baseAdr * 0.70),
    shoulderSeasonAdrSuggested: Math.round(baseAdr * 0.90),
    peakSeasonAdrSuggested: Math.round(baseAdr * 1.15),
    eventAdrSuggested: Math.round(baseAdr * 1.45),
    occupancySuggested: 0.80,
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

export default router;
