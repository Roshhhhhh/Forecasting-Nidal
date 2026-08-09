/**
 * Integration tests: benchmark import endpoint
 *
 * Tests cover:
 *   1. Valid import: upserts benchmarks, creates new areas, returns correct counts
 *   2. NA / N/A / empty cells → treated as null, row skipped when both ADR and LTR are null
 *   3. Locale-formatted numbers ("65 000", "1,200") → parsed correctly
 *   4. Invalid/non-numeric text → treated as null
 *   5. Negative/zero values → treated as null (not meaningful rates)
 *   6. parseRateCell unit checks
 *   7. Re-import (update path): existing benchmarks are updated, count reported correctly
 *   8. Upsert preserves untouched rows: rows absent from the file are not deleted
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import express, { type Application, type Request, type Response, type NextFunction } from "express";
import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db, marketAreasTable, unitBenchmarksTable } from "@workspace/db";
import marketRouter, { parseRateCell, BENCHMARK_BEDROOM_COLS } from "./market";

// ── parseRateCell unit tests ─────────────────────────────────────────────────

describe("parseRateCell", () => {
  it("returns null for NA (case-insensitive)", () => {
    expect(parseRateCell("NA")).toBeNull();
    expect(parseRateCell("na")).toBeNull();
    expect(parseRateCell("Na")).toBeNull();
  });

  it("returns null for N/A", () => {
    expect(parseRateCell("N/A")).toBeNull();
    expect(parseRateCell("n/a")).toBeNull();
  });

  it("returns null for empty / null / undefined", () => {
    expect(parseRateCell("")).toBeNull();
    expect(parseRateCell(null)).toBeNull();
    expect(parseRateCell(undefined)).toBeNull();
  });

  it("returns null for arbitrary non-numeric text", () => {
    expect(parseRateCell("TBD")).toBeNull();
    expect(parseRateCell("—")).toBeNull();
    expect(parseRateCell("n/a (no data)")).toBeNull();
  });

  it("returns null for zero and negative values", () => {
    expect(parseRateCell(0)).toBeNull();
    expect(parseRateCell(-100)).toBeNull();
    expect(parseRateCell("-500")).toBeNull();
  });

  it("returns null for NaN / Infinity", () => {
    expect(parseRateCell(NaN)).toBeNull();
    expect(parseRateCell(Infinity)).toBeNull();
    expect(parseRateCell("Infinity")).toBeNull();
  });

  it("parses plain numbers", () => {
    expect(parseRateCell(650)).toBe(650);
    expect(parseRateCell("850")).toBe(850);
    expect(parseRateCell(1100.5)).toBe(1100.5);
  });

  it("strips space-thousands separators ('65 000')", () => {
    expect(parseRateCell("65 000")).toBe(65000);
    expect(parseRateCell("1 200")).toBe(1200);
  });

  it("strips comma-thousands separators ('1,200')", () => {
    expect(parseRateCell("1,200")).toBe(1200);
    expect(parseRateCell("65,000")).toBe(65000);
  });
});

// ── Integration tests ─────────────────────────────────────────────────────────

/** Build a minimal .xlsx buffer from a 2D array (header:1 format) */
function buildXlsx(rows: (string | number | null)[][]): Buffer {
  const wb = XLSX.utils.book_new();
  // Worksheet name must include "(2)" so the importer picks it up
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1 (2)");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function buildTestApp(): Application {
  const app = express();
  app.use(express.json());
  // Inject a minimal fake session so requireAuth passes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { userId: 1, userRole: "super_admin", userPermissions: [] };
    next();
  });
  app.use("/api", marketRouter);
  return app;
}

// Unique timestamp suffix to avoid data collisions between test runs
const TS = Date.now();
const AREA_NAME = `TestArea${TS}`;
const PROJECT_NAME = `TestProject${TS}`;
const AREA2_NAME = `TestArea2${TS}`;
const PROJECT2_NAME = `TestProject2${TS}`;

let app: Application;
let insertedAreaId: number | null = null;
let insertedBenchmarkId: number | null = null;

beforeAll(() => {
  app = buildTestApp();
});

afterAll(async () => {
  // Clean up any test data created during these tests
  if (insertedAreaId) {
    await db.delete(unitBenchmarksTable).where(eq(unitBenchmarksTable.marketAreaId, insertedAreaId));
    await db.delete(marketAreasTable).where(eq(marketAreasTable.id, insertedAreaId));
  }
  // Clean up second test area
  const [area2] = await db.select().from(marketAreasTable)
    .where(eq(marketAreasTable.area, AREA2_NAME));
  if (area2) {
    await db.delete(unitBenchmarksTable).where(eq(unitBenchmarksTable.marketAreaId, area2.id));
    await db.delete(marketAreasTable).where(eq(marketAreasTable.id, area2.id));
  }
});

