/**
 * portalScraper.test.ts
 *
 * Tests for:
 * - Cache read/write (getPortalCache never triggers a fetch)
 * - Cooldown enforcement on explicit refresh
 * - Single-flight request coalescing
 * - validateStats: numeric guards including finite count
 * - validateParsed: provenance requirement, source filtering, note length
 * - extractCitedPortals: URL citation domain matching
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  fetchPortalListings,
  fetchPortalListingsWithCooldown,
  getPortalCache,
  clearPortalCache,
  invalidatePortalCache,
  _testOnly,
  type PortalListingsResult,
} from "./portalScraper";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AREA     = "Al Reem Island";
const BEDROOMS = 2;
const KEY      = `${AREA.toLowerCase().trim()}:${BEDROOMS}`;

const mockResult: PortalListingsResult = {
  ltr: { min: 90000, max: 130000, avg: 110000, count: 8 },
  adr: { min: 450,   max: 750,    avg: 600,    count: 5 },
  listingCount: 13,
  sources: ["Property Finder", "Bayut"],
  fetchedAt: new Date().toISOString(),
  area: AREA,
  bedrooms: BEDROOMS,
};

function seedCache(result: PortalListingsResult, refreshedAgo = 120_000) {
  _testOnly.cache.set(KEY, {
    result,
    expiresAt: Date.now() + _testOnly.CACHE_TTL_MS,
    refreshedAt: Date.now() - refreshedAgo,
  });
}

// ── getPortalCache — read-only, never triggers external calls ─────────────────

describe("getPortalCache", () => {
  beforeEach(() => clearPortalCache());

  it("returns null when nothing is cached", () => {
    expect(getPortalCache(AREA, BEDROOMS)).toBeNull();
  });

  it("returns null for empty area", () => {
    expect(getPortalCache("", BEDROOMS)).toBeNull();
  });

  it("returns the cached result when present", () => {
    seedCache(mockResult);
    expect(getPortalCache(AREA, BEDROOMS)).toEqual(mockResult);
  });

  it("never triggers an OpenAI fetch (safe on GET paths)", () => {
    // Without API key and without cache: must return null without throwing
    const orig = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    expect(getPortalCache(AREA, BEDROOMS)).toBeNull();
    process.env.OPENAI_API_KEY = orig;
  });
});

// ── fetchPortalListings — cache and fetch guard ───────────────────────────────

describe("fetchPortalListings", () => {
  beforeEach(() => clearPortalCache());

  it("returns null when OPENAI_API_KEY absent and cache empty", async () => {
    const origKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const origKey2 = process.env.OPENAI_API_KEY;
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const result = await fetchPortalListings(AREA, BEDROOMS, false);
    expect(result).toBeNull();
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = origKey;
    process.env.OPENAI_API_KEY = origKey2;
  });

  it("returns cached result without calling OpenAI (forceRefresh=false)", async () => {
    seedCache(mockResult);
    const result = await fetchPortalListings(AREA, BEDROOMS, false);
    expect(result).toEqual(mockResult);
  });

  it("returns null for empty area", async () => {
    expect(await fetchPortalListings("", BEDROOMS, false)).toBeNull();
  });

  it("invalidatePortalCache removes entry", () => {
    seedCache(mockResult);
    invalidatePortalCache(AREA, BEDROOMS);
    expect(getPortalCache(AREA, BEDROOMS)).toBeNull();
  });

  it("cleans up inFlight entry after fetch resolves", async () => {
    const origKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const origKey2 = process.env.OPENAI_API_KEY;
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const p = fetchPortalListings(AREA, BEDROOMS, true);
    expect(_testOnly.inFlight.has(KEY)).toBe(true);
    await p;
    expect(_testOnly.inFlight.has(KEY)).toBe(false);
    if (origKey !== undefined) process.env.AI_INTEGRATIONS_OPENAI_API_KEY = origKey;
    if (origKey2 !== undefined) process.env.OPENAI_API_KEY = origKey2;
  });
});

// ── Cooldown enforcement ──────────────────────────────────────────────────────

describe("fetchPortalListingsWithCooldown", () => {
  beforeEach(() => clearPortalCache());

  it("returns cooldownActive=true when refreshed less than 60 s ago", async () => {
    seedCache(mockResult, 5_000); // 5 s ago
    const { result, cooldownActive } = await fetchPortalListingsWithCooldown(AREA, BEDROOMS);
    expect(cooldownActive).toBe(true);
    expect(result).toEqual(mockResult);
  });

  it("returns cooldownActive=false when refreshed more than 60 s ago", async () => {
    seedCache(mockResult, 120_000); // 2 min ago
    const orig = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const { cooldownActive } = await fetchPortalListingsWithCooldown(AREA, BEDROOMS);
    expect(cooldownActive).toBe(false);
    process.env.OPENAI_API_KEY = orig;
  });

  it("returns cooldownActive=false and result=null for empty area", async () => {
    const { result, cooldownActive } = await fetchPortalListingsWithCooldown("", BEDROOMS);
    expect(cooldownActive).toBe(false);
    expect(result).toBeNull();
  });
});

// ── Single-flight coalescing ──────────────────────────────────────────────────

describe("single-flight coalescing", () => {
  beforeEach(() => clearPortalCache());

  it("concurrent requests share one in-flight promise", async () => {
    let resolve!: (v: PortalListingsResult | null) => void;
    const shared = new Promise<PortalListingsResult | null>(r => { resolve = r; });
    _testOnly.inFlight.set(KEY, shared);

    const p1 = fetchPortalListings(AREA, BEDROOMS, true);
    const p2 = fetchPortalListings(AREA, BEDROOMS, true);
    expect(_testOnly.inFlight.size).toBe(1);

    resolve(mockResult);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(mockResult);
    expect(r2).toBe(mockResult);
  });
});

// ── validateStats ─────────────────────────────────────────────────────────────

describe("validateStats", () => {
  const { validateStats } = _testOnly;

  it("accepts valid stats", () => {
    expect(validateStats({ min: 100, max: 500, avg: 300, count: 10 }))
      .toMatchObject({ min: 100, max: 500, avg: 300, count: 10 });
  });

  it("rejects Infinity min/max/avg", () => {
    expect(validateStats({ min: Infinity, max: 500, avg: 300, count: 5 })).toBeNull();
    expect(validateStats({ min: 100, max: Infinity, avg: 300, count: 5 })).toBeNull();
  });

  it("rejects NaN values", () => {
    expect(validateStats({ min: NaN, max: 500, avg: 300, count: 5 })).toBeNull();
  });

  it("rejects zero or negative values", () => {
    expect(validateStats({ min: 0,    max: 500, avg: 300, count: 5 })).toBeNull();
    expect(validateStats({ min: -100, max: 500, avg: 300, count: 5 })).toBeNull();
  });

  it("rejects min > max", () => {
    expect(validateStats({ min: 900, max: 100, avg: 500, count: 3 })).toBeNull();
  });

  it("rejects avg outside [min, max]", () => {
    expect(validateStats({ min: 100, max: 500, avg: 50,  count: 3 })).toBeNull();
    expect(validateStats({ min: 100, max: 500, avg: 600, count: 3 })).toBeNull();
  });

  it("rejects non-finite count (e.g. Infinity as string or number)", () => {
    expect(validateStats({ min: 100, max: 500, avg: 300, count: Infinity })).toBeNull();
    expect(validateStats({ min: 100, max: 500, avg: 300, count: "Infinity" })).toBeNull();
    expect(validateStats({ min: 100, max: 500, avg: 300, count: NaN })).toBeNull();
  });

  it("rejects negative count", () => {
    expect(validateStats({ min: 100, max: 500, avg: 300, count: -1 })).toBeNull();
  });

  it("rejects fractional count (e.g. 1.4 listings)", () => {
    expect(validateStats({ min: 100, max: 500, avg: 300, count: 1.4 })).toBeNull();
    expect(validateStats({ min: 100, max: 500, avg: 300, count: 0.5 })).toBeNull();
  });

  it("accepts zero count (listing count can be unknown)", () => {
    const r = validateStats({ min: 100, max: 500, avg: 300, count: 0 });
    expect(r).not.toBeNull();
    expect(r!.count).toBe(0);
  });

  it("accepts integer counts as-is without rounding", () => {
    const r = validateStats({ min: 100, max: 500, avg: 300, count: 14 });
    expect(r).not.toBeNull();
    expect(r!.count).toBe(14);
  });

  it("rejects null / missing input", () => {
    expect(validateStats(null)).toBeNull();
    expect(validateStats(undefined)).toBeNull();
    expect(validateStats("not an object")).toBeNull();
  });
});

// ── validateParsed (with citedPortals) ───────────────────────────────────────

describe("validateParsed", () => {
  const { validateParsed } = _testOnly;

  const bothPortals  = new Set(["Property Finder", "Bayut"]);
  const pfOnly       = new Set(["Property Finder"]);
  const noPortals    = new Set<string>();
  const unknownPortal = new Set(["Zillow"]);

  const validLtr = { min: 90000, max: 130000, avg: 110000, count: 8 };
  const validAdr = { min: 450,   max: 750,    avg: 600,    count: 5 };

  it("accepts a valid response with cited portals", () => {
    const result = validateParsed({ ltr: validLtr, adr: validAdr, sources: ["Property Finder", "Bayut"] }, bothPortals);
    expect(result).not.toBeNull();
    expect(result!.ltr).toMatchObject({ min: 90000, max: 130000 });
    expect(result!.sources).toEqual(expect.arrayContaining(["Property Finder", "Bayut"]));
  });

  it("returns null when no portal domain was cited (provenance unverified)", () => {
    expect(validateParsed({ ltr: validLtr }, noPortals)).toBeNull();
  });

  it("returns null when only unknown portal domains are cited", () => {
    expect(validateParsed({ ltr: validLtr }, unknownPortal)).toBeNull();
  });

  it("includes only the portal whose domain was actually cited", () => {
    const result = validateParsed({ ltr: validLtr, sources: ["Property Finder"] }, pfOnly);
    expect(result!.sources).toContain("Property Finder");
    expect(result!.sources).not.toContain("Bayut");
  });

  it("returns null when both ltr and adr are invalid", () => {
    expect(validateParsed({ ltr: { min: 0, max: -1, avg: 0, count: 0 } }, bothPortals)).toBeNull();
  });

  it("accepts partial response with only ltr", () => {
    const result = validateParsed({ ltr: validLtr }, pfOnly);
    expect(result).not.toBeNull();
    expect(result!.ltr).not.toBeNull();
    expect(result!.adr).toBeNull();
  });

  it("truncates overly-long notes", () => {
    const result = validateParsed({ ltr: validLtr, note: "x".repeat(1000) }, pfOnly);
    expect(result!.note!.length).toBeLessThanOrEqual(500);
  });

  it("returns null for non-object input", () => {
    expect(validateParsed(null, bothPortals)).toBeNull();
    expect(validateParsed("bad", bothPortals)).toBeNull();
    expect(validateParsed(42, bothPortals)).toBeNull();
  });
});

// ── extractCitedPortals ───────────────────────────────────────────────────────

describe("extractCitedPortals", () => {
  const { extractCitedPortals } = _testOnly;

  function makeOutput(urls: string[]) {
    return [{
      type: "message",
      content: [{
        type: "output_text",
        text: "some text",
        annotations: urls.map(url => ({ type: "url_citation", url })),
      }],
    }];
  }

  it("identifies Property Finder from propertyfinder.ae URL", () => {
    const cited = extractCitedPortals(makeOutput(["https://www.propertyfinder.ae/en/some-listing"]));
    expect(cited.has("Property Finder")).toBe(true);
    expect(cited.has("Bayut")).toBe(false);
  });

  it("identifies Bayut from bayut.com URL", () => {
    const cited = extractCitedPortals(makeOutput(["https://www.bayut.com/to-rent/apartments/"]));
    expect(cited.has("Bayut")).toBe(true);
    expect(cited.has("Property Finder")).toBe(false);
  });

  it("identifies both portals when both are cited", () => {
    const cited = extractCitedPortals(makeOutput([
      "https://propertyfinder.ae/listing/123",
      "https://www.bayut.com/listing/456",
    ]));
    expect(cited.has("Property Finder")).toBe(true);
    expect(cited.has("Bayut")).toBe(true);
  });

  it("ignores URLs from unrelated domains", () => {
    const cited = extractCitedPortals(makeOutput([
      "https://zillow.com/listing",
      "https://dubizzle.com/listing",
    ]));
    expect(cited.size).toBe(0);
  });

  it("returns empty set when no output is provided", () => {
    expect(extractCitedPortals([]).size).toBe(0);
  });

  it("skips malformed URLs without throwing", () => {
    const cited = extractCitedPortals(makeOutput(["not-a-url", "also invalid"]));
    expect(cited.size).toBe(0);
  });
});
