import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq, desc } from "drizzle-orm";
import { db, usersTable, rolesTable } from "@workspace/db";
import { requireAuth, requireRole, requirePermission } from "../middlewares/auth";
import { PERMISSIONS } from "../lib/permissions";
import { z } from "zod";

const router: IRouter = Router();

const CreateUserBody = z.object({
  name:     z.string().min(1),
  email:    z.string().email(),
  password: z.string().min(6),
  roleId:   z.number().int().positive(),
  phone:    z.string().optional(),
});

const UpdateUserBody = z.object({
  name:     z.string().min(1).optional(),
  roleId:   z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  phone:    z.string().optional(),
});

async function fmtUser(u: typeof usersTable.$inferSelect) {
  let roleLabel = u.role as string;
  let roleName  = u.role as string;
  if (u.roleId) {
    const [role] = await db.select({ label: rolesTable.label, name: rolesTable.name })
      .from(rolesTable).where(eq(rolesTable.id, u.roleId));
    if (role) { roleLabel = role.label; roleName = role.name; }
  }
  return {
    id: u.id, email: u.email, name: u.name,
    role: roleName, roleLabel, roleId: u.roleId ?? null,
    isActive: u.isActive, phone: u.phone,
    avatarUrl: u.avatarUrl, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt,
  };
}

router.get("/users", requireAuth, requirePermission(PERMISSIONS.USERS_VIEW), async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  const formatted = await Promise.all(users.map(fmtUser));
  res.json(formatted);
});

router.post("/users", requireAuth, requirePermission(PERMISSIONS.USERS_CREATE), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // Validate roleId exists
  const [role] = await db.select({ name: rolesTable.name }).from(rolesTable).where(eq(rolesTable.id, parsed.data.roleId));
  if (!role) { res.status(400).json({ error: "Invalid role" }); return; }

  const { password, roleId, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db.insert(usersTable).values({
    ...rest,
    passwordHash,
    role: (role.name as any) ?? "sales",
    roleId,
  }).returning();
  res.status(201).json(await fmtUser(user));
});

router.get("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_VIEW), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(await fmtUser(user));
});

router.patch("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_EDIT), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updates: Record<string, any> = { ...parsed.data };

  // If roleId is changing, also update the legacy role column
  if (parsed.data.roleId) {
    const [role] = await db.select({ name: rolesTable.name }).from(rolesTable).where(eq(rolesTable.id, parsed.data.roleId));
    if (!role) { res.status(400).json({ error: "Invalid role" }); return; }
    // Map to enum value if it's a built-in name; otherwise keep current
    const builtInNames = ["super_admin","admin","sales","revenue_manager","read_only"];
    if (builtInNames.includes(role.name)) updates.role = role.name;
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(await fmtUser(user));
});

router.delete("/users/:id", requireAuth, requirePermission(PERMISSIONS.USERS_EDIT), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, id));
  res.json({ message: "User deactivated" });
});

export default router;
