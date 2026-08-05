import { useGetForecast, useListForecastScenarios, useGetForecastMonthly } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Share, Send, Sparkles, Building, Calendar, DollarSign, Target, Copy, TrendingUp, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function ForecastDetail() {
  const { id } = useParams<{ id: string }>();
  const forecastId = parseInt(id || "0", 10);

  const { data: forecast, isLoading } = useGetForecast(forecastId);
  const { data: scenarios } = useListForecastScenarios(forecastId);
  const { data: monthly } = useGetForecastMonthly(forecastId);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading forecast...</div>;
  if (!forecast) return <div className="p-8 text-center text-red-500">Forecast not found.</div>;

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "-";
    return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(val);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-primary/20 text-primary border-primary/30";
      case "accepted": return "bg-green-500/20 text-green-700 border-green-500/30";
      case "declined": return "bg-red-500/20 text-red-700 border-red-500/30";
      case "draft": return "bg-gray-500/20 text-gray-700 border-gray-500/30";
      default: return "bg-secondary/20 text-secondary-foreground border-secondary/30";
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] w-full">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <Link href="/forecasts" className="p-2 -ml-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-serif font-bold text-foreground">{forecast.referenceNumber}</h1>
              <Badge variant="outline" className={`capitalize ${getStatusColor(forecast.status)}`}>
                {forecast.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {(forecast as any).ownerName && (
                <Link href={`/owners/${forecast.ownerId}`} className="hover:text-foreground">{(forecast as any).ownerName}</Link>
              )}
              {(forecast as any).ownerName && (forecast as any).propertyAddress && " • "}
              {(forecast as any).propertyAddress && <span>{(forecast as any).propertyAddress}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Save className="h-4 w-4" /> Save Draft
          </Button>
          <Button size="sm" className="gap-2">
            <Share className="h-4 w-4" /> Generate Proposal
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 max-w-[1600px] mx-auto w-full">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="grid w-full grid-cols-6 max-w-[800px] mb-8">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="inputs">Data Inputs</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="ai" className="relative">
              AI Config
              <Sparkles className="h-3 w-3 absolute top-1.5 right-1.5 text-primary" />
            </TabsTrigger>
            <TabsTrigger value="proposal">Proposal</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Gross Revenue</h3>
                    <div className="p-2 bg-primary/10 rounded-md"><DollarSign className="h-4 w-4 text-primary" /></div>
                  </div>
                  <div className="text-3xl font-bold">{formatCurrency(forecast.grossAnnualRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-2">Projected annual top-line</p>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm bg-secondary/5 border-secondary/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-secondary-foreground">Net Owner Income</h3>
                    <div className="p-2 bg-background rounded-md shadow-sm"><Target className="h-4 w-4 text-secondary-foreground" /></div>
                  </div>
                  <div className="text-3xl font-bold text-secondary-foreground">{formatCurrency(forecast.netOwnerIncome)}</div>
                  <p className="text-xs text-muted-foreground mt-2">After all expenses & fees</p>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground">vs LTR Benchmark</h3>
                    <div className="p-2 bg-muted rounded-md"><Building className="h-4 w-4 text-muted-foreground" /></div>
                  </div>
                  <div className={`text-3xl font-bold ${(forecast.increaseVsLtrPct ?? 0) > 0 ? "text-green-600 dark:text-green-500" : "text-red-600"}`}>
                    {(forecast.increaseVsLtrPct ?? 0) > 0 ? "+" : ""}{forecast.increaseVsLtrPct ?? "—"}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Net increase over LTR</p>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-muted-foreground">Key Metrics</h3>
                    <div className="p-2 bg-muted rounded-md"><TrendingUp className="h-4 w-4 text-muted-foreground" /></div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Occupancy</span>
                      <span className="font-medium">{forecast.recommendedOccupancy != null ? `${Math.round((forecast.recommendedOccupancy as number) * 100)}%` : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Weighted ADR</span>
                      <span className="font-medium">{forecast.weightedAdr ? `AED ${forecast.weightedAdr}` : "—"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Content split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="bg-muted/20 border-b border-border">
                    <CardTitle className="font-serif">Scenario Comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 h-[350px]">
                    {!scenarios || scenarios.length === 0 ? (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No scenarios generated yet. Run a calculation to see results.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scenarios} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `AED ${val / 1000}k`} />
                          <Tooltip
                            formatter={(value: number) => formatCurrency(value)}
                            cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                            contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                          />
                          <Bar dataKey="netOwnerIncome" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={60} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <Card className="border-border/50 shadow-sm h-full">
                  <CardHeader className="bg-muted/20 border-b border-border">
                    <CardTitle className="font-serif text-lg">Forecast Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" /> AI Optimizer
                      </h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Run the AI engine to generate optimized ADRs based on market comps.
                      </p>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">Run Optimizer</Button>
                    </div>
                    <div className="space-y-3 pt-4 border-t border-border/50">
                      <Button variant="outline" className="w-full justify-start text-left">
                        <Send className="h-4 w-4 mr-2" /> Request Approval
                      </Button>
                      <Button variant="outline" className="w-full justify-start text-left">
                        <FileText className="h-4 w-4 mr-2" /> Download PDF Internal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Monthly mini chart if available */}
            {monthly && monthly.length > 0 && (
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="bg-muted/20 border-b border-border">
                  <CardTitle className="font-serif">Monthly Revenue Overview</CardTitle>
                </CardHeader>
                <CardContent className="p-6 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `${val / 1000}k`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                      />
                      <Bar dataKey="grossRevenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="inputs">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="bg-muted/20 border-b border-border">
                <CardTitle className="font-serif">Financial Inputs</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">ADR Settings</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Low Season ADR</span><span className="font-medium">AED {forecast.lowSeasonAdr ?? "—"}</span></div>
                      <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Shoulder Season ADR</span><span className="font-medium">AED {forecast.shoulderSeasonAdr ?? "—"}</span></div>
                      <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Peak Season ADR</span><span className="font-medium">AED {forecast.peakSeasonAdr ?? "—"}</span></div>
                      <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Event Season ADR</span><span className="font-medium">AED {forecast.eventAdr ?? "—"}</span></div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium mb-4 text-sm text-muted-foreground uppercase tracking-wide">Expenses & Fees</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Management Fee</span><span className="font-medium">{forecast.managementFeePercent}%</span></div>
                      <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Annual LTR</span><span className="font-medium">AED {forecast.annualLtr?.toLocaleString() ?? "—"}</span></div>
                      <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Internet</span><span className="font-medium">AED {forecast.internetCost?.toLocaleString() ?? "—"}</span></div>
                      <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Utilities</span><span className="font-medium">AED {forecast.utilityCost?.toLocaleString() ?? "—"}</span></div>
                      <div className="flex justify-between py-2 border-b border-border/50"><span className="text-muted-foreground">Maintenance</span><span className="font-medium">AED {forecast.maintenanceCost?.toLocaleString() ?? "—"}</span></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monthly">
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="bg-muted/20 border-b border-border">
                <CardTitle className="font-serif">Monthly Projections</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!monthly || monthly.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p>Run a calculation to generate monthly projections.</p>
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Month</th>
                          <th className="px-4 py-3 text-right font-medium">Available Nights</th>
                          <th className="px-4 py-3 text-right font-medium">Occupied</th>
                          <th className="px-4 py-3 text-right font-medium">Occupancy</th>
                          <th className="px-4 py-3 text-right font-medium">ADR</th>
                          <th className="px-4 py-3 text-right font-medium">Gross Revenue</th>
                          <th className="px-4 py-3 text-right font-medium">Net Income</th>
                          <th className="px-4 py-3 text-left font-medium">Season</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {monthly.map((m) => (
                          <tr key={m.month} className="hover:bg-muted/20">
                            <td className="px-4 py-3 font-medium">{m.monthName}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{m.availableNights}</td>
                            <td className="px-4 py-3 text-right text-muted-foreground">{m.occupiedNights}</td>
                            <td className="px-4 py-3 text-right">{Math.round((m.occupancyRate as number) * 100)}%</td>
                            <td className="px-4 py-3 text-right">AED {m.adr}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(m.grossRevenue)}</td>
                            <td className="px-4 py-3 text-right font-medium text-primary">{formatCurrency(m.netOwnerIncome)}</td>
                            <td className="px-4 py-3 capitalize text-muted-foreground text-xs">{m.seasonType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scenarios">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-8 text-center text-muted-foreground">
                Scenarios management will be rendered here.
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="ai">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-8 text-center text-muted-foreground">
                AI suggestions and overrides will be rendered here.
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="proposal">
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-8 text-center text-muted-foreground">
                Proposal narrative editor will be rendered here.
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
