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

export default router;
