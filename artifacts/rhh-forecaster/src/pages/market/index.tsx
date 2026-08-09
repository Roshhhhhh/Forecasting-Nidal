import { useListMarketAreas, useListBenchmarks, useGetCompanySettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Search, Upload, Download, MapPin, TrendingUp, Home, Star,
  ChevronDown, ChevronRight, Building2,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";

// ── helpers ────────────────────────────────────────────────────────────────────
const aed = (n: number | null | undefined) =>
  n != null ? `AED ${Math.round(n).toLocaleString()}` : "—";
const pct = (n: number | null | undefined) =>
  n != null ? `${Math.round(n)}%` : "—";

function ConfidenceBadge({ level }: { level: string | null | undefined }) {
  if (!level) return <span className="text-muted-foreground text-xs">—</span>;
  const cls =
    level === "high"
      ? "text-green-700 border-green-200 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
      : level === "medium"
      ? "text-amber-700 border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400"
      : "text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={`capitalize text-[10px] ${cls}`}>
      {level}
    </Badge>
  );
}

// ── main ───────────────────────────────────────────────────────────────────────
export default function MarketList() {
  const { data: areas, isLoading: areasLoading } = useListMarketAreas();
  const { data: benchmarks, isLoading: benchLoading } = useListBenchmarks();
  const { data: settings } = useGetCompanySettings();

  const [search, setSearch] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [bedroomFilter, setBedroomFilter] = useState<number | null>(null);

  // Filter sidebar areas by search
  const filteredAreas = useMemo(
    () =>
      (areas ?? []).filter((a) =>
        `${a.area} ${a.emirate}`.toLowerCase().includes(search.toLowerCase())
      ),
    [areas, search]
  );

  // Benchmarks for selected area
  const areaBenchmarks = useMemo(() => {
    if (!benchmarks) return [];
    const base = selectedAreaId
      ? benchmarks.filter((b) => b.marketAreaId === selectedAreaId)
      : benchmarks;
    return bedroomFilter != null
      ? base.filter((b) => b.bedrooms === bedroomFilter)
      : base;
  }, [benchmarks, selectedAreaId, bedroomFilter]);

  // Group by project building for display
  const grouped = useMemo(() => {
    const map = new Map<string, typeof areaBenchmarks>();
    for (const b of areaBenchmarks) {
      const key = (b as any).projectBuilding || "— Area Average —";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    // Sort: named projects first, then "Area Average", each sorted by bedrooms
    const sorted = [...map.entries()].sort(([a], [b]) => {
      if (a === "— Area Average —") return 1;
      if (b === "— Area Average —") return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [areaBenchmarks]);

  // Summary stats for the selected area
  const summary = useMemo(() => {
    if (!areaBenchmarks.length) return null;
    const adrs = areaBenchmarks.map((b) => b.typicalAdr).filter(Boolean) as number[];
    const ltrs = areaBenchmarks.map((b) => b.annualLtr).filter(Boolean) as number[];
    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    return {
      avgAdr: avg(adrs),
      minAdr: adrs.length ? Math.min(...adrs) : null,
      maxAdr: adrs.length ? Math.max(...adrs) : null,
      avgLtr: avg(ltrs),
      minLtr: ltrs.length ? Math.min(...ltrs) : null,
      maxLtr: ltrs.length ? Math.max(...ltrs) : null,
      projects: new Set(areaBenchmarks.map((b) => (b as any).projectBuilding).filter(Boolean)).size,
      rows: areaBenchmarks.length,
    };
  }, [areaBenchmarks]);

  const selectedArea = areas?.find((a) => a.id === selectedAreaId);
  const bedOptions = useMemo(() => {
    const beds = new Set(areaBenchmarks.map((b) => b.bedrooms));
    return [...beds].sort((a, b) => a - b);
  }, [areaBenchmarks]);

  const toggleProject = (key: string) =>
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-5 h-[calc(100vh-theme(spacing.16))] flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Market Data</h1>
          <p className="text-muted-foreground mt-0.5">
            Abu Dhabi STR &amp; LTR benchmarks by area and project — sourced from RHH internal data.
          </p>
          {(settings as any)?.lastBenchmarkImportAt && (
            <p className="text-xs text-muted-foreground mt-1">
              Last import:{" "}
              <span className="font-medium text-foreground">
                {new Date((settings as any).lastBenchmarkImportAt).toLocaleString()}
              </span>
              {(settings as any).lastBenchmarkImportSummary && (
                <span className="ml-1">· {(settings as any).lastBenchmarkImportSummary}</span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Link
            href="/market/import"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm gap-2"
          >
            <Upload className="h-4 w-4" />
            Import Data
          </Link>
        </div>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">
        {/* ── Left: Area sidebar ── */}
        <Card className="w-64 flex flex-col border-border/50 shadow-sm shrink-0">
          <CardHeader className="p-3 border-b border-border bg-muted/10 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search areas..."
                className="pl-8 bg-background h-8 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            <button
              onClick={() => setSelectedAreaId(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                selectedAreaId === null
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-muted/60 text-foreground"
              }`}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>All Areas</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {benchmarks?.length ?? 0}
              </span>
            </button>

            {areasLoading ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
            ) : (
              filteredAreas.map((area) => {
                const count = benchmarks?.filter((b) => b.marketAreaId === area.id).length ?? 0;
                const active = selectedAreaId === area.id;
                return (
                  <button
                    key={area.id}
                    onClick={() => { setSelectedAreaId(area.id); setBedroomFilter(null); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                      active
                        ? "bg-primary/10 text-primary font-semibold"
                        : "hover:bg-muted/60 text-foreground"
                    }`}
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{area.area}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{area.emirate}</div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{count}</span>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* ── Right: Benchmark panel ── */}
        <div className="flex-1 flex flex-col gap-4 min-h-0 min-w-0">
          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    ADR Range
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {aed(summary.minAdr)} – {aed(summary.maxAdr)}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg {aed(summary.avgAdr)}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    Annual LTR Range
                  </p>
                  <p className="text-lg font-bold text-foreground">
                    {aed(summary.minLtr)} – {aed(summary.maxLtr)}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg {aed(summary.avgLtr)}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    Projects Tracked
                  </p>
                  <p className="text-2xl font-bold text-primary">{summary.projects}</p>
                  <p className="text-xs text-muted-foreground">in this area</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
                    Data Points
                  </p>
                  <p className="text-2xl font-bold text-primary">{summary.rows}</p>
                  <p className="text-xs text-muted-foreground">benchmarks</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-2 shrink-0">
            <p className="text-sm font-medium text-foreground">
              {selectedArea ? selectedArea.area : "All Areas"}
            </p>
            <span className="text-muted-foreground text-sm">·</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setBedroomFilter(null)}
                className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                  bedroomFilter === null
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                All
              </button>
              {bedOptions.map((b) => (
                <button
                  key={b}
                  onClick={() => setBedroomFilter(b === bedroomFilter ? null : b)}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${
                    bedroomFilter === b
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {b === 0 ? "Studio" : `${b} BR`}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <Card className="flex-1 border-border/50 shadow-sm flex flex-col min-h-0">
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-muted-foreground uppercase bg-muted/50 border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Project / Building</th>
                    <th className="px-3 py-2.5 font-semibold">Type</th>
                    <th className="px-3 py-2.5 font-semibold">Beds</th>
                    <th className="px-3 py-2.5 font-semibold">Avg ADR</th>
                    <th className="px-3 py-2.5 font-semibold">Peak ADR</th>
                    <th className="px-3 py-2.5 font-semibold">Low ADR</th>
                    <th className="px-3 py-2.5 font-semibold">Annual LTR</th>
                    <th className="px-3 py-2.5 font-semibold">Occupancy</th>
                    <th className="px-3 py-2.5 font-semibold">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {benchLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">
                        Loading benchmarks…
                      </td>
                    </tr>
                  ) : grouped.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-16 text-muted-foreground text-sm">
                        No benchmark data for this selection.
                      </td>
                    </tr>
                  ) : (
                    grouped.map(([projectKey, rows]) => {
                      const isExpanded = expandedProjects.has(projectKey);
                      const isNamedProject = projectKey !== "— Area Average —";
                      // By default expand named projects, collapse "Area Average"
                      const show = isNamedProject ? !isExpanded : isExpanded;

                      return rows.map((b, i) => {
                        const isFirstRow = i === 0;
                        return (
                          <tr
                            key={b.id}
                            className="hover:bg-muted/20 transition-colors"
                          >
                            {/* Project cell — only on first row of this group */}
                            {isFirstRow ? (
                              <td
                                rowSpan={rows.length}
                                className="px-4 py-2.5 align-top border-r border-border/30 w-48"
                              >
                                <button
                                  onClick={() => toggleProject(projectKey)}
                                  className="flex items-start gap-1.5 text-left group"
                                >
                                  {isNamedProject ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                  )}
                                  <span className={`text-xs font-semibold leading-snug ${isNamedProject ? "text-foreground" : "text-muted-foreground italic"}`}>
                                    {projectKey}
                                  </span>
                                </button>
                                <span className="text-[10px] text-muted-foreground ml-5 mt-0.5 block">
                                  {rows.length} {rows.length === 1 ? "unit type" : "unit types"}
                                </span>
                              </td>
                            ) : null}

                            <td className="px-3 py-2.5 text-muted-foreground capitalize text-xs">{b.propertyType}</td>
                            <td className="px-3 py-2.5 font-medium">
                              {b.bedrooms === 0 ? "Studio" : `${b.bedrooms} BR`}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-foreground">
                              {aed(b.typicalAdr)}
                            </td>
                            <td className="px-3 py-2.5 text-orange-600 dark:text-orange-400 font-medium">
                              {aed(b.peakSeasonAdr)}
                            </td>
                            <td className="px-3 py-2.5 text-blue-600 dark:text-blue-400 font-medium">
                              {aed(b.lowSeasonAdr)}
                            </td>
                            <td className="px-3 py-2.5">
                              {b.annualLtr ? (
                                <span className="font-semibold text-foreground">
                                  {aed(b.annualLtr)}
                                  {(b.minLtr || b.maxLtr) && (
                                    <span className="text-[10px] text-muted-foreground block font-normal">
                                      {b.minLtr ? aed(b.minLtr) : ""} – {b.maxLtr ? aed(b.maxLtr) : ""}
                                    </span>
                                  )}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2.5">{pct(b.expectedOccupancy)}</td>
                            <td className="px-3 py-2.5">
                              <ConfidenceBadge level={b.confidenceLevel} />
                            </td>
                          </tr>
                        );
                      });
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
