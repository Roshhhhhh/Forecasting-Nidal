import { useGetPublicProposal, useSubmitProposalAction } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { FileText, Printer, Phone, CheckCircle2, ArrowRight, MapPin, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const GOLD   = "#C9A84C";
const DARK   = "#1C1C1C";
const CREAM  = "#FDFCF8";
const WHITE  = "#FFFFFF";
const BORDER = "#E8E4DC";
const MUTED  = "#888888";

function fmt(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(v);
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const HOW_IT_WORKS = [
  { n: 1, title: "Onboarding",          desc: "Simple onboarding with clear terms, timelines, and revenue expectations." },
  { n: 2, title: "Licensing",           desc: "We handle all holiday home permits and compliance requirements." },
  { n: 3, title: "Setup",               desc: "Professional setup to maximise guest appeal and booking potential." },
  { n: 4, title: "Listing & Pricing",   desc: "Your property is listed across top platforms with demand-based pricing." },
  { n: 5, title: "Operations",          desc: "End-to-end guest handling, housekeeping, and maintenance." },
  { n: 6, title: "Revenue Management",  desc: "Continuous performance tracking with transparent monthly reports." },
  { n: 7, title: "Monthly Payout",      desc: "Net earnings transferred directly to you every month." },
];

const WHY_RHH = [
  { title: "Abu Dhabi Specialists",  desc: "Deep local knowledge of building regulations and guest preferences." },
  { title: "Earn More",              desc: "We offer a supportive environment where you can grow your business and earn more profit and our helpful support team is always here to assist you." },
  { title: "In-House Teams",         desc: "Our cleaning, maintenance, and laundry are not outsourced." },
  { title: "Proven Compliance",      desc: "Fully licensed by the Department of Culture and Tourism." },
  { title: "Performance First",      desc: "Our goals are aligned — we only earn when you earn." },
  { title: "Hassle Free",            desc: "We're always committed to making your experience and living smooth, hassle-free, comfortable, and enjoyable as possible." },
  { title: "Value for Money",        desc: "Our pricing is transparent, so you can trust that you're getting a reliable deal. We constantly evaluate our offerings to ensure that we are delivering real value." },
];

const PORTFOLIO = [
  { v: "160+",       l: "Managed Premium Properties" },
  { v: "5,000+",     l: "5 Star Reviews" },
  { v: "1,000+",     l: "Managed Bookings per month" },
  { v: "3,500+",     l: "Hosted Travelers monthly" },
  { v: "250M",       l: "Managed Assets" },
  { v: "100+",       l: "Trusted Home Owners in Abu Dhabi" },
];

// ── Shared layout primitives (static) ────────────────────────────────────────
// `page` is now built inside the component where `isMobile` is available.

const confidential: React.CSSProperties = {
  fontSize: 11,
  color: MUTED,
  marginTop: 48,
  paddingTop: 16,
  borderTop: `1px solid ${BORDER}`,
  letterSpacing: 0.5,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 3,
  textTransform: "uppercase" as const,
  color: GOLD,
  marginBottom: 8,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "serif",
  fontSize: 28,
  fontWeight: 700,
  color: DARK,
  marginBottom: 0,
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function PublicProposal() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const { data: proposal, isLoading, error } = useGetPublicProposal(token || "");
  const submitAction = useSubmitProposalAction();

  const [dialogType, setDialogType] = useState<"accept" | "call" | "question" | null>(null);
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  if (isLoading) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: CREAM }}>
      <p style={{ color: MUTED, fontFamily: "serif", fontSize: 16 }}>Preparing your proposal…</p>
    </div>
  );

  if (error || !proposal) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: CREAM, padding: 24 }}>
      <div style={{ maxWidth: 400, textAlign: "center" }}>
        <FileText style={{ width: 48, height: 48, color: "#ccc", margin: "0 auto 16px" }} />
        <h2 style={{ fontSize: 22, fontFamily: "serif", fontWeight: 700, marginBottom: 8 }}>Proposal Unavailable</h2>
        <p style={{ color: MUTED }}>This link has expired or is invalid. Please contact your Royal Holiday Homes representative.</p>
      </div>
    </div>
  );

  const scenarios = (proposal.scenarios ?? []).sort((a: any, b: any) => a.occupancyRate - b.occupancyRate);
  const monthly   = (proposal.monthlyProjections ?? []).sort((a: any, b: any) => a.month - b.month);
  const recOcc    = Math.round((proposal.recommendedOccupancy ?? 0.85) * 100);
  const hasLtr    = (proposal.netLtrIncome ?? 0) > 0;
  const hasScenarios = scenarios.length > 0;
  const hasMonthly   = monthly.length > 0;

  async function handleSubmit() {
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
  }

  const propDate = new Date(proposal.proposalDate || Date.now())
    .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
    .replace(/\//g, "/");

  // ── Responsive page layout ───────────────────────────────────────────────────
  const page: React.CSSProperties = {
    background: WHITE,
    padding: isMobile ? "28px 16px" : "56px 64px",
    maxWidth: 860,
    margin: "0 auto",
  };

  // ── td helpers ───────────────────────────────────────────────────────────────
  const tdLabel = (text: string, sub?: string): React.CSSProperties => ({
    padding: "12px 16px",
    fontSize: 13,
    color: "#444",
    borderBottom: `1px solid ${BORDER}`,
    verticalAlign: "top" as const,
  });

  const tdVal = (isConfident: boolean): React.CSSProperties => ({
    padding: "12px 16px",
    textAlign: "right" as const,
    fontSize: 13,
    fontWeight: 600,
    color: isConfident ? GOLD : DARK,
    background: isConfident ? `${GOLD}12` : "transparent",
    borderBottom: `1px solid ${BORDER}`,
    borderLeft: isConfident ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
  });

  return (
    <div style={{ background: CREAM, fontFamily: "'Inter','Segoe UI',sans-serif", color: DARK }}>

      {/* ── Print button (screen only) ── */}
      <div className="print:hidden" style={{ position: "fixed", top: 16, right: 16, zIndex: 999 }}>
        <button
          onClick={() => window.print()}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 8, background: DARK, color: WHITE, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          <Printer style={{ width: 16, height: 16 }} /> Download PDF
        </button>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 1 — COVER
      ══════════════════════════════════════════════ */}
      <div style={{ ...page, pageBreakAfter: "always", minHeight: "90vh", display: "flex", flexDirection: "column" }}>

        {/* Header row */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "flex-start", gap: isMobile ? 12 : 0, marginBottom: 48, paddingBottom: 24, borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/rhh-logo.png" alt="Royal Holiday Homes" style={{ height: 36, width: "auto" }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <span style={{ fontFamily: "serif", fontSize: 16, fontWeight: 700, color: DARK }}>Royal Holiday Homes</span>
          </div>
          <div style={{ textAlign: "right", fontSize: 12 }}>
            <div style={{ display: "flex", gap: 32 }}>
              <div>
                <div style={{ color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, fontSize: 10 }}>Date</div>
                <div style={{ fontWeight: 600, color: DARK }}>{propDate}</div>
              </div>
              <div>
                <div style={{ color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4, fontSize: 10 }}>Proposal Ref#</div>
                <div style={{ fontWeight: 600, color: DARK }}>{proposal.referenceNumber}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: GOLD, marginBottom: 20 }}>
            Turn Your Second Home Into Your Second Income
          </div>
          <h1 style={{ fontFamily: "serif", fontSize: isMobile ? 26 : 38, fontWeight: 800, color: DARK, lineHeight: 1.2, marginBottom: 40 }}>
            Property Management Proposal
          </h1>

          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
              Prepared Exclusively For
            </div>
          </div>

          {/* Owner block */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 6 }}>Owner(s)</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "serif", color: DARK }}>
              {proposal.ownerTitle ? `${proposal.ownerTitle} ` : ""}{proposal.ownerName}
            </div>
          </div>

          {/* Property details */}
          <div style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "24px 28px", marginBottom: 40 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Property Details</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Address</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{proposal.propertyAddress}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 16, marginTop: 16 }}>
              {[
                { label: "Property Type", value: proposal.propertyType },
                { label: "Bedroom",       value: `${proposal.bedrooms} Bedroom${(proposal.bedrooms ?? 1) !== 1 ? "s" : ""}` },
                { label: "Bathroom",      value: `${proposal.bathrooms} Bathroom${(proposal.bathrooms ?? 1) !== 1 ? "s" : ""}` },
                { label: "Size",          value: proposal.internalArea ? `${fmt(proposal.internalArea)} Sq.Ft.` : null },
                { label: "View",          value: proposal.view },
              ].filter(x => x.value).map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Narrative */}
          <p style={{ fontSize: 15, color: "#555", lineHeight: 1.8, fontFamily: "serif" }}>
            {proposal.narrativeText ??
              `Based on our analysis of comparable units in ${proposal.propertyAddress?.split(",")[0] ?? "Abu Dhabi"}, we forecast your property to generate AED ${fmt(proposal.grossAnnualRevenue)} annually at ${recOcc}% occupancy, representing a +${proposal.increaseVsLtrPct ?? 0}% increase compared to traditional long-term leasing.`}
          </p>
        </div>

        <div style={confidential}>Confidential © Royal Holiday Homes</div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 2 — EXECUTIVE FINANCIAL SUMMARY
      ══════════════════════════════════════════════ */}
      <div style={{ ...page, pageBreakAfter: "always" }}>
        <div style={sectionLabel}>Executive Financial Summary</div>
        <div style={{ height: 1, background: BORDER, margin: "12px 0 48px" }} />

        {/* Top KPIs */}
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", justifyContent: "space-around", gap: isMobile ? 24 : 0, marginBottom: 48 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: isMobile ? 30 : 40, fontWeight: 900, fontFamily: "serif", color: DARK }}>AED {fmt(proposal.weightedAdr)}</div>
            <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 }}>Average Daily Rate</div>
          </div>
          {!isMobile && <div style={{ width: 1, background: BORDER, alignSelf: "stretch" }} />}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: isMobile ? 30 : 40, fontWeight: 900, fontFamily: "serif", color: DARK }}>{recOcc}%</div>
            <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginTop: 6 }}>Assumed occupancy %</div>
          </div>
        </div>

        {/* Stacked KPI pyramid */}
        <div style={{ textAlign: "center", borderTop: `1px solid ${BORDER}` }}>
          {[
            { label: "Gross Annual Revenue",     value: `AED ${fmt(proposal.grossAnnualRevenue)}`,    size: 28 },
            { label: "Annual Net Profit Forecast", value: `AED ${fmt(proposal.netOwnerIncome)}`,       size: 36 },
            { label: "Monthly Average Net Payout", value: `AED ${fmt(proposal.monthlyPayout)}`,        size: 28 },
            ...(hasLtr ? [{ label: "vs Long Term Rental", value: `+${proposal.increaseVsLtrPct ?? 0}% Higher Yield`, size: 22, gold: true }] : []),
          ].map(({ label, value, size, gold }) => (
            <div key={label} style={{ padding: "24px 16px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: size, fontWeight: 900, fontFamily: "serif", color: gold ? GOLD : DARK }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={confidential}>Confidential © Royal Holiday Homes</div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 3 — INCOME CALCULATOR
      ══════════════════════════════════════════════ */}
      {hasScenarios && (
        <div style={{ ...page, pageBreakAfter: "always" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
            <div style={sectionLabel}>Income Calculator</div>
          </div>

          {/* LTR reference boxes */}
          {hasLtr && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 28 }}>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Long-term Rental (Average Market Rate)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>AED {fmt(proposal.netLtrIncome)}</div>
              </div>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 6, padding: "16px 20px" }}>
                <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Long-term Rental (With 10% vacancy)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>AED {fmt((proposal.netLtrIncome ?? 0) * 0.9)}</div>
              </div>
            </div>
          )}

          {/* Scenarios — desktop: table, mobile: stacked cards */}
          {isMobile ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {scenarios.map((s: any) => {
                const isConfident = s.name === "Confident";
                const occ = Math.round(s.occupancyRate * 100);
                const costs = s.totalExpenses != null
                  ? s.totalExpenses - (s.grossRevenue ?? 0) * 0.17
                  : (s.grossRevenue ?? 0) - (s.netOwnerIncome ?? 0) - (s.grossRevenue ?? 0) * 0.17;
                const fee = (s.grossRevenue ?? 0) * 0.17;
                const ltr = proposal.netLtrIncome ?? 0;
                const pct = hasLtr && ltr > 0 ? Math.round(((s.netOwnerIncome ?? 0) - ltr) / ltr * 100) : null;
                return (
                  <div key={s.id} style={{ border: isConfident ? `2px solid ${GOLD}` : `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden", background: isConfident ? `${GOLD}08` : WHITE }}>
                    {/* Card header */}
                    <div style={{ padding: "12px 16px", background: isConfident ? `${GOLD}18` : CREAM, borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "serif", color: isConfident ? GOLD : DARK }}>{occ}%</div>
                      {isConfident
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 1, textTransform: "uppercase" }}>Confident</span>
                        : <span style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>Scenario</span>}
                    </div>
                    {/* Key/value rows */}
                    {[
                      { label: "Gross Revenue", value: `AED ${fmt(s.grossRevenue)}` },
                      { label: "Operating Costs", value: `AED ${fmt(Math.max(0, costs))}` },
                      { label: "Management Fees (17%)", value: `AED ${fmt(fee)}` },
                      { label: "Net Annual Income", value: `AED ${fmt(s.netOwnerIncome)}`, bold: true },
                      ...(pct != null ? [{ label: "vs Long-term Rental", value: `${pct >= 0 ? "+" : ""}${pct}%`, accent: true, pct }] : []),
                    ].map(({ label, value, bold, accent, pct: p }: any) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${BORDER}` }}>
                        <span style={{ fontSize: 12, color: "#555" }}>{label}</span>
                        <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: accent ? ((p ?? 0) >= 0 ? "#16a34a" : "#dc2626") : (isConfident && bold ? GOLD : DARK) }}>{value}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, marginTop: 4 }}>
                Note: This is a projection based on current market data. Figures may vary.
              </p>
            </div>
          ) : (
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: CREAM }}>
                    <th style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, color: MUTED, borderBottom: `2px solid ${BORDER}`, width: "36%" }}></th>
                    {scenarios.map((s: any) => {
                      const isConfident = s.name === "Confident";
                      const occ = Math.round(s.occupancyRate * 100);
                      return (
                        <th key={s.id} style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, borderBottom: `2px solid ${BORDER}`, borderLeft: isConfident ? `2px solid ${GOLD}` : `1px solid ${BORDER}`, background: isConfident ? `${GOLD}12` : "transparent", color: isConfident ? GOLD : DARK, width: "16%" }}>
                          <div style={{ fontSize: 18 }}>{occ}%</div>
                          {isConfident && <div style={{ fontSize: 10, fontWeight: 500, color: GOLD, marginTop: 2 }}>Confident</div>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ ...tdLabel("Occupancy"), color: MUTED, fontStyle: "italic" }}>Occupancy</td>
                    {scenarios.map((s: any) => (
                      <td key={s.id} style={tdVal(s.name === "Confident")}>{Math.round(s.occupancyRate * 100)}%</td>
                    ))}
                  </tr>
                  <tr style={{ background: "#F7F5F0" }}>
                    <td colSpan={scenarios.length + 1} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, borderBottom: `1px solid ${BORDER}` }}>Income</td>
                  </tr>
                  <tr>
                    <td style={tdLabel("")}>Gross Annual Revenue (AED)</td>
                    {scenarios.map((s: any) => (
                      <td key={s.id} style={tdVal(s.name === "Confident")}>{fmt(s.grossRevenue)}</td>
                    ))}
                  </tr>
                  <tr style={{ background: "#F7F5F0" }}>
                    <td colSpan={scenarios.length + 1} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, borderBottom: `1px solid ${BORDER}` }}>Costs</td>
                  </tr>
                  <tr>
                    <td style={tdLabel("")}>Total Operating Costs (AED)</td>
                    {scenarios.map((s: any) => {
                      const costs = s.totalExpenses != null
                        ? s.totalExpenses - (s.grossRevenue ?? 0) * 0.17
                        : (s.grossRevenue ?? 0) - (s.netOwnerIncome ?? 0) - (s.grossRevenue ?? 0) * 0.17;
                      return <td key={s.id} style={tdVal(s.name === "Confident")}>{fmt(Math.max(0, costs))}</td>;
                    })}
                  </tr>
                  <tr style={{ background: "#F7F5F0" }}>
                    <td colSpan={scenarios.length + 1} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, borderBottom: `1px solid ${BORDER}` }}>Fees</td>
                  </tr>
                  <tr>
                    <td style={tdLabel("")}>Management Fees (17%)</td>
                    {scenarios.map((s: any) => {
                      const fee = (s.grossRevenue ?? 0) * 0.17;
                      return <td key={s.id} style={tdVal(s.name === "Confident")}>{fmt(fee)}</td>;
                    })}
                  </tr>
                  <tr style={{ background: "#F7F5F0" }}>
                    <td colSpan={scenarios.length + 1} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, borderBottom: `1px solid ${BORDER}` }}>Net Outcome</td>
                  </tr>
                  <tr style={{ fontWeight: 800 }}>
                    <td style={{ ...tdLabel(""), fontWeight: 700, color: DARK }}>Net Annual Income (AED)</td>
                    {scenarios.map((s: any) => (
                      <td key={s.id} style={{ ...tdVal(s.name === "Confident"), fontSize: 14 }}>{fmt(s.netOwnerIncome)}</td>
                    ))}
                  </tr>
                  {hasLtr && (
                    <>
                      <tr style={{ background: "#F7F5F0" }}>
                        <td colSpan={scenarios.length + 1} style={{ padding: "8px 16px", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, borderBottom: `1px solid ${BORDER}` }}>Increase vs Long Term Rental</td>
                      </tr>
                      <tr>
                        <td style={tdLabel("")}>Increase vs Long-term Rental</td>
                        {scenarios.map((s: any) => {
                          const ltr = proposal.netLtrIncome ?? 0;
                          const pct = ltr > 0 ? Math.round(((s.netOwnerIncome ?? 0) - ltr) / ltr * 100) : null;
                          return (
                            <td key={s.id} style={{ ...tdVal(s.name === "Confident"), color: s.name === "Confident" ? GOLD : (pct ?? 0) >= 0 ? "#16a34a" : "#dc2626" }}>
                              {pct != null ? `${pct >= 0 ? "+" : ""}${pct}%` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
              <div style={{ padding: "12px 16px", background: CREAM, borderTop: `1px solid ${BORDER}` }}>
                <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                  Note: Please note this is a projection based on the information we have and the current market. Figures may vary over time depending on the market supply and demand.
                </p>
              </div>
            </div>
          )}

          <div style={confidential}>Confidential © Royal Holiday Homes</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          PAGE 4 — CHARTS
      ══════════════════════════════════════════════ */}
      {(hasScenarios || hasMonthly) && (
        <div style={{ ...page, pageBreakAfter: "always" }}>
          {/* Monthly chart */}
          {hasMonthly && (
            <div style={{ marginBottom: 48 }}>
              <div style={{ ...sectionLabel, textAlign: "right" }}>Expected Revenue Comparison</div>
              <h2 style={{ ...sectionTitle, textAlign: "right", marginBottom: 4 }}>Monthly STR vs LTR Comparison</h2>
              <p style={{ textAlign: "right", fontSize: 12, color: MUTED, marginBottom: 28 }}>Based on Realistic ({recOcc}%) scenario</p>
              <div style={{ height: 280, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 8px 8px", background: WHITE }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthly.map((m: any) => ({ name: MONTH_LABELS[(m.month - 1) % 12], str: Math.round(m.netOwnerIncome ?? 0), ltr: m.ltrBenchmark ? Math.round(m.ltrBenchmark) : null }))} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fill: MUTED, fontSize: 11 }} />
                    <RechartsTooltip formatter={(v: number) => `AED ${fmt(v)}`} contentStyle={{ borderRadius: 6, border: `1px solid ${BORDER}` }} />
                    <Line type="monotone" dataKey="str" name="STR Net" stroke={GOLD} strokeWidth={2.5} dot={{ fill: GOLD, r: 3 }} />
                    {hasLtr && <Line type="monotone" dataKey="ltr" name="LTR" stroke="#ccc" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 12, color: MUTED, justifyContent: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 24, height: 3, background: GOLD, display: "inline-block", borderRadius: 2 }} /> STR Net Income</span>
                {hasLtr && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 24, height: 3, background: "#ccc", display: "inline-block", borderRadius: 2 }} /> LTR Benchmark</span>}
              </div>
            </div>
          )}

          {/* Bar chart */}
          {hasScenarios && (
            <div>
              <div style={{ ...sectionLabel, textAlign: "right" }}>Expected Revenue Comparison</div>
              <h2 style={{ ...sectionTitle, textAlign: "right", marginBottom: 4 }}>Revenue vs Profit Analysis</h2>
              <p style={{ textAlign: "right", fontSize: 12, color: MUTED, marginBottom: 28 }}>Gross revenue vs net income by scenario</p>
              <div style={{ height: 260, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "16px 8px 8px", background: WHITE }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scenarios.map((s: any) => ({ name: s.name, gross: Math.round(s.grossRevenue ?? 0), net: Math.round(s.netOwnerIncome ?? 0) }))} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fill: MUTED, fontSize: 11 }} />
                    <RechartsTooltip formatter={(v: number) => `AED ${fmt(v)}`} contentStyle={{ borderRadius: 6, border: `1px solid ${BORDER}` }} />
                    <Bar dataKey="gross" name="Gross Revenue" radius={[3, 3, 0, 0]} maxBarSize={40}>
                      {scenarios.map((s: any) => <Cell key={s.id} fill={s.name === "Confident" ? `${GOLD}50` : "#E5E0D5"} />)}
                    </Bar>
                    <Bar dataKey="net" name="Net Income" radius={[3, 3, 0, 0]} maxBarSize={40}>
                      {scenarios.map((s: any) => <Cell key={s.id} fill={s.name === "Confident" ? GOLD : "#A09580"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 10, fontSize: 12, color: MUTED, justifyContent: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, background: "#E5E0D5", display: "inline-block", borderRadius: 2 }} /> Gross Revenue</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, background: "#A09580", display: "inline-block", borderRadius: 2 }} /> Net Income</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 14, height: 14, background: GOLD, display: "inline-block", borderRadius: 2 }} /> Confident</span>
              </div>
            </div>
          )}

          <div style={confidential}>Confidential © Royal Holiday Homes</div>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          PAGE 5 — WHY YOUR PROPERTY EARNS MORE
      ══════════════════════════════════════════════ */}
      <div style={{ ...page, pageBreakAfter: "always" }}>
        <h2 style={{ ...sectionTitle, fontSize: 26, marginBottom: 20 }}>Why Your Property Earns More?</h2>
        <div style={{ height: 2, background: GOLD, width: 40, marginBottom: 24 }} />
        <p style={{ fontSize: 14, color: "#555", lineHeight: 1.8, marginBottom: 40, maxWidth: 600 }}>
          Short-term rental properties demonstrate superior revenue performance by strategically capitalizing on seasonal demand fluctuations. Our data-driven approach optimizes pricing across peak, shoulder, and low seasons, ensuring maximum profitability while maintaining competitive occupancy rates throughout the calendar year.
        </p>

        {/* ADR by season */}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>
          Average Daily Rate (ADR) by Season
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16, marginBottom: 40 }}>
          {[
            { label: "Low Season",          value: (proposal as any).lowSeasonAdr,    note: "75% Accuracy" },
            { label: "Peak Season",         value: (proposal as any).peakSeasonAdr,   note: "92% Accuracy" },
            { label: "Average Yearly",      value: proposal.weightedAdr,              note: "85% Accuracy" },
          ].map(({ label, value, note }) => (
            <div key={label} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "serif", color: DARK, marginBottom: 4 }}>AED {fmt(value as any)}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{note}</div>
            </div>
          ))}
        </div>

        {/* Benefits grid */}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>
          Owner Benefits &amp; Value Proposition
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
          {[
            { title: "Dynamic Revenue Capture",   desc: "Leverage premium pricing during high-demand periods to maximize returns." },
            { title: "Market Intelligence",        desc: "Real-time adjustments based on competitive analysis and demand forecasting." },
            { title: "Transparent Analytics",      desc: "Clear insights into performance drivers and revenue attribution." },
            { title: "Consistent Profitability",   desc: "Stable cash flow across all seasonal cycles." },
          ].map(({ title, desc }) => (
            <div key={title} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={confidential}>Confidential © Royal Holiday Homes</div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 6 — WHY HOLIDAY HOMES
      ══════════════════════════════════════════════ */}
      <div style={{ ...page, pageBreakAfter: "always" }}>
        <h2 style={{ ...sectionTitle, fontSize: 26, marginBottom: 4 }}>Why Opt for Holiday Homes?</h2>
        <div style={{ height: 2, background: GOLD, width: 40, marginTop: 12, marginBottom: 32 }} />

        {isMobile ? (
          /* Mobile: one card per benefit topic */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              ["20-58% Higher Returns",          "Higher yield through seasonality",    "Limited pricing flexibility",         "Fixed annual income"],
              ["Asset protection & monitoring",   "Reduced long-term tenant risk",       "Property tied up for 12+ months",     "Tenant disputes and issues"],
              ["Flexibility & owner usage",       "Maintain property value",             "Difficult to use property yourself",  "Wear and tear over time"],
            ].map(([str1, str2, ltr1, ltr2], i) => (
              <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "12px 16px", background: CREAM, borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GOLD, marginBottom: 2 }}>✓ {str1}</div>
                  <div style={{ fontSize: 12, color: "#555" }}>{str2}</div>
                </div>
                <div style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>vs Long-Term Rental</div>
                  <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 4 }}>✕ {ltr1}</div>
                  <div style={{ fontSize: 12, color: "#dc2626" }}>✕ {ltr2}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: 3-column grid table */
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: CREAM, borderBottom: `2px solid ${BORDER}` }}>
              <div style={{ padding: "14px 20px" }} />
              <div style={{ padding: "14px 20px", textAlign: "center", fontWeight: 700, color: GOLD, fontSize: 13, borderLeft: `1px solid ${BORDER}` }}>
                Holiday Home (Short-Term)
              </div>
              <div style={{ padding: "14px 20px", textAlign: "center", fontWeight: 700, color: MUTED, fontSize: 13, borderLeft: `1px solid ${BORDER}` }}>
                Traditional Long-Term Rental
              </div>
            </div>
            {[
              ["20-58% Higher Returns",          "Higher yield through seasonality",    "Limited pricing flexibility",         "Fixed annual income"],
              ["Asset protection & monitoring",   "Reduced long-term tenant risk",       "Property tied up for 12+ months",     "Tenant disputes and issues"],
              ["Flexibility & owner usage",       "Maintain property value",             "Difficult to use property yourself",  "Wear and tear over time"],
            ].map(([str1, str2, ltr1, ltr2], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: `1px solid ${BORDER}` }}>
                <div style={{ padding: "18px 20px", background: CREAM, borderRight: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: DARK, marginBottom: 4 }}>✓ {str1}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{str2}</div>
                </div>
                <div style={{ padding: "18px 20px", borderLeft: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 12, color: "#dc2626" }}>✕ {ltr1}</div>
                  <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>✕ {ltr2}</div>
                </div>
                <div style={{ display: "none" }} />
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 13, color: MUTED, marginTop: 24, fontStyle: "italic", lineHeight: 1.7 }}>
          Holiday homes allow your property to earn more by adapting pricing to market demand and seasonal trends.
        </p>

        <div style={confidential}>Confidential © Royal Holiday Homes</div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 7 — HOW IT WORKS
      ══════════════════════════════════════════════ */}
      <div style={{ ...page, pageBreakAfter: "always" }}>
        <h2 style={{ ...sectionTitle, fontSize: 26, marginBottom: 4 }}>How It Works?</h2>
        <div style={{ height: 2, background: GOLD, width: 40, marginTop: 12, marginBottom: 36 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {HOW_IT_WORKS.map(({ n, title, desc }) => (
            <div key={n} style={{ display: "flex", gap: 24, padding: "20px 0", borderBottom: `1px solid ${BORDER}`, alignItems: "flex-start" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: GOLD, fontWeight: 700, fontSize: 14, marginTop: 2 }}>
                {n}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: DARK, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{title}</div>
                <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={confidential}>Confidential © Royal Holiday Homes</div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 8 — WHY ROYAL HOLIDAY HOMES
      ══════════════════════════════════════════════ */}
      <div style={{ ...page, pageBreakAfter: "always" }}>
        <h2 style={{ ...sectionTitle, fontSize: 26, marginBottom: 4 }}>Why Royal Holiday Homes?</h2>
        <p style={{ fontSize: 13, color: MUTED, fontStyle: "italic", marginTop: 8, marginBottom: 4 }}>We are Operators, Not Just Agents.</p>
        <div style={{ height: 2, background: GOLD, width: 40, marginTop: 12, marginBottom: 36 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {WHY_RHH.map(({ title, desc }) => (
            <div key={title} style={{ padding: "18px 0", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${GOLD}`, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: DARK, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>{desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={confidential}>Confidential © Royal Holiday Homes</div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 9 — PORTFOLIO
      ══════════════════════════════════════════════ */}
      <div style={{ ...page, pageBreakAfter: "always" }}>
        <h2 style={{ ...sectionTitle, fontSize: 26, textAlign: "center", marginBottom: 4 }}>Our Portfolio</h2>
        <div style={{ height: 2, background: GOLD, width: 40, margin: "12px auto 48px" }} />

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)", gap: 24, marginBottom: 40 }}>
          {PORTFOLIO.map(({ v, l }) => (
            <div key={l} style={{ textAlign: "center", padding: "28px 20px", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
              <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "serif", color: DARK, marginBottom: 8 }}>{v}</div>
              <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{l}</div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", fontSize: 13, color: MUTED, fontStyle: "italic", marginBottom: 32 }}>
          Delivering 5 Star Hospitality Excellence
        </p>

        <div style={{ textAlign: "center", fontSize: 12, color: MUTED, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
          Our Distribution Partners
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: MUTED, marginTop: 8 }}>Airbnb · Booking.com · Vrbo · Expedia · And Much More…</p>

        <div style={confidential}>Confidential © Royal Holiday Homes</div>
      </div>

      {/* ══════════════════════════════════════════════
          PAGE 10 — CTA + CONTACT
      ══════════════════════════════════════════════ */}
      <div style={{ ...page }}>
        <h2 style={{ ...sectionTitle, fontSize: 26, marginBottom: 4 }}>Ready to Maximize Your Property's Potential?</h2>
        <div style={{ height: 2, background: GOLD, width: 40, marginTop: 12, marginBottom: 16 }} />
        <p style={{ fontSize: 13, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 32 }}>Next Steps</p>

        <p style={{ fontSize: 14, color: "#555", lineHeight: 1.8, marginBottom: 40 }}>
          {proposal.advisorName
            ? `Your dedicated representative, ${proposal.advisorName}, is ready to assist you every step of the way.`
            : "Reach out to begin onboarding, our team will take care of everything required to prepare, position, and launch your property for successful bookings."}
        </p>

        {/* CTA buttons — hidden on print */}
        <div className="print:hidden" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 48 }}>
          {submitted ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 24px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
              <CheckCircle2 style={{ width: 20, height: 20, color: "#16a34a" }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: "#16a34a" }}>Thank you! Your representative will be in touch shortly.</span>
            </div>
          ) : (
            <>
              <button onClick={() => setDialogType("accept")}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 24px", borderRadius: 8, background: DARK, color: WHITE, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                <CheckCircle2 style={{ width: 18, height: 18, color: GOLD }} /> Accept Proposal
              </button>
              <button onClick={() => setDialogType("call")}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 24px", borderRadius: 8, background: WHITE, color: DARK, border: `1.5px solid ${BORDER}`, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                <Phone style={{ width: 18, height: 18 }} /> Request a Call
              </button>
              <button onClick={() => setDialogType("question")}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 24px", borderRadius: 8, background: WHITE, color: DARK, border: `1.5px solid ${BORDER}`, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                <ArrowRight style={{ width: 18, height: 18 }} /> Ask a Question
              </button>
            </>
          )}
        </div>

        {/* Contact block */}
        <div style={{ borderTop: `2px solid ${BORDER}`, paddingTop: 36 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 20 }}>Contact Us</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 24 : 40 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "#555" }}>
              <div>📞 {proposal.companyPhone ?? "800 RHH"}</div>
              <div>🌐 www.royalholidayhomes.ae</div>
              <div>📧 Landlords: owners@royalholidayhomes.ae</div>
              <div style={{ paddingLeft: 20, fontSize: 12, color: MUTED }}>Guests: bookings@royalholidayhomes.ae</div>
              <div>📍 Suite 503, Al Neyadi Building – Sheikh Rashid Bin Saeed St – Al Manhal – Abu Dhabi.</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
              <div style={{ textAlign: isMobile ? "left" : "right" }}>
                <img src="/rhh-logo.png" alt="RHH" style={{ height: 32, width: "auto", marginBottom: 8 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "serif", color: DARK }}>Royal Holiday Homes</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Ref: {proposal.referenceNumber}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                  Expires: {new Date(proposal.expiresAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ ...confidential, marginTop: 32 }}>
          <p>{proposal.disclaimer ?? "This forecast is an estimate based on historical market data and comparable properties. Actual revenue may vary and is not guaranteed."}</p>
          <p style={{ marginTop: 6 }}>Confidential © Royal Holiday Homes {new Date().getFullYear()}. All rights reserved.</p>
        </div>
      </div>

      {/* ── Action dialogs ── */}
      <Dialog open={dialogType !== null} onOpenChange={open => !open && setDialogType(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {dialogType === "accept" ? "Accept Proposal" : dialogType === "call" ? "Request a Callback" : "Ask a Question"}
            </DialogTitle>
            <DialogDescription>
              {dialogType === "accept" ? "We'll get in touch to finalise your management agreement." :
               dialogType === "call"   ? "Provide your number and we'll call you at your convenience." :
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
            <Button onClick={handleSubmit} disabled={submitAction.isPending} style={{ background: DARK, color: WHITE }}>
              {submitAction.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 8mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
