import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ownerTypeEnum = pgEnum("owner_type", ["individual", "company"]);

export const ownersTable = pgTable("owners", {
  id: serial("id").primaryKey(),
  ownerType: ownerTypeEnum("owner_type").notNull().default("individual"),
  title: text("title"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  companyName: text("company_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  nationality: text("nationality"),
  preferredLanguage: text("preferred_language"),
  preferredContactMethod: text("preferred_contact_method"),
  leadSource: text("lead_source"),
  isExistingClient: boolean("is_existing_client").notNull().default(false),
  objectives: text("objectives").array(),
  assignedToId: integer("assigned_to_id"),
  refereeId: integer("referee_id"),
  notes: text("notes"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdById: integer("created_by_id"),
  updatedById: integer("updated_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOwnerSchema = createInsertSchema(ownersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Owner = typeof ownersTable.$inferSelect;
