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

export const refereesTable = pgTable("referees", {
  id: serial("id").primaryKey(),
  refereeCode: text("referee_code").notNull().unique(), // e.g. REF-001
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  companyName: text("company_name"),
  // One-time referral fees by apartment layout (AED)
  referralFeeStudio: integer("referral_fee_studio").notNull().default(1500),
  referralFee1br: integer("referral_fee_1br").notNull().default(2000),
  referralFee2br: integer("referral_fee_2br").notNull().default(2500),
  referralFee3br: integer("referral_fee_3br").notNull().default(3000),
  referralFee4brPlus: integer("referral_fee_4br_plus").notNull().default(3500),
  // Recurring commission programme: agent earns (PM% - 16%) when enabled
  // Company minimum PM is always 15%; agent share = max(0, PM% - 16%)
  isRecurringEnabled: boolean("is_recurring_enabled").notNull().default(false),
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
