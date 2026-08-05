import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, rolesTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { BUILT_IN_ROLE_PERMISSIONS } from "../lib/permissions";

const router: IRouter = Router();

async function loadUserPermissions(roleId: number | null | undefined, roleName: string): Promise<string[]> {
  if (roleId) {
    const [role] = await db.select({ permissions: rolesTable.permissions })
      .from(rolesTable)
      .where(eq(rolesTable.id, roleId));
    if (role) return role.permissions;
  }
  // Fall back to built-in role permissions
  return BUILT_IN_ROLE_PERMISSIONS[roleName] ?? [];
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));

  const permissions = await loadUserPermissions(user.roleId, user.role);

  req.session.userId      = user.id;
  req.session.userRole    = user.role;
  req.session.userEmail   = user.email;
  req.session.userName    = user.name;
  req.session.userPermissions = permissions;
  req.session.userRoleId  = user.roleId ?? null;

  // Load role label for response
  let roleName = user.role;
  if (user.roleId) {
    const [role] = await db.select({ label: rolesTable.label, name: rolesTable.name })
      .from(rolesTable).where(eq(rolesTable.id, user.roleId));
    if (role) roleName = role.name;
  }

  res.json({
    id: user.id, email: user.email, name: user.name,
    role: roleName, avatarUrl: user.avatarUrl,
    roleId: user.roleId ?? null, permissions,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  const permissions = req.session.userPermissions
    ?? await loadUserPermissions(user.roleId, user.role);

  let roleName = user.role;
  if (user.roleId) {
    const [role] = await db.select({ name: rolesTable.name })
      .from(rolesTable).where(eq(rolesTable.id, user.roleId));
    if (role) roleName = role.name;
  }

  res.json({
    id: user.id, email: user.email, name: user.name,
    role: roleName, avatarUrl: user.avatarUrl,
    roleId: user.roleId ?? null, permissions,
  });
});

export default router;
