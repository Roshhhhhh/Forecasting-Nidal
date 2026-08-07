/**
 * portalScraper.ts
 *
 * Fetches live listing price ranges from Property Finder and Bayut via
 * OpenAI web_search_preview. Designed with strict controls:
 *
 * - GET path (market-suggestions, ai-recommend): cache-only via getPortalCache()
 *   — never triggers an external call
 * - POST path (portal-listings/refresh): role-restricted, 60 s cooldown,
 *   single-flight coalescing
 * - All parsed portal JSON is validated before caching:
 *   · finite positive monetary values; min ≤ max; avg within [min, max]
 *   · count must be a finite non-negative integer
 *   · only known portal source labels accepted (unknown labels stripped)
 * - Domain provenance: URL citations returned by the search tool are checked;
 *   only portals whose domains appear in citations are included in sources;
 *   result is discarded if no expected portal domain is cited
 */

import OpenAI from "openai";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortalStats {
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface PortalListingsResult {
  ltr: PortalStats | null;  // annual LTR range (AED/year)
  adr: PortalStats | null;  // nightly STR/holiday range (AED/night)
  listingCount: number;
  sources: string[];         // portals whose domains were cited in search results
  fetchedAt: string;         // ISO timestamp
  area: string;
  bedrooms: number;
  note?: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const COOLDOWN_MS  = 60 * 1000;           // 60 s minimum between explicit refreshes

/** Maps allowed portal label → its expected hostname(s) for provenance checking. */
const PORTAL_DOMAINS: Record<string, string[]> = {
  "Property Finder": ["propertyfinder.ae", "www.propertyfinder.ae"],
  "Bayut":           ["bayut.com",         "www.bayut.com"],
};
const ALLOWED_SOURCES = new Set(Object.keys(PORTAL_DOMAINS));

// ── In-memory store ───────────────────────────────────────────────────────────

interface CacheEntry {
  result: PortalListingsResult;
  expiresAt: number;
  refreshedAt: number;
}

const cache    = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<PortalListingsResult | null>>();

function makeKey(area: string, bedrooms: number) {
  return `${area.toLowerCase().trim()}:${bedrooms}`;
}

function readCache(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { cache.delete(key); return null; }
  return entry;
}

function writeCache(key: string, result: PortalListingsResult) {
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS, refreshedAt: Date.now() });
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate and sanitise a raw PortalStats-shaped value.
 * All monetary values must be finite and positive; min ≤ max; avg within range;
 * count must be a finite non-negative integer.
 */
function validateStats(raw: unknown): PortalStats | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const min      = Number(r.min);
  const max      = Number(r.max);
  const avg      = Number(r.avg ?? (min + max) / 2);
  const rawCount = Number(r.count ?? 0);

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(avg)) return null;
  if (min <= 0 || max <= 0 || avg <= 0)  return null;
  if (min > max)                          return null;
  if (avg < min || avg > max)             return null;
  if (!Number.isFinite(rawCount) || rawCount < 0) return null;
  if (!Number.isInteger(rawCount)) return null; // reject fractional counts (e.g. 1.4)

  return { min: Math.round(min), max: Math.round(max), avg: Math.round(avg), count: rawCount };
}

/**
 * Validate and sanitise a raw parsed portal response, given the set of portal
 * names whose domains were actually cited in the web search results.
 *
 * Returns null if:
 * - Both ltr and adr fail numeric validation
 * - No expected portal domain was cited (provenance unverified)
 */
function validateParsed(
  raw: unknown,
  citedPortals: Set<string>,
): { ltr: PortalStats | null; adr: PortalStats | null; sources: string[]; note: string | undefined } | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const ltr = validateStats(r.ltr);
  const adr = validateStats(r.adr);

  if (!ltr && !adr) return null;

  // Only include source labels that were actually cited in search results
  const sources = Array.from(ALLOWED_SOURCES).filter(s => citedPortals.has(s));

  // Discard result if we cannot verify any data came from the expected portals
  if (sources.length === 0) {
    console.warn("[portalScraper] No portal domain citations found — discarding result");
    return null;
  }

  const note = typeof r.note === "string"
    ? r.note.slice(0, 500).replace(/[^\x20-\x7E]/g, "")
    : undefined;

  return { ltr, adr, sources, note };
}

