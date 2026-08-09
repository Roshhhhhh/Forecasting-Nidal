import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, marketAreasTable, unitBenchmarksTable, companySettingsTable } from "@workspace/db";
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
import multer from "multer";
import * as XLSX from "xlsx";
import {
  getAllPortalCacheEntries,
  fetchPortalListingsWithCooldown,
} from "../lib/portalScraper";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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
    emirate: marketAreasTable.emirate,
    propertyType: unitBenchmarksTable.propertyType,
    bedrooms: unitBenchmarksTable.bedrooms,
    projectBuilding: unitBenchmarksTable.projectBuilding,
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

// ── Benchmark bulk import via XLSX ────────────────────────────────────────────
// Col layout: Area(0), Type(1), Status(2), Dev(3), Project(4),
//             STD ADR(5), STD LTR(6), 1BR ADR(7), 1BR LTR(8),
//             2BR ADR(9), 2BR LTR(10), 3BR ADR(11), 3BR LTR(12),
//             4BR ADR(13), 4BR LTR(14)
export const BENCHMARK_BEDROOM_COLS = [
  { bed: 0, adrCol: 5, ltrCol: 6 },
  { bed: 1, adrCol: 7, ltrCol: 8 },
  { bed: 2, adrCol: 9, ltrCol: 10 },
  { bed: 3, adrCol: 11, ltrCol: 12 },
  { bed: 4, adrCol: 13, ltrCol: 14 },
];

/**
 * Strictly parse a spreadsheet cell as a positive finite number.
 * Returns null for: NA, N/A, empty, non-numeric text, NaN, Infinity,
 * non-positive values (ADR/LTR must be > 0 to be meaningful).
 * Strips common locale decorators (spaces, commas) before parsing.
 */
export function parseRateCell(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (/^n\/?a$/i.test(s)) return null;          // NA, N/A
  const cleaned = s.replace(/[\s,]/g, "");       // strip space-thousands and comma-thousands
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

router.post(
  "/market/benchmarks/import",
  requireAuth,
  requireRole("super_admin", "admin", "revenue_manager"),
  upload.single("file"),
  async (req, res): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      // Parse workbook from buffer
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = wb.SheetNames.find((n: string) => n.includes("(2)")) ?? wb.SheetNames[1] ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Filter out header/empty rows
      const dataRows = raw.filter((row: any[]) =>
        row[0] && typeof row[0] === "string" && row[0].trim() !== "" &&
        !["area", "price", "main"].some((k: string) => row[0].toLowerCase().startsWith(k))
      );

      if (dataRows.length === 0) {
        res.status(422).json({ error: "No data rows found. Check the file uses the correct sheet and column layout." });
        return;
      }

      // Load existing areas and benchmarks outside the transaction (read-only snapshot)
      const existingAreas = await db.select().from(marketAreasTable);
      const areaMap = new Map<string, typeof existingAreas[0]>();
      for (const a of existingAreas) {
        areaMap.set(`${(a.area ?? "").toLowerCase()}|||${(a.projectBuilding ?? "").toLowerCase()}`, a);
      }

      const existingBenchmarks = await db.select().from(unitBenchmarksTable);
      const benchMap = new Map<string, number>(); // "marketAreaId:propertyType:bedrooms" → id
      for (const b of existingBenchmarks) {
        benchMap.set(`${b.marketAreaId}:${(b.propertyType ?? "").toLowerCase()}:${b.bedrooms}`, b.id);
      }

      let areasCreated = 0;
      let benchmarksInserted = 0;
      let benchmarksUpdated = 0;
      let skipped = 0;

      // All DB mutations run inside a single transaction so partial failures roll back
      const importedAt = await db.transaction(async (tx) => {
        for (const row of dataRows) {
          const area = String(row[0] ?? "").trim();
          const propertyType = String(row[1] ?? "Apartment").trim();
          const projectStatus = String(row[2] ?? "").trim() || null;
          const developer = String(row[3] ?? "").trim() || null;
          const project = String(row[4] ?? "").trim();
          if (!area || !project) { skipped++; continue; }

          const areaKey = `${area.toLowerCase()}|||${project.toLowerCase()}`;
          let areaRecord = areaMap.get(areaKey);

          if (!areaRecord) {
            const [created] = await tx
              .insert(marketAreasTable)
              .values({
                area,
                projectBuilding: project,
                emirate: "Abu Dhabi",
                developer: developer ?? undefined,
                projectStatus: projectStatus ?? undefined,
                createdById: req.session.userId,
              })
              .returning();
            areaRecord = created;
            areaMap.set(areaKey, created);
            areasCreated++;
          } else if (developer || projectStatus) {
            // Fill in missing developer/status metadata on existing areas
            const updates: Record<string, string> = {};
            if (developer && !areaRecord.developer) updates.developer = developer;
            if (projectStatus && !areaRecord.projectStatus) updates.projectStatus = projectStatus;
            if (Object.keys(updates).length > 0) {
              await tx.update(marketAreasTable).set(updates).where(eq(marketAreasTable.id, areaRecord.id));
              areaRecord = { ...areaRecord, ...updates };
              areaMap.set(areaKey, areaRecord);
            }
          }

          for (const { bed, adrCol, ltrCol } of BENCHMARK_BEDROOM_COLS) {
            const adr = parseRateCell(row[adrCol]);
            const ltr = parseRateCell(row[ltrCol]);
            if (adr === null && ltr === null) continue; // no valid rate data for this bedroom type

            const bKey = `${areaRecord.id}:${propertyType.toLowerCase()}:${bed}`;
            const existingId = benchMap.get(bKey);

            const values = {
              marketAreaId: areaRecord.id,
              propertyType,
              bedrooms: bed,
              typicalAdr: adr,
              shoulderSeasonAdr: adr,
              annualLtr: ltr,
              expectedOccupancy: 75,
              isActive: true as const,
              confidenceLevel: "medium",
              notes: "AUH Areas market data import",
              projectBuilding: project,
              createdById: req.session.userId,
            };

            if (existingId) {
              await tx.update(unitBenchmarksTable)
                .set({ ...values, updatedAt: new Date() } as any)
                .where(eq(unitBenchmarksTable.id, existingId));
              benchmarksUpdated++;
            } else {
              const [inserted] = await tx.insert(unitBenchmarksTable).values(values).returning();
              benchMap.set(bKey, inserted.id); // bKey already includes propertyType
              benchmarksInserted++;
            }
          }
        }

        // Record the import timestamp — inside the transaction so it only persists on success
        const now = new Date();
        const summary = `Updated ${benchmarksUpdated}, added ${benchmarksInserted} new, created ${areasCreated} area${areasCreated !== 1 ? "s" : ""}.`;
        const settings = await tx.query.companySettingsTable.findFirst();
        if (settings) {
          await tx.update(companySettingsTable).set({
            lastBenchmarkImportAt: now,
            lastBenchmarkImportSummary: summary,
          } as any);
        } else {
          await tx.insert(companySettingsTable).values({
            lastBenchmarkImportAt: now,
            lastBenchmarkImportSummary: summary,
          } as any);
        }
        return now;
      });

      res.json({ areasCreated, benchmarksInserted, benchmarksUpdated, skipped, importedAt });
    } catch (err: any) {
      res.status(500).json({ error: err.message ?? "Import failed" });
    }
  }
);

