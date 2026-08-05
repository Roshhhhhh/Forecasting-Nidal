import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const proposalsTable = pgTable("proposals", {
  id: serial("id").primaryKey(),
  forecastId: integer("forecast_id").notNull().unique(),
  referenceNumber: text("reference_number").notNull(),
  status: text("status").notNull().default("draft"),

  // Share link
  shareToken: text("share_token").unique(),
  shareUrl: text("share_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isLinkActive: boolean("is_link_active").notNull().default(false),
  ownerPin: text("owner_pin"),
  requirePin: boolean("require_pin").notNull().default(false),

  // Engagement tracking
  totalViews: integer("total_views").notNull().default(0),
  uniqueViews: integer("unique_views").notNull().default(0),
  lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
  pdfDownloads: integer("pdf_downloads").notNull().default(0),
  acceptClicks: integer("accept_clicks").notNull().default(0),
  declineClicks: integer("decline_clicks").notNull().default(0),
  callRequestClicks: integer("call_request_clicks").notNull().default(0),
  questionsSubmitted: integer("questions_submitted").notNull().default(0),

  // Owner action
  ownerAction: text("owner_action"),
  ownerActionAt: timestamp("owner_action_at", { withTimezone: true }),
  ownerActionName: text("owner_action_name"),
  ownerActionEmail: text("owner_action_email"),
  ownerActionPhone: text("owner_action_phone"),
  ownerActionNotes: text("owner_action_notes"),
  acceptedScenarioId: integer("accepted_scenario_id"),

  // Content
  coverNarrative: text("cover_narrative"),

  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const proposalViewEventsTable = pgTable("proposal_view_events", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull(),
  eventType: text("event_type").notNull(),
  deviceType: text("device_type"),
  ipAddressHash: text("ip_address_hash"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProposalSchema = createInsertSchema(proposalsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Proposal = typeof proposalsTable.$inferSelect;
