import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq, desc } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import {
  CreateUserBody,
  UpdateUserBody,
  GetUserParams,
  UpdateUserParams,
  DeleteUserParams,
} from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/users", requireAuth, requireRole("super_admin", "admin"), async (_req, res): Promise<void> => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive, phone: u.phone, avatarUrl: u.avatarUrl, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt })));
});

router.post("/users", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { password, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({ ...rest, passwordHash }).returning();
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive, phone: user.phone, avatarUrl: user.avatarUrl, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt });
});

router.get("/users/:id", requireAuth, requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive, phone: user.phone, avatarUrl: user.avatarUrl, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt });
});

router.patch("/users/:id", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, params.data.id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, isActive: user.isActive, phone: user.phone, avatarUrl: user.avatarUrl, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt });
});

router.delete("/users/:id", requireAuth, requireRole("super_admin"), async (req, res): Promise<void> => {
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(usersTable).set({ isActive: false }).where(eq(usersTable.id, params.data.id));
  res.json({ message: "User deactivated" });
});

export default router;
