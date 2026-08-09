import { Router, type IRouter } from "express";
import { eq, desc, sql, or } from "drizzle-orm";
import { db, ownersTable, usersTable, refereesTable, propertiesTable } from "@workspace/db";
import { propertyOwnersTable } from "@workspace/db/schema";
import {
  CreateOwnerBody,
  UpdateOwnerBody,
  GetOwnerParams,
  UpdateOwnerParams,
  DeleteOwnerParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { bustCommissionCache } from "./referees";

const router: IRouter = Router();

function formatOwner(owner: any, assignedName?: string | null, refereeName?: string | null, refereeCode?: string | null) {
  return {
    id: owner.id,
    ownerType: owner.ownerType,
    title: owner.title,
    firstName: owner.firstName,
    lastName: owner.lastName,
    companyName: owner.companyName,
    email: owner.email,
    phone: owner.phone,
    whatsapp: owner.whatsapp,
    nationality: owner.nationality,
    preferredLanguage: owner.preferredLanguage,
    leadSource: owner.leadSource,
    isExistingClient: owner.isExistingClient,
    objectives: owner.objectives ?? [],
    assignedToId: owner.assignedToId,
    assignedToName: assignedName ?? null,
    refereeId: owner.refereeId ?? null,
    refereeName: refereeName ?? null,
    refereeCode: refereeCode ?? null,
    notes: owner.notes,
    createdAt: owner.createdAt,
  };
}

router.get("/owners", requireAuth, async (_req, res): Promise<void> => {
  const owners = await db.select().from(ownersTable)
    .where(eq(ownersTable.isArchived, false))
    .orderBy(desc(ownersTable.createdAt));
  res.json(owners.map(o => formatOwner(o)));
});

router.post("/owners", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [owner] = await db.insert(ownersTable).values({
    ...parsed.data,
    createdById: req.session.userId,
  }).returning();
  res.status(201).json(formatOwner(owner));
});

router.get("/owners/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetOwnerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [owner] = await db.select().from(ownersTable).where(eq(ownersTable.id, params.data.id));
  if (!owner) { res.status(404).json({ error: "Owner not found" }); return; }
  let assignedName: string | null = null;
  if (owner.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, owner.assignedToId));
    assignedName = u?.name ?? null;
  }
  let refereeName: string | null = null;
  let refereeCode: string | null = null;
  if (owner.refereeId) {
    const [r] = await db.select({ name: refereesTable.name, refereeCode: refereesTable.refereeCode }).from(refereesTable).where(eq(refereesTable.id, owner.refereeId));
    refereeName = r?.name ?? null;
    refereeCode = r?.refereeCode ?? null;
  }
  res.json(formatOwner(owner, assignedName, refereeName, refereeCode));
});

router.patch("/owners/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOwnerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Fetch the current refereeId before updating so we can bust the old cache entry
  const [existing] = await db
    .select({ refereeId: ownersTable.refereeId })
    .from(ownersTable)
    .where(eq(ownersTable.id, params.data.id));

  const [owner] = await db.update(ownersTable).set({ ...parsed.data, updatedById: req.session.userId })
    .where(eq(ownersTable.id, params.data.id)).returning();
  if (!owner) { res.status(404).json({ error: "Owner not found" }); return; }

  // If refereeId changed, bust commission cache for both old and new referee
  if ("refereeId" in parsed.data) {
    const oldRefereeId = existing?.refereeId ?? null;
    const newRefereeId = parsed.data.refereeId ?? null;
    if (oldRefereeId !== newRefereeId) {
      if (oldRefereeId !== null) bustCommissionCache(oldRefereeId);
      if (newRefereeId !== null) bustCommissionCache(newRefereeId);
    }
  }

  res.json(formatOwner(owner));
});

// All properties for this owner (primary + co-owned via property_owners)
router.get("/owners/:id/properties", requireAuth, async (req, res): Promise<void> => {
  const ownerId = parseInt(req.params.id, 10);
  if (!ownerId) { res.status(400).json({ error: "Invalid id" }); return; }

  // Primary-owned
  const primary = await db.select().from(propertiesTable)
    .where(eq(propertiesTable.ownerId, ownerId))
    .orderBy(desc(propertiesTable.createdAt));

  // Co-owned (in property_owners but not the primary owner_id)
  const coRows = await db
    .select({ propertyId: propertyOwnersTable.propertyId, ownershipPercentage: propertyOwnersTable.ownershipPercentage, isPrimary: propertyOwnersTable.isPrimary })
    .from(propertyOwnersTable)
    .where(eq(propertyOwnersTable.ownerId, ownerId));

  const primaryIds = new Set(primary.map(p => p.id));
  const coOnlyIds  = coRows.filter(r => !primaryIds.has(r.propertyId));

  const coProps = coOnlyIds.length
    ? await db.select().from(propertiesTable)
        .where(or(...coOnlyIds.map(r => eq(propertiesTable.id, r.propertyId))))
    : [];

  const coOwnershipMap = Object.fromEntries(coRows.map(r => [r.propertyId, { ownershipPercentage: r.ownershipPercentage, isPrimary: r.isPrimary }]));

  const result = [
    ...primary.map(p => ({ ...p, coOwnership: coOwnershipMap[p.id] ?? null, isCoOwned: false })),
    ...coProps.map(p => ({ ...p, coOwnership: coOwnershipMap[p.id] ?? null, isCoOwned: true })),
  ];

  res.json(result);
});

router.delete("/owners/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteOwnerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(ownersTable).set({ isArchived: true }).where(eq(ownersTable.id, params.data.id));
  res.json({ message: "Owner archived" });
});

export default router;
