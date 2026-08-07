import { Router } from "express";
import { db } from "@workspace/db";
import { proposalViewEventsTable, proposalsTable, forecastsTable, ownersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/notifications", requireAuth, async (_req, res): Promise<void> => {
  try {
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
      .limit(50);

    const notifications = rows.map((r) => ({
      id:              r.id,
      eventType:       r.eventType,
      createdAt:       r.createdAt,
      proposalId:      r.proposalId,
      referenceNumber: r.referenceNumber,
      ownerName:       [r.ownerTitle, r.ownerFirstName, r.ownerLastName].filter(Boolean).join(" ") || null,
    }));

    res.json(notifications);
  } catch (err) {
    console.error("[notifications] error:", err);
    res.status(500).json({ error: "Failed to load notifications" });
  }
});

export default router;
