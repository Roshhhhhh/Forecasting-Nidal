import {
  pgTable,
  serial,
  text,
  timestamp,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const companySettingsTable = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default("Royal Holiday Homes"),
  brandName: text("brand_name").notNull().default("Royal Holiday Homes"),
  currency: text("currency").notNull().default("AED"),
  logoUrl: text("logo_url"),
  goldBrandColor: text("gold_brand_color").default("#C9963B"),
  phone: text("phone"),
  tollFree: text("toll_free"),
  website: text("website"),
  ownerEmail: text("owner_email"),
  guestEmail: text("guest_email"),
  address: text("address"),
  socialMedia: text("social_media"),

  // Defaults
  defaultManagementFeePercent: real("default_management_fee_percent").notNull().default(20),
  defaultLtrVacancyPercent: real("default_ltr_vacancy_percent").notNull().default(10),
  materialityThresholdPercent: real("materiality_threshold_percent").notNull().default(10),
  proposalValidityDays: integer("proposal_validity_days").notNull().default(30),

  // Scenarios defaults
  conservativeOccupancy: real("conservative_occupancy").default(75),
  realisticOccupancy: real("realistic_occupancy").default(80),
  confidentOccupancy: real("confident_occupancy").default(85),
  optimisticOccupancy: real("optimistic_occupancy").default(90),

  // Content
  disclaimer: text("disclaimer").notNull().default(
    "This forecast is an estimate prepared using the property information available, internal market benchmarks, comparable property data and current market conditions. Actual occupancy, average daily rate, expenses, gross revenue and net income may differ due to changes in supply, demand, seasonality, events, property condition, platform performance and other market factors. This proposal does not represent a guarantee of future rental income."
  ),

  // Portfolio stats (stored as text so values like "150+" display as-is on the proposal)
  portfolioManagedProperties: text("portfolio_managed_properties"),
  portfolioFiveStarReviews: text("portfolio_five_star_reviews"),
  portfolioMonthlyBookings: text("portfolio_monthly_bookings"),
  portfolioMonthlyTravelers: text("portfolio_monthly_travelers"),
  portfolioAssetsUnderManagement: text("portfolio_assets_under_management"),
  portfolioTrustedOwners: text("portfolio_trusted_owners"),

  // Market benchmark import tracking
  lastBenchmarkImportAt: timestamp("last_benchmark_import_at", { withTimezone: true }),
  lastBenchmarkImportSummary: text("last_benchmark_import_summary"),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const fileImportsTable = pgTable("file_imports", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  status: text("status").notNull().default("pending"),
  recordCount: integer("record_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  importedById: integer("imported_by_id"),
  notes: text("notes"),
  sessionToken: text("session_token"),
  rawData: text("raw_data"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
});

export const sessionsTable = pgTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: text("sess").notNull(),
  expire: timestamp("expire", { withTimezone: true }).notNull(),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettingsTable).omit({
  id: true,
  updatedAt: true,
});
export type CompanySettings = typeof companySettingsTable.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