// ── Domain provenance helper ──────────────────────────────────────────────────

/**
 * Extract the set of portal names whose hostnames appear in the URL
 * citations returned by the web_search_preview tool.
 */
function extractCitedPortals(responseOutput: unknown[]): Set<string> {
  const cited = new Set<string>();

  for (const item of responseOutput) {
    if (!item || typeof item !== "object") continue;
    const i = item as Record<string, unknown>;

    // message output items carry annotations with url_citation entries
    if (i.type === "message" && Array.isArray(i.content)) {
      for (const c of i.content as unknown[]) {
        if (!c || typeof c !== "object") continue;
        const ci = c as Record<string, unknown>;
        if (ci.type === "output_text" && Array.isArray(ci.annotations)) {
          for (const ann of ci.annotations as unknown[]) {
            if (!ann || typeof ann !== "object") continue;
            const a = ann as Record<string, unknown>;
            if (a.type === "url_citation" && typeof a.url === "string") {
              try {
                const hostname = new URL(a.url).hostname.replace(/^www\./, "");
                for (const [label, domains] of Object.entries(PORTAL_DOMAINS)) {
                  if (domains.some(d => d.replace(/^www\./, "") === hostname)) {
                    cited.add(label);
                  }
                }
              } catch {
                // malformed URL — skip
              }
            }
          }
        }
      }
    }
  }

  return cited;
}

// ── Core fetch ────────────────────────────────────────────────────────────────

