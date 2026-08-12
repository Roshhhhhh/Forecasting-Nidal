import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

/** Return all app_config rows as a key→value object. */
router.get("/config", requireAuth, async (_req, res): Promise<void> => {
  const result = await db.execute(sql`SELECT key, value FROM app_config ORDER BY key`);
  const config: Record<string, string> = {};
  for (const row of result.rows) {
    config[row.key as string] = row.value as string;
  }
  res.json(config);
});

/** Upsert a single config value — super_admin only. */
router.patch("/config/:key", requireRole("super_admin"), async (req, res): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined || value === null) {
    res.status(400).json({ error: "value is required" });
    return;
  }
  const strValue = String(value);
  await db.execute(sql`
    INSERT INTO app_config (key, value, updated_at)
    VALUES (${key}, ${strValue}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);
  res.json({ key, value: strValue });
});

export default router;
