import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  real,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const marketAreasTable = pgTable("market_areas", {
  id: serial("id").primaryKey(),
  emirate: text("emirate").notNull().default("Abu Dhabi"),
  area: text("area").notNull(),
  development: text("development"),
  projectBuilding: text("project_building"),
  developer: text("developer"),
  projectStatus: text("project_status"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: integer("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const unitBenchmarksTable = pgTable("unit_benchmarks", {
  id: serial("id").primaryKey(),
  marketAreaId: integer("market_area_id").notNull(),
  propertyType: text("property_type").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  typicalAdr: real("typical_adr"),
  lowSeasonAdr: real("low_season_adr"),
  shoulderSeasonAdr: real("shoulder_season_adr"),
  peakSeasonAdr: real("peak_season_adr"),
  eventAdr: real("event_adr"),
  expectedOccupancy: real("expected_occupancy"),
  annualLtr: real("annual_ltr"),
  minLtr: real("min_ltr"),
  maxLtr: real("max_ltr"),
  avgUtilities: real("avg_utilities"),
  avgInternet: real("avg_internet"),
  avgMaintenance: real("avg_maintenance"),
  recommendedManagementFee: real("recommended_management_fee"),
  confidenceLevel: text("confidence_level"),
  dataSource: text("data_source"),
  sourceDate: text("source_date"),
  lastVerifiedDate: text("last_verified_date"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdById: integer("created_by_id"),
  importId: integer("import_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMarketAreaSchema = createInsertSchema(marketAreasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertUnitBenchmarkSchema = createInsertSchema(unitBenchmarksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMarketArea = z.infer<typeof insertMarketAreaSchema>;
export type MarketArea = typeof marketAreasTable.$inferSelect;
export type InsertUnitBenchmark = z.infer<typeof insertUnitBenchmarkSchema>;
export type UnitBenchmark = typeof unitBenchmarksTable.$inferSelect;
