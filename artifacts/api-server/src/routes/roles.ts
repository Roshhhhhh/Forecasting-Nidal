import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rolesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { requirePermission } from "../middlewares/auth";
import { PERMISSIONS } from "../lib/permissions";
import { z } from "zod";

const router: IRouter = Router();

const RoleInputSchema = z.object({
  name:        z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "Name must be lowercase letters, numbers and underscores only"),
  label:       z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).default([]),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#6B7280"),
});

const RoleUpdateSchema = z.object({
  label:       z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).optional(),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

function fmt(r: typeof rolesTable.$inferSelect) {
  return {
    id:          r.id,
    name:        r.name,
    label:       r.label,
    description: r.description,
    permissions: r.permissions,
    color:       r.color,
    isBuiltIn:   r.isBuiltIn,
    createdAt:   r.createdAt,
  };
}

// List all roles
router.get("/roles", requireAuth, async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.createdAt);
  res.json(roles.map(fmt));
});

// Get single role
router.get("/roles/:id", requireAuth, requirePermission(PERMISSIONS.ROLES_MANAGE), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }
  res.json(fmt(role));
});

// Create custom role
router.post("/roles", requireAuth, requirePermission(PERMISSIONS.ROLES_MANAGE), async (req, res): Promise<void> => {
  const parsed = RoleInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [role] = await db.insert(rolesTable).values({
      name:        parsed.data.name,
      label:       parsed.data.label,
      description: parsed.data.description,
      permissions: parsed.data.permissions,
      color:       parsed.data.color,
      isBuiltIn:   false,
    }).returning();
    res.status(201).json(fmt(role));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A role with that name already exists" });
    } else {
      throw err;
    }
  }
});

// Update role (label, description, permissions, color)
router.patch("/roles/:id", requireAuth, requirePermission(PERMISSIONS.ROLES_MANAGE), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = RoleUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [role] = await db.update(rolesTable).set(parsed.data).where(eq(rolesTable.id, id)).returning();
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }
  res.json(fmt(role));
});

// Delete custom role (built-in roles cannot be deleted)
router.delete("/roles/:id", requireAuth, requirePermission(PERMISSIONS.ROLES_MANAGE), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [role] = await db.select().from(rolesTable).where(eq(rolesTable.id, id));
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }
  if (role.isBuiltIn) { res.status(403).json({ error: "Built-in roles cannot be deleted" }); return; }
  await db.delete(rolesTable).where(eq(rolesTable.id, id));
  res.json({ message: "Role deleted" });
});

export default router;
