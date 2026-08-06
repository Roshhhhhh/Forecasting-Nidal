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

    // 9. Add weighted_adr to forecast_scenarios (per-scenario weighted average daily rate)
    await db.execute(sql`
      ALTER TABLE forecast_scenarios
        ADD COLUMN IF NOT EXISTS weighted_adr REAL
    `);

    // 10. Fix stale isRecommended flags: ensure the 80% scenario is recommended,
    //    not the old 85% default. This is a one-time idempotent correction for
    //    forecasts created before the 80% Realistic scenario became the default.
    //    Step A: clear isRecommended from any 85% scenario
    await db.execute(sql`
      UPDATE forecast_scenarios
      SET is_recommended = false
      WHERE ABS(occupancy_rate - 0.85) < 0.001
        AND is_recommended = true
    `);
    //    Step B: set isRecommended on the 80% scenario for every forecast that
    //    currently has no recommended scenario at all, or whose recommended
    //    scenario is not at 80%.
    await db.execute(sql`
      UPDATE forecast_scenarios fs
      SET is_recommended = true
      WHERE ABS(fs.occupancy_rate - 0.80) < 0.001
        AND fs.is_recommended = false
        AND NOT EXISTS (
          SELECT 1 FROM forecast_scenarios fs2
          WHERE fs2.forecast_id = fs.forecast_id
            AND fs2.is_recommended = true
        )
    `);

    // 9. Create amenities table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS amenities (
        id                   SERIAL PRIMARY KEY,
        category             TEXT NOT NULL,
        name                 TEXT NOT NULL,
        icon                 TEXT NOT NULL DEFAULT '✓',
        description          TEXT,
        adr_boost            REAL NOT NULL DEFAULT 0,
        occupancy_boost      REAL NOT NULL DEFAULT 0,
        luxury_score         INTEGER NOT NULL DEFAULT 0,
        guest_appeal_score   INTEGER NOT NULL DEFAULT 0,
        family_score         INTEGER NOT NULL DEFAULT 0,
        corporate_score      INTEGER NOT NULL DEFAULT 0,
        holiday_home_score   INTEGER NOT NULL DEFAULT 0,
        is_proposal_highlight BOOLEAN NOT NULL DEFAULT false,
        seo_keyword          TEXT,
        sort_order           INTEGER NOT NULL DEFAULT 0,
        is_active            BOOLEAN NOT NULL DEFAULT true,
        UNIQUE (category, name)
      )
    `);

    // 10. Create property_amenities join table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS property_amenities (
        id           SERIAL PRIMARY KEY,
        property_id  INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        amenity_id   INTEGER NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
        UNIQUE (property_id, amenity_id)
      )
    `);

    // 11. Add custom_amenity_tags column to properties
    await db.execute(sql`
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS custom_amenity_tags TEXT[] NOT NULL DEFAULT '{}'
    `);

    // 12. Seed amenities (idempotent via ON CONFLICT DO NOTHING)
    type AmenitySeed = { cat: string; name: string; icon: string; adr: number; occ: number; lux: number; gst: number; fam: number; cor: number; hol: number; prop: boolean; seo?: string; ord: number };
    const AMENITIES: AmenitySeed[] = [
      // ── Category 1: Property Features ──────────────────────────────
      { cat:"Property Features", name:"Waterfront",        icon:"🌊", adr:12,occ:6,lux:8,gst:10,fam:4,cor:2,hol:5,  prop:true,  seo:"waterfront property",   ord:1  },
      { cat:"Property Features", name:"Beachfront",        icon:"🏖️", adr:15,occ:8,lux:10,gst:12,fam:5,cor:1,hol:5, prop:true,  seo:"beachfront apartment",  ord:2  },
      { cat:"Property Features", name:"Canal Front",       icon:"🛶", adr:8, occ:4,lux:6,gst:8, fam:3,cor:1,hol:4,  prop:false, seo:"canal view property",   ord:3  },
      { cat:"Property Features", name:"Marina View",       icon:"⚓", adr:6, occ:3,lux:5,gst:7, fam:2,cor:2,hol:3,  prop:true,  seo:"marina view",           ord:4  },
      { cat:"Property Features", name:"Sea View",          icon:"🌅", adr:8, occ:4,lux:6,gst:8, fam:2,cor:2,hol:4,  prop:true,  seo:"sea view apartment",    ord:5  },
      { cat:"Property Features", name:"Ocean View",        icon:"🌊", adr:9, occ:4,lux:7,gst:9, fam:2,cor:2,hol:4,  prop:true,  seo:"ocean view",            ord:6  },
      { cat:"Property Features", name:"Mangrove View",     icon:"🌿", adr:5, occ:3,lux:4,gst:6, fam:3,cor:1,hol:3,  prop:false, seo:"mangrove view",         ord:7  },
      { cat:"Property Features", name:"Golf View",         icon:"⛳", adr:6, occ:3,lux:5,gst:6, fam:2,cor:3,hol:3,  prop:false, seo:"golf view villa",       ord:8  },
      { cat:"Property Features", name:"Yas Waterworld View",icon:"🎢",adr:4, occ:3,lux:2,gst:5, fam:5,cor:1,hol:3,  prop:false, ord:9  },
      { cat:"Property Features", name:"Ferrari World View", icon:"🏎️",adr:4, occ:3,lux:3,gst:5, fam:4,cor:1,hol:3,  prop:false, ord:10 },
      { cat:"Property Features", name:"City Skyline View", icon:"🏙️", adr:5, occ:3,lux:4,gst:6, fam:1,cor:3,hol:3,  prop:false, seo:"city view apartment",  ord:11 },
      { cat:"Property Features", name:"Landmark View",     icon:"🗺️", adr:5, occ:2,lux:4,gst:5, fam:1,cor:2,hol:3,  prop:false, ord:12 },
      { cat:"Property Features", name:"Park View",         icon:"🌳", adr:3, occ:2,lux:2,gst:4, fam:4,cor:1,hol:3,  prop:false, ord:13 },
      { cat:"Property Features", name:"Pool View",         icon:"🏊", adr:2, occ:2,lux:2,gst:3, fam:3,cor:1,hol:2,  prop:false, ord:14 },
      { cat:"Property Features", name:"Garden View",       icon:"🌺", adr:2, occ:2,lux:2,gst:3, fam:4,cor:1,hol:2,  prop:false, ord:15 },
      { cat:"Property Features", name:"Corner Unit",       icon:"📐", adr:3, occ:2,lux:2,gst:3, fam:2,cor:2,hol:2,  prop:false, ord:16 },
      { cat:"Property Features", name:"High Floor",        icon:"🔝", adr:4, occ:2,lux:3,gst:4, fam:1,cor:2,hol:2,  prop:false, ord:17 },
      { cat:"Property Features", name:"Low Floor",         icon:"🔽", adr:0, occ:0,lux:0,gst:0, fam:1,cor:0,hol:0,  prop:false, ord:18 },
      { cat:"Property Features", name:"Penthouse",         icon:"🏰", adr:18,occ:5,lux:14,gst:10,fam:2,cor:4,hol:5, prop:true,  seo:"penthouse for rent",    ord:19 },
      { cat:"Property Features", name:"Duplex",            icon:"🏠", adr:8, occ:3,lux:5,gst:6, fam:4,cor:2,hol:4,  prop:false, ord:20 },
      { cat:"Property Features", name:"Loft",              icon:"🔲", adr:5, occ:2,lux:3,gst:4, fam:1,cor:3,hol:3,  prop:false, ord:21 },
      { cat:"Property Features", name:"Smart Home",        icon:"🏡", adr:5, occ:2,lux:4,gst:4, fam:2,cor:4,hol:4,  prop:false, ord:22 },
      { cat:"Property Features", name:"Newly Renovated",   icon:"🔨", adr:6, occ:3,lux:4,gst:5, fam:2,cor:2,hol:3,  prop:false, ord:23 },
      { cat:"Property Features", name:"Brand New",         icon:"✨", adr:8, occ:4,lux:5,gst:6, fam:2,cor:2,hol:4,  prop:false, ord:24 },
      { cat:"Property Features", name:"Luxury Furnished",  icon:"🛋️", adr:10,occ:4,lux:9,gst:7, fam:2,cor:3,hol:5,  prop:true,  seo:"luxury furnished apartment", ord:25 },
      { cat:"Property Features", name:"Designer Interior", icon:"🎨", adr:8, occ:3,lux:7,gst:5, fam:1,cor:2,hol:4,  prop:true,  ord:26 },
      { cat:"Property Features", name:"Contemporary Design",icon:"🏛️",adr:4, occ:2,lux:3,gst:4, fam:1,cor:2,hol:3,  prop:false, ord:27 },
      { cat:"Property Features", name:"Premium Finishes",  icon:"💎", adr:6, occ:2,lux:6,gst:4, fam:1,cor:2,hol:3,  prop:false, ord:28 },
      { cat:"Property Features", name:"Spacious Layout",   icon:"📏", adr:4, occ:3,lux:2,gst:5, fam:4,cor:2,hol:4,  prop:false, ord:29 },
      { cat:"Property Features", name:"Open Kitchen",      icon:"🍽️", adr:2, occ:2,lux:1,gst:3, fam:3,cor:1,hol:4,  prop:false, ord:30 },
      { cat:"Property Features", name:"Closed Kitchen",    icon:"🚪", adr:1, occ:1,lux:0,gst:2, fam:2,cor:1,hol:2,  prop:false, ord:31 },
      { cat:"Property Features", name:"Maid's Room",       icon:"🧹", adr:3, occ:2,lux:3,gst:2, fam:5,cor:1,hol:3,  prop:false, ord:32 },
      { cat:"Property Features", name:"Study Room",        icon:"📚", adr:2, occ:2,lux:1,gst:2, fam:3,cor:5,hol:3,  prop:false, ord:33 },
      { cat:"Property Features", name:"Laundry Room",      icon:"🧺", adr:2, occ:2,lux:1,gst:2, fam:4,cor:1,hol:5,  prop:false, ord:34 },
      { cat:"Property Features", name:"Storage Room",      icon:"📦", adr:1, occ:1,lux:0,gst:1, fam:2,cor:1,hol:2,  prop:false, ord:35 },
      { cat:"Property Features", name:"Walk-in Closet",    icon:"👔", adr:3, occ:2,lux:4,gst:3, fam:1,cor:2,hol:3,  prop:false, ord:36 },
      { cat:"Property Features", name:"Built-in Wardrobes",icon:"🪟", adr:2, occ:1,lux:2,gst:2, fam:2,cor:1,hol:3,  prop:false, ord:37 },
      { cat:"Property Features", name:"Guest Bathroom",    icon:"🚿", adr:2, occ:1,lux:2,gst:2, fam:3,cor:2,hol:2,  prop:false, ord:38 },
      { cat:"Property Features", name:"Ensuite Bedrooms",  icon:"🛁", adr:3, occ:2,lux:3,gst:3, fam:2,cor:2,hol:3,  prop:false, ord:39 },
      // ── Category 2: Outdoor Features ───────────────────────────────
      { cat:"Outdoor Features", name:"Balcony",             icon:"🌇", adr:3, occ:2,lux:2,gst:3, fam:2,cor:1,hol:3,  prop:false, ord:1  },
      { cat:"Outdoor Features", name:"Large Balcony",       icon:"🌄", adr:5, occ:3,lux:3,gst:5, fam:3,cor:1,hol:4,  prop:false, ord:2  },
      { cat:"Outdoor Features", name:"Terrace",             icon:"☀️", adr:5, occ:3,lux:4,gst:5, fam:2,cor:1,hol:4,  prop:false, ord:3  },
      { cat:"Outdoor Features", name:"Rooftop Terrace",     icon:"🌃", adr:8, occ:4,lux:6,gst:7, fam:2,cor:2,hol:4,  prop:true,  seo:"rooftop terrace apartment", ord:4  },
      { cat:"Outdoor Features", name:"Private Garden",      icon:"🌻", adr:6, occ:3,lux:5,gst:5, fam:7,cor:1,hol:4,  prop:true,  ord:5  },
      { cat:"Outdoor Features", name:"Courtyard",           icon:"🏡", adr:4, occ:2,lux:3,gst:3, fam:3,cor:1,hol:3,  prop:false, ord:6  },
      { cat:"Outdoor Features", name:"BBQ Area",            icon:"🔥", adr:3, occ:3,lux:2,gst:4, fam:6,cor:1,hol:5,  prop:false, seo:"bbq area villa",        ord:7  },
      { cat:"Outdoor Features", name:"Outdoor Dining",      icon:"🍽️", adr:3, occ:2,lux:2,gst:4, fam:4,cor:1,hol:4,  prop:false, ord:8  },
      { cat:"Outdoor Features", name:"Outdoor Lounge",      icon:"🛌", adr:4, occ:3,lux:3,gst:4, fam:2,cor:1,hol:4,  prop:false, ord:9  },
      { cat:"Outdoor Features", name:"Outdoor Kitchen",     icon:"🍳", adr:5, occ:3,lux:4,gst:4, fam:4,cor:1,hol:4,  prop:false, ord:10 },
      { cat:"Outdoor Features", name:"Fire Pit",            icon:"🕯️", adr:2, occ:2,lux:2,gst:2, fam:2,cor:1,hol:3,  prop:false, ord:11 },
      { cat:"Outdoor Features", name:"Private Pool",        icon:"🏊", adr:18,occ:5,lux:12,gst:8, fam:6,cor:2,hol:7,  prop:true,  seo:"private pool villa",    ord:12 },
      { cat:"Outdoor Features", name:"Infinity Pool",       icon:"♾️", adr:20,occ:6,lux:14,gst:9, fam:4,cor:2,hol:7,  prop:true,  seo:"infinity pool property",ord:13 },
      { cat:"Outdoor Features", name:"Jacuzzi",             icon:"💆", adr:8, occ:4,lux:7,gst:6, fam:2,cor:2,hol:5,  prop:true,  ord:14 },
      { cat:"Outdoor Features", name:"Private Jacuzzi",     icon:"🛁", adr:10,occ:5,lux:9,gst:7, fam:2,cor:2,hol:6,  prop:true,  ord:15 },
      { cat:"Outdoor Features", name:"Plunge Pool",         icon:"🌊", adr:8, occ:4,lux:7,gst:6, fam:2,cor:1,hol:5,  prop:true,  ord:16 },
      // ── Category 3: Building Facilities ────────────────────────────
      { cat:"Building Facilities", name:"Shared Swimming Pool",icon:"🏊",adr:4,occ:3,lux:3,gst:5, fam:5,cor:1,hol:4,  prop:false, ord:1  },
      { cat:"Building Facilities", name:"Children's Pool",    icon:"🏊",adr:2,occ:2,lux:1,gst:2, fam:7,cor:0,hol:2,  prop:false, ord:2  },
      { cat:"Building Facilities", name:"Lap Pool",           icon:"🔵",adr:3,occ:2,lux:2,gst:3, fam:2,cor:3,hol:2,  prop:false, ord:3  },
      { cat:"Building Facilities", name:"Indoor Pool",        icon:"🏠",adr:5,occ:3,lux:4,gst:4, fam:3,cor:2,hol:3,  prop:false, ord:4  },
      { cat:"Building Facilities", name:"Gym",                icon:"💪",adr:3,occ:3,lux:3,gst:4, fam:2,cor:4,hol:2,  prop:false, seo:"gym apartment",         ord:5  },
      { cat:"Building Facilities", name:"Shared Gym",         icon:"🏋️",adr:2,occ:2,lux:1,gst:3, fam:1,cor:3,hol:2,  prop:false, ord:6  },
      { cat:"Building Facilities", name:"Spa",                icon:"💆",adr:7,occ:4,lux:7,gst:6, fam:2,cor:3,hol:4,  prop:true,  seo:"spa apartment",         ord:7  },
      { cat:"Building Facilities", name:"Sauna",              icon:"🌡️",adr:4,occ:2,lux:4,gst:3, fam:1,cor:2,hol:3,  prop:false, ord:8  },
      { cat:"Building Facilities", name:"Steam Room",         icon:"♨️", adr:3,occ:2,lux:3,gst:3, fam:1,cor:2,hol:3,  prop:false, ord:9  },
      { cat:"Building Facilities", name:"Yoga Studio",        icon:"🧘",adr:2,occ:2,lux:2,gst:3, fam:1,cor:2,hol:2,  prop:false, ord:10 },
      { cat:"Building Facilities", name:"Tennis Court",       icon:"🎾",adr:3,occ:2,lux:3,gst:3, fam:4,cor:2,hol:2,  prop:false, ord:11 },
      { cat:"Building Facilities", name:"Paddle Court",       icon:"🏓",adr:3,occ:2,lux:2,gst:3, fam:3,cor:2,hol:2,  prop:false, ord:12 },
      { cat:"Building Facilities", name:"Basketball Court",   icon:"🏀",adr:2,occ:2,lux:1,gst:2, fam:5,cor:1,hol:2,  prop:false, ord:13 },
      { cat:"Building Facilities", name:"Football Court",     icon:"⚽",adr:2,occ:2,lux:1,gst:2, fam:5,cor:1,hol:2,  prop:false, ord:14 },
      { cat:"Building Facilities", name:"Squash Court",       icon:"🎱",adr:2,occ:2,lux:2,gst:2, fam:2,cor:3,hol:1,  prop:false, ord:15 },
      { cat:"Building Facilities", name:"Children's Playground",icon:"🛝",adr:2,occ:2,lux:1,gst:2, fam:8,cor:0,hol:2, prop:false, ord:16 },
      { cat:"Building Facilities", name:"Kids Club",          icon:"🧒",adr:3,occ:2,lux:2,gst:2, fam:9,cor:0,hol:3,  prop:false, ord:17 },
      { cat:"Building Facilities", name:"Cinema",             icon:"🎬",adr:4,occ:2,lux:3,gst:4, fam:5,cor:2,hol:4,  prop:false, ord:18 },
      { cat:"Building Facilities", name:"Games Room",         icon:"🎮",adr:2,occ:2,lux:2,gst:3, fam:5,cor:1,hol:3,  prop:false, ord:19 },
      { cat:"Building Facilities", name:"Residents Lounge",   icon:"🛋️",adr:2,occ:1,lux:3,gst:2, fam:1,cor:2,hol:2,  prop:false, ord:20 },
      { cat:"Building Facilities", name:"Business Centre",    icon:"💼",adr:3,occ:2,lux:2,gst:2, fam:1,cor:7,hol:1,  prop:false, seo:"business centre apartment",ord:21},
      { cat:"Building Facilities", name:"Coworking Space",    icon:"💻",adr:2,occ:2,lux:1,gst:2, fam:1,cor:6,hol:2,  prop:false, ord:22 },
      { cat:"Building Facilities", name:"Library",            icon:"📖",adr:1,occ:1,lux:1,gst:1, fam:2,cor:3,hol:1,  prop:false, ord:23 },
      { cat:"Building Facilities", name:"Rooftop Lounge",     icon:"🌆",adr:4,occ:2,lux:4,gst:4, fam:1,cor:2,hol:3,  prop:false, ord:24 },
      { cat:"Building Facilities", name:"Sky Garden",         icon:"🌿",adr:4,occ:2,lux:4,gst:4, fam:2,cor:2,hol:3,  prop:false, ord:25 },
      // ── Category 4: Services ────────────────────────────────────────
      { cat:"Services", name:"Concierge",           icon:"🛎️",adr:5,occ:3,lux:9,gst:5, fam:2,cor:4,hol:4,  prop:true,  seo:"concierge apartment",   ord:1  },
      { cat:"Services", name:"24/7 Security",       icon:"🔒",adr:2,occ:2,lux:2,gst:2, fam:3,cor:3,hol:2,  prop:false, ord:2  },
      { cat:"Services", name:"CCTV",                icon:"📹",adr:1,occ:1,lux:1,gst:1, fam:2,cor:2,hol:1,  prop:false, ord:3  },
      { cat:"Services", name:"Smart Access",        icon:"🔑",adr:2,occ:1,lux:2,gst:1, fam:1,cor:2,hol:2,  prop:false, ord:4  },
      { cat:"Services", name:"Reception",           icon:"🏨",adr:2,occ:2,lux:3,gst:2, fam:1,cor:3,hol:2,  prop:false, ord:5  },
      { cat:"Services", name:"Valet Parking",       icon:"🚗",adr:4,occ:2,lux:7,gst:3, fam:1,cor:3,hol:3,  prop:true,  ord:6  },
      { cat:"Services", name:"Housekeeping",        icon:"🧹",adr:4,occ:3,lux:4,gst:4, fam:3,cor:2,hol:5,  prop:false, seo:"housekeeping service",  ord:7  },
      { cat:"Services", name:"Laundry Service",     icon:"👕",adr:2,occ:2,lux:2,gst:2, fam:2,cor:2,hol:4,  prop:false, ord:8  },
      { cat:"Services", name:"Room Service",        icon:"🍱",adr:4,occ:2,lux:4,gst:3, fam:2,cor:2,hol:3,  prop:false, ord:9  },
      { cat:"Services", name:"Maintenance Team",    icon:"🔧",adr:1,occ:1,lux:1,gst:1, fam:1,cor:1,hol:1,  prop:false, ord:10 },
      { cat:"Services", name:"Shuttle Service",     icon:"🚐",adr:2,occ:2,lux:2,gst:2, fam:3,cor:3,hol:2,  prop:false, ord:11 },
      // ── Category 5: Parking ──────────────────────────────────────────
      { cat:"Parking", name:"Covered Parking",   icon:"🅿️",adr:2,occ:2,lux:2,gst:2, fam:2,cor:2,hol:2,  prop:false, ord:1  },
      { cat:"Parking", name:"Basement Parking",  icon:"🏗️",adr:2,occ:2,lux:1,gst:1, fam:1,cor:1,hol:1,  prop:false, ord:2  },
      { cat:"Parking", name:"Private Garage",    icon:"🚘",adr:3,occ:2,lux:4,gst:2, fam:2,cor:2,hol:2,  prop:false, ord:3  },
      { cat:"Parking", name:"EV Charging",       icon:"⚡",adr:2,occ:2,lux:2,gst:1, fam:1,cor:3,hol:2,  prop:false, ord:4  },
      { cat:"Parking", name:"Visitor Parking",   icon:"🅰️",adr:1,occ:1,lux:0,gst:1, fam:2,cor:1,hol:1,  prop:false, ord:5  },
      { cat:"Parking", name:"Motorcycle Parking",icon:"🏍️",adr:0,occ:1,lux:0,gst:0, fam:0,cor:1,hol:0,  prop:false, ord:6  },
      // ── Category 6: Kitchen ──────────────────────────────────────────
      { cat:"Kitchen", name:"Fully Equipped Kitchen",icon:"🍳",adr:4,occ:3,lux:2,gst:4, fam:5,cor:2,hol:8,  prop:false, seo:"fully equipped kitchen",ord:1  },
      { cat:"Kitchen", name:"Coffee Machine",   icon:"☕",adr:2,occ:1,lux:2,gst:2, fam:1,cor:3,hol:3,  prop:false, ord:2  },
      { cat:"Kitchen", name:"Dishwasher",       icon:"🫧",adr:2,occ:1,lux:1,gst:2, fam:3,cor:1,hol:4,  prop:false, ord:3  },
      { cat:"Kitchen", name:"Microwave",        icon:"📡",adr:1,occ:1,lux:0,gst:1, fam:2,cor:1,hol:3,  prop:false, ord:4  },
      { cat:"Kitchen", name:"Oven",             icon:"🔥",adr:1,occ:1,lux:0,gst:1, fam:3,cor:1,hol:4,  prop:false, ord:5  },
      { cat:"Kitchen", name:"Air Fryer",        icon:"🌀",adr:1,occ:1,lux:0,gst:1, fam:2,cor:1,hol:3,  prop:false, ord:6  },
      { cat:"Kitchen", name:"Blender",          icon:"🥤",adr:1,occ:1,lux:0,gst:1, fam:2,cor:0,hol:2,  prop:false, ord:7  },
      { cat:"Kitchen", name:"Toaster",          icon:"🍞",adr:0,occ:1,lux:0,gst:0, fam:1,cor:0,hol:2,  prop:false, ord:8  },
      { cat:"Kitchen", name:"Kettle",           icon:"🫖",adr:0,occ:1,lux:0,gst:0, fam:1,cor:0,hol:2,  prop:false, ord:9  },
      { cat:"Kitchen", name:"Wine Cooler",      icon:"🍷",adr:3,occ:1,lux:4,gst:2, fam:0,cor:2,hol:3,  prop:false, ord:10 },
      { cat:"Kitchen", name:"Ice Maker",        icon:"🧊",adr:1,occ:1,lux:1,gst:1, fam:1,cor:1,hol:2,  prop:false, ord:11 },
      { cat:"Kitchen", name:"Water Dispenser",  icon:"💧",adr:1,occ:1,lux:0,gst:1, fam:2,cor:1,hol:3,  prop:false, ord:12 },
      { cat:"Kitchen", name:"Breakfast Bar",    icon:"🥐",adr:2,occ:1,lux:1,gst:2, fam:2,cor:1,hol:3,  prop:false, ord:13 },
      // ── Category 7: Technology ───────────────────────────────────────
      { cat:"Technology", name:"High-Speed WiFi",    icon:"📶",adr:2,occ:2,lux:2,gst:3, fam:3,cor:6,hol:4,  prop:false, seo:"high speed wifi apartment",ord:1 },
      { cat:"Technology", name:"Smart TV",           icon:"📺",adr:1,occ:1,lux:1,gst:2, fam:3,cor:1,hol:4,  prop:false, ord:2  },
      { cat:"Technology", name:"Netflix Ready",      icon:"🎬",adr:1,occ:1,lux:1,gst:2, fam:3,cor:1,hol:4,  prop:false, ord:3  },
      { cat:"Technology", name:"Apple TV",           icon:"🍎",adr:1,occ:1,lux:2,gst:1, fam:2,cor:1,hol:3,  prop:false, ord:4  },
      { cat:"Technology", name:"Sound System",       icon:"🔊",adr:3,occ:1,lux:3,gst:2, fam:2,cor:1,hol:3,  prop:false, ord:5  },
      { cat:"Technology", name:"Home Cinema",        icon:"🎥",adr:4,occ:2,lux:4,gst:4, fam:4,cor:2,hol:5,  prop:false, ord:6  },
      { cat:"Technology", name:"Alexa",              icon:"🔵",adr:1,occ:1,lux:1,gst:1, fam:2,cor:2,hol:2,  prop:false, ord:7  },
      { cat:"Technology", name:"Google Home",        icon:"🟢",adr:1,occ:1,lux:1,gst:1, fam:2,cor:2,hol:2,  prop:false, ord:8  },
      { cat:"Technology", name:"Smart Lighting",     icon:"💡",adr:2,occ:1,lux:2,gst:1, fam:1,cor:2,hol:2,  prop:false, ord:9  },
      { cat:"Technology", name:"Smart Locks",        icon:"🔐",adr:1,occ:1,lux:2,gst:1, fam:1,cor:2,hol:2,  prop:false, ord:10 },
      { cat:"Technology", name:"USB Charging Ports", icon:"🔌",adr:1,occ:1,lux:0,gst:1, fam:2,cor:3,hol:2,  prop:false, ord:11 },
      { cat:"Technology", name:"Dedicated Workspace",icon:"🖥️",adr:2,occ:2,lux:1,gst:2, fam:1,cor:7,hol:3,  prop:false, seo:"work from home apartment",ord:12},
      // ── Category 8: Family Friendly ──────────────────────────────────
      { cat:"Family Friendly", name:"Baby Cot",          icon:"🛏️",adr:1,occ:1,lux:0,gst:1, fam:6,cor:0,hol:2,  prop:false, ord:1  },
      { cat:"Family Friendly", name:"High Chair",        icon:"🪑",adr:1,occ:1,lux:0,gst:1, fam:5,cor:0,hol:2,  prop:false, ord:2  },
      { cat:"Family Friendly", name:"Children's Toys",   icon:"🧸",adr:1,occ:1,lux:0,gst:1, fam:5,cor:0,hol:2,  prop:false, ord:3  },
      { cat:"Family Friendly", name:"Family Friendly",   icon:"👨‍👩‍👧",adr:2,occ:2,lux:0,gst:2, fam:7,cor:0,hol:3,  prop:false, seo:"family friendly apartment",ord:4},
      { cat:"Family Friendly", name:"Stroller Storage",  icon:"🚼",adr:0,occ:1,lux:0,gst:0, fam:4,cor:0,hol:1,  prop:false, ord:5  },
      { cat:"Family Friendly", name:"Baby Safety Features",icon:"🛡️",adr:1,occ:1,lux:0,gst:1, fam:6,cor:0,hol:2, prop:false, ord:6  },
      // ── Category 9: Accessibility ─────────────────────────────────────
      { cat:"Accessibility", name:"Wheelchair Accessible",icon:"♿",adr:1,occ:1,lux:0,gst:1, fam:2,cor:1,hol:1,  prop:false, ord:1  },
      { cat:"Accessibility", name:"Elevator",            icon:"🔼",adr:2,occ:2,lux:1,gst:1, fam:2,cor:1,hol:1,  prop:false, ord:2  },
      { cat:"Accessibility", name:"Step-Free Access",    icon:"🚶",adr:1,occ:1,lux:0,gst:1, fam:1,cor:1,hol:1,  prop:false, ord:3  },
      { cat:"Accessibility", name:"Accessible Bathroom", icon:"🚿",adr:1,occ:1,lux:0,gst:1, fam:1,cor:1,hol:1,  prop:false, ord:4  },
      { cat:"Accessibility", name:"Accessible Parking",  icon:"🅿️",adr:1,occ:1,lux:0,gst:0, fam:1,cor:1,hol:1,  prop:false, ord:5  },
      // ── Category 10: Pet Friendly ────────────────────────────────────
      { cat:"Pet Friendly", name:"Pets Allowed", icon:"🐾",adr:2,occ:3,lux:0,gst:3, fam:3,cor:0,hol:3,  prop:false, seo:"pet friendly apartment",ord:1 },
      { cat:"Pet Friendly", name:"Dog Friendly", icon:"🐕",adr:2,occ:2,lux:0,gst:2, fam:2,cor:0,hol:2,  prop:false, ord:2  },
      { cat:"Pet Friendly", name:"Cat Friendly", icon:"🐈",adr:1,occ:1,lux:0,gst:1, fam:2,cor:0,hol:2,  prop:false, ord:3  },
      { cat:"Pet Friendly", name:"Pet Area",     icon:"🌿",adr:1,occ:1,lux:0,gst:1, fam:2,cor:0,hol:1,  prop:false, ord:4  },
      // ── Category 11: Nearby Attractions ──────────────────────────────
      { cat:"Nearby Attractions", name:"Beach",           icon:"🏖️",adr:8,occ:5,lux:4,gst:8, fam:6,cor:1,hol:6,  prop:true,  seo:"near beach apartment",  ord:1  },
      { cat:"Nearby Attractions", name:"Yas Marina",      icon:"⚓",adr:6,occ:4,lux:5,gst:6, fam:3,cor:2,hol:4,  prop:false, ord:2  },
      { cat:"Nearby Attractions", name:"Yas Mall",        icon:"🛍️",adr:4,occ:3,lux:2,gst:4, fam:5,cor:2,hol:3,  prop:false, ord:3  },
      { cat:"Nearby Attractions", name:"Ferrari World",   icon:"🏎️",adr:5,occ:3,lux:3,gst:5, fam:6,cor:1,hol:4,  prop:false, ord:4  },
      { cat:"Nearby Attractions", name:"Warner Bros",     icon:"🎬",adr:4,occ:3,lux:2,gst:4, fam:6,cor:1,hol:3,  prop:false, ord:5  },
      { cat:"Nearby Attractions", name:"SeaWorld",        icon:"🐳",adr:4,occ:3,lux:2,gst:4, fam:6,cor:1,hol:3,  prop:false, ord:6  },
      { cat:"Nearby Attractions", name:"Yas Waterworld",  icon:"💦",adr:4,occ:3,lux:2,gst:4, fam:6,cor:1,hol:3,  prop:false, ord:7  },
      { cat:"Nearby Attractions", name:"Etihad Arena",    icon:"🎵",adr:4,occ:3,lux:3,gst:4, fam:3,cor:2,hol:3,  prop:false, ord:8  },
      { cat:"Nearby Attractions", name:"Formula 1 Circuit",icon:"🏁",adr:5,occ:3,lux:3,gst:5, fam:3,cor:2,hol:3,  prop:false, seo:"near F1 circuit",       ord:9  },
      { cat:"Nearby Attractions", name:"Golf Club",       icon:"⛳",adr:4,occ:2,lux:4,gst:3, fam:2,cor:3,hol:3,  prop:false, ord:10 },
      { cat:"Nearby Attractions", name:"Airport",         icon:"✈️",adr:3,occ:2,lux:1,gst:2, fam:2,cor:5,hol:2,  prop:false, ord:11 },
      { cat:"Nearby Attractions", name:"Metro",           icon:"🚇",adr:2,occ:2,lux:0,gst:2, fam:2,cor:4,hol:2,  prop:false, ord:12 },
      { cat:"Nearby Attractions", name:"Mosque",          icon:"🕌",adr:1,occ:1,lux:0,gst:1, fam:2,cor:1,hol:1,  prop:false, ord:13 },
      { cat:"Nearby Attractions", name:"Hospital",        icon:"🏥",adr:1,occ:1,lux:0,gst:1, fam:3,cor:1,hol:1,  prop:false, ord:14 },
      { cat:"Nearby Attractions", name:"Shopping Mall",   icon:"🏬",adr:3,occ:2,lux:1,gst:3, fam:4,cor:2,hol:3,  prop:false, ord:15 },
      { cat:"Nearby Attractions", name:"Public Park",     icon:"🌳",adr:2,occ:2,lux:1,gst:2, fam:4,cor:1,hol:2,  prop:false, ord:16 },
      // ── Category 12: Lifestyle ────────────────────────────────────────
      { cat:"Lifestyle", name:"Luxury",             icon:"👑",adr:5,occ:2,lux:10,gst:4, fam:1,cor:2,hol:3,  prop:true,  ord:1  },
      { cat:"Lifestyle", name:"Business Friendly",  icon:"💼",adr:2,occ:2,lux:1,gst:2, fam:0,cor:7,hol:2,  prop:false, ord:2  },
      { cat:"Lifestyle", name:"Family Friendly",    icon:"👨‍👩‍👧‍👦",adr:2,occ:3,lux:0,gst:2, fam:8,cor:0,hol:4,  prop:false, ord:3  },
      { cat:"Lifestyle", name:"Romantic",           icon:"💕",adr:6,occ:3,lux:4,gst:5, fam:0,cor:0,hol:4,  prop:false, ord:4  },
      { cat:"Lifestyle", name:"Party Friendly",     icon:"🎉",adr:3,occ:3,lux:2,gst:4, fam:0,cor:0,hol:3,  prop:false, ord:5  },
      { cat:"Lifestyle", name:"Corporate Ready",    icon:"🏢",adr:3,occ:2,lux:2,gst:2, fam:0,cor:8,hol:2,  prop:false, ord:6  },
      { cat:"Lifestyle", name:"Remote Work Friendly",icon:"💻",adr:2,occ:2,lux:1,gst:2, fam:1,cor:6,hol:3,  prop:false, ord:7  },
      { cat:"Lifestyle", name:"Long Stay Friendly", icon:"📅",adr:2,occ:4,lux:1,gst:2, fam:3,cor:3,hol:6,  prop:false, ord:8  },
      { cat:"Lifestyle", name:"Holiday Home Ready", icon:"🏖️",adr:3,occ:3,lux:2,gst:3, fam:3,cor:1,hol:9,  prop:false, seo:"holiday home rental",   ord:9  },
      // ── Category 13: Property Condition ──────────────────────────────
      { cat:"Property Condition", name:"Move-in Ready",        icon:"✅",adr:4,occ:3,lux:2,gst:4, fam:3,cor:2,hol:5,  prop:false, ord:1  },
      { cat:"Property Condition", name:"Recently Refurbished", icon:"🔨",adr:5,occ:3,lux:3,gst:5, fam:2,cor:2,hol:4,  prop:false, ord:2  },
      { cat:"Property Condition", name:"Requires Minor Upgrade",icon:"⚠️",adr:-2,occ:-1,lux:0,gst:-1,fam:-1,cor:-1,hol:-1,prop:false, ord:3 },
      { cat:"Property Condition", name:"Requires Renovation",  icon:"🚧",adr:-5,occ:-3,lux:0,gst:-3,fam:-2,cor:-2,hol:-3,prop:false, ord:4 },
      { cat:"Property Condition", name:"Premium Condition",    icon:"💎",adr:8,occ:4,lux:6,gst:6, fam:2,cor:3,hol:5,  prop:true,  ord:5  },
    ];

    for (const a of AMENITIES) {
      await db.execute(sql`
        INSERT INTO amenities (category, name, icon, adr_boost, occupancy_boost, luxury_score, guest_appeal_score, family_score, corporate_score, holiday_home_score, is_proposal_highlight, seo_keyword, sort_order)
        VALUES (
          ${a.cat}, ${a.name}, ${a.icon},
          ${a.adr}, ${a.occ}, ${a.lux}, ${a.gst}, ${a.fam}, ${a.cor}, ${a.hol},
          ${a.prop}, ${a.seo ?? null}, ${a.ord}
        )
        ON CONFLICT (category, name) DO NOTHING
      `);
    }

    // Add has_main_room column to properties if missing
    await db.execute(sql`
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS has_main_room BOOLEAN NOT NULL DEFAULT false
    `);

    // Create forecast_comparables table (comparable listings panel on forecast detail)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS forecast_comparables (
        id           SERIAL PRIMARY KEY,
        forecast_id  INTEGER NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
        listing_name TEXT NOT NULL,
        listing_url  TEXT,
        nightly_rate REAL NOT NULL,
        occupancy_pct REAL NOT NULL,
        bedrooms     INTEGER,
        area         TEXT,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create forecast_comparables table (comparable listings panel on forecast detail)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS forecast_comparables (
        id           SERIAL PRIMARY KEY,
        forecast_id  INTEGER NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
        listing_name TEXT NOT NULL,
        listing_url  TEXT,
        nightly_rate REAL NOT NULL,
        occupancy_pct REAL NOT NULL,
        bedrooms     INTEGER,
        area         TEXT,
        sort_order   INTEGER NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create monthly_actuals table for actual vs. projected revenue tracking
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS monthly_actuals (
        id           SERIAL PRIMARY KEY,
        forecast_id  INTEGER NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
        month        INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        actual_gross REAL,
        actual_net   REAL,
        notes        TEXT,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (forecast_id, month)
      )
    `);

    logger.info("Startup migration complete");
  } catch (err) {
    logger.error({ err }, "Startup migration failed");
    throw err;
  }
}
