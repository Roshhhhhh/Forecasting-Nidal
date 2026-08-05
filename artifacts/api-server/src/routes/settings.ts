import { Router, type IRouter } from "express";
import { db, companySettingsTable, fileImportsTable, marketAreasTable, unitBenchmarksTable } from "@workspace/db";
import { UpdateCompanySettingsBody, CommitImportBody } from "@workspace/api-zod";
import { requireAuth, requireRole } from "../middlewares/auth";
import crypto from "crypto";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/settings", requireAuth, async (_req, res): Promise<void> => {
  let settings = await db.query.companySettingsTable.findFirst();
  if (!settings) {
    const [created] = await db.insert(companySettingsTable).values({}).returning();
    settings = created;
  }
  res.json(settings);
});

router.patch("/settings", requireAuth, requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const parsed = UpdateCompanySettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let settings = await db.query.companySettingsTable.findFirst();
  if (!settings) {
    const [created] = await db.insert(companySettingsTable).values(parsed.data as any).returning();
    res.json(created); return;
  }
  const [updated] = await db.update(companySettingsTable).set(parsed.data as any).returning();
  res.json(updated);
});

// Imports
router.get("/imports", requireAuth, async (_req, res): Promise<void> => {
  const imports = await db.select().from(fileImportsTable).orderBy(desc(fileImportsTable.createdAt)).limit(50);
  res.json(imports.map(i => ({
    id: i.id, filename: i.filename, status: i.status, recordCount: i.recordCount,
    errorCount: i.errorCount, importedById: i.importedById,
    importedByName: null, notes: i.notes, createdAt: i.createdAt,
  })));
});

router.post("/imports/preview", requireAuth, async (req, res): Promise<void> => {
  const { filename, rows, columnMapping } = req.body;
  if (!filename || !Array.isArray(rows)) {
    res.status(400).json({ error: "filename and rows required" });
    return;
  }

  const validRows: any[] = [];
  const errors: any[] = [];
  let duplicates = 0;
  let warnings = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowErrors: string[] = [];

    if (!row.area && !row.Area) {
      rowErrors.push("Area is required");
    }

    // Check for NA values — must not be converted to zero
    const adrFields = ["studio_adr", "1br_adr", "2br_adr", "3br_adr", "4br_adr",
                       "Studio ADR", "1 Bedroom ADR", "2 Bedroom ADR", "3 Bedroom ADR", "4 Bedroom ADR"];
    for (const field of adrFields) {
      if (row[field] === "NA" || row[field] === "N/A") {
        warnings++;
        // Keep as null, not zero
      } else if (row[field] !== undefined && row[field] !== null && row[field] !== "") {
        const val = parseFloat(row[field]);
        if (isNaN(val)) {
          rowErrors.push(`${field}: "${row[field]}" is not a valid number`);
        } else if (val < 0) {
          rowErrors.push(`${field}: ADR cannot be negative`);
        }
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ rowIndex: i + 1, message: rowErrors.join("; "), field: null, value: null });
    } else {
      validRows.push({
        area: row.area || row.Area || "",
        project: row.project || row["Project"] || row["Building Name"] || null,
        developer: row.developer || row["Developer"] || null,
        propertyType: row.propertyType || row["Property Type"] || "apartment",
        bedrooms: row.bedrooms || row["Bedrooms"] || null,
        annualLtr: row.annualLtr || row["Annual LTR"] || null,
        typicalAdr: row.typicalAdr || row["Typical ADR"] || null,
        rawData: JSON.stringify(row),
      });
    }
  }

  const sessionToken = crypto.randomBytes(16).toString("hex");

  // Store import session temporarily
  await db.insert(fileImportsTable).values({
    filename,
    status: "pending",
    recordCount: validRows.length,
    errorCount: errors.length,
    warningCount: warnings,
    importedById: (req.session as any).userId,
    sessionToken,
    rawData: JSON.stringify(rows),
  });

  res.json({
    validRows: validRows.length,
    invalidRows: errors.length,
    duplicates,
    warnings,
    preview: validRows.slice(0, 20),
    errors,
    sessionToken,
  });
});

