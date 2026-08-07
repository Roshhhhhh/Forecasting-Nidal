/**
 * Integration tests for the core proposal API routes.
 *
 * Covers:
 *   GET  /api/proposals/:id          – fetch by id, 404 for unknown
 *   PATCH /api/proposals/:id         – narrative save, field update, 404 for unknown
 *   POST  /api/proposals/:id/publish – publish, re-publish; narrative preserved across both
 *   POST  /api/p/:token/action       – owner action (accept / decline / request_call)
 *
 * Each suite seeds its own rows and cleans them up in afterAll so suites
 * can run in parallel without collision.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import express, {
  type Application,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { inArray, eq } from "drizzle-orm";
import { db, forecastsTable, proposalsTable } from "@workspace/db";
import proposalRouter from "./proposals";

// ── Shared test app ────────────────────────────────────────────────────────────

function buildTestApp(): Application {
  const app = express();
  app.use(express.json());
  // Inject a minimal fake session so requireAuth passes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = {
      userId: 1,
      userRole: "super_admin",
      userPermissions: [],
    };
    next();
  });
  app.use("/api", proposalRouter);
  return app;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function seedForecastAndProposal(
  suffix: string,
  overrides: Record<string, unknown> = {}
) {
  const [fc] = await db
    .insert(forecastsTable)
    .values({
      referenceNumber: `TEST-${suffix}`,
      managementFeePercent: 17,
      isArchived: false,
    })
    .returning();

  const [pr] = await db
    .insert(proposalsTable)
    .values({
      forecastId: fc.id,
      referenceNumber: fc.referenceNumber,
      createdById: 1,
      ...overrides,
    })
    .returning();

  return { fc, pr };
}

async function cleanup(proposalIds: number[], forecastIds: number[]) {
  if (proposalIds.length)
    await db
      .delete(proposalsTable)
      .where(inArray(proposalsTable.id, proposalIds));
  if (forecastIds.length)
    await db
      .delete(forecastsTable)
      .where(inArray(forecastsTable.id, forecastIds));
}

// ── GET /api/proposals/:id ─────────────────────────────────────────────────────

describe("GET /api/proposals/:id", () => {
  const TS = `GET-${Date.now()}`;
  let app: Application;
  let proposalId: number;
  let forecastId: number;

  beforeAll(async () => {
    app = buildTestApp();
    const { fc, pr } = await seedForecastAndProposal(TS, {
      coverNarrative: "Narrative for GET test",
    });
    forecastId = fc.id;
    proposalId = pr.id;
  });

  afterAll(() => cleanup([proposalId], [forecastId]));

  it("returns 200 with correct shape for a known proposal", async () => {
    const res = await supertest(app).get(`/api/proposals/${proposalId}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: proposalId,
      forecastId,
      coverNarrative: "Narrative for GET test",
    });
    // status field must be present
    expect(typeof res.body.status).toBe("string");
  });

  it("returns 404 for a proposal id that does not exist", async () => {
    const res = await supertest(app).get("/api/proposals/99999999");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await supertest(app).get("/api/proposals/not-a-number");

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });
});

// ── PATCH /api/proposals/:id ───────────────────────────────────────────────────

describe("PATCH /api/proposals/:id", () => {
  const TS = `PATCH-${Date.now()}`;
  let app: Application;
  let proposalId: number;
  let forecastId: number;

  beforeAll(async () => {
    app = buildTestApp();
    const { fc, pr } = await seedForecastAndProposal(TS, {
      coverNarrative: "Original narrative",
    });
    forecastId = fc.id;
    proposalId = pr.id;
  });

  afterAll(() => cleanup([proposalId], [forecastId]));

  it("saves a new coverNarrative and returns the updated proposal", async () => {
    const newNarrative = "Staff-written narrative saved by PATCH";
    const res = await supertest(app)
      .patch(`/api/proposals/${proposalId}`)
      .send({ coverNarrative: newNarrative });

    expect(res.status).toBe(200);
    expect(res.body.coverNarrative).toBe(newNarrative);
    expect(res.body.id).toBe(proposalId);
  });

  it("persists the narrative so a subsequent GET returns it", async () => {
    const persisted = "Persisted narrative checked via GET";
    await supertest(app)
      .patch(`/api/proposals/${proposalId}`)
      .send({ coverNarrative: persisted });

    const get = await supertest(app).get(`/api/proposals/${proposalId}`);
    expect(get.status).toBe(200);
    expect(get.body.coverNarrative).toBe(persisted);
  });

  it("returns 404 when patching a proposal that does not exist", async () => {
    const res = await supertest(app)
      .patch("/api/proposals/99999999")
      .send({ coverNarrative: "ghost update" });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});

// ── POST /api/proposals/:id/publish ───────────────────────────────────────────

describe("POST /api/proposals/:id/publish – narrative preservation", () => {
  const TS = `PUB-${Date.now()}`;
  let app: Application;
  let forecastId: number;
  let proposalId: number;

  beforeAll(async () => {
    app = buildTestApp();
    const { fc, pr } = await seedForecastAndProposal(TS, {
      coverNarrative: "This is the owner-facing narrative staff wrote.",
    });
    forecastId = fc.id;
    proposalId = pr.id;
  });

  afterAll(() => cleanup([proposalId], [forecastId]));

  it("returns 200 with shareUrl and token on first publish", async () => {
    const res = await supertest(app)
      .post(`/api/proposals/${proposalId}/publish`)
      .send({ expiresInDays: 30 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("shareUrl");
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("expiresAt");
  });

  it("does not clear coverNarrative on first publish", async () => {
    const get = await supertest(app).get(`/api/proposals/${proposalId}`);
    expect(get.status).toBe(200);
    expect(get.body.coverNarrative).toBe(
      "This is the owner-facing narrative staff wrote."
    );
  });

  it("does not clear coverNarrative on re-publish (link regeneration)", async () => {
    const res = await supertest(app)
      .post(`/api/proposals/${proposalId}/publish`)
      .send({ expiresInDays: 14 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("shareUrl");

    const get = await supertest(app).get(`/api/proposals/${proposalId}`);
    expect(get.status).toBe(200);
    expect(get.body.coverNarrative).toBe(
      "This is the owner-facing narrative staff wrote."
    );
  });

  it("preserves a narrative that was updated between publish calls", async () => {
    const updated = "Updated narrative written by staff after first publish.";
    const patch = await supertest(app)
      .patch(`/api/proposals/${proposalId}`)
      .send({ coverNarrative: updated });
    expect(patch.status).toBe(200);

    const pub = await supertest(app)
      .post(`/api/proposals/${proposalId}/publish`)
      .send({ expiresInDays: 7 });
    expect(pub.status).toBe(200);

    const get = await supertest(app).get(`/api/proposals/${proposalId}`);
    expect(get.status).toBe(200);
    expect(get.body.coverNarrative).toBe(updated);
  });

  it("returns 404 when publishing a proposal that does not exist", async () => {
    const res = await supertest(app)
      .post("/api/proposals/99999999/publish")
      .send({ expiresInDays: 30 });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});

// ── POST /api/p/:token/action ──────────────────────────────────────────────────

describe("POST /api/p/:token/action", () => {
  const TS = `ACT-${Date.now()}`;
  let app: Application;
  let forecastId: number;
  let proposalId: number;
  let shareToken: string;

  beforeAll(async () => {
    app = buildTestApp();
    const { fc, pr } = await seedForecastAndProposal(TS);
    forecastId = fc.id;
    proposalId = pr.id;

    // Publish the proposal so it has a shareToken and isLinkActive = true
    const pub = await supertest(app)
      .post(`/api/proposals/${proposalId}/publish`)
      .send({ expiresInDays: 30 });

    shareToken = pub.body.token;
  });

  afterAll(() => cleanup([proposalId], [forecastId]));

  it("returns 200 and success message for an 'accept' action", async () => {
    const res = await supertest(app)
      .post(`/api/p/${shareToken}/action`)
      .send({
        actionType: "accept",
        ownerName: "Test Owner",
        ownerEmail: "owner@example.com",
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: "Action submitted successfully" });
  });

  it("records the ownerAction on the proposal after accept", async () => {
    const get = await supertest(app).get(`/api/proposals/${proposalId}`);
    expect(get.status).toBe(200);
    expect(get.body.ownerAction).toBe("accept");
  });

  it("returns 200 for a 'request_call' action", async () => {
    // Re-seed a fresh proposal for this sub-test so state is clean
    const { fc: fc2, pr: pr2 } = await seedForecastAndProposal(
      `${TS}-RC`
    );
    const pub = await supertest(app)
      .post(`/api/proposals/${pr2.id}/publish`)
      .send({ expiresInDays: 30 });
    const token2 = pub.body.token;

    const res = await supertest(app)
      .post(`/api/p/${token2}/action`)
      .send({ actionType: "request_call", ownerPhone: "+971501234567" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");

    // clean up the extra rows
    await cleanup([pr2.id], [fc2.id]);
  });

  it("returns 400 for an invalid actionType", async () => {
    const res = await supertest(app)
      .post(`/api/p/${shareToken}/action`)
      .send({ actionType: "not_a_valid_action" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 404 for an unknown token", async () => {
    const res = await supertest(app)
      .post("/api/p/00000000-0000-0000-0000-000000000000/action")
      .send({ actionType: "decline" });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});
