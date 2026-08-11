import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ── shared SQL fragment ────────────────────────────────────────────────────────
const SELECT_COLS = sql`
  fr.*,
  rep.name AS representative_name,
  cb.name  AS created_by_name
`;

const JOINS = sql`
  FROM forecast_requests fr
  LEFT JOIN users rep ON rep.id = fr.representative_id
  LEFT JOIN users cb  ON cb.id  = fr.created_by_id
`;

// ── enrichRow ──────────────────────────────────────────────────────────────────
function enrichRow(row: any) {
  return {
    id:                           row.id,
    status:                       row.status,
    ownerId:                      row.owner_id,
    propertyId:                   row.property_id,
    representativeId:             row.representative_id,
    representativeName:           row.representative_name ?? null,
    // free-text referee from form (new)
    refereeName:                  row.referee_name ?? null,
    // legacy FK (kept for compat, not used in new form)
    refereeId:                    row.referee_id,
    // owner fields
    ownerTitle:                   row.owner_title ?? null,
    ownerFirstName:               row.owner_first_name ?? null,
    ownerLastName:                row.owner_last_name ?? null,
    ownerCompanyName:             row.owner_company_name ?? null,
    ownerContactPerson:           row.owner_contact_person ?? null,
    ownerContactPosition:         row.owner_contact_position ?? null,
    ownerEmail:                   row.owner_email ?? null,
    ownerPhone:                   row.owner_phone ?? null,
    ownerWhatsapp:                row.owner_whatsapp ?? null,
    ownerNationality:             row.owner_nationality ?? null,
    ownerType:                    row.owner_type ?? "individual",
    // property fields
    propertyEmirate:              row.property_emirate ?? null,
    propertyArea:                 row.property_area ?? null,
    propertyCommunity:            row.property_community ?? null,
    propertyDevelopment:          row.property_development ?? null,
    propertyUnitNumber:           row.property_unit_number ?? null,
    propertyType:                 row.property_type ?? null,
    propertyLayout:               row.property_layout ?? null,
    propertyBedrooms:             row.property_bedrooms ?? null,
    propertyBathrooms:            row.property_bathrooms ?? null,
    propertyInternalArea:         row.property_internal_area ?? null,
    propertyFurnishing:           row.property_furnishing ?? null,
    propertyCondition:            row.property_condition ?? null,
    propertyView:                 row.property_view ?? null,
    propertyIsWaterfront:         row.property_is_waterfront ?? false,
    // commercial
    proposedManagementCommission: row.proposed_management_commission ?? "20%",
    // media + notes
    mediaUrls:                    row.media_urls ?? [],
    notes:                        row.notes ?? null,
    // meta
    createdById:                  row.created_by_id ?? null,
    createdByName:                row.created_by_name ?? null,
    reviewedById:                 row.reviewed_by_id ?? null,
    convertedForecastId:          row.converted_forecast_id ?? null,
    createdAt:                    row.created_at ?? null,
    updatedAt:                    row.updated_at ?? null,
  };
}

// ── GET /forecast-requests ─────────────────────────────────────────────────────
router.get("/forecast-requests", requireAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(sql`
      SELECT ${SELECT_COLS} ${JOINS} ORDER BY fr.created_at DESC
    `);
    res.json(rows.rows.map(enrichRow));
  } catch (err) {
    console.error("[forecast-requests] list error:", err);
    res.status(500).json({ error: "Failed to load forecast requests" });
  }
});

// ── POST /forecast-requests ────────────────────────────────────────────────────
router.post("/forecast-requests", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = (req as any).user;
    const b = req.body;

    const mediaUrls = Array.isArray(b.mediaUrls) ? b.mediaUrls : [];
    const mediaLiteral = "'{" + mediaUrls.map((u: string) => `"${u.replace(/"/g, '\\"')}"`).join(",") + "}'";

    // Derive bedrooms from layout
    let bedrooms: number | null = null;
    if (b.propertyLayout === "Studio") bedrooms = 0;
    else if (b.propertyLayout) {
      const m = String(b.propertyLayout).match(/^(\d+)/);
      if (m) bedrooms = parseInt(m[1], 10);
    }
    if (b.propertyBedrooms !== undefined && b.propertyBedrooms !== null) {
      bedrooms = parseInt(b.propertyBedrooms, 10);
    }

    const result = await db.execute(sql`
      INSERT INTO forecast_requests (
        owner_id, property_id,
        owner_title, owner_first_name, owner_last_name,
        owner_company_name, owner_contact_person, owner_contact_position,
        owner_email, owner_phone, owner_whatsapp, owner_nationality, owner_type,
        property_emirate, property_area, property_community,
        property_development, property_unit_number, property_type, property_layout,
        property_bedrooms, property_bathrooms, property_internal_area,
        property_furnishing, property_condition, property_view, property_is_waterfront,
        proposed_management_commission, referee_name,
        media_urls, notes, created_by_id
      ) VALUES (
        ${b.ownerId ?? null},
        ${b.propertyId ?? null},
        ${b.ownerTitle ?? null},
        ${b.ownerFirstName ?? null},
        ${b.ownerLastName ?? null},
        ${b.ownerCompanyName ?? null},
        ${b.ownerContactPerson ?? null},
        ${b.ownerContactPosition ?? null},
        ${b.ownerEmail ?? null},
        ${b.ownerPhone ?? null},
        ${b.ownerWhatsapp ?? null},
        ${b.ownerNationality ?? null},
        ${b.ownerType ?? "individual"},
        ${b.propertyEmirate ?? null},
        ${b.propertyArea ?? null},
        ${b.propertyCommunity ?? null},
        ${b.propertyDevelopment ?? null},
        ${b.propertyUnitNumber ?? null},
        ${b.propertyType ?? null},
        ${b.propertyLayout ?? null},
        ${bedrooms},
        ${b.propertyBathrooms ?? null},
        ${b.propertyInternalArea ?? null},
        ${b.propertyFurnishing ?? null},
        ${b.propertyCondition ?? null},
        ${b.propertyView ?? null},
        ${b.propertyIsWaterfront ?? false},
        ${b.proposedManagementCommission ?? "20%"},
        ${b.refereeName ?? null},
        ${sql.raw(mediaLiteral)}::text[],
        ${b.notes ?? null},
        ${user?.id ?? null}
      )
      RETURNING id
    `);

    const newId = (result.rows[0] as any).id;
    const row = await db.execute(sql`
      SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${newId}
    `);
    res.status(201).json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] create error:", err);
    res.status(500).json({ error: "Failed to create forecast request" });
  }
});

// ── GET /forecast-requests/:id ────────────────────────────────────────────────
router.get("/forecast-requests/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await db.execute(sql`
      SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${id}
    `);
    if (!row.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    res.json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] get error:", err);
    res.status(500).json({ error: "Failed to load forecast request" });
  }
});

// ── PATCH /forecast-requests/:id/status ───────────────────────────────────────
router.patch("/forecast-requests/:id/status", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, reviewedById } = req.body;
    const validStatuses = ["pending", "in_review", "converted", "declined"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    await db.execute(sql`
      UPDATE forecast_requests
      SET status = ${status},
          reviewed_by_id = ${reviewedById ?? null},
          updated_at = NOW()
      WHERE id = ${id}
    `);
    const row = await db.execute(sql`
      SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${id}
    `);
    res.json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;
