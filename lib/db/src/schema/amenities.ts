import { pgTable, serial, text, real, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { propertiesTable } from "./properties";

export const amenitiesTable = pgTable("amenities", {
  id:                serial("id").primaryKey(),
  category:          text("category").notNull(),
  name:              text("name").notNull(),
  icon:              text("icon").notNull().default("✓"),
  description:       text("description"),
  adrBoost:          real("adr_boost").notNull().default(0),          // % ADR increase
  occupancyBoost:    real("occupancy_boost").notNull().default(0),     // % occupancy increase
  luxuryScore:       integer("luxury_score").notNull().default(0),     // points toward luxury score
  guestAppealScore:  integer("guest_appeal_score").notNull().default(0),
  familyScore:       integer("family_score").notNull().default(0),
  corporateScore:    integer("corporate_score").notNull().default(0),
  holidayHomeScore:  integer("holiday_home_score").notNull().default(0),
  isProposalHighlight: boolean("is_proposal_highlight").notNull().default(false),
  seoKeyword:        text("seo_keyword"),
  sortOrder:         integer("sort_order").notNull().default(0),
  isActive:          boolean("is_active").notNull().default(true),
});

export const propertyAmenitiesTable = pgTable("property_amenities", {
  id:         serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  amenityId:  integer("amenity_id").notNull().references(() => amenitiesTable.id, { onDelete: "cascade" }),
});

export type Amenity         = typeof amenitiesTable.$inferSelect;
export type PropertyAmenity = typeof propertyAmenitiesTable.$inferSelect;
