import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, propertiesTable, ownersTable } from "@workspace/db";
import {
  CreatePropertyBody,
  UpdatePropertyBody,
  GetPropertyParams,
  UpdatePropertyParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatProperty(p: any, ownerName?: string | null) {
  return {
    id: p.id,
    ownerId: p.ownerId,
    ownerName: ownerName ?? null,
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
    ownerName = owner ? `${owner.firstName} ${owner.lastName}` : null;
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
    ownerName = owner ? `${owner.firstName} ${owner.lastName}` : null;
  }
  res.json(formatProperty(prop, ownerName));
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

export default router;
