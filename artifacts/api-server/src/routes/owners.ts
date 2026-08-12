import { Router, type IRouter } from "express";
import { eq, desc, sql, or, and } from "drizzle-orm";
import { db, ownersTable, usersTable, refereesTable, propertiesTable, propertyOwnersTable } from "@workspace/db";
import {
  CreateOwnerBody,
  UpdateOwnerBody,
  GetOwnerParams,
  UpdateOwnerParams,
  DeleteOwnerParams,
  CreateOwnerActivityBody,
  CreateOwnerActivityParams,
  UpdateOwnerActivityBody,
  UpdateOwnerActivityParams,
  DeleteOwnerActivityParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import { bustCommissionCache } from "./referees";

const router: IRouter = Router();

function formatOwner(owner: any, assignedName?: string | null, refereeName?: string | null, refereeCode?: string | null) {
  return {
    id: owner.id,
    ownerType: owner.ownerType,
    title: owner.title,
    firstName: owner.firstName,
    lastName: owner.lastName,
    companyName: owner.companyName,
    email: owner.email,
    phone: owner.phone,
    whatsapp: owner.whatsapp,
    nationality: owner.nationality,
    preferredLanguage: owner.preferredLanguage,
    leadSource: owner.leadSource,
    isExistingClient: owner.isExistingClient,
    objectives: owner.objectives ?? [],
    assignedToId: owner.assignedToId,
    assignedToName: assignedName ?? null,
    refereeId: owner.refereeId ?? null,
    refereeName: refereeName ?? null,
    refereeCode: refereeCode ?? null,
    notes: owner.notes,
    createdAt: owner.createdAt,
  };
}

router.get("/owners", requireAuth, async (_req, res): Promise<void> => {
  const owners = await db.select().from(ownersTable)
    .where(eq(ownersTable.isArchived, false))
    .orderBy(desc(ownersTable.createdAt));
  res.json(owners.map(o => formatOwner(o)));
});

router.post("/owners", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Duplicate detection: block if phone or email already exists on an active owner
  const { phone, email } = parsed.data;
  const conditions = [];
  if (phone) conditions.push(eq(ownersTable.phone, phone));
  if (email) conditions.push(eq(ownersTable.email, email));
  if (conditions.length > 0) {
    const [existing] = await db.select({ id: ownersTable.id, phone: ownersTable.phone, email: ownersTable.email })
      .from(ownersTable)
      .where(and(eq(ownersTable.isArchived, false), or(...conditions)))
      .limit(1);
    if (existing) {
      const field = phone && existing.phone === phone ? "mobile number" : "email address";
      res.status(409).json({
        error: `An owner with this ${field} already exists. Please check the owner list before creating a new profile.`,
        existingId: existing.id,
      });
      return;
    }
  }

  const [owner] = await db.insert(ownersTable).values({
    ...parsed.data,
    createdById: req.session.userId,
  }).returning();
  res.status(201).json(formatOwner(owner));
});

router.get("/owners/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetOwnerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [owner] = await db.select().from(ownersTable).where(eq(ownersTable.id, params.data.id));
  if (!owner) { res.status(404).json({ error: "Owner not found" }); return; }
  let assignedName: string | null = null;
  if (owner.assignedToId) {
    const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, owner.assignedToId));
    assignedName = u?.name ?? null;
  }
  let refereeName: string | null = null;
  let refereeCode: string | null = null;
  if (owner.refereeId) {
    const [r] = await db.select({ name: refereesTable.name, refereeCode: refereesTable.refereeCode }).from(refereesTable).where(eq(refereesTable.id, owner.refereeId));
    refereeName = r?.name ?? null;
    refereeCode = r?.refereeCode ?? null;
  }
  res.json(formatOwner(owner, assignedName, refereeName, refereeCode));
});

