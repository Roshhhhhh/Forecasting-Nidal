import { Router, type IRouter } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, propertiesTable, ownersTable, propertyOwnersTable } from "@workspace/db";
import {
  CreatePropertyBody,
  UpdatePropertyBody,
  GetPropertyParams,
  UpdatePropertyParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
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
      ownershipType:       (propertyOwnersTable as any).ownershipType,
      notes:               (propertyOwnersTable as any).notes,
      firstName:           ownersTable.firstName,
      lastName:            ownersTable.lastName,
      title:               ownersTable.title,
      email:               ownersTable.email,
      phone:               ownersTable.phone,
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
    phone: r.phone,
    ownershipPercentage: r.ownershipPercentage,
    isPrimary: r.isPrimary,
    ownershipType: r.ownershipType ?? null,
    notes: r.notes ?? null,
  }));
}

router.get("/properties", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      prop: propertiesTable,
      ownerFirstName: ownersTable.firstName,
      ownerLastName: ownersTable.lastName,
      ownerTitle: ownersTable.title,
      ownerCompanyName: ownersTable.companyName,
    })
    .from(propertiesTable)
    .leftJoin(ownersTable, eq(ownersTable.id, propertiesTable.ownerId))
    .where(eq(propertiesTable.isArchived, false))
    .orderBy(desc(propertiesTable.createdAt));

  res.json(rows.map(r => {
    const ownerName = r.ownerCompanyName
      ? r.ownerCompanyName
      : r.ownerFirstName
        ? [r.ownerTitle, r.ownerFirstName, r.ownerLastName].filter(Boolean).join(" ")
        : null;
    return formatProperty(r.prop, ownerName);
  }));
});

router.post("/properties", requireAuth, async (req, res): Promise<void> => {
  // Extract owners array before main validation (not part of the codegen schema)
  const ownersArray: Array<{ ownerId: number; ownershipPercentage?: number; ownershipType?: string; isPrimary?: boolean; notes?: string }> =
    Array.isArray(req.body.owners) ? req.body.owners : [];
  const bodyWithoutOwners = { ...req.body };
  delete bodyWithoutOwners.owners;

  // If owners array provided, derive ownerId from the primary (or first) owner
  if (ownersArray.length > 0 && !bodyWithoutOwners.ownerId) {
    const primary = ownersArray.find(o => o.isPrimary) ?? ownersArray[0];
    bodyWithoutOwners.ownerId = primary.ownerId;
  }

  const parsed = CreatePropertyBody.safeParse(bodyWithoutOwners);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Duplicate detection: block if unit_number AND project_building already exist on a non-archived property
  const { unitNumber, projectBuilding } = parsed.data as any;
  if (unitNumber && projectBuilding) {
    const [existing] = await db
      .select({ id: propertiesTable.id })
      .from(propertiesTable)
      .where(and(
        eq(propertiesTable.isArchived, false),
        eq((propertiesTable as any).unitNumber, unitNumber),
        eq((propertiesTable as any).projectBuilding, projectBuilding),
      ))
      .limit(1);
    if (existing) {
      res.status(409).json({
        error: `A property with unit ${unitNumber} in ${projectBuilding} already exists. Check the existing record before creating a new one.`,
        existingId: existing.id,
      });
      return;
    }
  }

  const [prop] = await db.insert(propertiesTable).values({ ...parsed.data, createdById: req.session.userId }).returning();

  if (ownersArray.length > 0) {
    // Deduplicate by ownerId
    const seenOwners = new Set<number>();
    const dedupedOwners = ownersArray.filter(e => {
      if (!e.ownerId || seenOwners.has(e.ownerId)) return false;
      seenOwners.add(e.ownerId);
      return true;
    });

    // Validate: reject multiple isPrimary: true
    const primaryCount = dedupedOwners.filter(e => e.isPrimary).length;
    if (primaryCount > 1) {
      res.status(400).json({ error: "Exactly one owner may be marked as primary" }); return;
    }
    // Normalize: ensure exactly one primary
    if (primaryCount === 0 && dedupedOwners.length > 0) dedupedOwners[0].isPrimary = true;

    // Write all junction rows and keep legacy column in sync — atomically
    const primaryEntry = dedupedOwners.find(e => e.isPrimary) ?? dedupedOwners[0];
    await db.transaction(async (tx) => {
      for (const entry of dedupedOwners) {
        await tx.insert(propertyOwnersTable).values({
          propertyId: prop.id,
          ownerId: entry.ownerId,
          ownershipPercentage: entry.ownershipPercentage ?? 100,
          isPrimary: !!entry.isPrimary,
          ...(entry.ownershipType ? { ownershipType: entry.ownershipType } : {}),
          ...(entry.notes         ? { notes: entry.notes }                 : {}),
        } as any).onConflictDoNothing();
      }
      // Sync legacy column once, deterministically
      await tx.update(propertiesTable)
        .set({ ownerId: primaryEntry.ownerId })
        .where(eq(propertiesTable.id, prop.id));
    });
  } else if (prop.ownerId) {
    // Backward-compat: auto-seed primary co-owner row from ownerId column
    await db.insert(propertyOwnersTable).values({
      propertyId: prop.id,
      ownerId: prop.ownerId,
      ownershipPercentage: 100,
      isPrimary: true,
    } as any).onConflictDoNothing();
  }

  let ownerName: string | null = null;
  if (prop.ownerId) {
    const [owner] = await db.select().from(ownersTable).where(eq(ownersTable.id, prop.ownerId));
    ownerName = owner ? [owner.title, owner.firstName, owner.lastName].filter(Boolean).join(" ") : null;
  }
  const coOwners = await getCoOwners(prop.id);
  res.status(201).json(formatProperty(prop, ownerName, coOwners));
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
  ownershipPercentage: z.number().min(0).max(100).default(100),
  isPrimary:           z.boolean().default(false),
  ownershipType:       z.string().optional(),
  notes:               z.string().optional(),
});

