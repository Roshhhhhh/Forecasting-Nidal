import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  db, proposalsTable, proposalViewEventsTable, forecastsTable,
  forecastScenariosTable, monthlyProjectionsTable, ownersTable, propertiesTable, usersTable, companySettingsTable,
  amenitiesTable, propertyAmenitiesTable, forecastComparablesTable,
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
  const rows = await db
    .select({
      id:             proposalsTable.id,
      forecastId:     proposalsTable.forecastId,
      referenceNumber:proposalsTable.referenceNumber,
      status:         proposalsTable.status,
      shareToken:     proposalsTable.shareToken,
      shareUrl:       proposalsTable.shareUrl,
      expiresAt:      proposalsTable.expiresAt,
      isLinkActive:   proposalsTable.isLinkActive,
      ownerPin:       proposalsTable.ownerPin,
      totalViews:     proposalsTable.totalViews,
      uniqueViews:    proposalsTable.uniqueViews,
      lastViewedAt:   proposalsTable.lastViewedAt,
      pdfDownloads:   proposalsTable.pdfDownloads,
      ownerAction:    proposalsTable.ownerAction,
      ownerActionAt:  proposalsTable.ownerActionAt,
      coverNarrative: proposalsTable.coverNarrative,
      createdAt:      proposalsTable.createdAt,
      // Owner fields
      ownerId:        ownersTable.id,
      ownerFirstName: ownersTable.firstName,
      ownerLastName:  ownersTable.lastName,
      ownerCompany:   ownersTable.companyName,
      ownerType:      ownersTable.ownerType,
      // Property fields
      propertyId:     propertiesTable.id,
      propertyType:   propertiesTable.propertyType,
      bedrooms:       propertiesTable.bedrooms,
      area:           propertiesTable.area,
      community:      propertiesTable.community,
      // Assigned rep
      assignedToName: usersTable.name,
    })
    .from(proposalsTable)
    .leftJoin(forecastsTable,  eq(forecastsTable.id,   proposalsTable.forecastId))
    .leftJoin(ownersTable,     eq(ownersTable.id,      forecastsTable.ownerId))
    .leftJoin(propertiesTable, eq(propertiesTable.id,  forecastsTable.propertyId))
    .leftJoin(usersTable,      eq(usersTable.id,       forecastsTable.assignedToId))
    .orderBy(desc(proposalsTable.updatedAt));

  res.json(rows.map(r => ({
    ...formatProposal(r),
    ownerId:        r.ownerId   ?? null,
    ownerName:      r.ownerCompany
                      ? String(r.ownerCompany)
                      : r.ownerFirstName
                        ? `${r.ownerFirstName} ${r.ownerLastName ?? ""}`.trim()
                        : null,
    ownerType:      r.ownerType ?? null,
    propertyId:     r.propertyId    ?? null,
    propertyType:   r.propertyType  ?? null,
    bedrooms:       r.bedrooms      ?? null,
    area:           r.area          ?? null,
    community:      r.community     ?? null,
    assignedToName: r.assignedToName ?? null,
  })));
});

router.get("/proposals/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProposalActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, forecast.propertyId));
  if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }
  res.json(formatProposal(p));
});

router.patch("/proposals/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetProposalActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = SubmitProposalActionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updateData: any = { ...parsed.data };
  if (parsed.data.expiresAt) updateData.expiresAt = new Date(parsed.data.expiresAt);
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, forecast.propertyId));
  if (!p) { res.status(404).json({ error: "Proposal not found" }); return; }
  res.json(formatProposal(p));
});