describe("POST /api/market/benchmarks/import", () => {
  it("rejects a request with no file", async () => {
    const res = await supertest(app)
      .post("/api/market/benchmarks/import")
      .expect(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it("rejects a file with no usable data rows", async () => {
    // Sheet with only a header row
    const xlsxBuf = buildXlsx([
      ["Area", "Type", "Status", "Dev.", "Project", "STD ADR", "STD LTR"],
    ]);
    const res = await supertest(app)
      .post("/api/market/benchmarks/import")
      .attach("file", xlsxBuf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      .expect(422);
    expect(res.body.error).toMatch(/no data rows/i);
  });

  it("inserts new area + benchmarks and returns correct counts", async () => {
    const xlsxBuf = buildXlsx([
      // Header row — will be skipped
      ["Area", "Type", "Status", "Dev.", "Project", "STD ADR", "STD LTR", "1BR ADR", "1BR LTR", "2BR ADR", "2BR LTR", "3BR ADR", "3BR LTR", "4BR ADR", "4BR LTR"],
      // Data row: STD ADR=650, STD LTR=65000, 1BR ADR=850, 1BR LTR=75000, rest NA
      [AREA_NAME, "Apartment", "Ready", "TestDev", PROJECT_NAME, 650, 65000, 850, 75000, "NA", "NA", "NA", "NA", "NA", "NA"],
    ]);

    const res = await supertest(app)
      .post("/api/market/benchmarks/import")
      .attach("file", xlsxBuf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      .expect(200);

    expect(res.body.areasCreated).toBe(1);
    expect(res.body.benchmarksInserted).toBe(2); // Studio + 1BR
    expect(res.body.benchmarksUpdated).toBe(0);
    expect(res.body.importedAt).toBeTruthy();

    // Record IDs for cleanup and update test
    const [area] = await db.select().from(marketAreasTable).where(eq(marketAreasTable.area, AREA_NAME));
    insertedAreaId = area?.id ?? null;

    // Verify developer and projectStatus persisted
    expect(area?.developer).toBe("TestDev");
    expect(area?.projectStatus).toBe("Ready");

    // Verify benchmark values
    if (insertedAreaId) {
      const benchmarks = await db.select().from(unitBenchmarksTable)
        .where(eq(unitBenchmarksTable.marketAreaId, insertedAreaId));
      insertedBenchmarkId = benchmarks[0]?.id ?? null;
      const studio = benchmarks.find(b => b.bedrooms === 0);
      const oneBr = benchmarks.find(b => b.bedrooms === 1);
      expect(studio?.typicalAdr).toBe(650);
      expect(studio?.annualLtr).toBe(65000);
      expect(oneBr?.typicalAdr).toBe(850);
      expect(oneBr?.annualLtr).toBe(75000);
    }
  });

  it("updates existing benchmarks on re-import (no new area created)", async () => {
    if (!insertedAreaId) throw new Error("Depends on previous test inserting the area");

    // Re-import same area/project with updated ADR values
    const xlsxBuf = buildXlsx([
      ["Area", "Type", "Status", "Dev.", "Project", "STD ADR", "STD LTR", "1BR ADR", "1BR LTR", "2BR ADR", "2BR LTR", "3BR ADR", "3BR LTR", "4BR ADR", "4BR LTR"],
      [AREA_NAME, "Apartment", "Ready", "TestDev", PROJECT_NAME, 700, 68000, 900, 78000, "NA", "NA", "NA", "NA", "NA", "NA"],
    ]);

    const res = await supertest(app)
      .post("/api/market/benchmarks/import")
      .attach("file", xlsxBuf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      .expect(200);

    expect(res.body.areasCreated).toBe(0);
    expect(res.body.benchmarksInserted).toBe(0);
    expect(res.body.benchmarksUpdated).toBe(2);

    // Verify updated values
    const benchmarks = await db.select().from(unitBenchmarksTable)
      .where(eq(unitBenchmarksTable.marketAreaId, insertedAreaId!));
    const studio = benchmarks.find(b => b.bedrooms === 0);
    expect(studio?.typicalAdr).toBe(700);
    expect(studio?.annualLtr).toBe(68000);
  });

  it("skips bedroom rows where both ADR and LTR are null/NA", async () => {
    const xlsxBuf = buildXlsx([
      ["Area", "Type", "Status", "Dev.", "Project", "STD ADR", "STD LTR", "1BR ADR", "1BR LTR", "2BR ADR", "2BR LTR", "3BR ADR", "3BR LTR", "4BR ADR", "4BR LTR"],
      // Only 2BR has valid data; Studio, 1BR, 3BR, 4BR are all NA
      [AREA2_NAME, "Apartment", "Offplan", "Dev2", PROJECT2_NAME, "NA", "NA", "N/A", "N/A", 1100, 90000, "NA", "NA", "", ""],
    ]);

    const res = await supertest(app)
      .post("/api/market/benchmarks/import")
      .attach("file", xlsxBuf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      .expect(200);

    expect(res.body.areasCreated).toBe(1);
    expect(res.body.benchmarksInserted).toBe(1); // only 2BR inserted

    const [area2] = await db.select().from(marketAreasTable).where(eq(marketAreasTable.area, AREA2_NAME));
    if (area2) {
      const benchmarks = await db.select().from(unitBenchmarksTable)
        .where(eq(unitBenchmarksTable.marketAreaId, area2.id));
      expect(benchmarks.length).toBe(1);
      expect(benchmarks[0].bedrooms).toBe(2);
      expect(benchmarks[0].typicalAdr).toBe(1100);
    }
  });

  it("treats locale-formatted numbers like '65 000' as valid rates", async () => {
    // Re-import the first area using space-formatted numbers
    if (!insertedAreaId) throw new Error("Depends on earlier test");
    const xlsxBuf = buildXlsx([
      ["Area", "Type", "Status", "Dev.", "Project", "STD ADR", "STD LTR", "1BR ADR", "1BR LTR", "2BR ADR", "2BR LTR", "3BR ADR", "3BR LTR", "4BR ADR", "4BR LTR"],
      [AREA_NAME, "Apartment", "Ready", "TestDev", PROJECT_NAME, "65 000", "1,200", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA"],
    ]);

    const res = await supertest(app)
      .post("/api/market/benchmarks/import")
      .attach("file", xlsxBuf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      .expect(200);

    expect(res.body.benchmarksUpdated).toBeGreaterThanOrEqual(1);

    // Verify the Studio now has ADR=65000 (not NaN or null)
    const benchmarks = await db.select().from(unitBenchmarksTable)
      .where(eq(unitBenchmarksTable.marketAreaId, insertedAreaId!));
    const studio = benchmarks.find(b => b.bedrooms === 0);
    expect(studio?.typicalAdr).toBe(65000);
    expect(studio?.annualLtr).toBe(1200);
  });

  it("keeps Apartment and Villa benchmarks separate for the same area/project/bedrooms", async () => {
    if (!insertedAreaId) throw new Error("Depends on earlier test inserting the area");

    // Import a Villa row for the same area/project and same Studio bedroom slot
    const xlsxBuf = buildXlsx([
      ["Area", "Type", "Status", "Dev.", "Project", "STD ADR", "STD LTR", "1BR ADR", "1BR LTR", "2BR ADR", "2BR LTR", "3BR ADR", "3BR LTR", "4BR ADR", "4BR LTR"],
      [AREA_NAME, "Villa", "Ready", "TestDev", PROJECT_NAME, 1200, 110000, "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA"],
    ]);

    const res = await supertest(app)
      .post("/api/market/benchmarks/import")
      .attach("file", xlsxBuf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      .expect(200);

    // Villa Studio should be inserted as a NEW benchmark, not overwrite the Apartment Studio
    expect(res.body.benchmarksInserted).toBe(1);
    expect(res.body.benchmarksUpdated).toBe(0);

    // Both the Apartment Studio and Villa Studio should now exist
    const benchmarks = await db.select().from(unitBenchmarksTable)
      .where(eq(unitBenchmarksTable.marketAreaId, insertedAreaId!));
    const apartmentStudios = benchmarks.filter(b => b.bedrooms === 0 && b.propertyType === "Apartment");
    const villaStudios = benchmarks.filter(b => b.bedrooms === 0 && b.propertyType === "Villa");
    expect(apartmentStudios.length).toBe(1);
    expect(villaStudios.length).toBe(1);
    expect(villaStudios[0].typicalAdr).toBe(1200);
    // Apartment Studio must be untouched
    expect(apartmentStudios[0].typicalAdr).not.toBe(1200);
  });

  it("does not delete rows absent from the import file", async () => {
    if (!insertedAreaId) throw new Error("Depends on earlier test");

    // Count benchmarks for this area before import
    const before = await db.select().from(unitBenchmarksTable)
      .where(eq(unitBenchmarksTable.marketAreaId, insertedAreaId!));

    // Import a completely different area — our area should be untouched
    const xlsxBuf = buildXlsx([
      ["Area", "Type", "Status", "Dev.", "Project", "STD ADR", "STD LTR", "1BR ADR", "1BR LTR", "2BR ADR", "2BR LTR", "3BR ADR", "3BR LTR", "4BR ADR", "4BR LTR"],
      [`UnrelatedArea${TS}`, "Villa", "", "", `UnrelatedProj${TS}`, 1500, "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA", "NA"],
    ]);

    await supertest(app)
      .post("/api/market/benchmarks/import")
      .attach("file", xlsxBuf, { filename: "test.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      .expect(200);

    const after = await db.select().from(unitBenchmarksTable)
      .where(eq(unitBenchmarksTable.marketAreaId, insertedAreaId!));
    expect(after.length).toBe(before.length);

    // Clean up the unrelated area
    const [unrelated] = await db.select().from(marketAreasTable)
      .where(eq(marketAreasTable.area, `UnrelatedArea${TS}`));
    if (unrelated) {
      await db.delete(unitBenchmarksTable).where(eq(unitBenchmarksTable.marketAreaId, unrelated.id));
      await db.delete(marketAreasTable).where(eq(marketAreasTable.id, unrelated.id));
    }
  });
});
