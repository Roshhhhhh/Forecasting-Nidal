import { Router } from "express";
import { db } from "@workspace/db";
import { proposalViewEventsTable, proposalsTable, forecastsTable, ownersTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/notifications", requireAuth, async (_req, res): Promise<void> => {
  try {
    // Proposal events
    const rows = await db
      .select({
        id:              proposalViewEventsTable.id,
        eventType:       proposalViewEventsTable.eventType,
        createdAt:       proposalViewEventsTable.createdAt,
        proposalId:      proposalsTable.id,
        referenceNumber: forecastsTable.referenceNumber,
        ownerFirstName:  ownersTable.firstName,
        ownerLastName:   ownersTable.lastName,
        ownerTitle:      ownersTable.title,
      })
      .from(proposalViewEventsTable)
      .innerJoin(proposalsTable, eq(proposalsTable.id, proposalViewEventsTable.proposalId))
      .innerJoin(forecastsTable, eq(forecastsTable.id, proposalsTable.forecastId))
      .leftJoin(ownersTable, eq(ownersTable.id, forecastsTable.ownerId))
      .orderBy(desc(proposalViewEventsTable.createdAt))
      .limit(40);

    const proposalNotifs = rows.map((r) => ({
      id:              r.id,
      eventType:       r.eventType,
      createdAt:       r.createdAt,
      proposalId:      r.proposalId,
      referenceNumber: r.referenceNumber,
      ownerName:       [r.ownerTitle, r.ownerFirstName, r.ownerLastName].filter(Boolean).join(" ") || null,
    }));

    // Forecast request events — treat each pending/in_review request as a notification
    const frRows = await db.execute(sql`
      SELECT
        (1000000 + fr.id) AS id,
        'forecast_request'  AS event_type,
        fr.created_at,
        NULL               AS proposal_id,
        NULL               AS reference_number,
        CONCAT(COALESCE(fr.owner_first_name, ''), ' ', COALESCE(fr.owner_last_name, '')) AS owner_name,
        fr.status,
        fr.id              AS request_id
      FROM forecast_requests fr
      WHERE fr.status IN ('pending', 'in_review')
      ORDER BY fr.created_at DESC
      LIMIT 20
    `);

    const requestNotifs = (frRows.rows as any[]).map(r => ({
      id:              r.id,
      eventType:       r.event_type,
      createdAt:       r.created_at,
      proposalId:      null,
      referenceNumber: null,
      ownerName:       r.owner_name?.trim() || `Request #${r.request_id}`,
      requestId:       r.request_id,
      status:          r.status,
    }));

    // Merge and sort by date
    const all = [...proposalNotifs, ...requestNotifs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ).slice(0, 50);

    res.json(all);
  } catch (err) {
    console.error("[notifications] error:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

export default router;
