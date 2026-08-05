import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const rolesTable = pgTable("roles", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull().unique(),   // slug, e.g. "super_admin", "custom_vip_manager"
  label:       text("label").notNull(),
  description: text("description"),
  permissions: text("permissions").array().notNull().default([]),
  color:       text("color").notNull().default("#6B7280"),
  isBuiltIn:   boolean("is_built_in").notNull().default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Role = typeof rolesTable.$inferSelect;
