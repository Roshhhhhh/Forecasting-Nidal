import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function statusToStage(status: string | null): string {
  if (!status) return "new_lead";
  switch (status) {
    case "accepted":          return "accepted";
    case "owner_called":      return "negotiating";
    case "viewed":            return "proposal_viewed";
    case "published":         return "proposal_sent";
    case "approved":
    case "changes_requested":
    case "submitted":
    case "review_required":
    case "ai_generated":
    case "awaiting_data":
    case "draft":             return "in_review";
    case "declined":
    case "expired":           return "lost";
    default:                  return "new_lead";
  }
}

const STAGE_ORDER = [
  "new_lead",
  "forecast_requested",
  "in_review",
  "proposal_sent",
  "proposal_viewed",
  "negotiating",
  "accepted",
] as const;

router.get("/pipeline", requireAuth, async (_req, res) => {
  // Read follow-up threshold from config (default 3 days)
  const cfgRow = await db.execute(sql`
    SELECT value FROM app_config WHERE key = 'follow_up_threshold_days'
  `);
  const thresholdDays = cfgRow.rows.length > 0
    ? parseFloat(cfgRow.rows[0].value as string) || 3
    : 3;

  const result = await db.execute(sql`
    SELECT
      o.id              AS owner_id,
      o.first_name,
      o.last_name,
      o.company_name,
      o.owner_type,
      o.lead_source,
      o.is_existing_client,
      o.created_at      AS owner_created_at,
      u.name            AS assigned_to_name,
      f.id              AS forecast_id,
      f.status          AS forecast_status,
      f.net_owner_income,
      f.updated_at      AS forecast_updated_at,
      p.property_type,
      p.bedrooms,
      p.area,
      p.community,
      fr.id             AS forecast_request_id,
      fr.updated_at     AS fr_updated_at,
      lp.owner_action   AS proposal_owner_action,
      lp.updated_at     AS proposal_updated_at
    FROM owners o
    LEFT JOIN users u ON u.id = o.assigned_to_id
    LEFT JOIN LATERAL (
      SELECT id, status, net_owner_income, updated_at
      FROM forecasts
      WHERE owner_id = o.id
        AND status != 'archived'
      ORDER BY
        CASE status
          WHEN 'accepted'           THEN 1
          WHEN 'owner_called'       THEN 2
          WHEN 'viewed'             THEN 3
          WHEN 'published'          THEN 4
          WHEN 'approved'           THEN 5
          WHEN 'changes_requested'  THEN 6
          WHEN 'submitted'          THEN 7
          WHEN 'review_required'    THEN 8
          WHEN 'ai_generated'       THEN 9
          WHEN 'awaiting_data'      THEN 10
          WHEN 'draft'              THEN 11
          WHEN 'declined'           THEN 12
          WHEN 'expired'            THEN 13
          ELSE 99
        END,
        updated_at DESC
      LIMIT 1
    ) f ON true
    LEFT JOIN LATERAL (
      SELECT property_type, bedrooms, area, community
      FROM properties
      WHERE owner_id = o.id
        AND is_archived = false
      ORDER BY created_at DESC
      LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
      SELECT id, updated_at
      FROM forecast_requests
      WHERE owner_id = o.id
        AND status IN ('pending', 'in_review')
      ORDER BY created_at DESC
      LIMIT 1
    ) fr ON true
    LEFT JOIN LATERAL (
      SELECT owner_action, updated_at
      FROM proposals
      WHERE forecast_id = f.id
      ORDER BY created_at DESC
      LIMIT 1
    ) lp ON true
    WHERE o.is_archived = false
    ORDER BY o.created_at DESC
  `);

  const now = Date.now();
  const stageMap: Record<string, any[]> = Object.fromEntries(
    STAGE_ORDER.map(k => [k, []])
  );
  const lostCards: any[] = [];

  for (const row of result.rows) {
    let stage = statusToStage(row.forecast_status as string | null);

    // Promote new_lead → forecast_requested if the owner has an active FR
    if (stage === "new_lead" && row.forecast_request_id != null) {
      stage = "forecast_requested";
    }

    const stageDate = (
      stage === "forecast_requested"
        ? (row.fr_updated_at ?? row.owner_created_at)
        : (row.forecast_updated_at ?? row.owner_created_at)
    ) as string | null;
    const daysInStage = stageDate
      ? Math.floor((now - new Date(stageDate).getTime()) / 86_400_000)
      : 0;

    // followUpDue: proposal sent/viewed, no owner action, older than threshold
    const proposalUpdatedAt = row.proposal_updated_at as string | null;
    const daysSinceProposal = proposalUpdatedAt
      ? Math.floor((now - new Date(proposalUpdatedAt).getTime()) / 86_400_000)
      : 0;
    const forecastStatus = row.forecast_status as string | null;
    const followUpDue =
      (forecastStatus === "published" || forecastStatus === "viewed") &&
      !row.proposal_owner_action &&
      daysSinceProposal >= thresholdDays;

    const card = {
      ownerId:            row.owner_id,
      ownerName:          row.company_name
                            ? String(row.company_name)
                            : `${row.first_name} ${row.last_name}`,
      ownerType:          row.owner_type,
      leadSource:         row.lead_source ?? null,
      isExistingClient:   row.is_existing_client,
      assignedToName:     row.assigned_to_name ?? null,
      forecastId:         row.forecast_id ?? null,
      forecastStatus:     forecastStatus ?? null,
      forecastRequestId:  row.forecast_request_id ?? null,
      projectedPayout:    row.net_owner_income != null ? Number(row.net_owner_income) : null,
      propertyType:       row.property_type ?? null,
      bedrooms:           row.bedrooms ?? null,
      area:               row.area ?? null,
      community:          row.community ?? null,
      daysInStage,
      followUpDue,
    };

    if (stage === "lost") lostCards.push(card);
    else stageMap[stage].push(card);
  }

  const stages = STAGE_ORDER.map(key => ({
    key,
    cards: stageMap[key],
    count: stageMap[key].length,
    totalPayout: stageMap[key].reduce((s: number, c: any) => s + (c.projectedPayout ?? 0), 0),
  }));

  res.json({ stages, lostCount: lostCards.length, lostCards });
});

export default router;
