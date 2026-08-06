import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  real,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const forecastStatusEnum = pgEnum("forecast_status", [
  "draft",
  "awaiting_data",
  "ai_generated",
  "review_required",
  "submitted",
  "changes_requested",
  "approved",
  "published",
  "viewed",
  "owner_called",
  "accepted",
  "declined",
  "expired",
  "archived",
]);

export const forecastsTable = pgTable("forecasts", {
  id: serial("id").primaryKey(),
  referenceNumber: text("reference_number").notNull().unique(),
  ownerId: integer("owner_id"),
  propertyId: integer("property_id"),
  marketAreaId: integer("market_area_id"),
  benchmarkId: integer("benchmark_id"),
  status: forecastStatusEnum("status").notNull().default("draft"),

  // Financial inputs
  managementFeePercent: real("management_fee_percent").default(20),
  ltrVacancyPercent: real("ltr_vacancy_percent").default(10),
  annualLtr: real("annual_ltr"),
  internetCost: real("internet_cost"),
  utilityCost: real("utility_cost"),
  maintenanceCost: real("maintenance_cost"),
  miscCost: real("misc_cost"),
  ownerBlockedNights: integer("owner_blocked_nights").default(0),

  // ADR inputs
  // Legacy 4-season ADR fields — kept for backward compat; new forecasts use baseAdr
  lowSeasonAdr: real("low_season_adr"),
  shoulderSeasonAdr: real("shoulder_season_adr"),
  peakSeasonAdr: real("peak_season_adr"),
  eventAdr: real("event_adr"),
  // Single base ADR (March shoulder reference, multiplier 1.0)
  baseAdr: real("base_adr"),

  // Calculated outputs
  weightedAdr: real("weighted_adr"),
  recommendedOccupancy: real("recommended_occupancy"),
  grossAnnualRevenue: real("gross_annual_revenue"),
  totalAnnualExpenses: real("total_annual_expenses"),
  netOwnerIncome: real("net_owner_income"),
  netLtrIncome: real("net_ltr_income"),
  increaseVsLtr: real("increase_vs_ltr"),
  increaseVsLtrPct: real("increase_vs_ltr_pct"),
  managementFeeAmount: real("management_fee_amount"),

  // Proposal content
  narrativeText: text("narrative_text"),
  internalNotes: text("internal_notes"),
  reconciliationStatus: text("reconciliation_status").default("pending"),

  // Meta
  assignedToId: integer("assigned_to_id"),
  approvedById: integer("approved_by_id"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvalNotes: text("approval_notes"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isArchived: boolean("is_archived").notNull().default(false),
  createdById: integer("created_by_id"),
  updatedById: integer("updated_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const forecastScenariosTable = pgTable("forecast_scenarios", {
  id: serial("id").primaryKey(),
  forecastId: integer("forecast_id").notNull(),
  name: text("name").notNull(),
  occupancyRate: real("occupancy_rate").notNull(),
  adrMultiplier: real("adr_multiplier").notNull().default(1.0),
  grossRevenue: real("gross_revenue"),
  netOwnerIncome: real("net_owner_income"),
  totalExpenses: real("total_expenses"),
  isRecommended: boolean("is_recommended").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monthlyProjectionsTable = pgTable("monthly_projections", {
  id: serial("id").primaryKey(),
  forecastId: integer("forecast_id").notNull(),
  scenarioId: integer("scenario_id"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  monthName: text("month_name").notNull(),
  availableNights: integer("available_nights").notNull(),
  occupiedNights: real("occupied_nights").notNull(),
  occupancyRate: real("occupancy_rate").notNull(),
  adr: real("adr").notNull(),
  grossRevenue: real("gross_revenue").notNull(),
  netOwnerIncome: real("net_owner_income").notNull(),
  ltrBenchmark: real("ltr_benchmark"),
  seasonType: text("season_type").notNull().default("shoulder"),
  // Per-month manual overrides — null means "use calculated value"
  occupancyOverride: real("occupancy_override"),
  adrOverride: real("adr_override"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiRecommendationsTable = pgTable("ai_recommendations", {
  id: serial("id").primaryKey(),
  forecastId: integer("forecast_id").notNull(),
  status: text("status").notNull().default("pending"),

  // Suggested values
  annualLtrSuggested: real("annual_ltr_suggested"),
  annualLtrConfidence: real("annual_ltr_confidence"),
  lowSeasonAdrSuggested: real("low_season_adr_suggested"),
  shoulderSeasonAdrSuggested: real("shoulder_season_adr_suggested"),
  peakSeasonAdrSuggested: real("peak_season_adr_suggested"),
  eventAdrSuggested: real("event_adr_suggested"),
  occupancySuggested: real("occupancy_suggested"),
  internetCostSuggested: real("internet_cost_suggested"),
  utilityCostSuggested: real("utility_cost_suggested"),
  maintenanceCostSuggested: real("maintenance_cost_suggested"),
  managementFeeSuggested: real("management_fee_suggested"),

  // Narrative
  narrativeSuggested: text("narrative_suggested"),
  keyRisks: text("key_risks"),
  keyDrivers: text("key_drivers"),
  overallConfidence: real("overall_confidence"),
  modelUsed: text("model_used"),
  dataSources: text("data_sources"),
  rawResponse: text("raw_response"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertForecastSchema = createInsertSchema(forecastsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertScenarioSchema = createInsertSchema(forecastScenariosTable).omit({
  id: true,
  createdAt: true,
});
export type InsertForecast = z.infer<typeof insertForecastSchema>;
export type Forecast = typeof forecastsTable.$inferSelect;
export type ForecastScenario = typeof forecastScenariosTable.$inferSelect;
export type MonthlyProjection = typeof monthlyProjectionsTable.$inferSelect;
