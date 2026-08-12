import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * GET /api/follow-ups
 *
 * Returns proposals that are in `published` or `viewed` status,
 * have no owner action, and whose updated_at is older than the
 * configured `follow_up_threshold_days`.
 *
 * revenue_manager / super_admin: see all reps.
 * Everyone else: only their own assigned forecasts.
 */
router.get("/follow-ups", requireAuth, async (req, res): Promise<void> => {
  const userId   = req.session.userId!;
  const userRole = req.session.userRole ?? "";
  const isManager = userRole === "super_admin" || userRole === "revenue_manager";

  // Read threshold from app_config (default 3 days)
  const cfgRow = await db.execute(sql`
    SELECT value FROM app_config WHERE key = 'follow_up_threshold_days'
  `);
  const thresholdDays = cfgRow.rows.length > 0
    ? parseFloat(cfgRow.rows[0].value as string) || 3
    : 3;

  const scopeFilter = isManager
    ? sql``
    : sql`AND f.assigned_to_id = ${userId}`;

  const result = await db.execute(sql`
    SELECT
      p.id                                                                          AS proposal_id,
      p.reference_number,
      p.status                                                                      AS proposal_status,
      p.updated_at                                                                  AS proposal_updated_at,
      FLOOR(EXTRACT(EPOCH FROM (NOW() - p.updated_at)) / 86400)                    AS days_since_update,
      f.id                                                                          AS forecast_id,
      f.owner_id,
      f.assigned_to_id,
      COALESCE(o.company_name, o.first_name || ' ' || o.last_name)                AS owner_name,
      prop.area,
      prop.community,
      prop.unit_number,
      prop.project_building,
      prop.bedrooms,
      u.name                                                                        AS rep_name
    FROM proposals p
    JOIN forecasts   f    ON f.id  = p.forecast_id AND f.is_archived = false
    JOIN owners      o    ON o.id  = f.owner_id    AND o.is_archived = false
    LEFT JOIN properties prop ON prop.id = f.property_id
    LEFT JOIN users  u    ON u.id  = f.assigned_to_id
    WHERE p.status IN ('published', 'viewed')
      AND p.owner_action IS NULL
      AND EXTRACT(EPOCH FROM (NOW() - p.updated_at)) / 86400 > ${thresholdDays}
      ${scopeFilter}
    ORDER BY p.updated_at ASC
  `);

  const items = result.rows.map(r => {
    const propParts = [
      r.unit_number   ? `#${r.unit_number}`          : null,
      r.project_building ?? null,
      r.bedrooms != null ? `${r.bedrooms}BR`          : null,
      r.community ?? r.area ?? null,
    ].filter(Boolean);

    return {
      proposalId:        Number(r.proposal_id),
      referenceNumber:   r.reference_number as string,
      proposalStatus:    r.proposal_status  as string,
      daysSinceUpdate:   Number(r.days_since_update),
      forecastId:        Number(r.forecast_id),
      ownerId:           Number(r.owner_id),
      ownerName:         r.owner_name as string,
      propertyLine:      propParts.join(" · ") || null,
      repName:           r.rep_name as string | null,
      assignedToId:      r.assigned_to_id != null ? Number(r.assigned_to_id) : null,
    };
  });

  res.json({ items, thresholdDays });
});

export default router;
