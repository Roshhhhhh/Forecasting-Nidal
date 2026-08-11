import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ── shared SQL fragment ────────────────────────────────────────────────────────
const SELECT_COLS = sql`
  fr.*,
  rep.name  AS representative_name,
  cb.name   AS created_by_name,
  rm.name   AS assigned_rm_name,
  cvt.name  AS converted_by_name
`;

const JOINS = sql`
  FROM forecast_requests fr
  LEFT JOIN users rep ON rep.id = fr.representative_id
  LEFT JOIN users cb  ON cb.id  = fr.created_by_id
  LEFT JOIN users rm  ON rm.id  = fr.assigned_revenue_manager_id
  LEFT JOIN users cvt ON cvt.id = fr.converted_by_user_id
`;

// ── enrichRow ──────────────────────────────────────────────────────────────────
function enrichRow(row: any) {
  return {
    id:                           row.id,
    status:                       row.status,
    // linked records
    ownerId:                      row.owner_id ?? null,
    propertyId:                   row.property_id ?? null,
    convertedForecastId:          row.converted_forecast_id ?? null,
    // representative (legacy)
    representativeId:             row.representative_id ?? null,
    representativeName:           row.representative_name ?? null,
    // assigned RM
    assignedRevenueManagerId:     row.assigned_revenue_manager_id ?? null,
    assignedRevenueManagerName:   row.assigned_rm_name ?? null,
    // conversion
    convertedAt:                  row.converted_at ?? null,
    convertedByUserId:            row.converted_by_user_id ?? null,
    convertedByName:              row.converted_by_name ?? null,
    // free-text referee
    refereeName:                  row.referee_name ?? null,
    refereeId:                    row.referee_id ?? null,
    // owner fields (submitted values — immutable source of truth)
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
    // property fields (submitted values — immutable)
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
    createdAt:                    row.created_at ?? null,
    updatedAt:                    row.updated_at ?? null,
  };
}

// ── GET /forecast-requests ─────────────────────────────────────────────────────
router.get("/forecast-requests", requireAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db.execute(sql`SELECT ${SELECT_COLS} ${JOINS} ORDER BY fr.created_at DESC`);
    res.json(rows.rows.map(enrichRow));
  } catch (err) {
    console.error("[forecast-requests] list error:", err);
    res.status(500).json({ error: "Failed to load forecast requests" });
  }
});

// ── POST /public/forecast-requests (no auth — owner-facing landing page) ───────
router.post("/public/forecast-requests", async (req, res): Promise<void> => {
  try {
    const b = req.body;

    // Basic honeypot / sanity guard
    if (b._hp) { res.status(200).json({ ok: true }); return; } // spam trap

    // Require at minimum a name or company and a contact method
    const hasOwner = b.ownerFirstName?.trim() || b.ownerCompanyName?.trim();
    const hasContact = b.ownerEmail?.trim() || b.ownerPhone?.trim();
    if (!hasOwner || !hasContact) {
      res.status(400).json({ error: "Owner name and contact information are required." });
      return;
    }

    let bedrooms: number | null = null;
    if (b.propertyLayout === "Studio") bedrooms = 0;
    else if (b.propertyLayout) {
      const m = String(b.propertyLayout).match(/^(\d+)/);
      if (m) bedrooms = parseInt(m[1], 10);
    }

    const result = await db.execute(sql`
      INSERT INTO forecast_requests (
        owner_title, owner_first_name, owner_last_name,
        owner_company_name, owner_contact_person, owner_contact_position,
        owner_email, owner_phone, owner_whatsapp, owner_nationality, owner_type,
        property_emirate, property_area, property_community,
        property_development, property_unit_number, property_type, property_layout,
        property_bedrooms, property_bathrooms, property_internal_area,
        property_furnishing, property_view, property_is_waterfront,
        notes, created_by_id
      ) VALUES (
        ${b.ownerTitle ?? null}, ${b.ownerFirstName?.trim() ?? null}, ${b.ownerLastName?.trim() ?? null},
        ${b.ownerCompanyName?.trim() ?? null}, ${b.ownerContactPerson?.trim() ?? null}, ${b.ownerContactPosition?.trim() ?? null},
        ${b.ownerEmail?.trim() ?? null}, ${b.ownerPhone?.trim() ?? null}, ${b.ownerWhatsapp?.trim() ?? null},
        ${b.ownerNationality?.trim() ?? null}, ${b.ownerType ?? "individual"},
        ${b.propertyEmirate ?? null}, ${b.propertyArea ?? null}, ${b.propertyCommunity ?? null},
        ${b.propertyDevelopment?.trim() ?? null}, ${b.propertyUnitNumber?.trim() ?? null},
        ${b.propertyType ?? null}, ${b.propertyLayout ?? null},
        ${bedrooms}, ${b.propertyBathrooms ?? null}, ${b.propertyInternalArea ?? null},
        ${b.propertyFurnishing ?? null}, ${b.propertyView ?? null}, ${b.propertyIsWaterfront ?? false},
        ${b.notes?.trim() ?? null}, ${null}
      ) RETURNING id
    `);

    const newId = (result.rows[0] as any).id;
    res.status(201).json({ id: newId, ref: `FR-${String(newId).padStart(4, "0")}` });
  } catch (err) {
    console.error("[public/forecast-requests] create error:", err);
    res.status(500).json({ error: "Failed to submit request. Please try again." });
  }
});

