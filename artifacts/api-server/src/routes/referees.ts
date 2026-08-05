import { Router, type IRouter } from "express";
import { eq, desc, sql, and, isNotNull, sum, inArray } from "drizzle-orm";
import { db, refereesTable, ownersTable, forecastsTable, refereeCommissionPaymentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

// ── Short-lived server-side commission cache ──────────────────────────────────
const CACHE_TTL_MS = 60_000; // 60 seconds
const commissionCache = new Map<number, { value: number; expiresAt: number }>();

function getCachedCommission(refereeId: number): number | undefined {
  const entry = commissionCache.get(refereeId);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { commissionCache.delete(refereeId); return undefined; }
  return entry.value;
}

function setCachedCommission(refereeId: number, value: number): void {
  commissionCache.set(refereeId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Bust one or all cached commission entries (call after forecast mutations). */
export function bustCommissionCache(refereeId?: number): void {
  if (refereeId !== undefined) { commissionCache.delete(refereeId); } else { commissionCache.clear(); }
}

const router: IRouter = Router();

// Auto-generate referee code (REF-001, REF-002, ...)
async function generateRefereeCode(): Promise<string> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(refereesTable);
  const next = (result?.count ?? 0) + 1;
  return `REF-${String(next).padStart(3, "0")}`;
}

function formatReferee(r: any, referredOwners?: any[]) {
  return {
    id: r.id,
    refereeCode: r.refereeCode,
    name: r.name,
    phone: r.phone ?? null,
    email: r.email ?? null,
    companyName: r.companyName ?? null,
    referralFeeStudio: r.referralFeeStudio ?? 1500,
    referralFee1br: r.referralFee1br ?? 2000,
    referralFee2br: r.referralFee2br ?? 2500,
    referralFee3br: r.referralFee3br ?? 3000,
    referralFee4brPlus: r.referralFee4brPlus ?? 3500,
    isRecurringEnabled: r.isRecurringEnabled ?? false,
    notes: r.notes ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt,
    ...(referredOwners !== undefined ? { referredOwners } : {}),
  };
}

const ReferralFeesSchema = z.object({
  referralFeeStudio: z.number().int().min(0).default(1500),
  referralFee1br: z.number().int().min(0).default(2000),
  referralFee2br: z.number().int().min(0).default(2500),
  referralFee3br: z.number().int().min(0).default(3000),
  referralFee4brPlus: z.number().int().min(0).default(3500),
});

const CreateRefereeBody = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().optional(),
  companyName: z.string().optional(),
  referralFeeStudio: z.number().int().min(0).default(1500),
  referralFee1br: z.number().int().min(0).default(2000),
  referralFee2br: z.number().int().min(0).default(2500),
  referralFee3br: z.number().int().min(0).default(3000),
  referralFee4brPlus: z.number().int().min(0).default(3500),
  isRecurringEnabled: z.boolean().default(false),
  notes: z.string().optional(),
});

const UpdateRefereeBody = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  referralFeeStudio: z.number().int().min(0).optional(),
  referralFee1br: z.number().int().min(0).optional(),
  referralFee2br: z.number().int().min(0).optional(),
  referralFee3br: z.number().int().min(0).optional(),
  referralFee4brPlus: z.number().int().min(0).optional(),
  isRecurringEnabled: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// Helper: compute total commission owed for a referee across all referred owners' forecasts
// Uses the server-side cache; falls back to a direct DB lookup on cache miss.
async function computeTotalCommissionOwed(refereeId: number, isRecurringEnabled: boolean): Promise<number> {
  if (!isRecurringEnabled) return 0;
  const cached = getCachedCommission(refereeId);
  if (cached !== undefined) return cached;
  const value = await computeCommissionForReferee(refereeId);
  setCachedCommission(refereeId, value);
  return value;
}

/** Single-referee DB lookup (no cache). */
async function computeCommissionForReferee(refereeId: number): Promise<number> {
  const owners = await db
    .select({ id: ownersTable.id })
    .from(ownersTable)
    .where(eq(ownersTable.refereeId, refereeId));
  if (owners.length === 0) return 0;
  const ownerIds = owners.map((o) => o.id);
  // Latest non-archived forecast per owner via DISTINCT ON
  const ownerIdLiteral = ownerIds.join(",");
  const rows = await db.execute(
    sql`SELECT DISTINCT ON (owner_id) owner_id, gross_annual_revenue, management_fee_percent
        FROM forecasts
        WHERE owner_id = ANY(ARRAY[${sql.raw(ownerIdLiteral)}]::int[])
          AND gross_annual_revenue IS NOT NULL
          AND is_archived = false
        ORDER BY owner_id, created_at DESC`
  );
  let total = 0;
  for (const row of rows.rows as any[]) {
    const gross = Number(row.gross_annual_revenue);
    const pct = Number(row.management_fee_percent);
    if (gross && pct) total += (gross * Math.max(0, pct - 16)) / 100;
  }
  return Math.round(total);
}

