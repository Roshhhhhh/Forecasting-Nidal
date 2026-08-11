import { pgTable, serial, integer, real, boolean, timestamp, varchar, text } from "drizzle-orm/pg-core";

export const propertyOwnersTable = pgTable("property_owners", {
  id:                  serial("id").primaryKey(),
  propertyId:          integer("property_id").notNull(),
  ownerId:             integer("owner_id").notNull(),
  ownershipPercentage: real("ownership_percentage").notNull().default(100),
  isPrimary:           boolean("is_primary").notNull().default(false),
  ownershipType:       varchar("ownership_type", { length: 100 }),
  notes:               text("notes"),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
