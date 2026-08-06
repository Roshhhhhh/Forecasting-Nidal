import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { BUILT_IN_ROLE_PERMISSIONS } from "./permissions";
import { logger } from "./logger";

/** Built-in roles to seed. */
const BUILT_IN_ROLES = [
  { name: "super_admin",     label: "Super Admin",      description: "Full access to everything including role management.", color: "#DC2626" },
  { name: "admin",           label: "Admin",             description: "Full access except role management.", color: "#9333EA" },
  { name: "revenue_manager", label: "Revenue Manager",   description: "Manages forecasts, proposals and commissions.", color: "#2563EB" },
  { name: "sales",           label: "Sales",             description: "Manages owners, properties and creates forecasts.", color: "#16A34A" },
  { name: "read_only",       label: "Read Only",         description: "Can view everything but cannot make changes.", color: "#6B7280" },
];

export async function runStartupMigration() {
  try {
    // 1. Create roles table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS roles (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL UNIQUE,
        label       TEXT NOT NULL,
        description TEXT,
        permissions TEXT[] NOT NULL DEFAULT '{}',
        color       TEXT NOT NULL DEFAULT '#6B7280',
        is_built_in BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. Seed built-in roles (upsert so re-running is safe)
    for (const role of BUILT_IN_ROLES) {
      const perms = BUILT_IN_ROLE_PERMISSIONS[role.name] ?? [];
      // Build a PostgreSQL array literal string: {"a","b","c"}
      const permsLiteral = `{${perms.map(p => `"${p}"`).join(",")}}`;
      await db.execute(sql`
        INSERT INTO roles (name, label, description, permissions, color, is_built_in)
        VALUES (
          ${role.name},
          ${role.label},
          ${role.description},
          ${permsLiteral}::text[],
          ${role.color},
          true
        )
        ON CONFLICT (name) DO UPDATE
          SET label       = EXCLUDED.label,
              description = EXCLUDED.description,
              permissions = EXCLUDED.permissions,
              color       = EXCLUDED.color,
              is_built_in = true
      `);
    }

    // 3. Add role_id column to users if it doesn't exist
    await db.execute(sql`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)
    `);

    // 4. Backfill role_id for existing users based on their role enum value
    await db.execute(sql`
      UPDATE users u
      SET role_id = r.id
      FROM roles r
      WHERE r.name = u.role::text
        AND u.role_id IS NULL
    `);

    // 5. Create referee_commission_payments table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS referee_commission_payments (
        id             SERIAL PRIMARY KEY,
        referee_id     INTEGER NOT NULL REFERENCES referees(id),
        amount_paid    INTEGER NOT NULL,
        paid_at        TIMESTAMPTZ NOT NULL,
        notes          TEXT,
        created_by_id  INTEGER,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 6. Add baseAdr to forecasts (single-ADR model, March = multiplier 1.0)
    await db.execute(sql`
      ALTER TABLE forecasts
        ADD COLUMN IF NOT EXISTS base_adr REAL
    `);

    // 7. Add per-month override columns to monthly_projections if they don't exist
    await db.execute(sql`
      ALTER TABLE monthly_projections
        ADD COLUMN IF NOT EXISTS occupancy_override REAL,
        ADD COLUMN IF NOT EXISTS adr_override REAL
    `);

    // 8. Add previously_holiday_home to furnishing_status enum if not already present
    // ALTER TYPE ... ADD VALUE is idempotent with IF NOT EXISTS
    await db.execute(sql`
      ALTER TYPE furnishing_status ADD VALUE IF NOT EXISTS 'previously_holiday_home'
    `);

    logger.info("Startup migration complete");
  } catch (err) {
    logger.error({ err }, "Startup migration failed");
    throw err;
  }
}
