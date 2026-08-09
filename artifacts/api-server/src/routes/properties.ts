import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, propertiesTable, ownersTable } from "@workspace/db";
import { propertyOwnersTable } from "@workspace/db/schema";
import {
  CreatePropertyBody,
  UpdatePropertyBody,
  GetPropertyParams,
  UpdatePropertyParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

function formatProperty(p: any, ownerName?: string | null, coOwners?: any[]) {
  return {
    id: p.id,
    ownerId: p.ownerId,
    ownerName: ownerName ?? null,
    coOwners: coOwners ?? [],
    emirate: p.emirate,
    area: p.area,
    community: p.community,
    development: p.development,
    projectBuilding: p.projectBuilding,
    tower: p.tower,
    unitNumber: p.unitNumber,
    floor: p.floor,
    propertyType: p.propertyType,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    hasMaidsRoom: p.hasMaidsRoom,
    hasStudy: p.hasStudy,
    hasMainRoom: (p as any).hasMainRoom ?? false,
    balconies: p.balconies,
    parkingSpaces: p.parkingSpaces,
    internalArea: p.internalArea,
    externalArea: p.externalArea,
    furnishingStatus: p.furnishingStatus,
    propertyCondition: p.propertyCondition,
    view: p.view,
    floorCategory: p.floorCategory,
    isWaterfront: p.isWaterfront,
    hasPrivatePool: p.hasPrivatePool,
    dctPermitStatus: p.dctPermitStatus,
    currentTenancyStatus: p.currentTenancyStatus,
    currentAnnualRent: p.currentAnnualRent,
    availabilityDate: p.availabilityDate,
    heroImageUrl: p.heroImageUrl,
    createdAt: p.createdAt,
  };
}

async function getCoOwners(propertyId: number) {
  const rows = await db
    .select({
      id:                  propertyOwnersTable.id,
      ownerId:             propertyOwnersTable.ownerId,
      ownershipPercentage: propertyOwnersTable.ownershipPercentage,
      isPrimary:           propertyOwnersTable.isPrimary,
      firstName:           ownersTable.firstName,
      lastName:            ownersTable.lastName,
      title:               ownersTable.title,
      email:               ownersTable.email,
    })
    .from(propertyOwnersTable)
    .innerJoin(ownersTable, eq(ownersTable.id, propertyOwnersTable.ownerId))
    .where(eq(propertyOwnersTable.propertyId, propertyId))
    .orderBy(desc(propertyOwnersTable.isPrimary), propertyOwnersTable.createdAt);

  return rows.map(r => ({
    id: r.id,
    ownerId: r.ownerId,
    ownerName: [r.title, r.firstName, r.lastName].filter(Boolean).join(" "),
    email: r.email,
    ownershipPercentage: r.ownershipPercentage,
    isPrimary: r.isPrimary,
  }));
}

router.get("/properties", requireAuth, async (_req, res): Promise<void> => {
  const props = await db.select().from(propertiesTable)
    .where(eq(propertiesTable.isArchived, false))
    .orderBy(desc(propertiesTable.createdAt));
  res.json(props.map(p => formatProperty(p)));
});

router.post("/properties", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [prop] = await db.insert(propertiesTable).values({ ...parsed.data, createdById: req.session.userId }).returning();
  let ownerName: string | null = null;
  if (prop.ownerId) {
    const [owner] = await db.select().from(ownersTable).where(eq(ownersTable.id, prop.ownerId));
    ownerName = owner ? [owner.title, owner.firstName, owner.lastName].filter(Boolean).join(" ") : null;
    // Auto-seed primary co-owner row
    await db.insert(propertyOwnersTable).values({
      propertyId: prop.id,
      ownerId: prop.ownerId,
      ownershipPercentage: 100,
      isPrimary: true,
    }).onConflictDoNothing();
  }
  res.status(201).json(formatProperty(prop, ownerName));
});

router.get("/properties/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetPropertyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, params.data.id));
  if (!prop) { res.status(404).json({ error: "Property not found" }); return; }
  let ownerName: string | null = null;
  if (prop.ownerId) {
    const [owner] = await db.select().from(ownersTable).where(eq(ownersTable.id, prop.ownerId));
    ownerName = owner ? [owner.title, owner.firstName, owner.lastName].filter(Boolean).join(" ") : null;
  }
  const coOwners = await getCoOwners(params.data.id);
  res.json(formatProperty(prop, ownerName, coOwners));
});

router.patch("/properties/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdatePropertyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [prop] = await db.update(propertiesTable).set({ ...parsed.data, updatedById: req.session.userId })
    .where(eq(propertiesTable.id, params.data.id)).returning();
  if (!prop) { res.status(404).json({ error: "Property not found" }); return; }
  res.json(formatProperty(prop));
});

// ── Co-owner endpoints ────────────────────────────────────────────────────────

const CoOwnerBody = z.object({
  ownerId:             z.number().int().positive(),
  ownershipPercentage: z.number().min(0.1).max(100).default(100),
  isPrimary:           z.boolean().default(false),
});

const UpdateCoOwnerBody = z.object({
  ownershipPercentage: z.number().min(0.1).max(100).optional(),
  isPrimary:           z.boolean().optional(),
});

router.get("/properties/:id/owners", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  res.json(await getCoOwners(id));
});

router.post("/properties/:id/owners", requireAuth, async (req, res): Promise<void> => {
  const propertyId = parseInt(req.params.id, 10);
  if (!propertyId) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CoOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // If setting as primary, clear other primaries first
  if (parsed.data.isPrimary) {
    await db.update(propertyOwnersTable)
      .set({ isPrimary: false })
      .where(eq(propertyOwnersTable.propertyId, propertyId));
  }

  await db.insert(propertyOwnersTable).values({
    propertyId,
    ownerId:             parsed.data.ownerId,
    ownershipPercentage: parsed.data.ownershipPercentage,
    isPrimary:           parsed.data.isPrimary,
  }).onConflictDoNothing();

  res.status(201).json(await getCoOwners(propertyId));
});

router.patch("/properties/:id/owners/:ownerId", requireAuth, async (req, res): Promise<void> => {
  const propertyId = parseInt(req.params.id, 10);
  const ownerId    = parseInt(req.params.ownerId, 10);
  if (!propertyId || !ownerId) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateCoOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.isPrimary) {
    await db.update(propertyOwnersTable)
      .set({ isPrimary: false })
      .where(eq(propertyOwnersTable.propertyId, propertyId));
  }

  await db.update(propertyOwnersTable)
    .set(parsed.data)
    .where(and(
      eq(propertyOwnersTable.propertyId, propertyId),
      eq(propertyOwnersTable.ownerId, ownerId),
    ));

  res.json(await getCoOwners(propertyId));
});

router.delete("/properties/:id/owners/:ownerId", requireAuth, async (req, res): Promise<void> => {
  const propertyId = parseInt(req.params.id, 10);
  const ownerId    = parseInt(req.params.ownerId, 10);
  if (!propertyId || !ownerId) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(propertyOwnersTable).where(and(
    eq(propertyOwnersTable.propertyId, propertyId),
    eq(propertyOwnersTable.ownerId, ownerId),
  ));

  res.json(await getCoOwners(propertyId));
});

export default router;
