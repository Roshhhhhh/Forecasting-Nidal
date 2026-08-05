import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, ownersTable, usersTable } from "@workspace/db";
import {
  CreateOwnerBody,
  UpdateOwnerBody,
  GetOwnerParams,
  UpdateOwnerParams,
  DeleteOwnerParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

function formatOwner(owner: any, assignedName?: string | null) {
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
    notes: owner.notes,
    createdAt: owner.createdAt,
    assignedToName: assignedName ?? null,
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
  res.json(formatOwner(owner, assignedName));
});

router.patch("/owners/:id", requireAuth, async (req, res): Promise<void> => {
  const params = UpdateOwnerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateOwnerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [owner] = await db.update(ownersTable).set({ ...parsed.data, updatedById: req.session.userId })
    .where(eq(ownersTable.id, params.data.id)).returning();
  if (!owner) { res.status(404).json({ error: "Owner not found" }); return; }
  res.json(formatOwner(owner));
});

router.delete("/owners/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteOwnerParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(ownersTable).set({ isArchived: true }).where(eq(ownersTable.id, params.data.id));
  res.json({ message: "Owner archived" });
});

export default router;