// ── POST /forecast-requests ────────────────────────────────────────────────────
router.post("/forecast-requests", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = (req as any).user;
    const b = req.body;

    const mediaUrls = Array.isArray(b.mediaUrls) ? b.mediaUrls : [];
    const mediaLiteral = "'{" + mediaUrls.map((u: string) => `"${u.replace(/"/g, '\\"')}"`).join(",") + "}'";

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
        ${b.ownerId ?? null}, ${b.propertyId ?? null},
        ${b.ownerTitle ?? null}, ${b.ownerFirstName ?? null}, ${b.ownerLastName ?? null},
        ${b.ownerCompanyName ?? null}, ${b.ownerContactPerson ?? null}, ${b.ownerContactPosition ?? null},
        ${b.ownerEmail ?? null}, ${b.ownerPhone ?? null}, ${b.ownerWhatsapp ?? null},
        ${b.ownerNationality ?? null}, ${b.ownerType ?? "individual"},
        ${b.propertyEmirate ?? null}, ${b.propertyArea ?? null}, ${b.propertyCommunity ?? null},
        ${b.propertyDevelopment ?? null}, ${b.propertyUnitNumber ?? null},
        ${b.propertyType ?? null}, ${b.propertyLayout ?? null},
        ${bedrooms}, ${b.propertyBathrooms ?? null}, ${b.propertyInternalArea ?? null},
        ${b.propertyFurnishing ?? null}, ${b.propertyCondition ?? null},
        ${b.propertyView ?? null}, ${b.propertyIsWaterfront ?? false},
        ${b.proposedManagementCommission ?? "20%"}, ${b.refereeName ?? null},
        ${sql.raw(mediaLiteral)}::text[], ${b.notes ?? null}, ${user?.id ?? null}
      ) RETURNING id
    `);

    const newId = (result.rows[0] as any).id;
    const row = await db.execute(sql`SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${newId}`);
    res.status(201).json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] create error:", err);
    res.status(500).json({ error: "Failed to create forecast request" });
  }
});

// ── GET /forecast-requests/:id ─────────────────────────────────────────────────
router.get("/forecast-requests/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = await db.execute(sql`SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${id}`);
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
    if (!validStatuses.includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
    await db.execute(sql`
      UPDATE forecast_requests SET status=${status}, reviewed_by_id=${reviewedById ?? null}, updated_at=NOW()
      WHERE id=${id}
    `);
    const row = await db.execute(sql`SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${id}`);
    res.json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ── PATCH /forecast-requests/:id/assign-rm ───────────────────────────────────
router.patch("/forecast-requests/:id/assign-rm", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { userId } = req.body;
    await db.execute(sql`
      UPDATE forecast_requests
      SET assigned_revenue_manager_id=${userId ?? null},
          status=CASE WHEN status='pending' THEN 'in_review' ELSE status END,
          updated_at=NOW()
      WHERE id=${id}
    `);
    const row = await db.execute(sql`SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${id}`);
    res.json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] assign-rm error:", err);
    res.status(500).json({ error: "Failed to assign Revenue Manager" });
  }
});

// ── PATCH /forecast-requests/:id/link-owner ──────────────────────────────────
router.patch("/forecast-requests/:id/link-owner", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { ownerId } = req.body;
    if (!ownerId) { res.status(400).json({ error: "ownerId required" }); return; }
    await db.execute(sql`
      UPDATE forecast_requests
      SET owner_id=${ownerId},
          status=CASE WHEN status='pending' THEN 'in_review' ELSE status END,
          updated_at=NOW()
      WHERE id=${id}
    `);
    const row = await db.execute(sql`SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${id}`);
    res.json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] link-owner error:", err);
    res.status(500).json({ error: "Failed to link owner" });
  }
});

// ── PATCH /forecast-requests/:id/link-property ───────────────────────────────
router.patch("/forecast-requests/:id/link-property", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const { propertyId } = req.body;
    if (!propertyId) { res.status(400).json({ error: "propertyId required" }); return; }
    await db.execute(sql`
      UPDATE forecast_requests SET property_id=${propertyId}, updated_at=NOW() WHERE id=${id}
    `);
    const row = await db.execute(sql`SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${id}`);
    res.json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] link-property error:", err);
    res.status(500).json({ error: "Failed to link property" });
  }
});

// ── PATCH /forecast-requests/:id/link-forecast ───────────────────────────────
router.patch("/forecast-requests/:id/link-forecast", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    const user = (req as any).user;
    const { forecastId } = req.body;
    if (!forecastId) { res.status(400).json({ error: "forecastId required" }); return; }
    await db.execute(sql`
      UPDATE forecast_requests
      SET converted_forecast_id=${forecastId},
          status='converted',
          converted_at=NOW(),
          converted_by_user_id=${user?.id ?? null},
          updated_at=NOW()
      WHERE id=${id}
    `);
    const row = await db.execute(sql`SELECT ${SELECT_COLS} ${JOINS} WHERE fr.id = ${id}`);
    res.json(enrichRow(row.rows[0]));
  } catch (err) {
    console.error("[forecast-requests] link-forecast error:", err);
    res.status(500).json({ error: "Failed to link forecast" });
  }
});

export default router;
