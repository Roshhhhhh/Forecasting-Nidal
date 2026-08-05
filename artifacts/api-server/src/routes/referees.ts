import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, refereesTable, ownersTable } from "@workspace/db";
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

// List all referees
router.get("/referees", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db.select().from(refereesTable).orderBy(desc(refereesTable.createdAt));
  const withCounts = await Promise.all(
    rows.map(async (r) => {
      const [cnt] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ownersTable)
        .where(eq(ownersTable.refereeId, r.id));
      return { ...formatReferee(r), referredCount: cnt?.count ?? 0 };
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
