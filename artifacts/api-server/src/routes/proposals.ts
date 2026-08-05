import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import {
  db, proposalsTable, proposalViewEventsTable, forecastsTable,
  forecastScenariosTable, monthlyProjectionsTable, ownersTable, propertiesTable, usersTable, companySettingsTable,
} from "@workspace/db";
import {
  UpdateProposalBody,
  GetProposalParams,
  UpdateProposalParams,
  PublishProposalBody,
  GetProposalActivityParams,
  SubmitProposalActionBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatProposal(p: any) {
  return {
    id: p.id, forecastId: p.forecastId, referenceNumber: p.referenceNumber,
    status: p.status, shareToken: p.shareToken, shareUrl: p.shareUrl,
    expiresAt: p.expiresAt?.toISOString?.() ?? null, isLinkActive: p.isLinkActive,
    ownerPin: p.ownerPin, totalViews: p.totalViews, uniqueViews: p.uniqueViews,
    lastViewedAt: p.lastViewedAt?.toISOString?.() ?? null, pdfDownloads: p.pdfDownloads,
    ownerAction: p.ownerAction, ownerActionAt: p.ownerActionAt?.toISOString?.() ?? null,
    coverNarrative: p.coverNarrative, createdAt: p.createdAt,
  };
}

router.get("/proposals", requireAuth, async (_req, res): Promise<void> => {
  const proposals = await db.select().from(proposalsTable).orderBy(desc(proposalsTable.updatedAt));
  res.json(proposals.map(formatProposal));
});

router.get("/proposals/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProposalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [p] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, params.data.id));
  if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }
  res.json(formatProposal(p));
});

router.patch("/proposals/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateProposalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateProposalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: any = { ...parsed.data };
  if (parsed.data.expiresAt) updateData.expiresAt = new Date(parsed.data.expiresAt);
  const [p] = await db.update(proposalsTable).set(updateData).where(eq(proposalsTable.id, params.data.id)).returning();
  if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }
  res.json(formatProposal(p));
});

router.post("/proposals/:id/publish", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = PublishProposalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, id));
  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }

  const token = crypto.randomBytes(16).toString("hex");
  const expiresInDays = parsed.data.expiresInDays ?? 30;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  const shareUrl = `/p/${token}`;

  await db.update(proposalsTable).set({
    shareToken: token, shareUrl, expiresAt, isLinkActive: true,
    status: "published",
    ownerPin: parsed.data.requirePin ? parsed.data.ownerPin : null,
  }).where(eq(proposalsTable.id, id));

  await db.update(forecastsTable).set({ status: "published" }).where(eq(forecastsTable.id, proposal.forecastId));

  res.json({ shareUrl, token, expiresAt: expiresAt.toISOString() });
});

router.get("/proposals/:id/activity", requireAuth, async (req, res): Promise<void> => {
  const params = GetProposalActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const events = await db.select().from(proposalViewEventsTable)
    .where(eq(proposalViewEventsTable.proposalId, params.data.id))
    .orderBy(desc(proposalViewEventsTable.createdAt));
  res.json(events.map(e => ({ id: e.id, eventType: e.eventType, deviceType: e.deviceType, createdAt: e.createdAt, metadata: e.metadata })));
});

router.post("/proposals/:id/revoke", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.update(proposalsTable).set({ isLinkActive: false }).where(eq(proposalsTable.id, id));
  res.json({ message: "Link revoked" });
});

