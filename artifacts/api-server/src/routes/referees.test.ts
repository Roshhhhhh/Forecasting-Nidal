/**
 * Integration tests: referee commission totals
 *
 * These tests verify that:
 *   1. GET /api/referees returns correct commission totals computed from seeded forecasts.
 *   2. Patching a forecast's managementFeePercent busts the cache so the next list
 *      request reflects the updated value.
 *   3. The batched commission path (list endpoint) produces the same total as the
 *      single-referee detail endpoint for a referee with multiple owners.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import supertest from "supertest";
import express, { type Application, type Request, type Response, type NextFunction } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, refereesTable, ownersTable, forecastsTable } from "@workspace/db";
import refereeRouter, { bustCommissionCache } from "./referees";
import forecastRouter from "./forecasts";

// ── Test app: bypasses real session/cookie stack with an injected fake session ──

function buildTestApp(): Application {
  const app = express();
  app.use(express.json());
  // Inject a minimal fake session so requireAuth passes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { userId: 1, userRole: "super_admin", userPermissions: [] };
    next();
  });
  app.use("/api", refereeRouter);
  app.use("/api", forecastRouter);
  return app;
}

// ── Shared state ──────────────────────────────────────────────────────────────

// Unique suffix so parallel or repeated test runs don't clash with live data
const TS = Date.now();

let app: Application;
let referee1Id: number; // one owner — used for tests 1 & 2
let referee2Id: number; // two owners — used for test 3
let owner1Id: number;
let owner2Id: number;
let owner3Id: number;
let forecast1Id: number;
let forecast2Id: number;
let forecast3Id: number;

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  app = buildTestApp();

  // Referee 1 — single referred owner
  const [ref1] = await db
    .insert(refereesTable)
    .values({ refereeCode: `TST-A-${TS}`, name: `Test Ref A ${TS}`, isRecurringEnabled: true })
    .returning();
  referee1Id = ref1.id;

  // Referee 2 — two referred owners
  const [ref2] = await db
    .insert(refereesTable)
    .values({ refereeCode: `TST-B-${TS}`, name: `Test Ref B ${TS}`, isRecurringEnabled: true })
    .returning();
  referee2Id = ref2.id;

  // Owner 1 → referee 1
  const [own1] = await db
    .insert(ownersTable)
    .values({ firstName: "Test", lastName: "OwnerA", email: `owna_${TS}@test.invalid`, refereeId: referee1Id })
    .returning();
  owner1Id = own1.id;

  // Owner 2 → referee 2
  const [own2] = await db
    .insert(ownersTable)
    .values({ firstName: "Test", lastName: "OwnerB", email: `ownb_${TS}@test.invalid`, refereeId: referee2Id })
    .returning();
  owner2Id = own2.id;

  // Owner 3 → referee 2
  const [own3] = await db
    .insert(ownersTable)
    .values({ firstName: "Test", lastName: "OwnerC", email: `ownc_${TS}@test.invalid`, refereeId: referee2Id })
    .returning();
  owner3Id = own3.id;

  // Forecast 1 for owner 1: gross=100 000, mgmt=20 %
  //   expected commission = 100 000 × (20 - 16) / 100 = 4 000
  const [fc1] = await db
    .insert(forecastsTable)
    .values({
      referenceNumber: `TST-${TS}-1`,
      ownerId: owner1Id,
      grossAnnualRevenue: 100_000,
      managementFeePercent: 20,
      isArchived: false,
    })
    .returning();
  forecast1Id = fc1.id;

  // Forecast 2 for owner 2: gross=80 000, mgmt=20 %
  //   expected commission = 80 000 × 4 / 100 = 3 200
  const [fc2] = await db
    .insert(forecastsTable)
    .values({
      referenceNumber: `TST-${TS}-2`,
      ownerId: owner2Id,
      grossAnnualRevenue: 80_000,
      managementFeePercent: 20,
      isArchived: false,
    })
    .returning();
  forecast2Id = fc2.id;

  // Forecast 3 for owner 3: gross=60 000, mgmt=18 %
  //   expected commission = 60 000 × (18 - 16) / 100 = 1 200
  const [fc3] = await db
    .insert(forecastsTable)
    .values({
      referenceNumber: `TST-${TS}-3`,
      ownerId: owner3Id,
      grossAnnualRevenue: 60_000,
      managementFeePercent: 18,
      isArchived: false,
    })
    .returning();
  forecast3Id = fc3.id;
});

afterAll(async () => {
  // Delete in FK-safe order (forecasts → owners → referees)
  if (forecast1Id || forecast2Id || forecast3Id) {
    await db.delete(forecastsTable).where(
      inArray(forecastsTable.id, [forecast1Id, forecast2Id, forecast3Id].filter(Boolean)),
    );
  }
  if (owner1Id || owner2Id || owner3Id) {
    await db.delete(ownersTable).where(
      inArray(ownersTable.id, [owner1Id, owner2Id, owner3Id].filter(Boolean)),
    );
  }
  if (referee1Id || referee2Id) {
    await db.delete(refereesTable).where(
      inArray(refereesTable.id, [referee1Id, referee2Id].filter(Boolean)),
    );
  }
});

beforeEach(() => {
  // Always start with a cold cache so tests are independent
  bustCommissionCache();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/referees – commission totals", () => {
  it("returns the correct commission total for a referee with one owner forecast", async () => {
    const res = await supertest(app).get("/api/referees");

    expect(res.status).toBe(200);

    const entry = (res.body as any[]).find((r) => r.id === referee1Id);
    expect(entry).toBeDefined();

    // gross=100 000, mgmt=20 % → (100 000 × (20 - 16)) / 100 = 4 000
    expect(entry.totalCommissionOwed).toBe(4_000);
  });

  it("returns updated totals after forecast managementFeePercent changes (cache bust)", async () => {
    // Warm the cache with the initial value
    const res1 = await supertest(app).get("/api/referees");
    expect(res1.status).toBe(200);
    const before = (res1.body as any[]).find((r) => r.id === referee1Id);
    expect(before.totalCommissionOwed).toBe(4_000);

    // PATCH the forecast — the route calls bustCacheForForecast internally
    const patch = await supertest(app)
      .patch(`/api/forecasts/${forecast1Id}`)
      .send({ managementFeePercent: 18 });
    expect(patch.status).toBe(200);

    // Re-fetch — cache entry is gone, so a fresh DB read should reflect the new mgmt %
    const res2 = await supertest(app).get("/api/referees");
    expect(res2.status).toBe(200);
    const after = (res2.body as any[]).find((r) => r.id === referee1Id);

    // gross=100 000, mgmt=18 % → (100 000 × (18 - 16)) / 100 = 2 000
    expect(after.totalCommissionOwed).toBe(2_000);

    // Restore so the suite remains self-contained
    await db
      .update(forecastsTable)
      .set({ managementFeePercent: 20 })
      .where(eq(forecastsTable.id, forecast1Id));
  });

  it("batched list path returns the same total as the single-referee commission endpoint for multiple owners", async () => {
    // Batch path: totalCommissionOwed embedded in the list response
    const listRes = await supertest(app).get("/api/referees");
    expect(listRes.status).toBe(200);
    const batchEntry = (listRes.body as any[]).find((r) => r.id === referee2Id);
    expect(batchEntry).toBeDefined();

    // Single-referee path: /referees/:id/commission uses a different DB code path
    bustCommissionCache(); // ensure detail endpoint also runs from DB, not cache
    const detailRes = await supertest(app).get(`/api/referees/${referee2Id}/commission`);
    expect(detailRes.status).toBe(200);

    // Both paths should agree:
    // owner2: 80 000 × 4 / 100 = 3 200
    // owner3: 60 000 × 2 / 100 = 1 200  → total 4 400
    const expectedTotal = 4_400;
    expect(batchEntry.totalCommissionOwed).toBe(expectedTotal);
    expect(detailRes.body.totalCommissionOwed).toBe(expectedTotal);
  });
});
