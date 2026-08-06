import { Router, type IRouter } from "express";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, amenitiesTable, propertyAmenitiesTable, propertiesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// ── GET /amenities ──────────────────────────────────────────────
// Returns all active amenities, ordered by category + sortOrder
router.get("/amenities", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(amenitiesTable)
    .where(eq(amenitiesTable.isActive, true))
    .orderBy(amenitiesTable.category, amenitiesTable.sortOrder, amenitiesTable.name);
  res.json(rows);
});

// ── POST /amenities ─────────────────────────────────────────────
// Admin: create a new amenity
const AmenityInput = z.object({
  category:           z.string().min(1),
  name:               z.string().min(1),
  icon:               z.string().default("✓"),
  description:        z.string().optional(),
  adrBoost:           z.number().default(0),
  occupancyBoost:     z.number().default(0),
  luxuryScore:        z.number().int().default(0),
  guestAppealScore:   z.number().int().default(0),
  familyScore:        z.number().int().default(0),
  corporateScore:     z.number().int().default(0),
  holidayHomeScore:   z.number().int().default(0),
  isProposalHighlight: z.boolean().default(false),
  seoKeyword:         z.string().optional(),
  sortOrder:          z.number().int().default(0),
});

router.post("/amenities", requireAuth, async (req, res): Promise<void> => {
  const parsed = AmenityInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [amenity] = await db.insert(amenitiesTable).values(parsed.data).returning();
  res.status(201).json(amenity);
});

// ── PATCH /amenities/:id ────────────────────────────────────────
router.patch("/amenities/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AmenityInput.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [amenity] = await db.update(amenitiesTable).set(parsed.data).where(eq(amenitiesTable.id, id)).returning();
  if (!amenity) { res.status(404).json({ error: "Not found" }); return; }
  res.json(amenity);
});

// ── GET /properties/:id/amenities ───────────────────────────────
router.get("/properties/:id/amenities", requireAuth, async (req, res): Promise<void> => {
  const propertyId = parseInt(req.params.id);
  if (isNaN(propertyId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db
    .select({ amenityId: propertyAmenitiesTable.amenityId })
    .from(propertyAmenitiesTable)
    .where(eq(propertyAmenitiesTable.propertyId, propertyId));
  res.json(rows.map(r => r.amenityId));
});

// ── PUT /properties/:id/amenities ───────────────────────────────
// Replaces all amenity associations for the property
router.put("/properties/:id/amenities", requireAuth, async (req, res): Promise<void> => {
  const propertyId = parseInt(req.params.id);
  if (isNaN(propertyId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = z.object({ amenityIds: z.array(z.number().int()) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { amenityIds } = parsed.data;

  // Verify property exists
  const [prop] = await db.select({ id: propertiesTable.id }).from(propertiesTable).where(eq(propertiesTable.id, propertyId));
  if (!prop) { res.status(404).json({ error: "Property not found" }); return; }

  // Replace all associations in a transaction
  await db.transaction(async (tx) => {
    await tx.delete(propertyAmenitiesTable).where(eq(propertyAmenitiesTable.propertyId, propertyId));
    if (amenityIds.length > 0) {
      await tx.insert(propertyAmenitiesTable).values(
        amenityIds.map(amenityId => ({ propertyId, amenityId }))
      );
    }

    // Sync isWaterfront / hasPrivatePool flags from amenity selections
    if (amenityIds.length > 0) {
      const selected = await tx
        .select({ name: amenitiesTable.name })
        .from(amenitiesTable)
        .where(inArray(amenitiesTable.id, amenityIds));
      const names = selected.map(r => r.name.toLowerCase());
      await tx.update(propertiesTable)
        .set({
          isWaterfront:   names.some(n => n.includes("waterfront") || n.includes("beachfront")),
          hasPrivatePool: names.some(n => n.includes("private pool") || n.includes("infinity pool") || n.includes("plunge pool")),
        })
        .where(eq(propertiesTable.id, propertyId));
    } else {
      await tx.update(propertiesTable)
        .set({ isWaterfront: false, hasPrivatePool: false })
        .where(eq(propertiesTable.id, propertyId));
    }
  });

  res.json({ ok: true, count: amenityIds.length });
});

export default router;
