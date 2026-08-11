import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ── helpers ────────────────────────────────────────────────────────────────────

async function enrichRow(row: any) {
  return {
    id:                   row.id,
    status:               row.status,
    ownerId:              row.owner_id,
    propertyId:           row.property_id,
    representativeId:     row.representative_id,
    representativeName:   row.representative_name ?? null,
    refereeId:            row.referee_id,
    refereeName:          row.referee_name ?? null,
    ownerFirstName:       row.owner_first_name,
    ownerLastName:        row.owner_last_name,
    ownerEmail:           row.owner_email,
    ownerPhone:           row.owner_phone,
    ownerWhatsapp:        row.owner_whatsapp,
    ownerNationality:     row.owner_nationality,
    ownerType:            row.owner_type,
    propertyEmirate:      row.property_emirate,
    propertyArea:         row.property_area,
    propertyCommunity:    row.property_community,
    propertyDevelopment:  row.property_development,
    propertyUnitNumber:   row.property_unit_number,
    propertyType:         row.property_type,
    propertyBedrooms:     row.property_bedrooms,
    propertyBathrooms:    row.property_bathrooms,
    propertyInternalArea: row.property_internal_area,
    propertyFurnishing:   row.property_furnishing,
    propertyCondition:    row.property_condition,
    propertyView:         row.property_view,
    propertyIsWaterfront: row.property_is_waterfront,
    mediaUrls:            row.media_urls ?? [],
    notes:                row.notes,
    createdById:          row.created_by_id,
    createdByName:        row.created_by_name ?? null,
    reviewedById:         row.reviewed_by_id,
    convertedForecastId:  row.converted_forecast_id,
    createdAt:            row.created_at,
    updatedAt:            row.updated_at,
  };
}

const LIST_QUERY = sql`
  SELECT
    fr.*,
    rep.name  AS representative_name,
    ref.name  AS referee_name,
    cb.name   AS created_by_name
  FROM forecast_requests fr
  LEFT JOIN users rep    ON rep.id = fr.representative_id
  LEFT JOIN referees ref ON ref.id = fr.referee_id
  LEFT JOIN users cb     ON cb.id  = fr.created_by_id
  ORDER BY fr.created_at DESC
`;

// ── GET /forecast-requests ─────────────────────────────────────────────────────
router.get("/forecast-requests", requireAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(LIST_QUERY);
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
    // Build PG array literal safely
    const mediaLiteral = "'{" + mediaUrls.map((u: string) => `"${u.replace(/"/g, '\\"')}"`).join(",") + "}'";

    const result = await db.execute(sql`
      INSERT INTO forecast_requests (
        owner_id, property_id, representative_id, referee_id,
        owner_first_name, owner_last_name, owner_email, owner_phone,
        owner_whatsapp, owner_nationality, owner_type,
        property_emirate, property_area, property_community,
        property_development, property_unit_number, property_type,
        property_bedrooms, property_bathrooms, property_internal_area,
        property_furnishing, property_condition, property_view,
        property_is_waterfront, media_urls, notes, created_by_id
      ) VALUES (
        ${b.ownerId ?? null},
        ${b.propertyId ?? null},
        ${b.representativeId ?? null},
        ${b.refereeId ?? null},
        ${b.ownerFirstName ?? null},
        ${b.ownerLastName ?? null},
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
        ${b.propertyBedrooms ?? null},
        ${b.propertyBathrooms ?? null},
        ${b.propertyInternalArea ?? null},
        ${b.propertyFurnishing ?? null},
        ${b.propertyCondition ?? null},
        ${b.propertyView ?? null},
        ${b.propertyIsWaterfront ?? false},
        ${sql.raw(mediaLiteral)}::text[],
        ${b.notes ?? null},
        ${user?.id ?? null}
      )
      RETURNING id
    `);

    const newId = (result.rows[0] as any).id;

    // Return the full enriched row
    const row = await db.execute(sql`
      SELECT fr.*,
        rep.name AS representative_name,
        ref.name AS referee_name,
        cb.name  AS created_by_name
      FROM forecast_requests fr
      LEFT JOIN users rep    ON rep.id = fr.representative_id
      LEFT JOIN referees ref ON ref.id = fr.referee_id
      LEFT JOIN users cb     ON cb.id  = fr.created_by_id
      WHERE fr.id = ${newId}
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
      SELECT fr.*,
        CONCAT(rep.first_name, ' ', rep.last_name) AS representative_name,
        CONCAT(ref.first_name, ' ', ref.last_name)  AS referee_name,
        CONCAT(cb.first_name, ' ', cb.last_name)    AS created_by_name
      FROM forecast_requests fr
      LEFT JOIN users rep ON rep.id = fr.representative_id
      LEFT JOIN referees ref ON ref.id = fr.referee_id
      LEFT JOIN users cb  ON cb.id  = fr.created_by_id
      WHERE fr.id = ${id}
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
      SELECT fr.*,
        CONCAT(rep.first_name, ' ', rep.last_name) AS representative_name,
        CONCAT(ref.first_name, ' ', ref.last_name)  AS referee_name,
        CONCAT(cb.first_name, ' ', cb.last_name)    AS created_by_name
      FROM forecast_requests fr
      LEFT JOIN users rep ON rep.id = fr.representative_id
      LEFT JOIN referees ref ON ref.id = fr.referee_id
      LEFT JOIN users cb  ON cb.id  = fr.created_by_id
      WHERE fr.id = ${id}
    `);
    res.json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] status update error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;
