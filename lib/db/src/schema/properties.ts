import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  integer,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const propertyTypeEnum = pgEnum("property_type", [
  "apartment",
  "duplex",
  "penthouse",
  "townhouse",
  "villa",
  "studio",
  "hotel_apartment",
  "other",
]);

export const furnishingStatusEnum = pgEnum("furnishing_status", [
  "unfurnished",
  "partially_furnished",
  "fully_furnished",
  "premium_furnished",
  "hotel_grade",
]);

export const propertyConditionEnum = pgEnum("property_condition", [
  "new",
  "excellent",
  "good",
  "requires_refresh",
  "requires_renovation",
]);

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  emirate: text("emirate").notNull().default("Abu Dhabi"),
  area: text("area").notNull(),
  community: text("community"),
  development: text("development"),
  projectBuilding: text("project_building"),
  tower: text("tower"),
  unitNumber: text("unit_number"),
  floor: integer("floor"),
  propertyType: propertyTypeEnum("property_type").notNull().default("apartment"),
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: real("bathrooms").notNull(),
  hasMaidsRoom: boolean("has_maids_room").notNull().default(false),
  hasStudy: boolean("has_study").notNull().default(false),
  balconies: integer("balconies"),
  parkingSpaces: integer("parking_spaces"),
  internalArea: real("internal_area").notNull(),
  externalArea: real("external_area"),
  furnishingStatus: furnishingStatusEnum("furnishing_status").notNull().default("fully_furnished"),
  propertyCondition: propertyConditionEnum("property_condition").notNull().default("good"),
  view: text("view"),
  layoutQuality: text("layout_quality"),
  floorCategory: text("floor_category"),
  isCornerUnit: boolean("is_corner_unit").notNull().default(false),
  isWaterfront: boolean("is_waterfront").notNull().default(false),
  hasDirectBeachAccess: boolean("has_direct_beach_access").notNull().default(false),
  hasPrivatePool: boolean("has_private_pool").notNull().default(false),
  hasPrivateGarden: boolean("has_private_garden").notNull().default(false),
  dctEligibilityStatus: text("dct_eligibility_status"),
  dctPermitStatus: text("dct_permit_status"),
  currentTenancyStatus: text("current_tenancy_status"),
  currentAnnualRent: real("current_annual_rent"),
  leaseExpiryDate: text("lease_expiry_date"),
  availabilityDate: text("availability_date"),
  heroImageUrl: text("hero_image_url"),
  videoLink: text("video_link"),
  googleMapsLink: text("google_maps_link"),
  inspectionNotes: text("inspection_notes"),
  isArchived: boolean("is_archived").notNull().default(false),
  createdById: integer("created_by_id"),
  updatedById: integer("updated_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