const UpdateCoOwnerBody = z.object({
  ownershipPercentage: z.number().min(0).max(100).optional(),
  isPrimary:           z.boolean().optional(),
  ownershipType:       z.string().optional(),
  notes:               z.string().optional(),
});

router.get("/properties/:id/owners", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  res.json(await getCoOwners(id));
});

router.post("/properties/:id/owners", requireAuth, async (req, res): Promise<void> => {
  const propertyId = parseInt(req.params.id as string, 10);
  if (!propertyId) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CoOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Reject duplicate — don't clear the existing primary before a silent no-op
  const [existing] = await db.select({ id: propertyOwnersTable.id })
    .from(propertyOwnersTable)
    .where(and(
      eq(propertyOwnersTable.propertyId, propertyId),
      eq(propertyOwnersTable.ownerId, parsed.data.ownerId),
    ));
  if (existing) { res.status(409).json({ error: "This owner is already linked to the property" }); return; }

  // Enforce 100% cap
  const currentRows = await db.select({ pct: propertyOwnersTable.ownershipPercentage })
    .from(propertyOwnersTable)
    .where(eq(propertyOwnersTable.propertyId, propertyId));
  const currentTotal = currentRows.reduce((s, r) => s + (r.pct ?? 0), 0);
  if (currentTotal + (parsed.data.ownershipPercentage ?? 0) > 100) {
    res.status(422).json({
      error: `Adding this stake would bring total ownership to ${currentTotal + (parsed.data.ownershipPercentage ?? 0)}% — cannot exceed 100%.`,
    });
    return;
  }

  await db.transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      // Clear existing primaries before inserting the new one
      await tx.update(propertyOwnersTable)
        .set({ isPrimary: false })
        .where(eq(propertyOwnersTable.propertyId, propertyId));
    }
    await tx.insert(propertyOwnersTable).values({
      propertyId,
      ownerId:             parsed.data.ownerId,
      ownershipPercentage: parsed.data.ownershipPercentage,
      isPrimary:           parsed.data.isPrimary,
      ...(parsed.data.ownershipType ? { ownershipType: parsed.data.ownershipType } : {}),
      ...(parsed.data.notes         ? { notes: parsed.data.notes }                : {}),
    } as any);
    // Sync legacy column if this is the new primary
    if (parsed.data.isPrimary) {
      await tx.update(propertiesTable)
        .set({ ownerId: parsed.data.ownerId })
        .where(eq(propertiesTable.id, propertyId));
    }
  });

  res.status(201).json(await getCoOwners(propertyId));
});

