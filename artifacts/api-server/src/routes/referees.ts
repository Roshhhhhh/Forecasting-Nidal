import { Router, type IRouter } from "express";
import { eq, desc, sql, and, isNotNull, sum } from "drizzle-orm";
import { db, refereesTable, ownersTable, forecastsTable, refereeCommissionPaymentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

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
async function computeTotalCommissionOwed(refereeId: number, isRecurringEnabled: boolean): Promise<number> {
  if (!isRecurringEnabled) return 0;
  // Get all owners referred by this referee
  const owners = await db
    .select({ id: ownersTable.id })
    .from(ownersTable)
    .where(eq(ownersTable.refereeId, refereeId));
  if (owners.length === 0) return 0;
  // For each owner, get their latest non-archived forecast with revenue data
  let total = 0;
  for (const owner of owners) {
    const [forecast] = await db
      .select({
        grossAnnualRevenue: forecastsTable.grossAnnualRevenue,
        managementFeePercent: forecastsTable.managementFeePercent,
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
    if (forecast?.grossAnnualRevenue && forecast?.managementFeePercent) {
      const commissionPct = Math.max(0, forecast.managementFeePercent - 16);
      total += (forecast.grossAnnualRevenue * commissionPct) / 100;
    }
  }
  return Math.round(total);
}

// List all referees
router.get("/referees", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(refereesTable).orderBy(desc(refereesTable.createdAt));
  const withCounts = await Promise.all(
    rows.map(async (r) => {
      const [cnt] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ownersTable)
        .where(eq(ownersTable.refereeId, r.id));
      const totalCommissionOwed = await computeTotalCommissionOwed(r.id, r.isRecurringEnabled);
      return { ...formatReferee(r), referredCount: cnt?.count ?? 0, totalCommissionOwed };
    })
  );
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