router.post("/proposals/:id/publish", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = SubmitProposalActionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [proposal] = await db.select().from(proposalsTable).where(eq(proposalsTable.shareToken, token));
  if (!proposal) { res.status(404).json({ error: "Proposal not found" }); return; }

  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
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
  let propertyAmenities: any[] = [];
  if (forecast.propertyId) {
    const [p] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, forecast.propertyId));
    propertyData = p;
    propertyAmenities = await db
      .select({
        id: amenitiesTable.id,
        name: amenitiesTable.name,
        category: amenitiesTable.category,
        icon: amenitiesTable.icon,
        isProposalHighlight: amenitiesTable.isProposalHighlight,
        sortOrder: amenitiesTable.sortOrder,
      })
      .from(propertyAmenitiesTable)
      .innerJoin(amenitiesTable, eq(amenitiesTable.id, propertyAmenitiesTable.amenityId))
      .where(eq(propertyAmenitiesTable.propertyId, forecast.propertyId))
      .orderBy(amenitiesTable.isProposalHighlight, amenitiesTable.category, amenitiesTable.sortOrder);
  }
  const scenarios = await db.select().from(forecastScenariosTable)
    .where(eq(forecastScenariosTable.forecastId, forecast.id))
    .orderBy(forecastScenariosTable.occupancyRate);
  const monthlyProjections = await db.select().from(monthlyProjectionsTable)
    .where(eq(monthlyProjectionsTable.forecastId, forecast.id))
    .orderBy(monthlyProjectionsTable.month);

  const comparables = await db.select().from(forecastComparablesTable)
    .where(eq(forecastComparablesTable.forecastId, forecast.id))
    .orderBy(forecastComparablesTable.sortOrder, forecastComparablesTable.createdAt);
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

  // Build owner first name (strip title duplication for salutation)
  const ownerFirstName = ownerData?.firstName ?? "";
  const ownerLastName  = ownerData?.lastName  ?? "";
  const ownerTitle     = ownerData?.title     ?? null;

  // Resolve weightedAdr from the recommended scenario so it is always consistent
  // with the hero KPIs (grossRevenue, netOwnerIncome), regardless of which occupancy
  // was used when the forecast was last fully recalculated.
  const recScenario = scenarios.find((s: any) => s.isRecommended)
    ?? scenarios.find((s: any) => s.name === "Realistic" && Math.abs(s.occupancyRate - 0.80) < 0.01)
    ?? scenarios.find((s: any) => Math.abs(s.occupancyRate - 0.80) < 0.01)
    ?? (scenarios.length ? scenarios[Math.floor(scenarios.length / 2)] : null);
  const resolvedWeightedAdr = (recScenario as any)?.weightedAdr ?? forecast.weightedAdr ?? 0;

  res.json({
    referenceNumber: proposal.referenceNumber,
    ownerName,            // server-composed full name (may duplicate title — client deduplicates)
    ownerTitle,
    ownerFirstName,
    ownerLastName,
    propertyAddress,
    projectBuilding: propertyData?.projectBuilding ?? null,
    area: propertyData?.area ?? null,
    unitNumber: propertyData?.unitNumber ?? null,
    propertyType: propertyData?.propertyType ?? "apartment",
    bedrooms: propertyData?.bedrooms ?? 1,
    bathrooms: propertyData?.bathrooms ?? 1,
    internalArea: propertyData?.internalArea ?? 0,
    floor: propertyData?.floor ?? null,
    view: propertyData?.view ?? null,
    furnishingStatus: propertyData?.furnishingStatus ?? "fully_furnished",
    heroImageUrl: propertyData?.heroImageUrl ?? null,
    weightedAdr: resolvedWeightedAdr,
    recommendedOccupancy: forecast.recommendedOccupancy ?? 0.80,
    grossAnnualRevenue: forecast.grossAnnualRevenue ?? 0,
    netOwnerIncome: forecast.netOwnerIncome ?? 0,
    monthlyPayout: forecast.netOwnerIncome ? Math.round(forecast.netOwnerIncome / 12) : 0,
    netLtrIncome: forecast.netLtrIncome ?? null,
    annualLtr: forecast.annualLtr ?? null,
    ltrVacancyPercent: forecast.ltrVacancyPercent ?? 10,
    managementFeePercent: forecast.managementFeePercent ?? 17,
    increaseVsLtr: forecast.increaseVsLtr ?? null,
    increaseVsLtrPct: forecast.increaseVsLtrPct ?? null,
    // Expense breakdown
    utilityCost: forecast.utilityCost ?? 0,
    internetCost: forecast.internetCost ?? 0,
    maintenanceCost: forecast.maintenanceCost ?? 0,
    miscCost: forecast.miscCost ?? 0,
    ownerBlockedNights: forecast.ownerBlockedNights ?? 0,
    narrativeText: proposal.coverNarrative ?? forecast.narrativeText ?? null,
    scenarios,
    monthlyProjections,
    proposalDate: new Date().toISOString().split("T")[0],
    expiresAt: proposal.expiresAt?.toISOString() ?? "",
    advisorName,
    companyPhone: settings?.phone ?? null,
    companyEmail: settings?.ownerEmail ?? null,
    disclaimer: settings?.disclaimer ?? "This forecast is an estimate prepared using available property information, Royal Holiday Homes' internal market benchmarks and current conditions. Actual occupancy, ADR, expenses, gross revenue and net owner income may differ. This proposal does not represent a guarantee of future rental income.",
    ownerAction: proposal.ownerAction ?? null,
    amenities: propertyAmenities,
    comparables,
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
