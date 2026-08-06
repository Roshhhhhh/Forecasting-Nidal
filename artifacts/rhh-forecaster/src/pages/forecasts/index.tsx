import { useListForecasts } from "@workspace/api-client-react";
import type { Forecast } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Plus, Search, MoreHorizontal, X, TrendingUp, TrendingDown, Eye, Pencil,
  FileText, CheckCircle, Copy,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { usePermission } from "@/hooks/usePermission";
import { DataTable, ColumnDef } from "@/components/DataTable";
import { SmartReport } from "@/components/SmartReport";
import { PageTabs } from "@/components/PageTabs";
import DuplicateForecastModal from "@/components/DuplicateForecastModal";

const STATUSES = [
  { value: "all",       label: "All" },
  { value: "draft",     label: "Draft" },
  { value: "published", label: "Published" },
  { value: "accepted",  label: "Accepted" },
  { value: "declined",  label: "Declined" },
];

const LTR_FILTERS = [
  { value: "all",      label: "Any" },
  { value: "positive", label: "Outperforms LTR" },
  { value: "negative", label: "Below LTR" },
  { value: "none",     label: "No LTR Data" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap select-none
        ${active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
        }`}
    >
      {children}
    </button>
  );
}


const fmtAed = (val?: number | null) =>
  val != null ? new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(val) : "—";

const getStatusColor = (s: string) => {
  switch (s) {
    case "published": return "bg-primary/20 text-primary border-primary/30";
    case "accepted":  return "bg-green-500/20 text-green-700 border-green-500/30";
    case "declined":  return "bg-red-500/20 text-red-700 border-red-500/30";
    case "draft":     return "bg-gray-500/20 text-gray-700 border-gray-500/30";
    default:          return "bg-secondary/20 text-secondary-foreground border-secondary/30";
  }
};

const FORECAST_COLUMNS: ColumnDef<Forecast>[] = [
  {
    key: "reference",
    label: "Reference",
    description: "Forecast reference number",
    render: (f) => (
      <div>
        <Link href={`/forecasts/${f.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
          {f.referenceNumber}
        </Link>
        <div className="text-xs text-muted-foreground mt-1">{new Date(f.createdAt).toLocaleDateString()}</div>
      </div>
    ),
    exportValue: (f) => f.referenceNumber,
  },
  {
    key: "client",
    label: "Client / Property",
    description: "Owner name and property address",
    render: (f) => (
      <div>
        <div className="font-medium text-foreground">
          <Link href={`/owners/${f.ownerId}`} className="hover:underline">{f.ownerName || "Unknown"}</Link>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={f.propertyAddress || ""}>
          {f.propertyAddress || "—"}
        </div>
      </div>
    ),
    exportValue: (f) => `${f.ownerName ?? ""} — ${f.propertyAddress ?? ""}`,
    minWidth: "min-w-[180px]",
  },
  {
    key: "area",
    label: "Area",
    description: "Property area / community",
    defaultVisible: false,
    render: (f) => <span className="text-sm text-muted-foreground">{f.area || "—"}</span>,
    exportValue: (f) => f.area ?? "",
  },
  {
    key: "bedrooms",
    label: "Bedrooms",
    description: "Number of bedrooms",
    defaultVisible: false,
    render: (f) => <span className="text-sm">{f.bedrooms === 0 ? "Studio" : (f.bedrooms ?? "—")}</span>,
    exportValue: (f) => f.bedrooms === 0 ? "Studio" : (f.bedrooms?.toString() ?? ""),
  },
  {
    key: "grossRevenue",
    label: "Gross Revenue",
    description: "Projected annual gross revenue",
    render: (f) => <span className="font-medium">{fmtAed(f.grossAnnualRevenue)}</span>,
    exportValue: (f) => f.grossAnnualRevenue ?? "",
  },
  {
    key: "netIncome",
    label: "Net Income",
    description: "Net owner income after management fees",
    render: (f) => <span className="text-sm text-muted-foreground">{fmtAed(f.netOwnerIncome)}</span>,
    exportValue: (f) => f.netOwnerIncome ?? "",
  },
  {
    key: "ltrIncome",
    label: "LTR Income",
    description: "Equivalent long-term rental income",
    defaultVisible: false,
    render: (f) => <span className="text-sm text-muted-foreground">{fmtAed(f.netLtrIncome)}</span>,
    exportValue: (f) => f.netLtrIncome ?? "",
  },
  {
    key: "vsLtr",
    label: "vs LTR",
    description: "Percentage uplift vs long-term rental",
    render: (f) => f.increaseVsLtrPct != null ? (
      <div className={`font-medium flex items-center gap-1 ${f.increaseVsLtrPct > 0 ? "text-green-600" : "text-red-600"}`}>
        {f.increaseVsLtrPct > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {f.increaseVsLtrPct > 0 ? "+" : ""}{f.increaseVsLtrPct}%
      </div>
    ) : <span className="text-muted-foreground">—</span>,
    exportValue: (f) => f.increaseVsLtrPct != null ? `${f.increaseVsLtrPct}%` : "",
  },
  {
    key: "occupancy",
    label: "Occupancy %",
    description: "Projected annual occupancy rate",
    defaultVisible: false,
    render: (f) => f.recommendedOccupancy != null
      ? <span className="text-sm">{Math.round(f.recommendedOccupancy * 100)}%</span>
      : <span className="text-muted-foreground">—</span>,
    exportValue: (f) => f.recommendedOccupancy != null ? `${Math.round(f.recommendedOccupancy * 100)}%` : "",
  },
  {
    key: "adr",
    label: "ADR (AED)",
    description: "Average Daily Rate",
    defaultVisible: false,
    render: (f) => f.weightedAdr != null
      ? <span className="text-sm">{Math.round(f.weightedAdr).toLocaleString()}</span>
      : <span className="text-muted-foreground">—</span>,
    exportValue: (f) => f.weightedAdr != null ? Math.round(f.weightedAdr) : "",
  },
  {
    key: "assignedTo",
    label: "Assigned Rep",
    description: "Staff member managing this forecast",
    defaultVisible: false,
    render: (f) => <span className="text-sm text-muted-foreground">{f.assignedToName || "—"}</span>,
    exportValue: (f) => f.assignedToName ?? "",
  },
  {
    key: "status",
    label: "Status",
    description: "Current forecast status",
    render: (f) => (
      <Badge variant="outline" className={`capitalize ${getStatusColor(f.status)}`}>
        {f.status.replace(/_/g, " ")}
      </Badge>
    ),
    exportValue: (f) => f.status.replace(/_/g, " "),
  },
  {
    key: "created",
    label: "Created",
    description: "Date forecast was created",
    defaultVisible: false,
    render: (f) => <span className="text-sm text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</span>,
    exportValue: (f) => new Date(f.createdAt).toLocaleDateString(),
  },
];

export default function ForecastsList() {
  const { data: forecasts, isLoading } = useListForecasts();
  const canCreateForecast = usePermission("forecasts.create");
  const canEditForecast   = usePermission("forecasts.edit");

  const [search, setSearch]         = useState("");
  const [status, setStatus]         = useState("all");
  const [ltrFilter, setLtrFilter]   = useState("all");
  const [revenueMin, setRevenueMin] = useState("");
  const [revenueMax, setRevenueMax] = useState("");
  const [duplicateForecast, setDuplicateForecast] = useState<Forecast | null>(null);

  // ── SmartReport metrics ────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const all = forecasts ?? [];
    const accepted = all.filter(f => f.status === "accepted").length;
    const beatLtr  = all.filter(f => (f.increaseVsLtrPct ?? 0) > 0).length;
    const revenues = all.map(f => f.grossAnnualRevenue ?? 0).filter(v => v > 0);
    const avgRev   = revenues.length > 0
      ? Math.round(revenues.reduce((s, v) => s + v, 0) / revenues.length)
      : 0;
    return [
      { icon: <FileText    className="h-4 w-4" />, label: "Total Forecasts",   value: all.length },
      { icon: <CheckCircle className="h-4 w-4" />, label: "Accepted",          value: accepted, color: accepted > 0 ? "green" as const : "default" as const },
      {                                             label: "Avg Gross Revenue", value: avgRev > 0 ? fmtAed(avgRev) : "—" },
      { icon: <TrendingUp  className="h-4 w-4" />, label: "Beat LTR",          value: beatLtr, color: beatLtr > 0 ? "green" as const : "default" as const,
        subtitle: `of ${all.filter(f => f.increaseVsLtrPct != null).length} with LTR data` },
    ];
  }, [forecasts]);

  // ── Status tabs ───────────────────────────────────────────────────────────
  const statusTabs = useMemo(() =>
    STATUSES.map(s => ({
      value: s.value,
      label: s.label,
      count: s.value === "all" ? (forecasts?.length ?? 0) : (forecasts?.filter(f => f.status === s.value).length ?? 0),
    }))
  , [forecasts]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const activeFilterCount = useMemo(() => [
    ltrFilter !== "all",
    !!revenueMin || !!revenueMax,
  ].filter(Boolean).length, [ltrFilter, revenueMin, revenueMax]);

  const filteredForecasts = useMemo(() => forecasts?.filter(f => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${f.referenceNumber} ${f.ownerName || ""} ${f.propertyAddress || ""}`.toLowerCase().includes(q)) return false;
    }
    if (status !== "all" && f.status !== status) return false;
    if (ltrFilter === "positive" && !(f.increaseVsLtrPct != null && f.increaseVsLtrPct > 0)) return false;
    if (ltrFilter === "negative" && !(f.increaseVsLtrPct != null && f.increaseVsLtrPct <= 0)) return false;
    if (ltrFilter === "none" && f.increaseVsLtrPct != null) return false;
    if (revenueMin && (f.grossAnnualRevenue ?? 0) < Number(revenueMin)) return false;
    if (revenueMax && (f.grossAnnualRevenue ?? 0) > Number(revenueMax)) return false;
    return true;
  }), [forecasts, search, status, ltrFilter, revenueMin, revenueMax]);

  function clearAll() {
    setSearch(""); setLtrFilter("all"); setRevenueMin(""); setRevenueMax("");
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (ltrFilter !== "all") activeChips.push({ label: LTR_FILTERS.find(f => f.value === ltrFilter)!.label, clear: () => setLtrFilter("all") });
  if (revenueMin || revenueMax) activeChips.push({ label: `AED ${revenueMin || "0"} – ${revenueMax || "∞"}`, clear: () => { setRevenueMin(""); setRevenueMax(""); } });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Revenue Forecasts</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage and track all revenue projections.</p>
        </div>
        {canCreateForecast && (
          <Link href="/forecasts/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Create Forecast
          </Link>
        )}
      </div>

      {/* SmartReport */}
      <SmartReport metrics={metrics} />

      {/* Main card */}
      <Card className="border-border/50 shadow-sm">
        {/* Nav Tabs — status */}
        <PageTabs tabs={statusTabs} value={status} onChange={setStatus} />

        {/* Filter bar */}
        <div className="p-4 border-b border-border space-y-3 bg-muted/20">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ref, owner, or property..."
                className="pl-9 bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(activeFilterCount > 0 || search) && (
              <Button variant="ghost" size="sm" className="h-10 text-muted-foreground hover:text-foreground gap-1.5" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
          </div>

          {/* LTR filter chips */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground self-center">vs LTR:</span>
            {LTR_FILTERS.map(f => (
              <Chip key={f.value} active={ltrFilter === f.value} onClick={() => setLtrFilter(f.value)}>
                {f.value === "positive" && <TrendingUp   className="h-3 w-3 inline mr-1 text-green-600" />}
                {f.value === "negative" && <TrendingDown className="h-3 w-3 inline mr-1 text-red-500" />}
                {f.label}
              </Chip>
            ))}
          </div>

          {/* Revenue range */}
          <div className="flex items-center gap-3 max-w-sm">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">AED</span>
              <Input type="number" placeholder="Min. Revenue" className="pl-12 text-sm h-9" value={revenueMin} onChange={e => setRevenueMin(e.target.value)} />
            </div>
            <span className="text-muted-foreground text-sm">—</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">AED</span>
              <Input type="number" placeholder="Max. Revenue" className="pl-12 text-sm h-9" value={revenueMax} onChange={e => setRevenueMax(e.target.value)} />
            </div>
          </div>

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex gap-2 flex-wrap pt-0.5">
              {activeChips.map(({ label, clear }) => (
                <button
                  key={label}
                  onClick={clear}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {label} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Record count */}
        <div className="px-6 py-2.5 border-b border-border/50 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredForecasts?.length ?? 0}</span> of{" "}
            <span className="font-semibold text-foreground">{forecasts?.length ?? 0}</span> forecasts
          </p>
        </div>

        <CardContent className="p-0">
          <DataTable
            id="forecasts"
            columns={FORECAST_COLUMNS}
            data={filteredForecasts}
            isLoading={isLoading}
            rowKey={f => f.id}
            exportFileName="Revenue Forecasts"
            emptyState={
              <div>
                <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-foreground">No forecasts match your filters</p>
                <p className="text-sm mt-1">Try adjusting your search or status filters.</p>
                {(activeFilterCount > 0 || search) && (
                  <Button variant="link" className="mt-2 text-primary" onClick={clearAll}>Clear all filters</Button>
                )}
              </div>
            }
            actions={forecast => (
              <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/forecasts/${forecast.id}`}>
                  <button
                    className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="View Details"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </Link>
                {canEditForecast && (
                  <Link href={`/forecasts/${forecast.id}/edit`}>
                    <button
                      className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit Forecast"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                )}
                {canEditForecast && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDuplicateForecast(forecast)} className="gap-2">
                        <Copy className="h-4 w-4" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive">Archive</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          />
        </CardContent>
      </Card>

      {duplicateForecast && (
        <DuplicateForecastModal
          forecast={duplicateForecast}
          open={!!duplicateForecast}
          onOpenChange={open => { if (!open) setDuplicateForecast(null); }}
        />
      )}
    </div>
  );
}
