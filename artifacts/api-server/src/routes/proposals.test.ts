/**
 * Regression test: coverNarrative is preserved across re-publish
 *
 * Verifies that calling POST /api/proposals/:id/publish (including re-publishing
 * an already-published proposal) never clears or overwrites an existing
 * coverNarrative. This protects the staff-written owner narrative from being
 * silently lost when "Regenerate Link" is clicked.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import express, { type Application, type Request, type Response, type NextFunction } from "express";
import { inArray } from "drizzle-orm";
import { db, forecastsTable, proposalsTable } from "@workspace/db";
import proposalRouter from "./proposals";

// ── Test app ──────────────────────────────────────────────────────────────────

function buildTestApp(): Application {
  const app = express();
  app.use(express.json());
  // Inject a minimal fake session so requireAuth passes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { userId: 1, userRole: "super_admin", userPermissions: [] };
    next();
  });
  app.use("/api", proposalRouter);
  return app;
}

// ── Shared state ──────────────────────────────────────────────────────────────

const TS = Date.now();
let app: Application;
let forecastId: number;
let proposalId: number;

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  app = buildTestApp();

  // Seed a minimal forecast (no owner/property needed — publish only touches proposal)
  const [fc] = await db
    .insert(forecastsTable)
    .values({
      referenceNumber: `NARR-TST-${TS}`,
      managementFeePercent: 17,
      isArchived: false,
    })
    .returning();
  forecastId = fc.id;

  // Seed a proposal for that forecast with a pre-written narrative
  const [pr] = await db
    .insert(proposalsTable)
    .values({
      forecastId: fc.id,
      referenceNumber: fc.referenceNumber,
      coverNarrative: "This is the owner-facing narrative staff wrote.",
      createdById: 1,
    })
    .returning();
  proposalId = pr.id;
});

afterAll(async () => {
  // Clean up in FK-safe order (proposals first, then forecasts)
  if (proposalId) {
    await db.delete(proposalsTable).where(inArray(proposalsTable.id, [proposalId]));
  }
  if (forecastId) {
    await db.delete(forecastsTable).where(inArray(forecastsTable.id, [forecastId]));
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/proposals/:id/publish – narrative preservation", () => {
  it("does not clear coverNarrative on first publish", async () => {
    const res = await supertest(app)
      .post(`/api/proposals/${proposalId}/publish`)
      .send({ expiresInDays: 30 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("shareUrl");

    // Fetch the proposal and verify the narrative is intact
    const get = await supertest(app).get(`/api/proposals/${proposalId}`);
    expect(get.status).toBe(200);
    expect(get.body.coverNarrative).toBe("This is the owner-facing narrative staff wrote.");
  });

  it("does not clear coverNarrative on re-publish (link regeneration)", async () => {
    // First publish is already done; regenerate the link a second time
    const res = await supertest(app)
      .post(`/api/proposals/${proposalId}/publish`)
      .send({ expiresInDays: 14 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("shareUrl");

    // The token will have rotated but the narrative must be unchanged
    const get = await supertest(app).get(`/api/proposals/${proposalId}`);
    expect(get.status).toBe(200);
    expect(get.body.coverNarrative).toBe("This is the owner-facing narrative staff wrote.");
  });

  it("preserves a narrative that was updated between publish calls", async () => {
    // Staff edits the narrative after the proposal is already published
    const updated = "Updated narrative written by staff after first publish.";
    const patch = await supertest(app)
      .patch(`/api/proposals/${proposalId}`)
      .send({ coverNarrative: updated });
    expect(patch.status).toBe(200);
    expect(patch.body.coverNarrative).toBe(updated);

    // Staff regenerates the link — narrative must survive
    const pub = await supertest(app)
      .post(`/api/proposals/${proposalId}/publish`)
      .send({ expiresInDays: 7 });
    expect(pub.status).toBe(200);

    const get = await supertest(app).get(`/api/proposals/${proposalId}`);
    expect(get.status).toBe(200);
    expect(get.body.coverNarrative).toBe(updated);
  });
});
