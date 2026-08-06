import { useListForecasts } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Search, MoreHorizontal, X, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useMemo } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { usePermission } from "@/hooks/usePermission";

const STATUSES = [
  { value: "all",      label: "All Statuses" },
  { value: "draft",    label: "Draft" },
  { value: "published",label: "Published" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
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

export default function ForecastsList() {
  const { data: forecasts, isLoading } = useListForecasts();
  const canCreateForecast = usePermission("forecasts.create");
  const canEditForecast   = usePermission("forecasts.edit");

  const [search, setSearch]       = useState("");
  const [status, setStatus]       = useState("all");
  const [ltrFilter, setLtrFilter] = useState("all");
  const [revenueMin, setRevenueMin] = useState("");
  const [revenueMax, setRevenueMax] = useState("");

  const activeFilterCount = useMemo(() => [
    status !== "all",
    ltrFilter !== "all",
    !!revenueMin || !!revenueMax,
  ].filter(Boolean).length, [status, ltrFilter, revenueMin, revenueMax]);

  const filteredForecasts = useMemo(() => forecasts?.filter(f => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${f.referenceNumber} ${f.ownerName || ''} ${f.propertyAddress || ''}`.toLowerCase().includes(q)) return false;
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
    setSearch(""); setStatus("all"); setLtrFilter("all"); setRevenueMin(""); setRevenueMax("");
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (status !== "all") activeChips.push({ label: STATUSES.find(s => s.value === status)!.label, clear: () => setStatus("all") });
  if (ltrFilter !== "all") activeChips.push({ label: LTR_FILTERS.find(f => f.value === ltrFilter)!.label, clear: () => setLtrFilter("all") });
  if (revenueMin || revenueMax) activeChips.push({ label: `AED ${revenueMin || "0"} – ${revenueMax || "∞"}`, clear: () => { setRevenueMin(""); setRevenueMax(""); } });

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'published': return 'bg-primary/20 text-primary border-primary/30';
      case 'accepted':  return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'declined':  return 'bg-red-500/20 text-red-700 border-red-500/30';
      case 'draft':     return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
      default:          return 'bg-secondary/20 text-secondary-foreground border-secondary/30';
    }
  };

  const fmt = (val?: number | null) =>
    val != null ? new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(val) : "—";

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
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

      <Card className="border-border/50 shadow-sm">
        <div className="p-4 border-b border-border space-y-3 bg-muted/20">
          {/* Search + clear */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-lg">
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
                <X className="h-3.5 w-3.5" /> Clear all
              </Button>
            )}
          </div>

          {/* Status chips */}
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map(s => (
              <Chip key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>
                {s.label}
              </Chip>
            ))}
            <div className="w-px bg-border mx-1 self-stretch" />
            {/* LTR chips */}
            {LTR_FILTERS.map(f => (
              <Chip key={f.value} active={ltrFilter === f.value} onClick={() => setLtrFilter(f.value)}>
                {f.value === "positive" && <TrendingUp className="h-3 w-3 inline mr-1 text-green-600" />}
                {f.value === "negative" && <TrendingDown className="h-3 w-3 inline mr-1 text-red-500" />}
                {f.label}
              </Chip>
            ))}
          </div>

          {/* Revenue range */}
          <div className="flex items-center gap-3 max-w-sm">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">AED</span>
              <Input
                type="number"
                placeholder="Min. Revenue"
                className="pl-12 text-sm h-9"
                value={revenueMin}
                onChange={e => setRevenueMin(e.target.value)}
              />
            </div>
            <span className="text-muted-foreground text-sm">—</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">AED</span>
              <Input
                type="number"
                placeholder="Max. Revenue"
                className="pl-12 text-sm h-9"
                value={revenueMax}
                onChange={e => setRevenueMax(e.target.value)}
              />
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

        {/* Result count */}
        <div className="px-6 py-2.5 border-b border-border/50 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredForecasts?.length ?? 0}</span> of{" "}
            <span className="font-semibold text-foreground">{forecasts?.length ?? 0}</span> forecasts
          </p>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 font-medium">Client / Property</th>
                  <th className="px-6 py-4 font-medium">Projected Revenue</th>
                  <th className="px-6 py-4 font-medium">vs LTR</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading forecasts...</td></tr>
                ) : filteredForecasts?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-16 text-muted-foreground">
                      <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="font-medium text-foreground">No forecasts match your filters</p>
                      <p className="text-sm mt-1">Try adjusting your search or status filters.</p>
                      {(activeFilterCount > 0 || search) && (
                        <Button variant="link" className="mt-2 text-primary" onClick={clearAll}>Clear all filters</Button>
                      )}
                    </td>
                  </tr>
                ) : filteredForecasts?.map((forecast) => (
                  <tr key={forecast.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <Link href={`/forecasts/${forecast.id}`} className="hover:text-primary transition-colors">
                        {forecast.referenceNumber}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-1 font-normal">
                        {new Date(forecast.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">
                        <Link href={`/owners/${forecast.ownerId}`} className="hover:underline">{forecast.ownerName || 'Unknown'}</Link>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={forecast.propertyAddress || ''}>
                        {forecast.propertyAddress || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{fmt(forecast.grossAnnualRevenue)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Net: {fmt(forecast.netOwnerIncome)}</div>
                    </td>
                    <td className="px-6 py-4">
                      {forecast.increaseVsLtrPct != null ? (
                        <div className={`font-medium flex items-center gap-1 ${forecast.increaseVsLtrPct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {forecast.increaseVsLtrPct > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                          {forecast.increaseVsLtrPct > 0 ? '+' : ''}{forecast.increaseVsLtrPct}%
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`capitalize ${getStatusColor(forecast.status)}`}>
                        {forecast.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/forecasts/${forecast.id}`}>View Details</Link>
                          </DropdownMenuItem>
                          {canEditForecast && (
                            <DropdownMenuItem asChild>
                              <Link href={`/forecasts/${forecast.id}/edit`}>Edit Forecast</Link>
                            </DropdownMenuItem>
                          )}
                          {canEditForecast && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem>Duplicate</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive">Archive</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