router.patch("/owners/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOwnerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Fetch the current refereeId before updating so we can bust the old cache entry
  const [existing] = await db
    .select({ refereeId: ownersTable.refereeId })
    .from(ownersTable)
    .where(eq(ownersTable.id, params.data.id));

  const [owner] = await db.update(ownersTable).set({ ...parsed.data, updatedById: req.session.userId })
    .where(eq(ownersTable.id, params.data.id)).returning();
  if (!owner) { res.status(404).json({ error: "Owner not found" }); return; }

  // If refereeId changed, bust commission cache for both old and new referee
  if ("refereeId" in parsed.data) {
    const oldRefereeId = existing?.refereeId ?? null;
    const newRefereeId = parsed.data.refereeId ?? null;
    if (oldRefereeId !== newRefereeId) {
      if (oldRefereeId !== null) bustCommissionCache(oldRefereeId);
      if (newRefereeId !== null) bustCommissionCache(newRefereeId);
    }
  }

  res.json(formatOwner(owner));
});

// All properties for this owner via the junction table (single source of truth post-migration)
router.get("/owners/:id/properties", requireAuth, async (req, res): Promise<void> => {
  const ownerId = parseInt(req.params.id as string, 10);
  if (!ownerId) { res.status(400).json({ error: "Invalid id" }); return; }

  // Junction-table query — covers both primary and co-owned after the startup migration backfill
  const rows = await db
    .select()
    .from(propertyOwnersTable)
    .innerJoin(propertiesTable, eq(propertiesTable.id, propertyOwnersTable.propertyId))
    .where(eq(propertyOwnersTable.ownerId, ownerId))
    .orderBy(desc(propertyOwnersTable.isPrimary), desc(propertiesTable.createdAt));

  const result = rows.map(r => ({
    ...r.properties,
    coOwnership: {
      ownershipPercentage: r.property_owners.ownershipPercentage,
      isPrimary:           r.property_owners.isPrimary,
      ownershipType:       (r.property_owners as any).ownershipType ?? null,
      notes:               (r.property_owners as any).notes ?? null,
    },
    isCoOwned: !r.property_owners.isPrimary,
  }));

  // Fallback: also include properties where owner_id matches but no junction row exists yet
  const junctionPropIds = new Set(result.map(r => r.id));
  const legacyProps = await db.select().from(propertiesTable)
    .where(eq(propertiesTable.ownerId, ownerId));
  for (const p of legacyProps) {
    if (!junctionPropIds.has(p.id)) {
      result.push({ ...p, coOwnership: { ownershipPercentage: 100, isPrimary: true, ownershipType: null, notes: null }, isCoOwned: false });
    }
  }

  res.json(result);
});

router.delete("/owners/:id", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const params = DeleteOwnerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(ownersTable).set({ isArchived: true }).where(eq(ownersTable.id, params.data.id));
  res.json({ message: "Owner archived" });
});

// ── Owner Activity Log ────────────────────────────────────────────────────────

/** Safely coerce an Express route param (string | string[]) to a positive integer. */
function parseRouteId(param: string | string[] | undefined): number | null {
  const raw = Array.isArray(param) ? param[0] : param;
  const n = parseInt(raw ?? "", 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function formatActivity(row: Record<string, unknown>, createdByName: string | null) {
  return {
    id:            Number(row.id),
    ownerId:       Number(row.owner_id),
    type:          row.type as string,
    content:       row.content as string,
    dueDate:       row.due_date ? String(row.due_date).slice(0, 10) : null,
    isCompleted:   Boolean(row.is_completed),
    completedAt:   (row.completed_at as string | null) ?? null,
    createdById:   row.created_by_id != null ? Number(row.created_by_id) : null,
    createdByName,
    createdAt:     row.created_at as string,
    updatedAt:     row.updated_at as string,
  };
}

router.get("/owners/:id/activities", requireAuth, async (req, res): Promise<void> => {
  const params = CreateOwnerActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid owner id" }); return; }
  const { id: ownerId } = params.data;

  const result = await db.execute(sql`
    SELECT
      a.id, a.owner_id, a.type, a.content, a.due_date,
      a.is_completed, a.completed_at,
      a.created_by_id, u.name AS created_by_name,
      a.created_at, a.updated_at
    FROM owner_activities a
    LEFT JOIN users u ON u.id = a.created_by_id
    WHERE a.owner_id = ${ownerId}
    ORDER BY a.created_at DESC
  `);

  const activities = result.rows.map(r =>
    formatActivity(r as Record<string, unknown>, r.created_by_name as string | null)
  );
  const openTaskCount = activities.filter(a => a.type === "task" && !a.isCompleted).length;
  res.json({ activities, openTaskCount });
});

router.post("/owners/:id/activities", requireAuth, async (req, res): Promise<void> => {
  const params = CreateOwnerActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid owner id" }); return; }
  const { id: ownerId } = params.data;

  const body = CreateOwnerActivityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues.map(i => i.message).join("; ") });
    return;
  }
  const { type, content, dueDate } = body.data;
  if (!content.trim()) { res.status(400).json({ error: "content must not be blank" }); return; }

  const result = await db.execute(sql`
    INSERT INTO owner_activities (owner_id, type, content, due_date, created_by_id)
    VALUES (${ownerId}, ${type}, ${content.trim()}, ${dueDate ?? null}, ${req.session.userId ?? null})
    RETURNING id, owner_id, type, content, due_date, is_completed, completed_at,
              created_by_id, created_at, updated_at
  `);
  const row = result.rows[0] as Record<string, unknown>;

  let createdByName: string | null = null;
  if (req.session.userId) {
    const uRes = await db.execute(sql`SELECT name FROM users WHERE id = ${req.session.userId}`);
    createdByName = (uRes.rows[0]?.name as string) ?? null;
  }

  res.status(201).json(formatActivity(row, createdByName));
});