// ── Portal Data ───────────────────────────────────────────────────────────────

/** GET /market/portal/cache-status — return all non-expired portal cache entries */
router.get(
  "/market/portal/cache-status",
  requireAuth,
  requireRole("super_admin", "admin", "revenue_manager"),
  async (_req, res): Promise<void> => {
    res.json(await getAllPortalCacheEntries());
  },
);

/** POST /market/portal/refresh-all — re-fetch portal listings for every known area+bedroom combo */
router.post(
  "/market/portal/refresh-all",
  requireAuth,
  requireRole("super_admin", "admin", "revenue_manager"),
  async (_req, res): Promise<void> => {
    // Build the unique (area_name, bedrooms) combos from our benchmark table
    const benchmarks = await db
      .select({
        area:     marketAreasTable.area,
        bedrooms: unitBenchmarksTable.bedrooms,
      })
      .from(unitBenchmarksTable)
      .leftJoin(marketAreasTable, eq(unitBenchmarksTable.marketAreaId, marketAreasTable.id));

    const combos = new Map<string, { area: string; bedrooms: number }>();
    for (const b of benchmarks) {
      if (!b.area) continue;
      const key = `${b.area.toLowerCase()}:${b.bedrooms}`;
      combos.set(key, { area: b.area, bedrooms: b.bedrooms });
    }

    if (combos.size === 0) {
      res.json({ attempted: 0, succeeded: 0, failed: 0, cooldownSkipped: 0, results: [] });
      return;
    }

    // Fan out all fetches concurrently — each call respects its own cooldown
    const settled = await Promise.allSettled(
      Array.from(combos.values()).map(async ({ area, bedrooms }) => {
        const { result, cooldownActive } = await fetchPortalListingsWithCooldown(area, bedrooms);
        return { area, bedrooms, result, cooldownActive };
      }),
    );

    let succeeded = 0;
    let failed = 0;
    let cooldownSkipped = 0;
    const results: Array<{
      area: string;
      bedrooms: number;
      status: "success" | "failed" | "cooldown";
      fetchedAt?: string;
      sources?: string[];
    }> = [];

    for (const s of settled) {
      if (s.status === "rejected") {
        failed++;
        continue;
      }
      const { area, bedrooms, result, cooldownActive } = s.value;
      if (cooldownActive) {
        cooldownSkipped++;
        results.push({ area, bedrooms, status: "cooldown", fetchedAt: result?.fetchedAt, sources: result?.sources });
      } else if (result) {
        succeeded++;
        results.push({ area, bedrooms, status: "success", fetchedAt: result.fetchedAt, sources: result.sources });
      } else {
        failed++;
        results.push({ area, bedrooms, status: "failed" });
      }
    }

    res.json({
      attempted:      combos.size,
      succeeded,
      failed,
      cooldownSkipped,
      results,
    });
  },
);

export default router;
