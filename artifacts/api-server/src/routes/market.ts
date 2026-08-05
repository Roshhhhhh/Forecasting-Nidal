import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, marketAreasTable, unitBenchmarksTable } from "@workspace/db";
import {
  CreateMarketAreaBody,
  UpdateMarketAreaBody,
  UpdateMarketAreaParams,
  DeleteMarketAreaParams,
  CreateBenchmarkBody,
  UpdateBenchmarkBody,
  UpdateBenchmarkParams,
  DeleteBenchmarkParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

// Market Areas
router.get("/market/areas", requireAuth, async (_req, res): Promise<void> => {
  const areas = await db.select().from(marketAreasTable).orderBy(marketAreasTable.area);
  res.json(areas);
});

router.post("/market/areas", requireAuth, requireRole("super_admin", "admin", "revenue_manager"), async (req, res): Promise<void> => {
  const parsed = CreateMarketAreaBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [area] = await db.insert(marketAreasTable).values({ ...parsed.data, createdById: req.session.userId }).returning();
  res.status(201).json(area);
});

router.patch("/market/areas/:id", requireAuth, requireRole("super_admin", "admin", "revenue_manager"), async (req, res): Promise<void> => {
  const params = UpdateMarketAreaParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateMarketAreaBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [area] = await db.update(marketAreasTable).set(parsed.data).where(eq(marketAreasTable.id, params.data.id)).returning();
  if (!area) { res.status(404).json({ error: "Area not found" }); return; }
  res.json(area);
});

router.delete("/market/areas/:id", requireAuth, requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const params = DeleteMarketAreaParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(marketAreasTable).where(eq(marketAreasTable.id, params.data.id));
  res.json({ message: "Area deleted" });
});

// Benchmarks
router.get("/market/benchmarks", requireAuth, async (_req, res): Promise<void> => {
  const benchmarks = await db.select({
    id: unitBenchmarksTable.id,
    marketAreaId: unitBenchmarksTable.marketAreaId,
    area: marketAreasTable.area,
    projectBuilding: marketAreasTable.projectBuilding,
    propertyType: unitBenchmarksTable.propertyType,
    bedrooms: unitBenchmarksTable.bedrooms,
    typicalAdr: unitBenchmarksTable.typicalAdr,
    lowSeasonAdr: unitBenchmarksTable.lowSeasonAdr,
    shoulderSeasonAdr: unitBenchmarksTable.shoulderSeasonAdr,
    peakSeasonAdr: unitBenchmarksTable.peakSeasonAdr,
    eventAdr: unitBenchmarksTable.eventAdr,
    expectedOccupancy: unitBenchmarksTable.expectedOccupancy,
    annualLtr: unitBenchmarksTable.annualLtr,
    minLtr: unitBenchmarksTable.minLtr,
    maxLtr: unitBenchmarksTable.maxLtr,
    confidenceLevel: unitBenchmarksTable.confidenceLevel,
    sourceDate: unitBenchmarksTable.sourceDate,
    notes: unitBenchmarksTable.notes,
    isActive: unitBenchmarksTable.isActive,
  })
    .from(unitBenchmarksTable)
    .leftJoin(marketAreasTable, eq(unitBenchmarksTable.marketAreaId, marketAreasTable.id))
    .orderBy(marketAreasTable.area);
  res.json(benchmarks);
});

router.post("/market/benchmarks", requireAuth, requireRole("super_admin", "admin", "revenue_manager"), async (req, res): Promise<void> => {
  const parsed = CreateBenchmarkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [benchmark] = await db.insert(unitBenchmarksTable).values({ ...parsed.data, createdById: req.session.userId }).returning();
  res.status(201).json(benchmark);
});

router.patch("/market/benchmarks/:id", requireAuth, requireRole("super_admin", "admin", "revenue_manager"), async (req, res): Promise<void> => {
  const params = UpdateBenchmarkParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateBenchmarkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [benchmark] = await db.update(unitBenchmarksTable).set(parsed.data).where(eq(unitBenchmarksTable.id, params.data.id)).returning();
  if (!benchmark) { res.status(404).json({ error: "Benchmark not found" }); return; }
  res.json(benchmark);
});

router.delete("/market/benchmarks/:id", requireAuth, requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const params = DeleteBenchmarkParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(unitBenchmarksTable).where(eq(unitBenchmarksTable.id, params.data.id));
  res.json({ message: "Benchmark deleted" });
});

export default router;