/**
 * Batch commission computation for the list endpoint.
 * Runs two DB queries total (owners + forecasts) instead of O(n * m).
 */
async function computeCommissionBatch(
  referees: { id: number; isRecurringEnabled: boolean }[]
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  const uncachedIds: number[] = [];

  for (const r of referees) {
    if (!r.isRecurringEnabled) { result.set(r.id, 0); continue; }
    const cached = getCachedCommission(r.id);
    if (cached !== undefined) { result.set(r.id, cached); } else { uncachedIds.push(r.id); }
  }

  if (uncachedIds.length === 0) return result;

  // One query: all owners for the uncached referee IDs
  const owners = await db
    .select({ id: ownersTable.id, refereeId: ownersTable.refereeId })
    .from(ownersTable)
    .where(inArray(ownersTable.refereeId, uncachedIds));

  // Initialize totals to 0 (handles referees with no owners)
  for (const id of uncachedIds) result.set(id, 0);

  const allOwnerIds = owners.map((o) => o.id);
  if (allOwnerIds.length > 0) {
    const ownerIdLiteral = allOwnerIds.join(",");
    const rows = await db.execute(
      sql`SELECT DISTINCT ON (owner_id) owner_id, gross_annual_revenue, management_fee_percent
          FROM forecasts
          WHERE owner_id = ANY(ARRAY[${sql.raw(ownerIdLiteral)}]::int[])
            AND gross_annual_revenue IS NOT NULL
            AND is_archived = false
          ORDER BY owner_id, created_at DESC`
    );

    // ownerToReferee lookup
    const ownerToReferee = new Map<number, number>();
    for (const o of owners) { if (o.refereeId) ownerToReferee.set(o.id, o.refereeId); }

    const runningTotals = new Map<number, number>();
    for (const id of uncachedIds) runningTotals.set(id, 0);

    for (const row of rows.rows as any[]) {
      const refereeId = ownerToReferee.get(Number(row.owner_id));
      if (refereeId === undefined) continue;
      const gross = Number(row.gross_annual_revenue);
      const pct = Number(row.management_fee_percent);
      if (gross && pct) {
        runningTotals.set(refereeId, (runningTotals.get(refereeId) ?? 0) + (gross * Math.max(0, pct - 16)) / 100);
      }
    }

    for (const [refereeId, total] of runningTotals) {
      const rounded = Math.round(total);
      setCachedCommission(refereeId, rounded);
      result.set(refereeId, rounded);
    }
  } else {
    for (const id of uncachedIds) { setCachedCommission(id, 0); }
  }

  return result;
}

// List all referees
router.get("/referees", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(refereesTable).orderBy(desc(refereesTable.createdAt));

  // Batch: owner counts + commission in parallel
  const [ownerCounts, commissionMap] = await Promise.all([
    // One query for all owner counts grouped by refereeId
    db
      .select({ refereeId: ownersTable.refereeId, count: sql<number>`count(*)::int` })
      .from(ownersTable)
      .where(inArray(ownersTable.refereeId, rows.map((r) => r.id)))
      .groupBy(ownersTable.refereeId),
    // Batched commission (2 DB queries total, cache-aware)
    computeCommissionBatch(rows.map((r) => ({ id: r.id, isRecurringEnabled: r.isRecurringEnabled }))),
  ]);

  const countMap = new Map(ownerCounts.map((c) => [c.refereeId, c.count]));

  const withCounts = rows.map((r) => ({
    ...formatReferee(r),
    referredCount: countMap.get(r.id) ?? 0,
    totalCommissionOwed: commissionMap.get(r.id) ?? 0,
  }));
  res.json(withCounts);
});

// Create referee
router.post("/referees", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateRefereeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const refereeCode = await generateRefereeCode();
  const [referee] = await db.insert(refereesTable).values({
    ...parsed.data,
    refereeCode,
    createdById: req.session.userId,
  }).returning();
  res.status(201).json(formatReferee(referee));
});

// Get single referee with referred owners
router.get("/referees/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [referee] = await db.select().from(refereesTable).where(eq(refereesTable.id, id));
  if (!referee) { res.status(404).json({ error: "Referee not found" }); return; }
  const owners = await db
    .select({
      id: ownersTable.id,
      firstName: ownersTable.firstName,
      lastName: ownersTable.lastName,
      email: ownersTable.email,
      phone: ownersTable.phone,
      leadSource: ownersTable.leadSource,
      createdAt: ownersTable.createdAt,
    })
    .from(ownersTable)
    .where(eq(ownersTable.refereeId, id));
  res.json(formatReferee(referee, owners));
});