router.patch("/owners/:id/activities/:activityId", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOwnerActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: ownerId, activityId } = params.data;

  const body = UpdateOwnerActivityBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.issues.map(i => i.message).join("; ") });
    return;
  }
  // Reject blank content if explicitly provided
  if (body.data.content !== undefined && !body.data.content.trim()) {
    res.status(400).json({ error: "content must not be blank" });
    return;
  }

  // Fetch existing row
  const existResult = await db.execute(sql`
    SELECT id, created_by_id, content, due_date, is_completed, completed_at
    FROM owner_activities WHERE id = ${activityId} AND owner_id = ${ownerId}
  `);
  if (existResult.rows.length === 0) { res.status(404).json({ error: "Activity not found" }); return; }
  const existing = existResult.rows[0] as Record<string, unknown>;

  const newContent     = body.data.content     !== undefined ? body.data.content.trim()      : (existing.content as string);
  const newDueDate     = body.data.dueDate     !== undefined ? (body.data.dueDate ?? null)   : (existing.due_date ?? null);
  const newIsCompleted = body.data.isCompleted !== undefined ? body.data.isCompleted         : Boolean(existing.is_completed);
  const newCompletedAt = body.data.isCompleted !== undefined
    ? (body.data.isCompleted ? new Date().toISOString() : null)
    : ((existing.completed_at as string | null) ?? null);

  const updateResult = await db.execute(sql`
    UPDATE owner_activities
    SET content      = ${newContent},
        due_date     = ${newDueDate},
        is_completed = ${newIsCompleted},
        completed_at = ${newCompletedAt},
        updated_at   = NOW()
    WHERE id = ${activityId}
    RETURNING id, owner_id, type, content, due_date, is_completed, completed_at,
              created_by_id, created_at, updated_at
  `);
  const row = updateResult.rows[0] as Record<string, unknown>;

  const uRes = await db.execute(sql`SELECT name FROM users WHERE id = ${row.created_by_id}`);
  const createdByName = (uRes.rows[0]?.name as string) ?? null;

  res.json(formatActivity(row, createdByName));
});

router.delete("/owners/:id/activities/:activityId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteOwnerActivityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id: ownerId, activityId } = params.data;

  const existing = await db.execute(sql`
    SELECT id, created_by_id FROM owner_activities WHERE id = ${activityId} AND owner_id = ${ownerId}
  `);
  if (existing.rows.length === 0) { res.status(404).json({ error: "Activity not found" }); return; }

  const row = existing.rows[0] as Record<string, unknown>;
  const isSuperAdmin = req.session.userRole === "super_admin";
  const isAuthor     = Number(row.created_by_id) === req.session.userId;
  if (!isAuthor && !isSuperAdmin) {
    res.status(403).json({ error: "Only the author or a super admin can delete this entry" });
    return;
  }

  await db.execute(sql`DELETE FROM owner_activities WHERE id = ${activityId}`);
  res.json({ message: "Activity deleted" });
});

export default router;
