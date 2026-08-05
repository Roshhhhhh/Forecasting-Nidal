import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const refereesTable = pgTable("referees", {
  id: serial("id").primaryKey(),
  refereeCode: text("referee_code").notNull().unique(), // e.g. REF-001
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  companyName: text("company_name"),
  commissionPercent: numeric("commission_percent", { precision: 5, scale: 2 }).default("5"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRefereeSchema = createInsertSchema(refereesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertReferee = z.infer<typeof insertRefereeSchema>;
export type Referee = typeof refereesTable.$inferSelect;