// Public proposal view (no auth required)
router.get("/p/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.shareToken, token));
  if (!proposal || !proposal.isLinkActive) {
    res.status(404).json({ error: "Proposal not found or link has expired" });
    return;
  }
  if (proposal.expiresAt && new Date() > proposal.expiresAt) {
    res.status(404).json({ error: "Proposal link has expired" });
    return;
  }

  const [forecast] = await db.select().from(forecastsTable).where(eq(forecastsTable.id, proposal.forecastId));
  if (!forecast) { res.status(404).json({ error: "Forecast not found" }); return; }

  let ownerData: any = null;
  if (forecast.ownerId) {
    const [o] = await db.select().from(ownersTable).where(eq(ownersTable.id, forecast.ownerId));
    ownerData = o;
  }
  let propertyData: any = null;
  if (forecast.propertyId) {
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, forecast.propertyId));
    propertyData = p;
  }
  const scenarios = await db.select().from(forecastScenariosTable)
    .where(eq(forecastScenariosTable.forecastId, forecast.id))
    .orderBy(forecastScenariosTable.occupancyRate);
  const monthlyProjections = await db.select().from(monthlyProjectionsTable)
    .where(eq(monthlyProjectionsTable.forecastId, forecast.id))
    .orderBy(monthlyProjectionsTable.month);
  const settings = await db.query.companySettingsTable.findFirst();

  let advisorName: string | null = null;
  if (forecast.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, forecast.assignedToId));
    advisorName = u?.name ?? null;
  }

  // Track view
  await db.update(proposalsTable).set({
    totalViews: (proposal.totalViews ?? 0) + 1,
    lastViewedAt: new Date(),
    uniqueViews: (proposal.uniqueViews ?? 0) + 1,
  }).where(eq(proposalsTable.id, proposal.id));
  await db.insert(proposalViewEventsTable).values({
    proposalId: proposal.id,
    eventType: "view",
    deviceType: req.headers["user-agent"]?.includes("Mobile") ? "mobile" : "desktop",
  });
  if (forecast.status === "published") {
    await db.update(forecastsTable).set({ status: "viewed" }).where(eq(forecastsTable.id, forecast.id));
  }

  const ownerName = ownerData
    ? `${ownerData.title ? ownerData.title + " " : ""}${ownerData.firstName} ${ownerData.lastName}`
    : "Valued Owner";
  const propertyAddress = propertyData
    ? [propertyData.projectBuilding, propertyData.area, "Abu Dhabi"].filter(Boolean).join(", ")
    : "Property";

  res.json({
    referenceNumber: proposal.referenceNumber,
    ownerName,
    ownerTitle: ownerData?.title ?? null,
    propertyAddress,
    propertyType: propertyData?.propertyType ?? "apartment",
    bedrooms: propertyData?.bedrooms ?? 1,
    bathrooms: propertyData?.bathrooms ?? 1,
    internalArea: propertyData?.internalArea ?? 0,
    floor: propertyData?.floor ?? null,
    view: propertyData?.view ?? null,
    furnishingStatus: propertyData?.furnishingStatus ?? "fully_furnished",
    heroImageUrl: propertyData?.heroImageUrl ?? null,
    weightedAdr: forecast.weightedAdr ?? 0,
    recommendedOccupancy: forecast.recommendedOccupancy ?? 0.80,
    grossAnnualRevenue: forecast.grossAnnualRevenue ?? 0,
    netOwnerIncome: forecast.netOwnerIncome ?? 0,
    monthlyPayout: forecast.netOwnerIncome ? Math.round(forecast.netOwnerIncome / 12) : 0,
    netLtrIncome: forecast.netLtrIncome ?? null,
    increaseVsLtr: forecast.increaseVsLtr ?? null,
    increaseVsLtrPct: forecast.increaseVsLtrPct ?? null,
    narrativeText: proposal.coverNarrative ?? forecast.narrativeText ?? null,
    scenarios,
    monthlyProjections,
    proposalDate: new Date().toISOString().split("T")[0],
    expiresAt: proposal.expiresAt?.toISOString() ?? "",
    advisorName,
    companyPhone: settings?.phone ?? null,
    companyEmail: settings?.ownerEmail ?? null,
    disclaimer: settings?.disclaimer ?? "This forecast is an estimate and does not represent a guarantee of future rental income.",
    ownerAction: proposal.ownerAction ?? null,
  });
});

router.post("/p/:token/action", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const parsed = SubmitProposalActionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.shareToken, token));
  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }

  await db.update(proposalsTable).set({
    ownerAction: parsed.data.actionType,
    ownerActionAt: new Date(),
    ownerActionName: parsed.data.ownerName,
    ownerActionEmail: parsed.data.ownerEmail,
    ownerActionPhone: parsed.data.ownerPhone,
    ownerActionNotes: parsed.data.comments,
  }).where(eq(proposalsTable.id, proposal.id));

  await db.insert(proposalViewEventsTable).values({
    proposalId: proposal.id,
    eventType: parsed.data.actionType,
    metadata: JSON.stringify(parsed.data),
  });

  if (parsed.data.actionType === "accept") {
    await db.update(forecastsTable).set({ status: "accepted" }).where(eq(forecastsTable.id, proposal.forecastId));
  } else if (parsed.data.actionType === "decline") {
    await db.update(forecastsTable).set({ status: "declined" }).where(eq(forecastsTable.id, proposal.forecastId));
  } else if (parsed.data.actionType === "request_call") {
    await db.update(forecastsTable).set({ status: "owner_called" }).where(eq(forecastsTable.id, proposal.forecastId));
  }

  res.json({ message: "Action submitted successfully" });
});

export default router;
