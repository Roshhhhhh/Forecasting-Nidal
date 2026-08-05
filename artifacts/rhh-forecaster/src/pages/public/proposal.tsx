import { useGetPublicProposal, useSubmitProposalAction } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Phone, FileText, Printer, Copy, RefreshCw,
  MapPin, Home, Star, Users, TrendingUp, Shield, Zap,
  Eye, Clock, DollarSign, BarChart2, ArrowRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const G = "#B8860B"; // gold
const DARK = "#111111";
const BEIGE = "#FAFAF8";

function fmt(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(v);
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const HOW_IT_WORKS = [
  { n: "01", title: "Onboarding", desc: "Simple onboarding with clear terms, timelines, and revenue expectations." },
  { n: "02", title: "Licensing", desc: "We handle all holiday home permits and compliance requirements." },
  { n: "03", title: "Setup", desc: "Professional setup to maximise guest appeal and booking potential." },
  { n: "04", title: "Listing & Pricing", desc: "Your property is listed across top platforms with demand-based pricing." },
  { n: "05", title: "Operations", desc: "End-to-end guest handling, housekeeping, and maintenance." },
  { n: "06", title: "Revenue Management", desc: "Continuous performance tracking with transparent monthly reports." },
  { n: "07", title: "Monthly Payout", desc: "Net earnings transferred directly to you every month." },
];

const WHY_RHH = [
  { icon: MapPin, title: "Abu Dhabi Specialists", desc: "Deep local knowledge of building regulations and guest preferences." },
  { icon: TrendingUp, title: "Earn More", desc: "Our data-driven approach consistently outperforms the market average." },
  { icon: Home, title: "In-House Teams", desc: "Cleaning, maintenance, and laundry — all handled internally, not outsourced." },
  { icon: Shield, title: "Proven Compliance", desc: "Fully licensed by the Department of Culture and Tourism." },
  { icon: Zap, title: "Performance First", desc: "Our goals are aligned — we only earn when you earn." },
  { icon: Star, title: "Hassle Free", desc: "We manage everything so you can enjoy the returns without the effort." },
  { icon: DollarSign, title: "Value for Money", desc: "Transparent pricing — no hidden fees, no surprises." },
];

const PORTFOLIO_STATS = [
  { v: "160+", l: "Managed Premium Properties" },
  { v: "5,000+", l: "5-Star Reviews" },
  { v: "1,000+", l: "Bookings Per Month" },
  { v: "3,500+", l: "Hosted Travellers Monthly" },
  { v: "AED 250M+", l: "Managed Assets" },
  { v: "100+", l: "Trusted Home Owners" },
];

export default function PublicProposal() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const { data: proposal, isLoading, error } = useGetPublicProposal(token || "");
  const submitAction = useSubmitProposalAction();

  const [dialogType, setDialogType] = useState<"accept" | "call" | "question" | null>(null);
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (isLoading) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: BEIGE }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 8, background: G, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "serif" }}>R</div>
        <p style={{ color: "#888", fontFamily: "serif", fontSize: 16 }}>Preparing your proposal…</p>
      </div>
    </div>
  );

  if (error || !proposal) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: BEIGE, padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: "center", background: "#fff", borderRadius: 16, padding: 40, boxShadow: "0 20px 60px rgba(0,0,0,0.1)" }}>
        <FileText style={{ width: 48, height: 48, color: "#ccc", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: 22, fontFamily: "serif", fontWeight: 700, marginBottom: 8 }}>Proposal Unavailable</h2>
        <p style={{ color: "#888", lineHeight: 1.6 }}>This link has expired or is invalid. Please contact your Royal Holiday Homes representative.</p>
      </div>
    </div>
  );

  const scenarios = (proposal.scenarios ?? []).sort((a: any, b: any) => a.occupancyRate - b.occupancyRate);
  const monthly = (proposal.monthlyProjections ?? []).sort((a: any, b: any) => a.month - b.month);
  const recOcc = Math.round((proposal.recommendedOccupancy ?? 0.85) * 100);
  const hasLtr = (proposal.netLtrIncome ?? 0) > 0;
  const hasScenarios = scenarios.length > 0;
  const hasMonthly = monthly.length > 0;

  const handleSubmit = async () => {
    if (!dialogType) return;
    try {
      await submitAction.mutateAsync({
        token: token!,
        data: {
          actionType: dialogType === "call" ? "request_call" : dialogType === "question" ? "ask_question" : "accept",
          comments: comment,
          ownerPhone: phone,
          acceptedScenarioId: scenarios.find((s: any) => s.name === "Confident")?.id ?? scenarios[1]?.id,
        },
      });
      setSubmitted(true);
      toast({ title: "Submitted!", description: "Your representative will be in touch shortly." });
      setDialogType(null);
    } catch {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    }
  };

  return (
    <div style={{ background: BEIGE, color: DARK, fontFamily: "'Inter', 'Segoe UI', sans-serif", overflowX: "hidden" }}>

      {/* ── Print / PDF button (screen only) ── */}
      <div className="print:hidden" style={{ position: "fixed", top: 16, right: 16, zIndex: 999, display: "flex", gap: 8 }}>
        <button
          onClick={() => window.print()}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8, background: DARK, color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          <Printer style={{ width: 16, height: 16 }} /> Download PDF
        </button>
      </div>

      {/* ── SECTION 1: HERO COVER ── */}
      <section style={{ background: DARK, color: "#fff", padding: "64px 48px 80px", position: "relative", overflow: "hidden", pageBreakAfter: "always" }}>
        {/* Gold glow */}
        <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: `${G}18`, filter: "blur(80px)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 64 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/rhh-logo.png" alt="Royal Holiday Homes" style={{ height: 40, width: "auto" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <span style={{ fontSize: 18, fontWeight: 600, fontFamily: "serif", letterSpacing: 1 }}>Royal Holiday Homes</span>
            </div>
            <div style={{ textAlign: "right", color: "#aaa", fontSize: 13 }}>
              <div style={{ textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>Proposal Ref</div>
              <div style={{ fontSize: 16, color: G, fontWeight: 700 }}>{proposal.referenceNumber}</div>
              <div style={{ marginTop: 6, color: "#666" }}>{new Date(proposal.proposalDate || Date.now()).toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>
          </div>

          {/* Tagline */}
          <div style={{ color: G, fontSize: 12, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", marginBottom: 20 }}>
            Property Management Proposal
          </div>
          <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontFamily: "serif", fontWeight: 800, lineHeight: 1.15, marginBottom: 24, maxWidth: 700 }}>
            Turn Your Second Home Into Your Second Income
          </h1>
          <p style={{ fontSize: 20, color: "#ccc", fontFamily: "serif", fontStyle: "italic", marginBottom: 8 }}>
            Prepared exclusively for <span style={{ color: "#fff", fontStyle: "normal", fontWeight: 600 }}>
              {proposal.ownerTitle ? `${proposal.ownerTitle} ` : ""}{proposal.ownerName}
            </span>
          </p>
          <p style={{ color: "#888", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <MapPin style={{ width: 14, height: 14 }} /> {proposal.propertyAddress}
          </p>

          {/* Hero KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 1, marginTop: 56, background: "#222", borderRadius: 12, overflow: "hidden" }}>
            {[
              { label: "Average Daily Rate", value: `AED ${fmt(proposal.weightedAdr)}` },
              { label: `Occupancy (${recOcc}%)`, value: `AED ${fmt(proposal.grossAnnualRevenue)}`, sub: "Gross Annual Revenue" },
              { label: "Net Annual Income", value: `AED ${fmt(proposal.netOwnerIncome)}`, gold: true },
              { label: "Monthly Average Payout", value: `AED ${fmt(proposal.monthlyPayout)}` },
              ...(hasLtr ? [{ label: "vs Long-Term Rental", value: `+${proposal.increaseVsLtrPct ?? 0}%`, green: true }] : []),
            ].map((k, i) => (
              <div key={i} style={{ padding: "24px 20px", background: k.gold ? `${G}22` : "#1a1a1a", borderLeft: k.gold ? `3px solid ${G}` : "none" }}>
                <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{k.sub ?? k.label}</div>
                <div style={{ fontSize: k.gold ? 26 : 20, fontWeight: 800, color: k.gold ? G : k.green ? "#4ade80" : "#fff" }}>{k.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: PROPERTY PROFILE ── */}
      <section style={{ maxWidth: 900, margin: "-32px auto 0", padding: "0 24px 48px", position: "relative", zIndex: 10 }}>
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.12)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div style={{ padding: "40px 40px" }}>
              <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 16 }}>Asset Profile</div>
              <h2 style={{ fontSize: 26, fontFamily: "serif", fontWeight: 700, marginBottom: 24 }}>Property Overview</h2>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "12px 24px", fontSize: 14 }}>
                <span style={{ color: "#888" }}>Address</span>
                <span style={{ fontWeight: 600 }}>{proposal.propertyAddress}</span>
                <span style={{ color: "#888" }}>Type</span>
                <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{proposal.propertyType}</span>
                <span style={{ color: "#888" }}>Bedrooms</span>
                <span style={{ fontWeight: 600 }}>{proposal.bedrooms} Bedroom{proposal.bedrooms !== 1 ? "s" : ""}</span>
                <span style={{ color: "#888" }}>Bathrooms</span>
                <span style={{ fontWeight: 600 }}>{proposal.bathrooms} Bathroom{proposal.bathrooms !== 1 ? "s" : ""}</span>
                <span style={{ color: "#888" }}>Size</span>
                <span style={{ fontWeight: 600 }}>{fmt(proposal.internalArea)} sqft</span>
                {proposal.view && <><span style={{ color: "#888" }}>View</span><span style={{ fontWeight: 600 }}>{proposal.view}</span></>}
                {proposal.furnishingStatus && <><span style={{ color: "#888" }}>Condition</span><span style={{ fontWeight: 600, textTransform: "capitalize" }}>{proposal.furnishingStatus.replace(/_/g, " ")}</span></>}
              </div>
            </div>
            <div style={{ background: DARK, color: "#fff", padding: "40px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 20 }}>Revenue Forecast</div>
              <p style={{ color: "#aaa", lineHeight: 1.7, fontSize: 14, marginBottom: 24 }}>
                {proposal.narrativeText ?? `Based on our analysis of comparable units in ${proposal.propertyAddress.split(",")[0]}, we forecast your property to generate significant returns through the short-term rental market — outperforming traditional long-term leasing.`}
              </p>
              {hasLtr && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: `${G}20`, borderRadius: 8, borderLeft: `3px solid ${G}` }}>
                  <TrendingUp style={{ width: 20, height: 20, color: G, flexShrink: 0 }} />
                  <div>
                    <div style={{ color: G, fontWeight: 700, fontSize: 22 }}>+{proposal.increaseVsLtrPct ?? 0}% Higher Yield</div>
                    <div style={{ color: "#aaa", fontSize: 12, marginTop: 2 }}>vs traditional long-term leasing</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 3: INCOME CALCULATOR TABLE ── */}
      {hasScenarios && (
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "16px 24px 48px", pageBreakBefore: "always" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>Financial Analysis</div>
            <h2 style={{ fontSize: 32, fontFamily: "serif", fontWeight: 700 }}>Income Calculator</h2>
            <p style={{ color: "#666", marginTop: 8 }}>Revenue projections across different occupancy scenarios.</p>
          </div>

          {/* LTR comparison row */}
          {hasLtr && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Long-Term Rental (Market Rate)</div>
                <div style={{ fontSize: 28, fontWeight: 800 }}>AED {fmt(proposal.netLtrIncome)}</div>
              </div>
              <div style={{ background: `${G}15`, borderRadius: 12, padding: "20px 24px", border: `1px solid ${G}40` }}>
                <div style={{ fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>LTR Effective (with 10% vacancy)</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: G }}>AED {fmt((proposal.netLtrIncome ?? 0) * 0.9)}</div>
              </div>
            </div>
          )}

          {/* Scenarios table */}
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f0f0f0" }}>
                    <th style={{ padding: "16px 20px", textAlign: "left", color: "#888", fontWeight: 600, background: "#FAFAF8" }}>Metric</th>
                    {scenarios.map((s: any) => {
                      const isConfident = s.name === "Confident";
                      return (
                        <th key={s.id} style={{ padding: "16px 20px", textAlign: "right", background: isConfident ? `${G}12` : "#FAFAF8", borderLeft: isConfident ? `3px solid ${G}` : "none" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: isConfident ? G : DARK }}>{Math.round(s.occupancyRate * 100)}%</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: isConfident ? G : "#888", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{s.name}</div>
                          {isConfident && <div style={{ fontSize: 10, color: G, marginTop: 2 }}>★ Recommended</div>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* Gross Revenue */}
                  <tr style={{ borderTop: "1px solid #f0f0f0", background: "#fff" }}>
                    <td style={{ padding: "14px 20px", color: "#444", fontWeight: 500 }}>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>INCOME</div>
                      Gross Annual Revenue (AED)
                    </td>
                    {scenarios.map((s: any) => (
                      <td key={s.id} style={{ padding: "14px 20px", textAlign: "right", fontWeight: 700, background: s.name === "Confident" ? `${G}08` : "transparent", borderLeft: s.name === "Confident" ? `3px solid ${G}30` : "none" }}>
                        {fmt(s.grossRevenue)}
                      </td>
                    ))}
                  </tr>
                  {/* Total Deductions */}
                  <tr style={{ borderTop: "1px solid #f0f0f0", background: "#FAFAF8" }}>
                    <td style={{ padding: "14px 20px", color: "#888" }}>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>COSTS & FEES</div>
                      Total Deductions (AED)
                    </td>
                    {scenarios.map((s: any) => (
                      <td key={s.id} style={{ padding: "14px 20px", textAlign: "right", color: "#999", background: s.name === "Confident" ? `${G}08` : "transparent", borderLeft: s.name === "Confident" ? `3px solid ${G}30` : "none" }}>
                        {fmt((s.grossRevenue ?? 0) - (s.netOwnerIncome ?? 0))}
                      </td>
                    ))}
                  </tr>
                  {/* Net Owner Income */}
                  <tr style={{ borderTop: "2px solid #e8e8e8", background: "#fff" }}>
                    <td style={{ padding: "16px 20px", fontWeight: 700, color: DARK }}>
                      <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>NET OUTCOME</div>
                      Net Annual Income (AED)
                    </td>
                    {scenarios.map((s: any) => {
                      const isConfident = s.name === "Confident";
                      return (
                        <td key={s.id} style={{ padding: "16px 20px", textAlign: "right", fontWeight: 800, fontSize: 17, color: isConfident ? G : DARK, background: isConfident ? `${G}12` : "transparent", borderLeft: isConfident ? `3px solid ${G}` : "none" }}>
                          {fmt(s.netOwnerIncome)}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Monthly payout */}
                  <tr style={{ borderTop: "1px solid #f0f0f0", background: "#FAFAF8" }}>
                    <td style={{ padding: "14px 20px", color: "#666" }}>Monthly Average Payout (AED)</td>
                    {scenarios.map((s: any) => (
                      <td key={s.id} style={{ padding: "14px 20px", textAlign: "right", fontWeight: 600, background: s.name === "Confident" ? `${G}08` : "transparent", borderLeft: s.name === "Confident" ? `3px solid ${G}30` : "none" }}>
                        {fmt(Math.round((s.netOwnerIncome ?? 0) / 12))}
                      </td>
                    ))}
                  </tr>
                  {/* vs LTR */}
                  {hasLtr && (
                    <tr style={{ borderTop: "1px solid #f0f0f0", background: "#fff" }}>
                      <td style={{ padding: "14px 20px", color: "#666" }}>
                        <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>COMPARISON</div>
                        Increase vs Long-Term Rental
                      </td>
                      {scenarios.map((s: any) => {
                        const ltr = proposal.netLtrIncome ?? 0;
                        const pct = ltr > 0 ? Math.round(((s.netOwnerIncome ?? 0) - ltr) / ltr * 100) : null;
                        const isConfident = s.name === "Confident";
                        return (
                          <td key={s.id} style={{ padding: "14px 20px", textAlign: "right", fontWeight: 700, color: (pct ?? 0) > 0 ? "#16a34a" : "#dc2626", background: isConfident ? `${G}08` : "transparent", borderLeft: isConfident ? `3px solid ${G}30` : "none" }}>
                            {pct != null ? `${pct > 0 ? "+" : ""}${pct}%` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f0f0", background: "#FAFAF8" }}>
              <p style={{ fontSize: 12, color: "#999", lineHeight: 1.5 }}>
                Note: This is a projection based on the information provided and current market conditions. Figures may vary over time depending on market supply and demand.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── SECTION 4: CHARTS ── */}
      {(hasScenarios || hasMonthly) && (
        <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px 48px", pageBreakBefore: "always" }}>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>Expected Revenue Comparison</div>
            <h2 style={{ fontSize: 32, fontFamily: "serif", fontWeight: 700 }}>Revenue Visualised</h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: hasScenarios && hasMonthly ? "1fr 1fr" : "1fr", gap: 24 }}>
            {/* Scenario bar chart */}
            {hasScenarios && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Net Income by Scenario</h3>
                <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>Gross revenue vs net income</p>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scenarios.map((s: any) => ({ name: s.name, gross: Math.round(s.grossRevenue ?? 0), net: Math.round(s.netOwnerIncome ?? 0) }))} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} tick={{ fill: "#888", fontSize: 11 }} />
                      <RechartsTooltip formatter={(v: number) => `AED ${fmt(v)}`} contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }} />
                      <Bar dataKey="gross" name="Gross Revenue" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {scenarios.map((s: any) => <Cell key={s.id} fill={s.name === "Confident" ? `${G}60` : "#e5e7eb"} />)}
                      </Bar>
                      <Bar dataKey="net" name="Net Income" radius={[4, 4, 0, 0]} maxBarSize={36}>
                        {scenarios.map((s: any) => <Cell key={s.id} fill={s.name === "Confident" ? G : DARK} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "#888" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: "#e5e7eb", display: "inline-block" }} /> Gross Revenue</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: DARK, display: "inline-block" }} /> Net Income</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: G, display: "inline-block" }} /> Confident (85%)</span>
                </div>
              </div>
            )}

            {/* Monthly chart */}
            {hasMonthly && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Monthly Revenue Projection</h3>
                <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>STR vs LTR comparison — month by month</p>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={monthly.map((m: any) => ({
                        name: MONTH_LABELS[(m.month - 1) % 12] ?? `M${m.month}`,
                        str: Math.round(m.netOwnerIncome ?? 0),
                        ltr: m.ltrBenchmark ? Math.round(m.ltrBenchmark) : null,
                      }))}
                      margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#888", fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} tick={{ fill: "#888", fontSize: 11 }} />
                      <RechartsTooltip formatter={(v: number) => `AED ${fmt(v)}`} contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }} />
                      <Line type="monotone" dataKey="str" name="STR Net Income" stroke={G} strokeWidth={2.5} dot={{ fill: G, r: 3 }} />
                      {hasLtr && <Line type="monotone" dataKey="ltr" name="LTR Benchmark" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="6 3" dot={false} />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "#888" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 20, height: 3, background: G, display: "inline-block", borderRadius: 2 }} /> STR Net Income</span>
                  {hasLtr && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 20, height: 3, background: "#cbd5e1", display: "inline-block", borderRadius: 2 }} /> LTR Benchmark</span>}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── SECTION 5: WHY YOUR PROPERTY EARNS MORE ── */}
      <section style={{ background: DARK, color: "#fff", padding: "64px 48px", pageBreakBefore: "always" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>Revenue Intelligence</div>
          <h2 style={{ fontSize: 36, fontFamily: "serif", fontWeight: 700, marginBottom: 12 }}>Why Your Property Earns More</h2>
          <p style={{ color: "#aaa", maxWidth: 600, lineHeight: 1.7, marginBottom: 48 }}>
            Short-term rentals outperform through strategic seasonal pricing and data-driven demand management — maximising yield across every week of the year.
          </p>

          {/* ADR callout */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 48 }}>
            <div style={{ padding: "28px 24px", background: "#1a1a1a", borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Weighted Average ADR</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: G }}>AED {fmt(proposal.weightedAdr)}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Across all seasonal periods</div>
            </div>
            <div style={{ padding: "28px 24px", background: "#1a1a1a", borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Projected Occupancy</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>{recOcc}%</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Confident annual average</div>
            </div>
            <div style={{ padding: "28px 24px", background: "#1a1a1a", borderRadius: 12 }}>
              <div style={{ fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Monthly Average Payout</div>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>AED {fmt(proposal.monthlyPayout)}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>Direct to your account</div>
            </div>
          </div>

          {/* Owner benefits */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {[
              { icon: BarChart2, title: "Dynamic Revenue Capture", desc: "Leverage premium pricing during high-demand periods to maximise returns." },
              { icon: Eye, title: "Market Intelligence", desc: "Real-time adjustments based on competitive analysis and demand forecasting." },
              { icon: TrendingUp, title: "Transparent Analytics", desc: "Clear insights into performance drivers and revenue attribution." },
              { icon: RefreshCw, title: "Consistent Profitability", desc: "Stable cash flow across all seasonal cycles through active management." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{ padding: "24px 20px", background: "#1a1a1a", borderRadius: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${G}20`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                  <Icon style={{ width: 18, height: 18, color: G }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6: STR vs LTR COMPARISON ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px", pageBreakBefore: "always" }}>
        <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>The Smarter Choice</div>
        <h2 style={{ fontSize: 36, fontFamily: "serif", fontWeight: 700, marginBottom: 8 }}>Why Opt for Holiday Homes?</h2>
        <p style={{ color: "#666", marginBottom: 40 }}>Holiday homes allow your property to earn more by adapting pricing to market demand and seasonal trends.</p>

        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ padding: "16px 24px", fontWeight: 600, color: "#888", fontSize: 13 }}>Criteria</div>
            <div style={{ padding: "16px 24px", textAlign: "center", background: `${G}10`, fontWeight: 700, color: G, fontSize: 13, borderLeft: `2px solid ${G}30` }}>Holiday Home (STR)</div>
            <div style={{ padding: "16px 24px", textAlign: "center", fontWeight: 600, color: "#888", fontSize: 13 }}>Long-Term Rental</div>
          </div>
          {[
            ["Annual Yield Potential", "20–58% Higher Returns", "Fixed Annual Income"],
            ["Revenue Flexibility", "Dynamic Seasonal Pricing", "Limited Flexibility"],
            ["Owner Usage", "Full Flexibility to Use Property", "Tied Up for 12+ Months"],
            ["Asset Monitoring", "Regular Inspections & Care", "Minimal Oversight"],
            ["Risk Profile", "Reduced Long-Term Tenant Risk", "Tenant Disputes & Issues"],
            ["Property Condition", "Maintained to Hotel Standard", "Wear & Tear Over Time"],
          ].map(([label, str, ltr]) => (
            <div key={label} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", borderTop: "1px solid #f0f0f0" }}>
              <div style={{ padding: "14px 24px", fontSize: 14, color: "#444", fontWeight: 500 }}>{label}</div>
              <div style={{ padding: "14px 24px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "#16a34a", background: `${G}05`, borderLeft: `2px solid ${G}20` }}>✓ {str}</div>
              <div style={{ padding: "14px 24px", textAlign: "center", fontSize: 13, color: "#dc2626" }}>✕ {ltr}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 7: HOW IT WORKS ── */}
      <section style={{ background: "#f5f0e8", padding: "64px 48px", pageBreakBefore: "always" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>Our Process</div>
          <h2 style={{ fontSize: 36, fontFamily: "serif", fontWeight: 700, marginBottom: 48 }}>How It Works</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {HOW_IT_WORKS.map(({ n, title, desc }) => (
              <div key={n} style={{ background: "#fff", borderRadius: 12, padding: "28px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: `${G}30`, fontFamily: "serif", marginBottom: 12, lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 8: WHY ROYAL HOLIDAY HOMES ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px", pageBreakBefore: "always" }}>
        <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>Our Commitment</div>
        <h2 style={{ fontSize: 36, fontFamily: "serif", fontWeight: 700, marginBottom: 8 }}>Why Royal Holiday Homes?</h2>
        <p style={{ color: "#666", marginBottom: 40 }}>We are operators, not just agents — deeply invested in your property's performance.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {WHY_RHH.map(({ icon: Icon, title, desc }) => (
            <div key={title} style={{ display: "flex", gap: 16, padding: "20px 20px", background: "#fff", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", alignItems: "flex-start" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${G}15`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <Icon style={{ width: 18, height: 18, color: G }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#888", lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 9: PORTFOLIO STATS ── */}
      <section style={{ background: DARK, color: "#fff", padding: "64px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 8 }}>Track Record</div>
          <h2 style={{ fontSize: 36, fontFamily: "serif", fontWeight: 700, marginBottom: 8 }}>Our Portfolio</h2>
          <p style={{ color: "#aaa", marginBottom: 40 }}>Delivering 5-star hospitality excellence across Abu Dhabi.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
            {PORTFOLIO_STATS.map(({ v, l }) => (
              <div key={l} style={{ padding: "24px 20px", background: "#1a1a1a", borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: G, fontFamily: "serif", marginBottom: 8 }}>{v}</div>
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 10: CTA ── */}
      <section className="print:hidden" style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px 80px" }}>
        <div style={{ background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.1)", padding: "56px 48px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -100, right: -100, width: 300, height: 300, borderRadius: "50%", background: `${G}08`, filter: "blur(60px)" }} />
          <div style={{ position: "absolute", bottom: -100, left: -100, width: 300, height: 300, borderRadius: "50%", background: `${G}08`, filter: "blur(60px)" }} />

          {submitted ? (
            <div style={{ position: "relative", zIndex: 1 }}>
              <CheckCircle2 style={{ width: 56, height: 56, color: "#16a34a", margin: "0 auto 16px" }} />
              <h2 style={{ fontSize: 28, fontFamily: "serif", fontWeight: 700, marginBottom: 12 }}>Thank you!</h2>
              <p style={{ color: "#666" }}>Your representative {proposal.advisorName ? `(${proposal.advisorName})` : ""} will be in touch with you shortly.</p>
            </div>
          ) : (
            <>
              <div style={{ position: "relative", zIndex: 1, fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 12 }}>Next Steps</div>
              <h2 style={{ position: "relative", zIndex: 1, fontSize: 36, fontFamily: "serif", fontWeight: 700, marginBottom: 12 }}>
                Ready to Maximise Your Property's Potential?
              </h2>
              <p style={{ position: "relative", zIndex: 1, color: "#666", maxWidth: 520, margin: "0 auto 40px" }}>
                {proposal.advisorName ? `Your dedicated representative, ${proposal.advisorName}, is ready to assist you every step of the way.` : "Reach out to begin onboarding — our team will take care of everything required to prepare, position, and launch your property."}
              </p>
              <div style={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
                <button onClick={() => setDialogType("accept")}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 28px", borderRadius: 10, background: DARK, color: "#fff", border: "none", cursor: "pointer", fontSize: 15, fontWeight: 700 }}>
                  <CheckCircle2 style={{ width: 20, height: 20, color: G }} /> Accept Proposal
                </button>
                <button onClick={() => setDialogType("call")}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 28px", borderRadius: 10, background: "#fff", color: DARK, border: "2px solid #e5e7eb", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
                  <Phone style={{ width: 20, height: 20 }} /> Request a Call
                </button>
                <button onClick={() => setDialogType("question")}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 28px", borderRadius: 10, background: "#fff", color: DARK, border: "2px solid #e5e7eb", cursor: "pointer", fontSize: 15, fontWeight: 600 }}>
                  <ArrowRight style={{ width: 20, height: 20 }} /> Ask a Question
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── CONTACT / FOOTER ── */}
      <section style={{ background: DARK, color: "#fff", padding: "48px 48px 40px", pageBreakBefore: "always" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "start", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 11, color: G, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 16 }}>Contact Us</div>
              <div style={{ fontSize: 22, fontFamily: "serif", fontWeight: 700, marginBottom: 16 }}>Ready to get started?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14, color: "#aaa" }}>
                <div>📞 {proposal.companyPhone ?? "800 RHH"}</div>
                <div>🌐 www.royalholidayhomes.ae</div>
                {proposal.companyEmail && <div>✉️ {proposal.companyEmail}</div>}
                <div>📍 Suite 503, Al Neyadi Building – Sheikh Rashid Bin Saeed St – Al Manhal – Abu Dhabi</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", marginBottom: 12 }}>
                <img src="/rhh-logo.png" alt="RHH" style={{ height: 32, width: "auto" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <span style={{ fontSize: 16, fontWeight: 600, fontFamily: "serif" }}>Royal Holiday Homes</span>
              </div>
              <div style={{ fontSize: 12, color: "#666" }}>
                <div>Ref: {proposal.referenceNumber}</div>
                <div style={{ marginTop: 4 }}>Expires: {new Date(proposal.expiresAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}</div>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #222", paddingTop: 20, fontSize: 11, color: "#555", lineHeight: 1.6 }}>
            <p>{proposal.disclaimer ?? "This forecast is an estimate based on historical market data and comparable properties. Actual revenue may vary and is not guaranteed. Figures are subject to change based on market conditions."}</p>
            <p style={{ marginTop: 8 }}>Confidential © Royal Holiday Homes {new Date().getFullYear()}. All rights reserved.</p>
          </div>
        </div>
      </section>

      {/* ── Action Dialogs ── */}
      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {dialogType === "accept" ? "Accept Proposal" : dialogType === "call" ? "Request a Callback" : "Ask a Question"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "accept" ? "We'll get in touch to finalise your management agreement." :
               dialogType === "call" ? "Provide your number and we'll call you at your convenience." :
               "Send your question and we'll respond promptly."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Phone Number</label>
              <Input placeholder="+971 50 123 4567" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                {dialogType === "question" ? "Your Question" : "Additional Notes (optional)"}
              </label>
              <Textarea placeholder={dialogType === "question" ? "e.g. When can we start the onboarding process?" : "e.g. Tomorrow afternoon works best for me."} value={comment} onChange={e => setComment(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitAction.isPending} style={{ background: DARK, color: "#fff" }}>
              {submitAction.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          section { page-break-inside: avoid; }
          button, .print\\:hidden { display: none !important; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
