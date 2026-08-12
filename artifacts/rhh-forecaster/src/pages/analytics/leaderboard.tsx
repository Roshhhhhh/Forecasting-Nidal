import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetMe } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Trophy, TrendingUp, Users, Clock, ArrowLeft } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RepStats {
  userId: number;
  userName: string;
  userEmail: string;
  userRole: string;
  totalOwners: number;
  accepted: number;
  lost: number;
  reachedProposal: number;
  conversionRate: number | null;
  avgDaysToAcceptance: number | null;
  stages: {
    newLead: number;
    inReview: number;
    proposalSent: number;
    proposalViewed: number;
    negotiating: number;
    accepted: number;
    lost: number;
  };
}

interface FunnelRow { stage: string; count: number; }

interface LeaderboardData {
  reps: RepStats[];
  funnel: FunnelRow[];
}

type SortKey = "userName" | "totalOwners" | "accepted" | "lost" | "conversionRate" | "avgDaysToAcceptance";
type SortDir = "asc" | "desc";
type DateRange = "this_month" | "this_quarter" | "all_time";

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function roleBadge(role: string) {
  const map: Record<string, { label: string; cls: string }> = {
    super_admin:     { label: "Super Admin",     cls: "bg-violet-100 text-violet-700 border-violet-200" },
    revenue_manager: { label: "Revenue Manager", cls: "bg-blue-100 text-blue-700 border-blue-200" },
    admin:           { label: "Admin",            cls: "bg-slate-100 text-slate-700 border-slate-200" },
    staff:           { label: "Staff",            cls: "bg-gray-100  text-gray-700  border-gray-200"  },
  };
  const m = map[role] ?? { label: role, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return <Badge variant="outline" className={`text-[10px] font-semibold ${m.cls}`}>{m.label}</Badge>;
}

// Colours map to the 7 distribution bars
const DIST_COLORS = ["#94a3b8", "#3b82f6", "#f59e0b", "#f97316", "#7c3aed", "#10b981", "#ef4444"];

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "this_month",   label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "all_time",     label: "All Time" },
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
          : <ChevronDown className="h-3 w-3 opacity-30" />
        }
      </span>
    </th>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Leaderboard() {
  // All hooks declared unconditionally at the top
  const { data: me, isLoading: isMeLoading } = useGetMe();
  const [, navigate] = useLocation();
  const [range, setRange]         = useState<DateRange>("all_time");
  const [sortKey, setSortKey]     = useState<SortKey>("accepted");
  const [sortDir, setSortDir]     = useState<SortDir>("desc");
  const [selectedReps, setSelectedReps] = useState<Set<number>>(new Set());

  const role             = (me as any)?.role as string | undefined;
  const isSuperAdmin     = role === "super_admin";
  const isRevenueManager = role === "revenue_manager";
  const isAuthorized     = isSuperAdmin || isRevenueManager;

  // Effect-based redirect — never before hooks, never conditionally
  useEffect(() => {
    if (!isMeLoading && me != null && !isAuthorized) {
      navigate("/dashboard");
    }
  }, [isMeLoading, me, isAuthorized, navigate]);

  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ["analytics/leaderboard", range],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/leaderboard?range=${range}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load leaderboard");
      return res.json();
    },
    enabled: isAuthorized,
  });

  function handleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  function toggleRep(id: number) {
    setSelectedReps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const sortedReps = useMemo(() => {
    if (!data) return [];
    let rows = [...data.reps];
    if (selectedReps.size > 0) rows = rows.filter(r => selectedReps.has(r.userId));
    rows.sort((a, b) => {
      const va = a[sortKey] ?? -1;
      const vb = b[sortKey] ?? -1;
      if (typeof va === "string" && typeof vb === "string")
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return rows;
  }, [data, sortKey, sortDir, selectedReps]);

  // Show nothing while we determine authorization
  if (isMeLoading || (!isMeLoading && !isAuthorized)) {
    return null;
  }

  // KPIs from all reps (unfiltered)
  const allReps       = data?.reps ?? [];
  const totalAccepted = allReps.reduce((s, r) => s + r.accepted, 0);
  const totalOwners   = allReps.reduce((s, r) => s + r.totalOwners, 0);
  const totalReached  = allReps.reduce((s, r) => s + r.reachedProposal, 0);
  const teamConversion = totalReached > 0 ? Math.round((totalAccepted / totalReached) * 100) : 0;
  const topRep        = allReps[0];

  // Stage distribution — bars are proportional to the total active owners
  // so that each bar represents "what share of all owners are at this stage".
  // This is an accurate current-state view, NOT a sequential funnel claim.
  const distData  = data?.funnel ?? [];
  const distTotal = distData.reduce((s, r) => s + r.count, 0) || 1;

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
              <Trophy className="h-6 w-6 text-amber-500" />
              Staff Leaderboard
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-6">Rep conversion rates and pipeline stage breakdown</p>
        </div>

        {/* Date range toggle */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
          {DATE_RANGES.map(dr => (
            <button
              key={dr.value}
              onClick={() => setRange(dr.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                range === dr.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {dr.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Active Owners", value: totalOwners,      icon: Users,       color: "text-blue-600" },
          { label: "Deals Accepted",      value: totalAccepted,    icon: TrendingUp,  color: "text-emerald-600" },
          { label: "Team Conversion",     value: `${teamConversion}%`, icon: TrendingUp, color: "text-primary" },
          { label: "Top Rep",             value: topRep?.userName ?? "—", icon: Trophy, color: "text-amber-500" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.label}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-xl font-bold text-foreground">{isLoading ? "—" : kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Rep table — 2/3 width on xl */}
        <Card className="xl:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="font-serif">Rep Performance</CardTitle>
                <CardDescription>Click a column header to sort · Click a rep name to filter</CardDescription>
              </div>
              {selectedReps.size > 0 && (
                <Button size="sm" variant="outline" onClick={() => setSelectedReps(new Set())}>
                  Clear filter ({selectedReps.size})
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 border-y border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-8">#</th>
                    <SortTh col="userName"            label="Rep"        sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    <SortTh col="totalOwners"         label="Owners"     sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                    <SortTh col="accepted"            label="Accepted"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                    <SortTh col="lost"                label="Lost"       sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                    <SortTh col="conversionRate"      label="Conv. Rate" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                    <SortTh col="avgDaysToAcceptance" label="Avg Days"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr><td colSpan={7} className="py-12 text-center text-muted-foreground text-sm animate-pulse">Loading…</td></tr>
                  ) : sortedReps.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">No data for this period</td></tr>
                  ) : sortedReps.map((rep, i) => {
                    const rank       = i + 1;
                    const isFiltered = selectedReps.has(rep.userId);
                    return (
                      <tr
                        key={rep.userId}
                        className={`hover:bg-muted/30 transition-colors ${isFiltered ? "bg-primary/5" : ""}`}
                      >
                        {/* Rank */}
                        <td className="px-4 py-3">
                          {rank === 1 ? <span className="text-amber-500 text-base">🥇</span>
                          : rank === 2 ? <span className="text-slate-400 text-base">🥈</span>
                          : rank === 3 ? <span className="text-amber-700 text-base">🥉</span>
                          : <span className="text-xs text-muted-foreground font-medium">{rank}</span>}
                        </td>

                        {/* Rep */}
                        <td className="px-4 py-3">
                          <button onClick={() => toggleRep(rep.userId)} className="flex items-center gap-2.5 group text-left">
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                              {initials(rep.userName)}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{rep.userName}</p>
                              <div className="mt-0.5">{roleBadge(rep.userRole)}</div>
                            </div>
                          </button>
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums font-medium">{rep.totalOwners}</td>

                        <td className="px-4 py-3 text-right">
                          <span className={`tabular-nums font-semibold ${rep.accepted > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
                            {rep.accepted}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span className={`tabular-nums text-sm ${rep.lost > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                            {rep.lost}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          {rep.conversionRate != null ? (
                            <span className={`tabular-nums font-semibold text-sm ${
                              rep.conversionRate >= 50 ? "text-emerald-700" :
                              rep.conversionRate >= 25 ? "text-amber-600" : "text-red-600"
                            }`}>
                              {rep.conversionRate}%
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {rep.avgDaysToAcceptance != null ? (
                            <span className="tabular-nums text-sm text-muted-foreground flex items-center justify-end gap-1">
                              <Clock className="h-3 w-3" />{rep.avgDaysToAcceptance}d
                            </span>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Stage distribution — 1/3 width on xl */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif">Stage Distribution</CardTitle>
            <CardDescription>
              Share of owners currently at each stage — where owners are right now across the whole team
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm animate-pulse">Loading…</div>
            ) : (
              <div className="space-y-3">
                {distData.map((row, i) => {
                  // Proportion of all owners currently at this stage
                  const pct = Math.round((row.count / distTotal) * 100);
                  return (
                    <div key={row.stage}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{row.stage}</span>
                        <span className="tabular-nums text-muted-foreground">
                          <span className="font-semibold text-foreground">{row.count}</span>
                          {" "}({pct}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-2.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: DIST_COLORS[i] ?? "#94a3b8",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground pt-1">
                  Total: {distTotal} owners across all stages
                </p>
              </div>
            )}

            {/* Accepted vs Lost bar chart */}
            {!isLoading && distData.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Accepted vs Lost</p>
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart
                    data={[
                      { name: "Accepted", value: distData.find(f => f.stage === "Accepted")?.count ?? 0 },
                      { name: "Lost",     value: distData.find(f => f.stage === "Lost")?.count ?? 0 },
                    ]}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} allowDecimals={false} />
                    <RechartsTooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      <Cell fill="#10b981" />
                      <Cell fill="#ef4444" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