router.patch("/properties/:id/owners/:ownerId", requireAuth, async (req, res): Promise<void> => {
  const propertyId = parseInt(req.params.id as string, 10);
  const ownerId    = parseInt(req.params.ownerId as string, 10);
  if (!propertyId || !ownerId) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateCoOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Verify the junction row exists before mutating primary flags
  const [target] = await db.select({ id: propertyOwnersTable.id, pct: propertyOwnersTable.ownershipPercentage })
    .from(propertyOwnersTable)
    .where(and(
      eq(propertyOwnersTable.propertyId, propertyId),
      eq(propertyOwnersTable.ownerId, ownerId),
    ));
  if (!target) { res.status(404).json({ error: "Ownership record not found" }); return; }

  // Enforce 100% cap when changing the percentage
  if (parsed.data.ownershipPercentage !== undefined) {
    const allRows = await db.select({ pct: propertyOwnersTable.ownershipPercentage, oid: propertyOwnersTable.ownerId })
      .from(propertyOwnersTable)
      .where(eq(propertyOwnersTable.propertyId, propertyId));
    const othersTotal = allRows.filter(r => r.oid !== ownerId).reduce((s, r) => s + (r.pct ?? 0), 0);
    if (othersTotal + parsed.data.ownershipPercentage > 100) {
      res.status(422).json({
        error: `This would bring total ownership to ${othersTotal + parsed.data.ownershipPercentage}% — cannot exceed 100%.`,
      });
      return;
    }
  }

  await db.transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      // Clear other primaries first, then set this one
      await tx.update(propertyOwnersTable)
        .set({ isPrimary: false })
        .where(eq(propertyOwnersTable.propertyId, propertyId));
    }
    await tx.update(propertyOwnersTable)
      .set(parsed.data as any)
      .where(and(
        eq(propertyOwnersTable.propertyId, propertyId),
        eq(propertyOwnersTable.ownerId, ownerId),
      ));
    // Sync legacy column when a new primary is designated
    if (parsed.data.isPrimary) {
      await tx.update(propertiesTable)
        .set({ ownerId })
        .where(eq(propertiesTable.id, propertyId));
    }
  });

  res.json(await getCoOwners(propertyId));
});

router.delete("/properties/:id/owners/:ownerId", requireAuth, async (req, res): Promise<void> => {
  const propertyId = parseInt(req.params.id as string, 10);
  const ownerId    = parseInt(req.params.ownerId as string, 10);
  if (!propertyId || !ownerId) { res.status(400).json({ error: "Invalid id" }); return; }

  // Read the record being deleted before we remove it
  const [target] = await db.select({
    id:        propertyOwnersTable.id,
    isPrimary: propertyOwnersTable.isPrimary,
  })
    .from(propertyOwnersTable)
    .where(and(
      eq(propertyOwnersTable.propertyId, propertyId),
      eq(propertyOwnersTable.ownerId, ownerId),
    ));
  if (!target) { res.status(404).json({ error: "Ownership record not found" }); return; }

  await db.transaction(async (tx) => {
    await tx.delete(propertyOwnersTable).where(and(
      eq(propertyOwnersTable.propertyId, propertyId),
      eq(propertyOwnersTable.ownerId, ownerId),
    ));

    if (target.isPrimary) {
      // Promote the next remaining owner (ordered by earliest created) as the new primary
      const [next] = await tx.select({ ownerId: propertyOwnersTable.ownerId })
        .from(propertyOwnersTable)
        .where(eq(propertyOwnersTable.propertyId, propertyId))
        .orderBy(propertyOwnersTable.createdAt)
        .limit(1);

      if (next) {
        await tx.update(propertyOwnersTable)
          .set({ isPrimary: true })
          .where(and(
            eq(propertyOwnersTable.propertyId, propertyId),
            eq(propertyOwnersTable.ownerId, next.ownerId),
          ));
        await tx.update(propertiesTable)
          .set({ ownerId: next.ownerId })
          .where(eq(propertiesTable.id, propertyId));
      } else {
        // No remaining owners — clear the legacy column
        await tx.update(propertiesTable)
          .set({ ownerId: null } as any)
          .where(eq(propertiesTable.id, propertyId));
      }
    }
  });

  res.json(await getCoOwners(propertyId));
});

router.delete("/properties/:id", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(propertiesTable).set({ isArchived: true } as any).where(eq(propertiesTable.id, id));
  res.json({ message: "Property archived" });
});

export default router;
