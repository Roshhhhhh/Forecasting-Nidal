/**
 * Import Abu Dhabi market benchmark data via the HTTP API.
 * The API server must be running on port 8080 with an admin session.
 * Run: node artifacts/api-server/scripts/import-auh-benchmarks.mjs <SESSION_COOKIE>
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX = require(resolve(__dirname, "../../../node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/xlsx.js"));

const FILE = resolve(__dirname, "../../../attached_assets/Forecast_-_AUH_Areas__1786119433903.xlsx");
const BASE = "http://localhost:8080";
const COOKIE = process.argv[2] ?? "";

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: COOKIE },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${t}`);
  }
  return res.json();
}

console.log("Reading:", FILE);
const wb = XLSX.readFile(FILE);

// "Sheet1 (2)" has combined ADR + LTR per bedroom
const sheetName = wb.SheetNames.find(n => n.includes("(2)")) ?? wb.SheetNames[1];
console.log("Sheet:", sheetName);
const ws = wb.Sheets[sheetName];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Col layout: Area(0), Type(1), Status(2), Dev(3), Project(4),
//             STD ADR(5), STD LTR(6), 1BR ADR(7), 1BR LTR(8),
//             2BR ADR(9), 2BR LTR(10), 3BR ADR(11), 3BR LTR(12),
//             4BR ADR(13), 4BR LTR(14)
const BEDROOM_COLS = [
  { bed: 0,  adrCol: 5,  ltrCol: 6  },
  { bed: 1,  adrCol: 7,  ltrCol: 8  },
  { bed: 2,  adrCol: 9,  ltrCol: 10 },
  { bed: 3,  adrCol: 11, ltrCol: 12 },
  { bed: 4,  adrCol: 13, ltrCol: 14 },
];

const dataRows = raw.filter(row =>
  row[0] && typeof row[0] === "string" && row[0].trim() !== "" &&
  !["area", "price", "main"].some(k => row[0].toLowerCase().startsWith(k))
);
console.log(`Data rows: ${dataRows.length}`);

// Load existing areas
const existingAreas = await api("GET", "/api/market/areas");
const areaMap = {}; // "area|||project" → id
for (const a of existingAreas) {
  areaMap[`${a.area?.toLowerCase()}|||${a.projectBuilding?.toLowerCase()}`] = a.id;
}

// Load existing benchmarks
const existingBenchmarks = await api("GET", "/api/market/benchmarks");
const benchSet = new Set(existingBenchmarks.map(b => `${b.marketAreaId}:${b.bedrooms}`));

let inserted = 0, skipped = 0, areaCreated = 0;

for (const row of dataRows) {
  const area = String(row[0] ?? "").trim();
  const propertyType = String(row[1] ?? "Apartment").trim();
  const project = String(row[4] ?? "").trim();
  if (!area || !project) { skipped++; continue; }

  const areaKey = `${area.toLowerCase()}|||${project.toLowerCase()}`;
  let areaId = areaMap[areaKey];
  if (!areaId) {
    try {
      const created = await api("POST", "/api/market/areas", { area, projectBuilding: project, emirate: "Abu Dhabi" });
      areaId = created.id;
      areaMap[areaKey] = areaId;
      areaCreated++;
    } catch (e) {
      console.error("  Area create failed:", e.message);
      skipped++;
      continue;
    }
  }

  for (const { bed, adrCol, ltrCol } of BEDROOM_COLS) {
    const rawAdr = row[adrCol];
    const rawLtr = row[ltrCol];
    const adr = rawAdr !== "NA" && rawAdr != null && rawAdr !== "" ? Number(rawAdr) : null;
    const ltr = rawLtr !== "NA" && rawLtr != null && rawLtr !== "" ? Number(rawLtr) : null;
    if (!adr && !ltr) continue;

    const bKey = `${areaId}:${bed}`;
    if (benchSet.has(bKey)) { skipped++; continue; }

    try {
      await api("POST", "/api/market/benchmarks", {
        marketAreaId: areaId,
        propertyType,
        bedrooms: bed,
        typicalAdr: adr,
        shoulderSeasonAdr: adr,
        annualLtr: ltr,
        expectedOccupancy: 75,
        isActive: true,
        confidenceLevel: "medium",
        notes: "AUH Areas market data import",
      });
      benchSet.add(bKey);
      inserted++;
    } catch (e) {
      console.error(`  Benchmark insert failed (${area}/${project} ${bed}BR):`, e.message);
    }
  }
}

console.log(`\nDone. Areas created: ${areaCreated}, Benchmarks inserted: ${inserted}, Skipped: ${skipped}`);
