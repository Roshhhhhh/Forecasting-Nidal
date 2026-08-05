import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

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
  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.userEmail = user.email;
  req.session.userName = user.name;
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl });
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
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl });
});

export default router;