router.post("/imports/commit", requireAuth, requireRole("super_admin", "admin", "revenue_manager"), async (req, res): Promise<void> => {
  const parsed = CommitImportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [importRecord] = await db.select().from(fileImportsTable)
    .where(eq(fileImportsTable.sessionToken, parsed.data.sessionToken));
  if (!importRecord) { res.status(404).json({ error: "Import session not found" }); return; }

  const rows = JSON.parse(importRecord.rawData ?? "[]");
  let imported = 0;

  for (const row of rows) {
    const area = row.area || row.Area;
    if (!area) continue;

    // Upsert market area
    let [marketArea] = await db.select().from(marketAreasTable)
      .where(eq(marketAreasTable.area, area));
    if (!marketArea) {
      const [created] = await db.insert(marketAreasTable).values({
        emirate: "Abu Dhabi",
        area,
        development: row["Development"] || row.development || null,
        projectBuilding: row["Project"] || row["Building Name"] || row.project || null,
        developer: row["Developer"] || row.developer || null,
      }).returning();
      marketArea = created;
    }

    // Import bedroom-specific benchmarks
    const bedroomConfigs = [
      { key: 0, adrField: "Studio ADR", ltrField: "Studio LTR" },
      { key: 1, adrField: "1 Bedroom ADR", ltrField: "1 Bedroom LTR" },
      { key: 2, adrField: "2 Bedroom ADR", ltrField: "2 Bedroom LTR" },
      { key: 3, adrField: "3 Bedroom ADR", ltrField: "3 Bedroom LTR" },
      { key: 4, adrField: "4 Bedroom ADR", ltrField: "4 Bedroom LTR" },
    ];

    for (const bc of bedroomConfigs) {
      const rawAdr = row[bc.adrField];
      const rawLtr = row[bc.ltrField];
      if (rawAdr === undefined && rawLtr === undefined) continue;
      if (rawAdr === "NA" || rawAdr === "N/A") continue;

      const adr = rawAdr ? parseFloat(rawAdr) : null;
      const ltr = rawLtr && rawLtr !== "NA" && rawLtr !== "N/A" ? parseFloat(rawLtr) : null;
      if (adr === null && ltr === null) continue;

      await db.insert(unitBenchmarksTable).values({
        marketAreaId: marketArea.id,
        propertyType: bc.key === 0 ? "studio" : "apartment",
        bedrooms: bc.key,
        typicalAdr: adr,
        lowSeasonAdr: adr ? Math.round(adr * 0.70) : null,
        shoulderSeasonAdr: adr ? Math.round(adr * 0.90) : null,
        peakSeasonAdr: adr ? Math.round(adr * 1.15) : null,
        eventAdr: adr ? Math.round(adr * 1.45) : null,
        annualLtr: ltr,
        importId: importRecord.id,
        createdById: (req.session as any).userId,
      });
      imported++;
    }
  }

  const [updated] = await db.update(fileImportsTable).set({
    status: "committed",
    recordCount: imported,
    notes: parsed.data.notes,
  }).where(eq(fileImportsTable.id, importRecord.id)).returning();

  res.json({
    id: updated.id, filename: updated.filename, status: updated.status,
    recordCount: updated.recordCount, errorCount: updated.errorCount,
    importedById: updated.importedById, notes: updated.notes, createdAt: updated.createdAt,
  });
});

router.post("/imports/:id/rollback", requireAuth, requireRole("super_admin", "admin"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [importRecord] = await db.select().from(fileImportsTable).where(eq(fileImportsTable.id, id));
  if (!importRecord) { res.status(404).json({ error: "Import not found" }); return; }

  // Delete benchmarks from this import
  await db.delete(unitBenchmarksTable).where(eq(unitBenchmarksTable.importId, id));
  await db.update(fileImportsTable).set({ status: "rolled_back", rolledBackAt: new Date() }).where(eq(fileImportsTable.id, id));

  res.json({ message: "Import rolled back successfully" });
});

export default router;
