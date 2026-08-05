import { useState, useEffect, useRef } from "react";
import {
  useGetForecast, useUpdateForecast, useCalculateForecast,
  useListForecastScenarios, useGetForecastMonthly, useUpdateMonthlyOverride,
  useGenerateAiRecommendation, useGenerateNarrativeDraft, useListProposals, usePublishProposal,
  useUpdateProposal,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import ProposalCoverPreview from "@/components/ProposalCoverPreview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Save, Share, Copy, TrendingUp, DollarSign, Target,
  Building, Calendar, Sparkles, Calculator, Loader2, CheckCircle2,
  Send, FileText, Globe, Eye, Printer,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

// Abu Dhabi seasonal weights (months per season out of 12)
const SEASON_WEIGHTS = { low: 3, shoulder: 4, peak: 4, event: 1 }; // Jun-Aug | Apr,May,Sep,Oct | Nov,Jan,Feb,Mar | Dec

function computeWeightedAdr(low: number, shoulder: number, peak: number, event: number): number {
  const total = SEASON_WEIGHTS.low + SEASON_WEIGHTS.shoulder + SEASON_WEIGHTS.peak + SEASON_WEIGHTS.event;
  return Math.round((low * SEASON_WEIGHTS.low + shoulder * SEASON_WEIGHTS.shoulder + peak * SEASON_WEIGHTS.peak + event * SEASON_WEIGHTS.event) / total);
}

const OCCUPANCY_LEVELS = [1.0, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70];

interface FormValues {
  annualLtr: number;
  ltrVacancyPercent: number;
  lowSeasonAdr: number;
  shoulderSeasonAdr: number;
  peakSeasonAdr: number;
  eventAdr: number;
  utilityCost: number;
  internetCost: number;
  maintenanceCost: number;
  miscCost: number;
  managementFeePercent: number;
  ownerBlockedNights: number;
  recommendedOccupancy: number;
}

function fmt(val?: number | null, opts?: { digits?: number }) {
  if (val == null || isNaN(val)) return "—";
  return new Intl.NumberFormat("en-AE", {
    style: "currency", currency: "AED",
    maximumFractionDigits: opts?.digits ?? 0,
  }).format(val);
}

function getStatusColor(status: string) {
  switch (status) {
    case "published": return "bg-primary/20 text-primary border-primary/30";
    case "accepted": return "bg-green-500/20 text-green-700 border-green-500/30";
    case "declined": return "bg-red-500/20 text-red-700 border-red-500/30";
    case "submitted": return "bg-amber-500/20 text-amber-700 border-amber-500/30";
    case "draft": return "bg-gray-400/20 text-gray-600 border-gray-400/30";
    default: return "bg-secondary/20 text-secondary-foreground border-secondary/30";
  }
}

// ── Monthly Projections Tab — inline editable Occupancy % and ADR ─────────────
function MonthlyProjectionsTab({ forecastId, monthly }: {
  forecastId: number;
  monthly: any[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateOverride = useUpdateMonthlyOverride();

  // Local editing state: { [monthId]: { occupancy: string; adr: string } }
  const [editing, setEditing] = useState<Record<number, { occupancy: string; adr: string }>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});

  function startEdit(m: any) {
    setEditing(prev => ({
      ...prev,
      [m.month]: {
        occupancy: String(Math.round((m.occupancyRate ?? 0) * 100)),
        adr: String(Math.round(m.adr ?? 0)),
      },
    }));
  }

  function cancelEdit(key: number) {
    setEditing(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  // Key by month number (1–12) — stable across recalculations, unlike row id
  async function saveOverride(m: any) {
    const key = m.month as number;
    const e = editing[key];
    if (!e) return;

    const occPct   = parseFloat(e.occupancy);
    const adrVal   = parseFloat(e.adr);

    if (isNaN(occPct) || occPct < 0 || occPct > 100) { toast({ title: "Invalid occupancy", description: "Enter a value between 0 and 100.", variant: "destructive" }); return; }
    if (isNaN(adrVal) || adrVal < 0) { toast({ title: "Invalid ADR", description: "Enter a positive number.", variant: "destructive" }); return; }

    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updateOverride.mutateAsync({
        forecastId,
        monthNum: key,
        data: { occupancyOverride: occPct / 100, adrOverride: adrVal },
      });
      cancelEdit(key);
      queryClient.invalidateQueries({ queryKey: [`/api/forecasts/${forecastId}/monthly`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forecasts/${forecastId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forecasts/${forecastId}/scenarios`] });
      toast({ title: "Override saved", description: `${m.monthName} updated and recalculated.` });
    } catch {
      toast({ title: "Save failed", description: "Could not save override.", variant: "destructive" });
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  }

  async function clearOverride(m: any) {
    const key = m.month as number;
    setSaving(prev => ({ ...prev, [key]: true }));
    try {
      await updateOverride.mutateAsync({
        forecastId,
        monthNum: key,
        data: { occupancyOverride: null, adrOverride: null },
      });
      cancelEdit(key);
      queryClient.invalidateQueries({ queryKey: [`/api/forecasts/${forecastId}/monthly`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forecasts/${forecastId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forecasts/${forecastId}/scenarios`] });
      toast({ title: "Override cleared", description: `${m.monthName} restored to calculated values.` });
    } catch {
      toast({ title: "Failed", description: "Could not clear override.", variant: "destructive" });
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  }

  const hasAnyOverride = monthly.some(m => m.occupancyOverride != null || m.adrOverride != null);

  if (!monthly || monthly.length === 0) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
          <CardTitle className="font-serif text-base">Monthly Projections</CardTitle>
        </CardHeader>
        <CardContent className="p-12 text-center text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium">No monthly data yet</p>
          <p className="text-sm mt-1">Fill in the Data Inputs tab and click <strong>Save & Calculate</strong></p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-serif text-base">Monthly Projections</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Click any Occupancy % or ADR cell to override it for that month</p>
          </div>
          {hasAnyOverride && (
            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-1 rounded-full font-medium border border-amber-200 dark:border-amber-800">
              ✦ Overrides active
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Month</th>
                <th className="px-4 py-3 text-left font-medium">Season</th>
                <th className="px-4 py-3 text-right font-medium">Available</th>
                <th className="px-4 py-3 text-right font-medium">Occupied</th>
                <th className="px-4 py-3 text-right font-medium text-amber-600 dark:text-amber-400">Occupancy %</th>
                <th className="px-4 py-3 text-right font-medium text-amber-600 dark:text-amber-400">ADR</th>
                <th className="px-4 py-3 text-right font-medium">Gross Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-primary">Net Income</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">vs LTR</th>
                <th className="px-4 py-2 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthly.map((m: any) => {
                const key = m.month as number;
                const isEditing = !!editing[key];
                const isSaving  = !!saving[key];
                const hasOccOverride = m.occupancyOverride != null;
                const hasAdrOverride = m.adrOverride != null;
                const hasOverride = hasOccOverride || hasAdrOverride;
                const e = editing[key];

                return (
                  <tr key={m.month} className={`hover:bg-muted/20 transition-colors ${hasOverride ? "bg-amber-50/40 dark:bg-amber-900/5" : ""}`}>
                    <td className="px-4 py-2.5 font-medium">{m.monthName}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                        m.seasonType === "peak"   ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20" :
                        m.seasonType === "low"    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20" :
                        m.seasonType === "event"  ? "bg-red-100 text-red-700 dark:bg-red-900/20" :
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20"
                      }`}>{m.seasonType}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{m.availableNights}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{Math.round((m.occupiedNights ?? 0) * 10) / 10}</td>

                    {/* Occupancy — editable */}
                    <td className="px-2 py-1.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            autoFocus
                            type="number" min={0} max={100} step={1}
                            className="w-20 h-7 text-right text-xs px-2"
                            value={e.occupancy}
                            onChange={ev => setEditing(prev => ({ ...prev, [key]: { ...prev[key], occupancy: ev.target.value } }))}
                            onKeyDown={ev => { if (ev.key === "Enter") saveOverride(m); if (ev.key === "Escape") cancelEdit(key); }}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(m)}
                          title="Click to override"
                          className={`group flex items-center justify-end gap-1.5 w-full text-right hover:text-amber-600 transition-colors ${hasOccOverride ? "text-amber-600 font-semibold" : ""}`}
                        >
                          {hasOccOverride && <span className="text-[9px] text-amber-500">✦</span>}
                          <span>{Math.round((m.occupancyRate ?? 0) * 100)}%</span>
                          <span className="opacity-0 group-hover:opacity-60 text-[10px]">✎</span>
                        </button>
                      )}
                    </td>

                    {/* ADR — editable */}
                    <td className="px-2 py-1.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number" min={0} step={1}
                            className="w-24 h-7 text-right text-xs px-2"
                            value={e.adr}
                            onChange={ev => setEditing(prev => ({ ...prev, [key]: { ...prev[key], adr: ev.target.value } }))}
                            onKeyDown={ev => { if (ev.key === "Enter") saveOverride(m); if (ev.key === "Escape") cancelEdit(key); }}
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(m)}
                          title="Click to override"
                          className={`group flex items-center justify-end gap-1.5 w-full text-right hover:text-amber-600 transition-colors ${hasAdrOverride ? "text-amber-600 font-semibold" : ""}`}
                        >
                          {hasAdrOverride && <span className="text-[9px] text-amber-500">✦</span>}
                          <span>AED {Math.round(m.adr ?? 0).toLocaleString()}</span>
                          <span className="opacity-0 group-hover:opacity-60 text-[10px]">✎</span>
                        </button>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-right font-medium">{fmt(m.grossRevenue)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-primary">{fmt(m.netOwnerIncome)}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">{m.ltrBenchmark ? fmt(m.ltrBenchmark) : "—"}</td>

                    {/* Row actions */}
                    <td className="px-2 py-1.5">
                      {isEditing ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => cancelEdit(key)} disabled={isSaving}>✕</Button>
                          <Button size="sm" className="h-7 px-2 text-xs bg-primary" onClick={() => saveOverride(m)} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                          </Button>
                        </div>
                      ) : hasOverride ? (
                        <button
                          onClick={() => clearOverride(m)}
                          disabled={isSaving}
                          title="Clear override — restore calculated value"
                          className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/10"
                        >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "Reset"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/30 border-t-2 border-border font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={6}>Annual Total</td>
                <td className="px-4 py-3 text-right">{fmt(monthly.reduce((s: number, m: any) => s + (m.grossRevenue ?? 0), 0))}</td>
                <td className="px-4 py-3 text-right text-primary">{fmt(monthly.reduce((s: number, m: any) => s + (m.netOwnerIncome ?? 0), 0))}</td>
                <td className="px-4 py-3 text-right text-muted-foreground text-xs">{monthly[0]?.ltrBenchmark ? fmt(monthly.reduce((s: number, m: any) => s + (m.ltrBenchmark ?? 0), 0)) : "—"}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-4 border-t border-border/50 bg-muted/10 flex items-start gap-2">
          <span className="text-amber-500 text-xs mt-0.5">✦</span>
          <p className="text-xs text-muted-foreground">
            <strong>Overridden months</strong> are highlighted and marked with ✦. Changes are saved immediately and recalculate all totals, scenarios, and the proposal. Click <strong>Reset</strong> on any row to restore the calculated value.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// hint: Logic changed on both sides. Requires understanding intent of each change.
export default function ForecastDetail() {
  const { id } = useParams<{ id: string }>();
  const forecastId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: forecast, isLoading } = useGetForecast(forecastId);
  const { data: scenarios } = useListForecastScenarios(forecastId);
  const { data: monthly } = useGetForecastMonthly(forecastId);

  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [proposalTab, setProposalTab] = useState<"share" | null>(null);
  const [activeTab, setActiveTab] = useState("inputs");

  const updateForecast = useUpdateForecast();
  const calculateForecast = useCalculateForecast();
  const aiRecommend = useGenerateAiRecommendation();
  const publishProposal = usePublishProposal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: proposals } = useListProposals({
    query: { refetchInterval: activeTab === "proposal" ? 30_000 : false } as any,
  });

  const proposal = proposals?.find((p: any) => p.forecastId === forecastId);
  const hasShareLink = !!(proposal?.shareUrl && proposal?.isLinkActive);

  const updateProposal = useUpdateProposal();
  const generateNarrativeDraft = useGenerateNarrativeDraft();
  const [narrativeText, setNarrativeText] = useState("");
  const [narrativeSaved, setNarrativeSaved] = useState(false);

  // Toast when the owner opens the proposal while staff is on the Proposal tab
  const prevProposalViewsRef = useRef<number | null>(null);
  useEffect(() => {
    if (!proposal) return;
    const current = proposal.totalViews ?? 0;
    if (prevProposalViewsRef.current !== null && current > prevProposalViewsRef.current) {
      toast({
        title: "Owner just viewed the proposal",
        description: `${proposal.referenceNumber} was opened — this is a great moment to follow up.`,
        duration: 8000,
      });
    }
    prevProposalViewsRef.current = current;
  }, [proposal?.totalViews]);

  // Sync narrative from proposal when it loads
  useEffect(() => {
    if (proposal?.coverNarrative != null) {
      setNarrativeText(proposal.coverNarrative);
    }
  }, [proposal?.id, proposal?.coverNarrative]);

  const form = useForm<FormValues>({
    defaultValues: {
      annualLtr: 0, ltrVacancyPercent: 10,
      lowSeasonAdr: 0, shoulderSeasonAdr: 0, peakSeasonAdr: 0, eventAdr: 0,
      utilityCost: 0, internetCost: 0, maintenanceCost: 0, miscCost: 0,
      managementFeePercent: 17, ownerBlockedNights: 0, recommendedOccupancy: 80,
    },
  });

  const values = form.watch();

  // Populate form when forecast loads
  useEffect(() => {
    if (forecast) {
      form.reset({
        annualLtr: forecast.annualLtr ?? 0,
        ltrVacancyPercent: forecast.ltrVacancyPercent ?? 10,
        lowSeasonAdr: forecast.lowSeasonAdr ?? 0,
        shoulderSeasonAdr: forecast.shoulderSeasonAdr ?? 0,
        peakSeasonAdr: forecast.peakSeasonAdr ?? 0,
        eventAdr: forecast.eventAdr ?? 0,
        utilityCost: forecast.utilityCost ?? 0,
        internetCost: forecast.internetCost ?? 0,
        maintenanceCost: forecast.maintenanceCost ?? 0,
        miscCost: forecast.miscCost ?? 0,
        managementFeePercent: forecast.managementFeePercent ?? 17,
        ownerBlockedNights: forecast.ownerBlockedNights ?? 0,
        recommendedOccupancy: forecast.recommendedOccupancy != null
          ? Math.round((forecast.recommendedOccupancy as number) * 100)
          : 80,
      });
      setIsDirty(false);
    }
  }, [forecast]);

  // Track dirty state
  useEffect(() => {
    const sub = form.watch(() => setIsDirty(true));
    return () => sub.unsubscribe();
  }, [form]);

  // Derived live calculations
  const weightedAdr = computeWeightedAdr(values.lowSeasonAdr, values.shoulderSeasonAdr, values.peakSeasonAdr, values.eventAdr);
  const ltrMonthly = values.annualLtr / 12;
  const ltrEffective = values.annualLtr * (1 - (values.ltrVacancyPercent ?? 10) / 100);
  const ltrMonthlyEffective = ltrEffective / 12;
  const totalAnnualExpenses = values.utilityCost + values.internetCost + values.maintenanceCost + values.miscCost;
  const totalMonthlyExpenses = totalAnnualExpenses / 12;

  // Scenario computations
  function computeScenario(occ: number) {
    const gross = weightedAdr * 365 * occ;
    const mgmtFee = gross * (values.managementFeePercent / 100);
    const net = gross - mgmtFee - totalAnnualExpenses;
    const monthly = net / 12;
    const vsLtr = ltrEffective > 0 ? ((net - ltrEffective) / ltrEffective) * 100 : null;
    return { gross, mgmtFee, net, monthly, vsLtr };
  }

  function buildUpdatePayload() {
    return {
      annualLtr: values.annualLtr || undefined,
      ltrVacancyPercent: values.ltrVacancyPercent,
      lowSeasonAdr: values.lowSeasonAdr || undefined,
      shoulderSeasonAdr: values.shoulderSeasonAdr || undefined,
      peakSeasonAdr: values.peakSeasonAdr || undefined,
      eventAdr: values.eventAdr || undefined,
      utilityCost: values.utilityCost || undefined,
      internetCost: values.internetCost || undefined,
      maintenanceCost: values.maintenanceCost || undefined,
      miscCost: values.miscCost || undefined,
      managementFeePercent: values.managementFeePercent,
      ownerBlockedNights: values.ownerBlockedNights,
      recommendedOccupancy: (values.recommendedOccupancy ?? 80) / 100,
    };
  }

  /** Invalidate all referee-commission queries so the referees list/detail stays fresh. */
  function invalidateCommissionQueries() {
    queryClient.invalidateQueries({
      predicate: (query) =>
        typeof query.queryKey[0] === "string" &&
        (query.queryKey[0] as string).startsWith("/api/referees"),
    });
  }

  async function handleSave() {
    try {
      await updateForecast.mutateAsync({ id: forecastId, data: buildUpdatePayload() });
      setIsDirty(false);
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["getForecast", forecastId] });
      // managementFeePercent affects commission figures — bust referee caches
      invalidateCommissionQueries();
      toast({ title: "Inputs saved", description: "Your inputs have been saved as a draft." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  }

  async function handleCalculate() {
    try {
      // First save inputs
      await updateForecast.mutateAsync({ id: forecastId, data: buildUpdatePayload() });
      // Then calculate
      await calculateForecast.mutateAsync({ id: forecastId });
      setIsDirty(false);
      setLastSaved(new Date());
      // Refresh all forecast data
      queryClient.invalidateQueries({ queryKey: ["getForecast", forecastId] });
      queryClient.invalidateQueries({ queryKey: ["listForecastScenarios", forecastId] });
      queryClient.invalidateQueries({ queryKey: [`/api/forecasts/${forecastId}/monthly`] });
      // grossAnnualRevenue changed — commission figures for referees are now stale
      invalidateCommissionQueries();
      toast({ title: "Calculation complete", description: "Revenue projections and scenarios have been updated." });
    } catch (e: any) {
      const msg = e?.data?.error ?? "Calculation failed. Ensure all ADR values are filled in.";
      toast({ title: "Calculation failed", description: msg, variant: "destructive" });
    }
  }

  async function handlePublishProposal() {
    if (!proposal) { toast({ title: "No proposal record found", variant: "destructive" }); return; }
    try {
      const result = await publishProposal.mutateAsync({ id: proposal.id, data: { expiresInDays: 30 } });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: "Proposal published!", description: "Share link is now active." });
      const shareUrl = window.location.origin + result.shareUrl;
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
    } catch {
      toast({ title: "Failed to publish proposal", variant: "destructive" });
    }
  }

  async function handleRequestApproval() {
    try {
      await updateForecast.mutateAsync({ id: forecastId, data: { status: "submitted" } });
      queryClient.invalidateQueries({ queryKey: ["getForecast", forecastId] });
      toast({ title: "Approval requested", description: "The forecast has been submitted for approval." });
    } catch {
      toast({ title: "Failed to submit", variant: "destructive" });
    }
  }

  async function handleAiOptimizer() {
    try {
      const rec = await aiRecommend.mutateAsync({ id: forecastId });
      // Pre-fill form with AI suggested values
      if (rec.lowSeasonAdrSuggested != null)      form.setValue("lowSeasonAdr", rec.lowSeasonAdrSuggested);
      if (rec.shoulderSeasonAdrSuggested != null)  form.setValue("shoulderSeasonAdr", rec.shoulderSeasonAdrSuggested);
      if (rec.peakSeasonAdrSuggested != null)      form.setValue("peakSeasonAdr", rec.peakSeasonAdrSuggested);
      if (rec.eventAdrSuggested != null)           form.setValue("eventAdr", rec.eventAdrSuggested);
      if (rec.occupancySuggested != null)          form.setValue("recommendedOccupancy", Math.round(rec.occupancySuggested * 100));
      if (rec.internetCostSuggested != null)       form.setValue("internetCost", rec.internetCostSuggested);
      if (rec.utilityCostSuggested != null)        form.setValue("utilityCost", rec.utilityCostSuggested);
      if (rec.maintenanceCostSuggested != null)    form.setValue("maintenanceCost", rec.maintenanceCostSuggested);
      if (rec.managementFeeSuggested != null)      form.setValue("managementFeePercent", rec.managementFeeSuggested);
      if (rec.annualLtrSuggested != null)          form.setValue("annualLtr", rec.annualLtrSuggested);
      setIsDirty(true);
      toast({ title: "AI suggestions applied", description: "Fields pre-filled from comparable properties. Review and calculate." });
    } catch {
      toast({ title: "AI optimizer failed", variant: "destructive" });
    }
  }

  async function handleGenerateDraft() {
    try {
      const result = await generateNarrativeDraft.mutateAsync({ id: forecastId });
      setNarrativeText(result.draft);
      setNarrativeSaved(false);
      toast({ title: "Draft generated", description: "AI draft applied — review and edit before saving." });
    } catch {
      toast({ title: "Draft generation failed", description: "Ensure the forecast has been calculated first.", variant: "destructive" });
    }
  }

  async function handleSaveNarrative() {
    if (!proposal) { toast({ title: "No proposal record found", variant: "destructive" }); return; }
    try {
      await updateProposal.mutateAsync({ id: proposal.id, data: { coverNarrative: narrativeText } });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
      setNarrativeSaved(true);
      setTimeout(() => setNarrativeSaved(false), 3000);
      toast({ title: "Narrative saved", description: "The cover narrative has been updated on the proposal." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    }
  }

  const isSaving = updateForecast.isPending;
  const isCalculating = calculateForecast.isPending || isSaving;
  const isAi = aiRecommend.isPending;

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading forecast...</div>;
  if (!forecast) return <div className="p-8 text-center text-red-500">Forecast not found.</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.0))] w-full">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background z-10 sticky top-0 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/forecasts" className="p-2 -ml-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-serif font-bold text-foreground">{forecast.referenceNumber}</h1>
              <Badge variant="outline" className={`capitalize text-xs ${getStatusColor(forecast.status)}`}>
                {forecast.status.replace(/_/g, " ")}
              </Badge>
              {lastSaved && !isDirty && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" /> Saved
                </span>
              )}
              {isDirty && <span className="text-xs text-amber-500">Unsaved changes</span>}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(forecast as any).ownerName}{(forecast as any).ownerName && " · "}{(forecast as any).propertyAddress}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button
            size="sm"
            onClick={handleCalculate}
            disabled={isCalculating}
            className="gap-2"
          >
            {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            Save & Calculate
          </Button>
          <Button
            variant="default" size="sm" className="gap-2 bg-primary/90 hover:bg-primary"
            onClick={handlePublishProposal}
            disabled={publishProposal.isPending || !forecast?.grossAnnualRevenue}
            title={!forecast?.grossAnnualRevenue ? "Run Save & Calculate first" : ""}
          >
            {publishProposal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share className="h-4 w-4" />}
            {hasShareLink ? "Reshare Proposal" : "Generate Proposal"}
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
          <div className="px-6 pt-4 border-b border-border bg-background sticky top-0 z-10">
            <TabsList className="grid grid-cols-5 max-w-[700px]">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="inputs">Data Inputs</TabsTrigger>
              <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="proposal">Proposal</TabsTrigger>
            </TabsList>
          </div>

          {/* ── SUMMARY ── */}
          <TabsContent value="summary" className="p-6 space-y-6 max-w-[1400px] mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Gross Revenue</h3>
                    <div className="p-2 bg-primary/10 rounded-md"><DollarSign className="h-4 w-4 text-primary" /></div>
                  </div>
                  <div className="text-2xl font-bold">{fmt(forecast.grossAnnualRevenue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Projected annual top-line</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm bg-primary/5 border-primary/10">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-primary/80">Net Owner Income</h3>
                    <div className="p-2 bg-primary/10 rounded-md"><Target className="h-4 w-4 text-primary" /></div>
                  </div>
                  <div className="text-2xl font-bold text-primary">{fmt(forecast.netOwnerIncome)}</div>
                  <p className="text-xs text-muted-foreground mt-1">After all expenses & fees</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground">vs LTR Benchmark</h3>
                    <div className="p-2 bg-muted rounded-md"><Building className="h-4 w-4 text-muted-foreground" /></div>
                  </div>
                  <div className={`text-2xl font-bold ${(forecast.increaseVsLtrPct ?? 0) > 0 ? "text-green-600" : "text-red-500"}`}>
                    {forecast.increaseVsLtrPct != null ? `${forecast.increaseVsLtrPct > 0 ? "+" : ""}${Math.round(forecast.increaseVsLtrPct)}%` : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Net increase over LTR</p>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Key Metrics</h3>
                    <div className="p-2 bg-muted rounded-md"><TrendingUp className="h-4 w-4 text-muted-foreground" /></div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Occupancy</span><span className="font-medium">{forecast.recommendedOccupancy != null ? `${Math.round((forecast.recommendedOccupancy as number) * 100)}%` : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Weighted ADR</span><span className="font-medium">{forecast.weightedAdr ? `AED ${forecast.weightedAdr}` : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Monthly Avg</span><span className="font-medium">{forecast.netOwnerIncome ? fmt(forecast.netOwnerIncome / 12) : "—"}</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {(!forecast.grossAnnualRevenue) && (
              <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
                <CardContent className="p-5 flex items-center gap-4">
                  <Calculator className="h-8 w-8 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-400">No calculation run yet</p>
                    <p className="text-sm text-amber-700 dark:text-amber-500 mt-0.5">Fill in your ADR values and expenses in the <strong>Data Inputs</strong> tab, then click <strong>Save & Calculate</strong> to generate projections.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                    <CardTitle className="font-serif text-base">Scenario Comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 h-[280px]">
                    {!scenarios || scenarios.length === 0 || !scenarios[0].netOwnerIncome ? (
                      <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Run a calculation to see results.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scenarios} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px" }} />
                          <Bar dataKey="netOwnerIncome" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={60} name="Net Owner Income" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {monthly && monthly.length > 0 && (
                  <Card className="border-border/50 shadow-sm">
                    <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                      <CardTitle className="font-serif text-base">Monthly Revenue Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthly} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="monthName" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", fontSize: "12px" }} />
                          <Bar dataKey="grossRevenue" fill="hsl(var(--primary)/0.8)" radius={[3, 3, 0, 0]} name="Gross Revenue" />
                          <Bar dataKey="netOwnerIncome" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Net Income" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Forecast Actions sidebar */}
              <div className="lg:col-span-1">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                    <CardTitle className="font-serif text-base">Forecast Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <h4 className="font-medium flex items-center gap-2 mb-2 text-sm">
                        <Sparkles className="h-4 w-4 text-primary" /> AI Optimizer
                      </h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Generate optimized ADRs from market comps. Pre-fills the Data Inputs form.
                      </p>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={handleAiOptimizer}
                        disabled={isAi}
                        size="sm"
                      >
                        {isAi ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : "Run Optimizer"}
                      </Button>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start text-left gap-2"
                        onClick={handleRequestApproval}
                        disabled={isSaving || forecast.status === "submitted" || forecast.status === "approved"}
                      >
                        <Send className="h-4 w-4" />
                        {forecast.status === "submitted" ? "Approval Requested" : "Request Approval"}
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left gap-2">
                        <FileText className="h-4 w-4" /> Download PDF Internal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ── DATA INPUTS ── */}
          <TabsContent value="inputs" className="p-6 max-w-[1200px] mx-auto">
            <div className="space-y-6">
              {/* LTR Section */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary" />
                    Long-Term Rental (LTR) Benchmark
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Annual Market Rent (AED)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="e.g. 150,000"
                        {...form.register("annualLtr", { valueAsNumber: true })}
                        className="h-11 text-base"
                      />
                      <p className="text-xs text-muted-foreground">Traditional annual rent value from market</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Lease Vacancy Gap (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="50"
                        placeholder="10"
                        {...form.register("ltrVacancyPercent", { valueAsNumber: true })}
                        className="h-11 text-base"
                      />
                      <p className="text-xs text-muted-foreground">10% gap on every 5-year lease cycle</p>
                    </div>
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">LTR Preview</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Monthly (gross)</span>
                          <span className="font-semibold">{values.annualLtr > 0 ? fmt(ltrMonthly) : "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Effective with vacancy</span>
                          <span className="font-semibold text-primary">{values.annualLtr > 0 ? fmt(ltrMonthlyEffective) : "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Annual effective</span>
                          <span className="font-semibold">{values.annualLtr > 0 ? fmt(ltrEffective) : "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ADR Section */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Average Daily Rate (ADR) by Season
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: "Low Season", key: "lowSeasonAdr" as const, hint: "Jun · Jul · Aug", color: "bg-blue-50 border-blue-200 dark:bg-blue-900/10" },
                      { label: "Shoulder Season", key: "shoulderSeasonAdr" as const, hint: "Apr · May · Sep · Oct", color: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10" },
                      { label: "Peak Season", key: "peakSeasonAdr" as const, hint: "Nov · Jan · Feb · Mar", color: "bg-orange-50 border-orange-200 dark:bg-orange-900/10" },
                      { label: "Events / Special", key: "eventAdr" as const, hint: "Dec (F1 · NYE)", color: "bg-red-50 border-red-200 dark:bg-red-900/10" },
                    ].map(({ label, key, hint, color }) => (
                      <div key={key} className={`p-4 rounded-lg border ${color} space-y-2`}>
                        <Label className="text-xs font-semibold uppercase tracking-wide">{label}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">AED</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            {...form.register(key, { valueAsNumber: true })}
                            className="pl-12 h-11 text-base font-semibold bg-background"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{hint}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estimated Weighted Average ADR</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Weighted by Abu Dhabi seasonal calendar (3/4/4/1 months)</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary">
                        {weightedAdr > 0 ? `AED ${weightedAdr.toLocaleString()}` : "—"}
                      </div>
                      {weightedAdr > 0 && <p className="text-xs text-muted-foreground">per occupied night</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expenses Section */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Annual Operating Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: "Utility Bills", key: "utilityCost" as const, hint: "Electricity, water, AC" },
                      { label: "Internet / Phone", key: "internetCost" as const, hint: "Broadband, SIM" },
                      { label: "Maintenance", key: "maintenanceCost" as const, hint: "Repairs, upkeep" },
                      { label: "Miscellaneous", key: "miscCost" as const, hint: "Supplies, other" },
                    ].map(({ label, key, hint }) => (
                      <div key={key} className="space-y-2">
                        <Label className="text-sm font-medium">{label}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">AED</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            {...form.register(key, { valueAsNumber: true })}
                            className="pl-12 h-11"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{hint} · annual</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Monthly Expenses</span>
                      <span className="font-semibold text-sm">{fmt(totalMonthlyExpenses)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Annual Expenses</span>
                      <span className="font-semibold text-sm">{fmt(totalAnnualExpenses)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PM Commission & Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                    <CardTitle className="font-serif text-base">Property Management Fee</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">PM Commission (%)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="50"
                          step="0.5"
                          placeholder="17"
                          {...form.register("managementFeePercent", { valueAsNumber: true })}
                          className="h-11 text-base pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Charged on gross STR revenue</p>
                    </div>
                    {weightedAdr > 0 && (
                      <div className="p-3 bg-muted/30 rounded-md text-sm space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">At 80% occupancy preview</p>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Gross Revenue</span>
                          <span className="font-medium">{fmt(weightedAdr * 365 * 0.8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Management Fee</span>
                          <span className="font-medium text-red-600">-{fmt(weightedAdr * 365 * 0.8 * values.managementFeePercent / 100)}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                    <CardTitle className="font-serif text-base">Additional Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Owner Blocked Nights (annual)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="365"
                        placeholder="0"
                        {...form.register("ownerBlockedNights", { valueAsNumber: true })}
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">Nights reserved for owner use (reduces available inventory)</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Target Occupancy Rate (%)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="80"
                          {...form.register("recommendedOccupancy", { valueAsNumber: true })}
                          className="h-11 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Used as the base occupancy rate for calculations</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action bar */}
              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-lg border border-border/50">
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={handleAiOptimizer}
                    disabled={isAi}
                    className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
                  >
                    {isAi ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> AI Optimizer</>}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRequestApproval}
                    disabled={isSaving || forecast.status === "submitted" || forecast.status === "approved"}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {forecast.status === "submitted" ? "Approval Requested" : "Request Approval"}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    {isDirty ? "You have unsaved changes." : lastSaved ? `Last saved ${lastSaved.toLocaleTimeString()}` : "Fill in all fields above, then calculate."}
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleSave} disabled={isSaving || !isDirty} className="gap-2">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Draft
                  </Button>
                  <Button onClick={handleCalculate} disabled={isCalculating} className="gap-2 min-w-[180px]">
                    {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                    {isCalculating ? "Calculating…" : "Save & Calculate"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── SCENARIOS ── */}
          <TabsContent value="scenarios" className="p-6 max-w-[1400px] mx-auto space-y-6">
            {/* Live preview note */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Sparkles className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-400">Live preview</p>
                <p className="text-xs text-blue-700 dark:text-blue-500 mt-0.5">
                  This table is computed in real time from your current inputs using the weighted average ADR (AED {weightedAdr > 0 ? weightedAdr.toLocaleString() : "—"}). Click <strong>Save & Calculate</strong> to store the official results and generate monthly projections.
                </p>
              </div>
            </div>

            {/* LTR Benchmark header */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">LTR Annual (Market Rate)</p>
                    <p className="text-2xl font-bold mt-1">{values.annualLtr > 0 ? fmt(values.annualLtr) : "—"}</p>
                  </div>
                  <Building className="h-8 w-8 text-muted-foreground/30" />
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-sm bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">LTR Effective (with {values.ltrVacancyPercent ?? 10}% vacancy)</p>
                    <p className="text-2xl font-bold mt-1">{values.annualLtr > 0 ? fmt(ltrEffective) : "—"}</p>
                  </div>
                  <Building className="h-8 w-8 text-amber-400/50" />
                </CardContent>
              </Card>
            </div>

            {/* Income Calculator table */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                <CardTitle className="font-serif text-base">Income Calculator — Occupancy Scenarios</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-5 py-3 text-left font-semibold text-muted-foreground">Metric</th>
                      {OCCUPANCY_LEVELS.map(occ => (
                        <th key={occ} className={`px-5 py-3 text-right font-semibold ${occ === 0.85 ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                          {Math.round(occ * 100)}%
                          {occ === 0.85 && <div className="text-[10px] font-normal mt-0.5">Confident</div>}
                          {occ === 0.80 && <div className="text-[10px] font-normal mt-0.5">Realistic</div>}
                          {occ === 0.75 && <div className="text-[10px] font-normal mt-0.5">Conservative</div>}
                          {occ === 0.90 && <div className="text-[10px] font-normal mt-0.5">Optimistic</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="bg-muted/20">
                      <td colSpan={OCCUPANCY_LEVELS.length + 1} className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">INCOME</td>
                    </tr>
                    <tr className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 font-medium">Gross Annual Revenue (AED)</td>
                      {OCCUPANCY_LEVELS.map(occ => {
                        const s = computeScenario(occ);
                        return (
                          <td key={occ} className={`px-5 py-3 text-right font-semibold tabular-nums ${occ === 0.85 ? "bg-primary/5 text-primary" : ""}`}>
                            {weightedAdr > 0 ? Math.round(s.gross).toLocaleString() : "—"}
                          </td>
                        );
                      })}
                    </tr>

                    <tr className="bg-muted/20">
                      <td colSpan={OCCUPANCY_LEVELS.length + 1} className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">COSTS</td>
                    </tr>
                    {[
                      { label: "Utility Bills", val: values.utilityCost },
                      { label: "Internet / Phone", val: values.internetCost },
                      { label: "Maintenance", val: values.maintenanceCost },
                      ...(values.miscCost > 0 ? [{ label: "Miscellaneous", val: values.miscCost }] : []),
                    ].map(({ label, val }) => (
                      <tr key={label} className="hover:bg-muted/20 transition-colors text-muted-foreground">
                        <td className="px-5 py-3">{label}</td>
                        {OCCUPANCY_LEVELS.map(occ => (
                          <td key={occ} className={`px-5 py-3 text-right tabular-nums ${occ === 0.85 ? "bg-primary/5" : ""}`}>
                            {val > 0 ? val.toLocaleString() : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}

                    <tr className="bg-muted/20">
                      <td colSpan={OCCUPANCY_LEVELS.length + 1} className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">FEES</td>
                    </tr>
                    <tr className="hover:bg-muted/20 transition-colors text-muted-foreground">
                      <td className="px-5 py-3">Management Fees ({values.managementFeePercent}%)</td>
                      {OCCUPANCY_LEVELS.map(occ => {
                        const s = computeScenario(occ);
                        return (
                          <td key={occ} className={`px-5 py-3 text-right tabular-nums ${occ === 0.85 ? "bg-primary/5" : ""}`}>
                            {weightedAdr > 0 ? Math.round(s.mgmtFee).toLocaleString() : "—"}
                          </td>
                        );
                      })}
                    </tr>

                    <tr className="bg-muted/20">
                      <td colSpan={OCCUPANCY_LEVELS.length + 1} className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">NET OUTCOME</td>
                    </tr>
                    <tr className="hover:bg-muted/20 transition-colors font-semibold border-t-2 border-primary/20">
                      <td className="px-5 py-3 text-foreground">Net Annual Income (AED)</td>
                      {OCCUPANCY_LEVELS.map(occ => {
                        const s = computeScenario(occ);
                        return (
                          <td key={occ} className={`px-5 py-3 text-right tabular-nums font-bold ${occ === 0.85 ? "bg-primary/10 text-primary" : "text-foreground"}`}>
                            {weightedAdr > 0 ? Math.round(s.net).toLocaleString() : "—"}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="hover:bg-muted/20 transition-colors text-muted-foreground">
                      <td className="px-5 py-3">Monthly Average Payout</td>
                      {OCCUPANCY_LEVELS.map(occ => {
                        const s = computeScenario(occ);
                        return (
                          <td key={occ} className={`px-5 py-3 text-right tabular-nums ${occ === 0.85 ? "bg-primary/5" : ""}`}>
                            {weightedAdr > 0 ? Math.round(s.monthly).toLocaleString() : "—"}
                          </td>
                        );
                      })}
                    </tr>

                    {values.annualLtr > 0 && (
                      <>
                        <tr className="bg-muted/20">
                          <td colSpan={OCCUPANCY_LEVELS.length + 1} className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">INCREASE VS LONG-TERM RENTAL</td>
                        </tr>
                        <tr className="hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 font-medium">vs LTR (with vacancy)</td>
                          {OCCUPANCY_LEVELS.map(occ => {
                            const s = computeScenario(occ);
                            const positive = s.vsLtr != null && s.vsLtr > 0;
                            return (
                              <td key={occ} className={`px-5 py-3 text-right tabular-nums font-bold ${occ === 0.85 ? "bg-primary/5" : ""} ${positive ? "text-green-600" : "text-red-500"}`}>
                                {s.vsLtr != null ? `${positive ? "+" : ""}${Math.round(s.vsLtr)}%` : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-border/50 bg-muted/10">
                <p className="text-xs text-muted-foreground">
                  Note: This is a projection based on the information provided and current market conditions. Figures may vary over time depending on market supply and demand. Weighted ADR is based on Abu Dhabi's seasonal calendar.
                </p>
              </div>
            </Card>
          </TabsContent>

          {/* ── MONTHLY ── */}
          <TabsContent value="monthly" className="p-6 max-w-[1400px] mx-auto">
            <MonthlyProjectionsTab forecastId={forecastId} monthly={monthly ?? []} />
          </TabsContent>

          {/* ── PROPOSAL ── */}
          <TabsContent value="proposal" className="p-6 max-w-[900px] mx-auto space-y-6">

            {/* Narrative editor */}
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="bg-muted/20 border-b border-border pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="font-serif text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      Cover Narrative
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Personalised opening paragraph shown on page 1 of the owner's proposal.
                    </p>
                  </div>
                  {narrativeSaved && (
                    <span className="text-xs text-green-600 flex items-center gap-1 mt-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder={`e.g. Based on our detailed analysis of comparable units in Yas Island, we are confident your ${(forecast as any).propertyType ?? "property"} can generate significantly more than traditional long-term rental. Our team has reviewed current STR performance across similar units in the building and the projections in this report reflect achievable market rates.`}
                    className="min-h-[160px] resize-y text-sm leading-relaxed"
                    maxLength={1000}
                    value={narrativeText}
                    onChange={e => {
                      setNarrativeText(e.target.value);
                      setNarrativeSaved(false);
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      <span className={narrativeText.length > 900 ? "text-amber-500 font-medium" : ""}>
                        {narrativeText.length}
                      </span>
                      {" / 1,000 characters"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tip: Mention the location, a standout feature, and why STR outperforms LTR here.
                    </p>
                  </div>
                </div>

                {/* Formatting hints */}
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What works well</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-none">
                    <li>✦ Reference the specific area or building to show local expertise</li>
                    <li>✦ Highlight a key data point (e.g. ADR, occupancy) to build confidence</li>
                    <li>✦ Keep it 2–4 sentences — concise and owner-focused</li>
                    <li>✦ Avoid generic phrases; make it feel written for this owner specifically</li>
                  </ul>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2 border-primary/30 text-primary hover:bg-primary/5"
                    onClick={handleGenerateDraft}
                    disabled={generateNarrativeDraft.isPending || !forecast?.grossAnnualRevenue}
                    title={!forecast?.grossAnnualRevenue ? "Run Save & Calculate first to enable AI draft" : "Generate a personalised draft from this property's data"}
                  >
                    {generateNarrativeDraft.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                      : <><Sparkles className="h-4 w-4" /> Generate Draft</>}
                  </Button>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={handleSaveNarrative}
                    disabled={updateProposal.isPending || !proposal || narrativeSaved}
                    title={!proposal ? "Publish a proposal first to enable narrative saving" : ""}
                  >
                    {updateProposal.isPending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                      : narrativeSaved
                        ? <><CheckCircle2 className="h-4 w-4" /> Saved</>
                        : <><Save className="h-4 w-4" /> Save Narrative</>}
                  </Button>
                </div>

                {!proposal && (
                  <p className="text-xs text-muted-foreground text-center">
                    Run <strong>Save &amp; Calculate</strong> then <strong>Generate Proposal</strong> to create a proposal record before saving the narrative.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── Live Cover Preview ── */}
            <Card className="border-border/50 shadow-sm overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <CardTitle className="font-serif text-base">Cover Preview</CardTitle>
                  <span className="ml-auto text-xs text-muted-foreground">Updates live as you type</span>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <ProposalCoverPreview
                  ownerName={(forecast as any).ownerName}
                  ownerTitle={(forecast as any).ownerTitle}
                  propertyAddress={(forecast as any).propertyAddress}
                  propertyType={(forecast as any).propertyType}
                  bedrooms={(forecast as any).bedrooms}
                  bathrooms={(forecast as any).bathrooms}
                  internalArea={(forecast as any).internalArea}
                  view={(forecast as any).view}
                  netOwnerIncome={forecast.netOwnerIncome}
                  monthlyPayout={forecast.netOwnerIncome != null ? forecast.netOwnerIncome / 12 : null}
                  recommendedOccupancy={forecast.recommendedOccupancy as number | null}
                  increaseVsLtrPct={forecast.increaseVsLtrPct}
                  grossAnnualRevenue={forecast.grossAnnualRevenue}
                  netLtrIncome={(forecast as any).annualLtr}
                  advisorName={(proposal as any)?.advisorName ?? null}
                  narrativeText={narrativeText}
                  referenceNumber={forecast.referenceNumber}
                />
              </CardContent>
            </Card>

            {/* Status card */}
            {!forecast?.grossAnnualRevenue ? (
              <Card className="border-border/50 shadow-sm">
                <CardContent className="p-10 text-center text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="font-semibold text-foreground mb-1">No calculation yet</p>
                  <p className="text-sm">Switch to the <strong>Data Inputs</strong> tab, fill in your ADR values, then click <strong>Save & Calculate</strong> to generate the financial projections before publishing a proposal.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Share card */}
                <Card className="border-border/50 shadow-sm overflow-hidden">
                  <div className="h-1 bg-primary" />
                  <CardHeader className="bg-muted/20 border-b border-border pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="font-serif text-lg">Owner Proposal</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">A branded, owner-facing sales presentation generated from this forecast.</p>
                      </div>
                      <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border ${hasShareLink ? "bg-green-50 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-border"}`}>
                        <div className={`w-2 h-2 rounded-full ${hasShareLink ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                        {hasShareLink ? "Live & Shareable" : "Not Yet Published"}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">

                    {hasShareLink ? (
                      <div className="space-y-4">
                        {/* Link row */}
                        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground font-mono truncate flex-1 select-all">
                            {window.location.origin}{proposal?.shareUrl}
                          </span>
                          <Button size="sm" variant="outline" className="shrink-0 gap-1.5"
                            onClick={() => { navigator.clipboard.writeText(window.location.origin + proposal!.shareUrl!); toast({ title: "Link copied!" }); }}>
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </Button>
                        </div>
                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-3">
                          <Button asChild className="gap-2">
                            <a href={proposal?.shareUrl ?? "#"} target="_blank" rel="noreferrer">
                              <Eye className="h-4 w-4" /> View Live Proposal
                            </a>
                          </Button>
                          <Button variant="outline" className="gap-2" onClick={handlePublishProposal} disabled={publishProposal.isPending}>
                            {publishProposal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share className="h-4 w-4" />}
                            Regenerate Link
                          </Button>
                          <Button variant="outline" className="gap-2" asChild>
                            <a href={proposal?.shareUrl ?? "#"} target="_blank" rel="noreferrer" onClick={() => setTimeout(() => window.print(), 500)}>
                              <Printer className="h-4 w-4" /> Print / Save as PDF
                            </a>
                          </Button>
                        </div>
                        {/* Engagement stats */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Engagement</p>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Eye className="h-3 w-3" /> Auto-refreshes every 30s
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { label: "Total Views", val: proposal?.totalViews ?? 0 },
                              { label: "PDF Downloads", val: proposal?.pdfDownloads ?? 0 },
                              { label: "Status", val: proposal?.ownerAction ? `Owner: ${proposal.ownerAction.replace(/_/g, " ")}` : "Awaiting response" },
                            ].map(({ label, val }) => (
                              <div key={label} className="text-center p-4 bg-muted/20 rounded-lg border border-border/50">
                                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                                <div className="text-lg font-bold text-foreground">{val}</div>
                              </div>
                            ))}
                          </div>
                          {proposal?.lastViewedAt && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Last viewed {new Date(proposal.lastViewedAt).toLocaleString("en-AE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </div>
                        {/* Expiry notice */}
                        {proposal?.expiresAt && (
                          <p className="text-xs text-muted-foreground">
                            Link expires on {new Date(proposal.expiresAt).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })}. Click "Regenerate Link" to extend by 30 days.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 space-y-4">
                        <Share className="h-10 w-10 mx-auto text-muted-foreground/30" />
                        <div>
                          <p className="font-semibold text-foreground mb-1">Ready to share</p>
                          <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            Publish a shareable link to send to the owner. They'll see a branded proposal with all financials, scenario comparisons, and the ability to accept or request a callback.
                          </p>
                        </div>
                        <Button className="gap-2 mt-2" onClick={handlePublishProposal} disabled={publishProposal.isPending}>
                          {publishProposal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
                          Publish & Generate Link
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* What the owner sees */}
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="bg-muted/20 border-b border-border pb-4">
                    <CardTitle className="font-serif text-base">What the owner receives</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { icon: FileText, label: "Executive Summary", desc: "Gross revenue, net income & monthly payout" },
                        { icon: TrendingUp, label: "Scenario Table", desc: "Conservative → Optimistic comparisons" },
                        { icon: CheckCircle2, label: "Revenue Charts", desc: "Monthly STR vs LTR visualisation" },
                        { icon: Send, label: "One-Click Actions", desc: "Accept, request call or ask a question" },
                      ].map(({ icon: Icon, label, desc }) => (
                        <div key={label} className="p-4 bg-muted/10 rounded-lg border border-border/50 text-center">
                          <Icon className="h-6 w-6 text-primary mx-auto mb-2" />
                          <p className="text-xs font-semibold text-foreground">{label}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