// Commission summary for a referee
router.get("/referees/:id/commission", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [referee] = await db.select().from(refereesTable).where(eq(refereesTable.id, id));
  if (!referee) { res.status(404).json({ error: "Referee not found" }); return; }

  const owners = await db
    .select({
      id: ownersTable.id,
      firstName: ownersTable.firstName,
      lastName: ownersTable.lastName,
      email: ownersTable.email,
    })
    .from(ownersTable)
    .where(eq(ownersTable.refereeId, id));

  const ownerBreakdowns = await Promise.all(
    owners.map(async (owner) => {
      const [forecast] = await db
        .select({
          id: forecastsTable.id,
          grossAnnualRevenue: forecastsTable.grossAnnualRevenue,
          netOwnerIncome: forecastsTable.netOwnerIncome,
          managementFeePercent: forecastsTable.managementFeePercent,
          status: forecastsTable.status,
        })
        .from(forecastsTable)
        .where(
          and(
            eq(forecastsTable.ownerId, owner.id),
            isNotNull(forecastsTable.grossAnnualRevenue),
            eq(forecastsTable.isArchived, false)
          )
        )
        .orderBy(desc(forecastsTable.createdAt))
        .limit(1);

      const grossAnnualRevenue = forecast?.grossAnnualRevenue ?? 0;
      const netOwnerIncome = forecast?.netOwnerIncome ?? 0;
      const managementFeePercent = forecast?.managementFeePercent ?? 0;
      const commissionPercent = referee.isRecurringEnabled
        ? Math.max(0, managementFeePercent - 16)
        : 0;
      const commissionAmount = Math.round((grossAnnualRevenue * commissionPercent) / 100);

      return {
        ownerId: owner.id,
        ownerName: `${owner.firstName} ${owner.lastName}`,
        ownerEmail: owner.email,
        forecastId: forecast?.id ?? null,
        forecastStatus: forecast?.status ?? null,
        grossAnnualRevenue,
        netOwnerIncome,
        managementFeePercent,
        commissionPercent,
        commissionAmount,
      };
    })
  );

  const totalGrossRevenue = ownerBreakdowns.reduce((s, o) => s + o.grossAnnualRevenue, 0);
  const totalCommissionOwed = ownerBreakdowns.reduce((s, o) => s + o.commissionAmount, 0);

  // Sum all recorded payments for this referee
  const [paymentSum] = await db
    .select({ total: sum(refereeCommissionPaymentsTable.amountPaid) })
    .from(refereeCommissionPaymentsTable)
    .where(eq(refereeCommissionPaymentsTable.refereeId, id));
  const totalPaid = Number(paymentSum?.total ?? 0);
  const outstandingBalance = Math.max(0, totalCommissionOwed - totalPaid);

  res.json({
    refereeId: referee.id,
    refereeName: referee.name,
    refereeCode: referee.refereeCode,
    isRecurringEnabled: referee.isRecurringEnabled,
    totalGrossRevenue,
    totalCommissionOwed,
    totalPaid,
    outstandingBalance,
    ownerBreakdowns,
  });
});

// List commission payments for a referee
router.get("/referees/:id/commission/payments", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [referee] = await db.select({ id: refereesTable.id }).from(refereesTable).where(eq(refereesTable.id, id));
  if (!referee) { res.status(404).json({ error: "Referee not found" }); return; }
  const payments = await db
    .select()
    .from(refereeCommissionPaymentsTable)
    .where(eq(refereeCommissionPaymentsTable.refereeId, id))
    .orderBy(desc(refereeCommissionPaymentsTable.paidAt));
  res.json(payments);
});

const RecordPaymentBody = z.object({
  amountPaid: z.number().int().min(1),
  paidAt: z.string().datetime(),
  notes: z.string().optional(),
});

// Record a commission payment for a referee
router.post("/referees/:id/commission/payments", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [referee] = await db.select({ id: refereesTable.id }).from(refereesTable).where(eq(refereesTable.id, id));
  if (!referee) { res.status(404).json({ error: "Referee not found" }); return; }
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [payment] = await db.insert(refereeCommissionPaymentsTable).values({
    refereeId: id,
    amountPaid: parsed.data.amountPaid,
    paidAt: new Date(parsed.data.paidAt),
    notes: parsed.data.notes ?? null,
    createdById: req.session.userId,
  }).returning();
  res.status(201).json(payment);
});

// Update referee
router.patch("/referees/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateRefereeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [referee] = await db.update(refereesTable).set(parsed.data).where(eq(refereesTable.id, id)).returning();
  if (!referee) { res.status(404).json({ error: "Referee not found" }); return; }
  res.json(formatReferee(referee));
});

// Delete/deactivate referee
router.delete("/referees/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(refereesTable).set({ isActive: false }).where(eq(refereesTable.id, id));
  res.json({ message: "Referee deactivated" });
});

export default router;