async function _doFetch(area: string, bedrooms: number): Promise<PortalListingsResult | null> {
  // Use the Replit AI Integrations key first, then fall back to a direct key
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? undefined;
  if (!apiKey) {
    console.warn("[portalScraper] No OpenAI API key configured — skipping portal fetch");
    return null;
  }

  const bedroomPhrase = bedrooms === 0 ? "studio apartments" : `${bedrooms} bedroom apartments`;
  const openai = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

  // Restrict search to the two portal domains at the API level (best-effort —
  // web_search_preview may not honour allowed_domains in all SDK versions; the
  // provenance check on citations is the authoritative gate).
  const searchTool: Record<string, unknown> = {
    type: "web_search_preview",
    user_location: { type: "approximate", country: "AE", city: "Abu Dhabi" },
    allowed_domains: [
      "propertyfinder.ae",
      "www.propertyfinder.ae",
      "bayut.com",
      "www.bayut.com",
    ],
  };

  const prompt = `You must ONLY use data from propertyfinder.ae and bayut.com — do not use any other source.

Search propertyfinder.ae AND bayut.com for current rental listings for ${bedroomPhrase} in ${area}, Abu Dhabi, UAE.

Find:
1. Long-term rental (annual): minimum price, maximum price, typical/average price, and how many listings found on each portal
2. Short-term / holiday rental nightly rates if available: minimum, maximum, average, and count

Return ONLY a JSON object (no explanation, no markdown, just raw JSON):
{
  "ltr": { "min": <AED>, "max": <AED>, "avg": <AED>, "count": <integer> },
  "adr": { "min": <AED/night>, "max": <AED/night>, "avg": <AED/night>, "count": <integer> },
  "sources": ["Property Finder", "Bayut"],
  "note": "<optional caveat>"
}

If a section has no data on either portal, omit it entirely. Only include portals you actually retrieved data from.`;

  try {
    const response = await (openai as any).responses.create({
      model: "gpt-4o",
      tools: [searchTool],
      input: prompt,
    });

    const output: unknown[] = Array.isArray(response.output) ? response.output : [];

    // ── Domain provenance: extract which portals were actually cited ───────────
    const citedPortals = extractCitedPortals(output);

    // ── Extract text output ───────────────────────────────────────────────────
    let rawText = "";
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const i = item as Record<string, unknown>;
      if (i.type === "message" && Array.isArray(i.content)) {
        for (const c of i.content as unknown[]) {
          if (!c || typeof c !== "object") continue;
          const ci = c as Record<string, unknown>;
          if (ci.type === "output_text" && typeof ci.text === "string") {
            rawText += ci.text;
          }
        }
      }
    }

    if (!rawText) {
      console.warn("[portalScraper] No text output from OpenAI web search");
      return null;
    }

    // ── Parse and validate JSON ───────────────────────────────────────────────
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[portalScraper] No JSON found in response:", rawText.slice(0, 300));
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.warn("[portalScraper] JSON.parse failed on model output");
      return null;
    }

    const validated = validateParsed(parsed, citedPortals);
    if (!validated) {
      console.warn("[portalScraper] Response failed validation/provenance check — discarding");
      return null;
    }

    return {
      ltr:          validated.ltr,
      adr:          validated.adr,
      listingCount: (validated.ltr?.count ?? 0) + (validated.adr?.count ?? 0),
      sources:      validated.sources,
      fetchedAt:    new Date().toISOString(),
      area,
      bedrooms,
      note:         validated.note,
    };
  } catch (err) {
    console.error("[portalScraper] OpenAI request failed:", err);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Read the portal cache for this area+bedrooms. Returns null if not cached.
 * Never triggers an external OpenAI call — safe for GET read paths.
 */
export function getPortalCache(area: string, bedrooms: number): PortalListingsResult | null {
  if (!area || bedrooms == null) return null;
  return readCache(makeKey(area, bedrooms))?.result ?? null;
}

/**
 * Fetch portal listings, using the TTL cache to avoid repeated calls.
 * On a cache miss, triggers OpenAI web search.
 * Uses single-flight coalescing: concurrent calls share one in-flight request.
 * Should only be invoked from the privileged refresh path.
 */
export async function fetchPortalListings(
  area: string,
  bedrooms: number,
  forceRefresh = false,
): Promise<PortalListingsResult | null> {
  if (!area || bedrooms == null) return null;

  const key = makeKey(area, bedrooms);

  if (!forceRefresh) {
    const cached = readCache(key);
    if (cached) return cached.result;
  }

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = _doFetch(area, bedrooms).then(result => {
    inFlight.delete(key);
    if (result) writeCache(key, result);
    return result;
  }).catch(err => {
    inFlight.delete(key);
    console.error("[portalScraper] unexpected error:", err);
    return null;
  });

  inFlight.set(key, promise);
  return promise;
}

/**
 * Refresh with cooldown enforcement — used by the privileged POST .../refresh endpoint.
 * Returns result + whether the cooldown blocked a new fetch.
 */
export async function fetchPortalListingsWithCooldown(
  area: string,
  bedrooms: number,
): Promise<{ result: PortalListingsResult | null; cooldownActive: boolean }> {
  if (!area || bedrooms == null) return { result: null, cooldownActive: false };

  const key   = makeKey(area, bedrooms);
  const entry = readCache(key);

  if (entry && (Date.now() - entry.refreshedAt) < COOLDOWN_MS) {
    return { result: entry.result, cooldownActive: true };
  }

  const existing = inFlight.get(key);
  if (existing) {
    const result = await existing;
    return { result, cooldownActive: false };
  }

  cache.delete(key);
  const result = await fetchPortalListings(area, bedrooms, true);
  return { result, cooldownActive: false };
}

/** Invalidate the cache for a specific area+bedrooms. */
export function invalidatePortalCache(area: string, bedrooms: number) {
  cache.delete(makeKey(area, bedrooms));
}

/** Clear the entire portal cache and any in-flight requests. */
export function clearPortalCache() {
  cache.clear();
  inFlight.clear();
}

// ── Test-only exports ─────────────────────────────────────────────────────────
export const _testOnly = {
  cache,
  inFlight,
  COOLDOWN_MS,
  CACHE_TTL_MS,
  PORTAL_DOMAINS,
  validateStats,
  validateParsed,
  extractCitedPortals,
};
