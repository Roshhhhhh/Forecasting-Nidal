import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronUp, ChevronDown, ChevronRight, MapPin, ArrowLeft,
  TrendingUp, Building2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ForecastDetail {
  id: number;
  referenceNumber: string;
  status: string;
  grossRevenue: number | null;
  netIncome: number | null;
  unitNumber: string | null;
  building: string | null;
  bedrooms: number | null;
  ownerName: string;
}

interface CommunityRow {
  key: string;
  community: string;
  emirate: string;
  forecastCount: number;
  avgGrossRevenue: number | null;
  avgNetIncome: number | null;
  avgOccupancyPct: number | null;
  avgAdr: number | null;
  proposalSentCount: number;
  acceptedCount: number;
  acceptanceRate: number | null;
  forecasts: ForecastDetail[];
}

interface AreasData {
  communities: CommunityRow[];
}

type SortKey = "community" | "forecastCount" | "avgGrossRevenue" | "avgNetIncome" | "avgOccupancyPct" | "avgAdr" | "acceptanceRate";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAed(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `AED ${Math.round(n / 1_000)}K`;
  return `AED ${Math.round(n).toLocaleString()}`;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    accepted:    "bg-emerald-100 text-emerald-700 border-emerald-200",
    published:   "bg-amber-100 text-amber-700 border-amber-200",
    approved:    "bg-blue-100 text-blue-700 border-blue-200",
    viewed:      "bg-orange-100 text-orange-700 border-orange-200",
    owner_called:"bg-violet-100 text-violet-700 border-violet-200",
    declined:    "bg-red-100 text-red-600 border-red-200",
    expired:     "bg-gray-100 text-gray-500 border-gray-200",
  };
  const cls = map[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <Badge variant="outline" className={`text-[10px] font-semibold capitalize ${cls}`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

/** Assign high / mid / low tier based on rank within the visible set */
function assignTiers(rows: CommunityRow[]): ("high" | "mid" | "low")[] {
  const n = rows.length;
  if (n === 0) return [];
  const top    = Math.ceil(n / 3);
  const bottom = Math.floor((n * 2) / 3);
  return rows.map((_, i) =>
    i < top    ? "high" :
    i < bottom ? "mid"  : "low"
  );
}

const TIER_STYLE: Record<string, { row: string; badge: string; label: string }> = {
  high: { row: "bg-emerald-50/60 hover:bg-emerald-50",   badge: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "High" },
  mid:  { row: "bg-amber-50/40 hover:bg-amber-50",        badge: "bg-amber-100 text-amber-700 border-amber-200",     label: "Mid"  },
  low:  { row: "hover:bg-muted/30",                       badge: "bg-gray-100 text-gray-600 border-gray-200",         label: "Low"  },
};

const EMIRATES = ["all", "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];
const BEDROOM_OPTS: { value: string; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "0",   label: "Studio" },
  { value: "1",   label: "1BR" },
  { value: "2",   label: "2BR" },
  { value: "3+",  label: "3BR+" },
];

// ── Sort header ───────────────────────────────────────────────────────────────

function SortTh({
  col, label, sortKey, sortDir, onSort, align = "left",
}: {
  col: SortKey; label: string; sortKey: SortKey; sortDir: SortDir;
  onSort: (k: SortKey) => void; align?: "left" | "right";
}) {
  const active = sortKey === col;
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap
        ${align === "right" ? "text-right" : "text-left"}
        ${active ? "text-primary" : "text-muted-foreground"} hover:text-foreground transition-colors`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active
          ? sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3 opacity-30" />}
      </span>
    </th>
  );
}

// ── Expanded forecast sub-table ───────────────────────────────────────────────

function ForecastSubTable({ forecasts }: { forecasts: ForecastDetail[] }) {
  if (forecasts.length === 0) {
    return <p className="text-sm text-muted-foreground italic py-3 px-4">No individual forecasts found.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Ref</th>
            <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Unit</th>
            <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Owner</th>
            <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wider">Gross Revenue</th>
            <th className="px-4 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wider">Net Income</th>
            <th className="px-4 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {forecasts.map(f => (
            <tr key={f.id} className="hover:bg-muted/20 transition-colors">
              <td className="px-4 py-2 font-medium">
                <Link href={`/forecasts/${f.id}`} className="text-primary hover:underline">
                  {f.referenceNumber}
                </Link>
              </td>
              <td className="px-4 py-2 text-muted-foreground">
                {[
                  f.unitNumber ? `#${f.unitNumber}` : null,
                  f.building ?? null,
                  f.bedrooms != null ? `${f.bedrooms}BR` : null,
                ].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="px-4 py-2">{f.ownerName || "—"}</td>
              <td className="px-4 py-2 text-right tabular-nums font-semibold text-emerald-700">{fmtAed(f.grossRevenue)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{fmtAed(f.netIncome)}</td>
              <td className="px-4 py-2">{statusBadge(f.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AreaIntelligence() {
  // Auth guard
  const { data: me, isLoading: isMeLoading } = useGetMe();
  const [, navigate] = useLocation();
  const role             = (me as any)?.role as string | undefined;
  const isSuperAdmin     = role === "super_admin";
  const isRevenueManager = role === "revenue_manager";
  const isAuthorized     = isSuperAdmin || isRevenueManager;

  useEffect(() => {
    if (!isMeLoading && me != null && !isAuthorized) {
      navigate("/dashboard");
    }
  }, [isMeLoading, me, isAuthorized, navigate]);

  // Filters
  const [emirate,  setEmirate]  = useState("all");
  const [bedrooms, setBedrooms] = useState("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo,   setCreatedTo]   = useState("");

  // Table state
  const [sortKey,  setSortKey]  = useState<SortKey>("avgGrossRevenue");
  const [sortDir,  setSortDir]  = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set()); // keyed by row.key (community|emirate)

  const params = new URLSearchParams();
  if (emirate  !== "all") params.set("emirate",  emirate);
  if (bedrooms !== "all") params.set("bedrooms", bedrooms);
  if (createdFrom) params.set("createdFrom", createdFrom);
  if (createdTo)   params.set("createdTo",   createdTo);

  const { data, isLoading } = useQuery<AreasData>({
    queryKey: ["analytics/areas", emirate, bedrooms, createdFrom, createdTo],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/areas?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load area data");
      return res.json();
    },
    enabled: isAuthorized,
  });

  // Don't render until authorization is resolved
  if (isMeLoading || (!isMeLoading && !isAuthorized)) return null;

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  function toggleExpanded(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Revenue-ranked rows — always sorted by avgGrossRevenue DESC.
  // Used for tiers, KPI, and chart so they remain revenue-based regardless of table sort.
  const revenueRanked = useMemo(() => {
    if (!data) return [];
    return [...data.communities].sort((a, b) => {
      const va = a.avgGrossRevenue ?? -1;
      const vb = b.avgGrossRevenue ?? -1;
      return vb - va;
    });
  }, [data]);

  // Tier assignment is always based on revenue rank (not table sort)
  const tiersByKey = useMemo(() => {
    const tiers = assignTiers(revenueRanked);
    const map = new Map<string, "high" | "mid" | "low">();
    revenueRanked.forEach((r, i) => map.set(r.key, tiers[i]));
    return map;
  }, [revenueRanked]);

  // Table rows — sorted by whatever the user chose
  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.communities];
    rows.sort((a, b) => {
      const va = a[sortKey] ?? -1;
      const vb = b[sortKey] ?? -1;
      if (typeof va === "string" && typeof vb === "string")
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return rows;
  }, [data, sortKey, sortDir]);

  // Top-8 chart — always revenue-ranked, never affected by table sort
  const chartData = useMemo(() => {
    return revenueRanked
      .filter(r => r.avgGrossRevenue != null)
      .slice(0, 8)
      .map(r => ({ name: r.community, avgGross: r.avgGrossRevenue ?? 0 }));
  }, [revenueRanked]);

  // KPIs
  const totalForecasts = data?.communities.reduce((s, r) => s + r.forecastCount, 0) ?? 0;
  const communities    = data?.communities.length ?? 0;
  const topCommunity   = revenueRanked[0]?.community ?? "—";
  const overallAccRate = useMemo(() => {
    if (!data) return null;
    const sent = data.communities.reduce((s, r) => s + r.proposalSentCount, 0);
    const acc  = data.communities.reduce((s, r) => s + r.acceptedCount, 0);
    return sent > 0 ? Math.round((acc / sent) * 100) : null;
  }, [data]);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              Area Intelligence
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-6">Community revenue rankings to guide prospecting priorities</p>
        </div>
      </div>

      {/* Filter bar */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Emirate */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Emirate</label>
              <select
                value={emirate}
                onChange={e => setEmirate(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {EMIRATES.map(e => (
                  <option key={e} value={e}>{e === "all" ? "Any emirate" : e}</option>
                ))}
              </select>
            </div>

            {/* Bedrooms */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Bedrooms</label>
              <div className="flex gap-1">
                {BEDROOM_OPTS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => setBedrooms(o.value)}
                    className={`px-3 py-1.5 h-9 rounded-md text-sm font-medium transition-all border ${
                      bedrooms === o.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Forecast created from</label>
              <input
                type="date"
                value={createdFrom}
                onChange={e => setCreatedFrom(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">to</label>
              <input
                type="date"
                value={createdTo}
                onChange={e => setCreatedTo(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {(emirate !== "all" || bedrooms !== "all" || createdFrom || createdTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={() => { setEmirate("all"); setBedrooms("all"); setCreatedFrom(""); setCreatedTo(""); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Communities",      value: isLoading ? "—" : String(communities),    icon: MapPin,      color: "text-blue-600" },
          { label: "Total Forecasts",  value: isLoading ? "—" : String(totalForecasts), icon: Building2,   color: "text-muted-foreground" },
          { label: "Top Community",    value: isLoading ? "—" : topCommunity,           icon: TrendingUp,  color: "text-primary" },
          { label: "Overall Acceptance", value: isLoading ? "—" : overallAccRate != null ? `${overallAccRate}%` : "—", icon: TrendingUp, color: "text-emerald-600" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <p className="text-xl font-bold text-foreground truncate">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top communities chart */}
      {!isLoading && chartData.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-base">Top Communities by Avg Gross Revenue</CardTitle>
            <CardDescription>Average gross forecast revenue per community</CardDescription>
          </CardHeader>
          <CardContent className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10 }} />
                <RechartsTooltip
                  formatter={(v: number) => [fmtAed(v), "Avg Gross Revenue"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                />
                <Bar dataKey="avgGross" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Main table */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="font-serif">Community Rankings</CardTitle>
          <CardDescription>
            Sorted by avg gross revenue · Click a row to expand individual forecasts ·
            <span className="inline-flex items-center gap-1 ml-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> High
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block ml-1.5" /> Mid
              <span className="h-2 w-2 rounded-full bg-gray-300 inline-block ml-1.5" /> Low
            </span>
            {" "}revenue tier (relative to current results)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-y border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-8">#</th>
                  <SortTh col="community"       label="Community"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Emirate</th>
                  <SortTh col="forecastCount"   label="Forecasts"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh col="avgGrossRevenue" label="Avg Gross"      sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh col="avgNetIncome"    label="Avg Net"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh col="avgOccupancyPct" label="Avg Occ."       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh col="avgAdr"          label="Avg ADR"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                  <SortTh col="acceptanceRate"  label="Accept Rate"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={10} className="py-16 text-center text-muted-foreground text-sm animate-pulse">Loading community data…</td></tr>
                ) : sortedRows.length === 0 ? (
                  <tr><td colSpan={10} className="py-16 text-center text-muted-foreground text-sm">No data matching current filters</td></tr>
                ) : sortedRows.map((row, i) => {
                  const tier     = tiersByKey.get(row.key) ?? "low";
                  const style    = TIER_STYLE[tier];
                  const isOpen   = expanded.has(row.key);

                  return [
                    // Main row
                    <tr
                      key={`row-${row.key}`}
                      onClick={() => toggleExpanded(row.key)}
                      className={`cursor-pointer transition-colors border-b border-border/50 ${style.row}`}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground font-medium">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${style.badge}`}>
                            {style.label}
                          </Badge>
                          <span className="font-semibold text-foreground">{row.community}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{row.emirate}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{row.forecastCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-700">{fmtAed(row.avgGrossRevenue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm">{fmtAed(row.avgNetIncome)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm">
                        {row.avgOccupancyPct != null ? `${row.avgOccupancyPct}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-sm">{fmtAed(row.avgAdr)}</td>
                      <td className="px-4 py-3 text-right">
                        {row.acceptanceRate != null ? (
                          <span className={`tabular-nums text-sm font-semibold ${
                            row.acceptanceRate >= 50 ? "text-emerald-700" :
                            row.acceptanceRate >= 25 ? "text-amber-600" : "text-red-600"
                          }`}>
                            {row.acceptanceRate}%
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                      </td>
                    </tr>,

                    // Expanded sub-table
                    isOpen && (
                      <tr key={`expand-${row.key}`} className="bg-muted/20 border-b border-border">
                        <td colSpan={10} className="p-0">
                          <div className="border-t border-border/50">
                            <div className="px-4 py-2 bg-muted/30 border-b border-border/30">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                {row.forecastCount} forecast{row.forecastCount !== 1 ? "s" : ""} in {row.community}
                              </span>
                            </div>
                            <ForecastSubTable forecasts={row.forecasts} />
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
