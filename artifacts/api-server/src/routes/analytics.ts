import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get(
  "/analytics/leaderboard",
  requireAuth,
  requireRole("super_admin", "revenue_manager"),
  async (req, res): Promise<void> => {
    const { range = "all_time" } = req.query as { range?: string };

    const now = new Date();
    let dateFrom: Date | null = null;
    if (range === "this_month") {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === "this_quarter") {
      const q = Math.floor(now.getMonth() / 3);
      dateFrom = new Date(now.getFullYear(), q * 3, 1);
    }

    const dateCondition = dateFrom
      ? sql`AND o.created_at >= ${dateFrom.toISOString()}::timestamptz`
      : sql``;

    const result = await db.execute(sql`
      SELECT
        u.id            AS user_id,
        u.name          AS user_name,
        u.email         AS user_email,
        u.role          AS user_role,
        COUNT(o.id)     AS total_owners,
        COUNT(CASE WHEN f.status = 'accepted' THEN 1 END)                                                           AS accepted,
        COUNT(CASE WHEN f.status IN ('declined','expired') THEN 1 END)                                              AS lost,
        COUNT(CASE WHEN f.status IN ('published','viewed','owner_called','accepted','declined','expired') THEN 1 END) AS reached_proposal,
        ROUND(
          AVG(CASE WHEN f.status = 'accepted'
            THEN EXTRACT(EPOCH FROM (f.updated_at - o.created_at)) / 86400.0
          END)::numeric, 1
        ) AS avg_days_to_acceptance,
        COUNT(CASE WHEN f.status IS NULL THEN 1 END)                                                                                                 AS stage_new_lead,
        COUNT(CASE WHEN f.status IN ('approved','changes_requested','submitted','review_required','ai_generated','awaiting_data','draft') THEN 1 END) AS stage_in_review,
        COUNT(CASE WHEN f.status = 'published'    THEN 1 END) AS stage_proposal_sent,
        COUNT(CASE WHEN f.status = 'viewed'       THEN 1 END) AS stage_proposal_viewed,
        COUNT(CASE WHEN f.status = 'owner_called' THEN 1 END) AS stage_negotiating,
        COUNT(CASE WHEN f.status = 'accepted'     THEN 1 END) AS stage_accepted,
        COUNT(CASE WHEN f.status IN ('declined','expired') THEN 1 END) AS stage_lost
      FROM users u
      LEFT JOIN owners o
        ON  o.assigned_to_id = u.id
        AND o.is_archived = false
        ${dateCondition}
      LEFT JOIN LATERAL (
        SELECT status, updated_at
        FROM   forecasts
        WHERE  owner_id = o.id AND status != 'archived'
        ORDER BY
          CASE status
            WHEN 'accepted'          THEN 1
            WHEN 'owner_called'      THEN 2
            WHEN 'viewed'            THEN 3
            WHEN 'published'         THEN 4
            WHEN 'approved'          THEN 5
            WHEN 'changes_requested' THEN 6
            WHEN 'submitted'         THEN 7
            WHEN 'review_required'   THEN 8
            WHEN 'ai_generated'      THEN 9
            WHEN 'awaiting_data'     THEN 10
            WHEN 'draft'             THEN 11
            WHEN 'declined'          THEN 12
            WHEN 'expired'           THEN 13
            ELSE 99
          END,
          updated_at DESC
        LIMIT 1
      ) f ON true
      WHERE u.is_active = true AND u.role != 'owner'
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY accepted DESC NULLS LAST, total_owners DESC
    `);

    const reps = result.rows.map(r => {
      const reachedProposal = Number(r.reached_proposal);
      const accepted        = Number(r.accepted);
      return {
        userId:              Number(r.user_id),
        userName:            r.user_name  as string,
        userEmail:           r.user_email as string,
        userRole:            r.user_role  as string,
        totalOwners:         Number(r.total_owners),
        accepted,
        lost:                Number(r.lost),
        reachedProposal,
        conversionRate:      reachedProposal > 0 ? Math.round((accepted / reachedProposal) * 100) : null,
        avgDaysToAcceptance: r.avg_days_to_acceptance != null ? Number(r.avg_days_to_acceptance) : null,
        stages: {
          newLead:       Number(r.stage_new_lead),
          inReview:      Number(r.stage_in_review),
          proposalSent:  Number(r.stage_proposal_sent),
          proposalViewed:Number(r.stage_proposal_viewed),
          negotiating:   Number(r.stage_negotiating),
          accepted:      Number(r.stage_accepted),
          lost:          Number(r.stage_lost),
        },
      };
    });

    // Portfolio-wide stage funnel (sum across all reps)
    const funnel = [
      { stage: "New Lead",       count: reps.reduce((s, r) => s + r.stages.newLead, 0) },
      { stage: "In Review",      count: reps.reduce((s, r) => s + r.stages.inReview, 0) },
      { stage: "Proposal Sent",  count: reps.reduce((s, r) => s + r.stages.proposalSent, 0) },
      { stage: "Viewed",         count: reps.reduce((s, r) => s + r.stages.proposalViewed, 0) },
      { stage: "Negotiating",    count: reps.reduce((s, r) => s + r.stages.negotiating, 0) },
      { stage: "Accepted",       count: reps.reduce((s, r) => s + r.stages.accepted, 0) },
      { stage: "Lost",           count: reps.reduce((s, r) => s + r.stages.lost, 0) },
    ];

    res.json({ reps, funnel });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Area Intelligence — community-level revenue aggregates
// ─────────────────────────────────────────────────────────────────────────────

const AREA_STATUSES = `'approved','published','viewed','owner_called','accepted','declined','expired'`;
const PROPOSAL_SENT_STATUSES = `'published','viewed','owner_called','accepted','declined','expired'`;

router.get(
  "/analytics/areas",
  requireRole("super_admin", "revenue_manager"),
  async (req, res): Promise<void> => {
  const { emirate, bedrooms, createdFrom, createdTo } = req.query as Record<string, string | undefined>;

  // Build optional filter fragments
  const emirateFilter  = emirate && emirate !== "all"
    ? sql`AND p.emirate = ${emirate}`
    : sql``;

  const bedroomsFilter = bedrooms && bedrooms !== "all"
    ? bedrooms === "3+"
      ? sql`AND p.bedrooms >= 3`
      : sql`AND p.bedrooms = ${parseInt(bedrooms)}`
    : sql``;

  const dateFromFilter = createdFrom
    ? sql`AND f.created_at >= ${createdFrom + "T00:00:00Z"}::timestamptz`
    : sql``;

  const dateToFilter = createdTo
    ? sql`AND f.created_at <= ${createdTo + "T23:59:59Z"}::timestamptz`
    : sql``;

  // Community aggregates
  const aggResult = await db.execute(sql`
    SELECT
      COALESCE(p.community, p.area, 'Unknown') AS community,
      p.emirate,
      COUNT(f.id)                                                                                     AS forecast_count,
      ROUND(AVG(f.gross_annual_revenue)::numeric, 0)                                                 AS avg_gross_revenue,
      ROUND(AVG(f.net_owner_income)::numeric, 0)                                                     AS avg_net_income,
      ROUND(AVG(CASE WHEN f.recommended_occupancy IS NOT NULL THEN f.recommended_occupancy * 100 END)::numeric, 1) AS avg_occupancy_pct,
      ROUND(AVG(f.weighted_adr)::numeric, 0)                                                         AS avg_adr,
      COUNT(CASE WHEN f.status = 'accepted' THEN 1 END)                                              AS accepted_count,
      COUNT(CASE WHEN f.status IN (${sql.raw(PROPOSAL_SENT_STATUSES)}) THEN 1 END)                  AS proposal_sent_count
    FROM forecasts f
    JOIN properties p ON p.id = f.property_id AND p.is_archived = false
    WHERE f.is_archived = false
      AND f.status IN (${sql.raw(AREA_STATUSES)})
      ${emirateFilter}
      ${bedroomsFilter}
      ${dateFromFilter}
      ${dateToFilter}
    GROUP BY COALESCE(p.community, p.area, 'Unknown'), p.emirate
    ORDER BY avg_gross_revenue DESC NULLS LAST
  `);

  // Individual forecast details (for row expansion)
  const detailResult = await db.execute(sql`
    SELECT
      f.id,
      f.reference_number,
      f.status,
      ROUND(f.gross_annual_revenue::numeric, 0) AS gross_annual_revenue,
      ROUND(f.net_owner_income::numeric, 0)     AS net_owner_income,
      p.unit_number,
      p.project_building,
      p.bedrooms,
      COALESCE(p.community, p.area, 'Unknown') AS community,
      COALESCE(o.company_name, CONCAT(o.first_name, ' ', o.last_name)) AS owner_name
    FROM forecasts f
    JOIN properties p ON p.id = f.property_id AND p.is_archived = false
    JOIN owners o     ON o.id = f.owner_id
    WHERE f.is_archived = false
      AND f.status IN (${sql.raw(AREA_STATUSES)})
      ${emirateFilter}
      ${bedroomsFilter}
      ${dateFromFilter}
      ${dateToFilter}
    ORDER BY f.gross_annual_revenue DESC NULLS LAST
  `);

  // Group detail rows by composite key community|emirate
  const detailByKey = new Map<string, any[]>();
  for (const row of detailResult.rows) {
    const key = `${row.community as string}|${row.emirate as string}`;
    if (!detailByKey.has(key)) detailByKey.set(key, []);
    detailByKey.get(key)!.push({
      id:               Number(row.id),
      referenceNumber:  row.reference_number as string,
      status:           row.status as string,
      grossRevenue:     row.gross_annual_revenue != null ? Number(row.gross_annual_revenue) : null,
      netIncome:        row.net_owner_income     != null ? Number(row.net_owner_income)     : null,
      unitNumber:       row.unit_number    as string | null,
      building:         row.project_building as string | null,
      bedrooms:         row.bedrooms != null ? Number(row.bedrooms) : null,
      ownerName:        row.owner_name as string,
    });
  }

  const communities = aggResult.rows.map(r => {
    const community    = r.community as string;
    const emirate      = r.emirate as string;
    const compositeKey = `${community}|${emirate}`;
    const proposalSent = Number(r.proposal_sent_count);
    const accepted     = Number(r.accepted_count);
    return {
      key:            compositeKey,
      community,
      emirate,
      forecastCount:  Number(r.forecast_count),
      avgGrossRevenue:r.avg_gross_revenue  != null ? Number(r.avg_gross_revenue)  : null,
      avgNetIncome:   r.avg_net_income     != null ? Number(r.avg_net_income)     : null,
      avgOccupancyPct:r.avg_occupancy_pct  != null ? Number(r.avg_occupancy_pct)  : null,
      avgAdr:         r.avg_adr            != null ? Number(r.avg_adr)            : null,
      proposalSentCount: proposalSent,
      acceptedCount:  accepted,
      acceptanceRate: proposalSent > 0 ? Math.round((accepted / proposalSent) * 100) : null,
      forecasts:      detailByKey.get(compositeKey) ?? [],
    };
  });

  res.json({ communities });
  }
);

export default router;
