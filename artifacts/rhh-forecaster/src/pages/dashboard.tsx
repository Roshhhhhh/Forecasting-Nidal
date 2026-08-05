import { useGetDashboardKpis, useGetRecentForecasts, useGetAreaPerformance, useGetConversionStats } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, TrendingUp, CheckCircle, GripVertical } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useRef, useState, useCallback, useEffect } from "react";

// ── Resizable split pane hook ─────────────────────────────────────────────────
function useResizableSplit(defaultPct = 65, minPct = 30, maxPct = 80) {
  const [pct, setPct] = useState(defaultPct);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const raw = ((ev.clientX - rect.left) / rect.width) * 100;
      setPct(Math.min(maxPct, Math.max(minPct, raw)));
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [minPct, maxPct]);

  return { pct, containerRef, onMouseDown };
}

export default function Dashboard() {
  const { data: kpis, isLoading: isKpisLoading } = useGetDashboardKpis();
  const { data: recentForecasts, isLoading: isRecentLoading } = useGetRecentForecasts();
  const { data: areaPerformance, isLoading: isAreaLoading } = useGetAreaPerformance();
  const { data: conversionStats, isLoading: isConversionLoading } = useGetConversionStats();

  const { pct, containerRef, onMouseDown } = useResizableSplit(65);

  const formatCurrency = (val?: number | null) => {
    if (!val) return "AED 0";
    return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(val);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-primary/20 text-primary border-primary/30';
      case 'accepted': return 'bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400';
      case 'declined': return 'bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400';
      case 'draft': return 'bg-gray-500/20 text-gray-700 border-gray-500/30 dark:text-gray-400';
      default: return 'bg-secondary/20 text-secondary-foreground border-secondary/30';
    }
  };

  const conversionData = conversionStats ? [
    { name: "Published", value: conversionStats.published },
    { name: "Viewed",    value: conversionStats.viewed },
    { name: "Called",    value: conversionStats.ownerCalled || 0 },
    { name: "Accepted",  value: conversionStats.accepted },
  ] : [];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1 text-lg">Your portfolio forecasting performance.</p>
        </div>
        <Link href="/forecasts/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
          New Forecast
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Forecasts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isKpisLoading ? "-" : kpis?.totalForecasts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-primary font-medium">{kpis?.draftForecasts}</span> in draft state
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isKpisLoading ? "-" : `${kpis?.conversionRate}%`}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-green-600 font-medium">{kpis?.acceptedProposals}</span> signed deals
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Revenue (Gross)</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isKpisLoading ? "-" : formatCurrency(kpis?.forecastedGrossRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="font-medium text-foreground">{formatCurrency(kpis?.forecastedManagementFee)}</span> avg mgmt fee
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border/50 bg-secondary/5 border-secondary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg LTR Increase</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-500">
              +{isKpisLoading ? "-" : kpis?.avgIncreaseVsLtr}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">vs long-term rental benchmarks</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Resizable chart row ── */}
      <div ref={containerRef} className="flex items-stretch gap-0 min-h-[370px]">
        {/* Area Performance */}
        <div style={{ width: `${pct}%`, minWidth: 0 }} className="flex flex-col">
          <Card className="shadow-sm border-border/50 flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="font-serif">Area Performance</CardTitle>
              <CardDescription>Average net owner income by area</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 h-[280px]">
              {isAreaLoading ? (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">Loading chart…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={areaPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="area" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `AED ${v / 1000}k`} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <RechartsTooltip
                      formatter={(value: number) => formatCurrency(value)}
                      cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="avgNetIncome" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Drag handle ── */}
        <div
          className="flex items-center justify-center w-3 cursor-col-resize flex-shrink-0 group select-none"
          onMouseDown={onMouseDown}
          title="Drag to resize"
        >
          <div className="flex flex-col items-center gap-0.5 opacity-30 group-hover:opacity-80 transition-opacity">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>

        {/* Conversion Funnel */}
        <div style={{ width: `${100 - pct}%`, minWidth: 0 }} className="flex flex-col">
          <Card className="shadow-sm border-border/50 flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="font-serif">Conversion Funnel</CardTitle>
              <CardDescription>Proposal engagement stages</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 h-[280px]">
              {isConversionLoading ? (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">Loading funnel…</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={conversionData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      width={72}
                      tick={{ fontSize: 12, fill: 'hsl(var(--foreground))', fontWeight: 500 }}
                    />
                    <RechartsTooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary)/0.2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Forecasts */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-serif">Recent Forecasts</CardTitle>
            <CardDescription>Latest activity in the pipeline</CardDescription>
          </div>
          <Link href="/forecasts" className="text-sm font-medium text-primary hover:underline">
            View All
          </Link>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium text-right">Proj. Net Income</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isRecentLoading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Loading recent forecasts...</td></tr>
                ) : recentForecasts?.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No recent forecasts found.</td></tr>
                ) : recentForecasts?.map((forecast) => (
                  <tr key={forecast.id} className="hover:bg-muted/30 transition-colors group cursor-pointer">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link href={`/forecasts/${forecast.id}`}>{forecast.referenceNumber}</Link>
                    </td>
                    <td className="px-4 py-3">{forecast.ownerName || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{forecast.propertyAddress || '-'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(forecast.netOwnerIncome)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`capitalize ${getStatusColor(forecast.status)}`}>
                        {forecast.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(forecast.createdAt).toLocaleDateString()}
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
