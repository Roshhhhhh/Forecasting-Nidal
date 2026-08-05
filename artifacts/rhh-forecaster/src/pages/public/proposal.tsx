import { useGetPublicProposal, useSubmitProposalAction } from "@workspace/api-client-react";
import { useParams } from "wouter";
import {
  FileText, Printer, Phone, CheckCircle2, ArrowRight, MapPin,
  TrendingUp, X, Check, ChevronRight, Star, Shield, Award,
  Building2, Users, Percent, Calendar,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Cell,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

// ── Brand tokens ──────────────────────────────────────────────────────────────
const GOLD   = "#C9A84C";
const GOLD2  = "#E6C97A";
const DARK   = "#1C1C1C";
const DARK2  = "#111111";
const CREAM  = "#FDFCF8";
const WHITE  = "#FFFFFF";
const BORDER = "#E8E4DC";
const MUTED  = "#888888";
const GREEN  = "#16a34a";
const RED    = "#dc2626";

function fmt(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(v);
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const HOW_IT_WORKS = [
  { n: 1, title: "Onboarding",         desc: "Simple onboarding with clear terms, timelines, and revenue expectations." },
  { n: 2, title: "Licensing",          desc: "We handle all holiday home permits and compliance requirements." },
  { n: 3, title: "Setup",              desc: "Professional setup to maximise guest appeal and booking potential." },
  { n: 4, title: "Listing & Pricing",  desc: "Listed across top platforms with demand-based dynamic pricing." },
  { n: 5, title: "Operations",         desc: "End-to-end guest handling, housekeeping, and maintenance." },
  { n: 6, title: "Revenue Management", desc: "Continuous performance tracking with transparent monthly reports." },
  { n: 7, title: "Monthly Payout",     desc: "Net earnings transferred directly to you every month." },
];

const WHY_RHH = [
  { icon: MapPin,       title: "Abu Dhabi Specialists",  desc: "Deep local knowledge of building regulations, hotspots, and guest preferences." },
  { icon: TrendingUp,   title: "Earn More",              desc: "We provide a performance-first environment — our goals are aligned because we only earn when you earn." },
  { icon: Shield,       title: "In-House Teams",         desc: "Our cleaning, maintenance, and laundry are not outsourced — quality is always our responsibility." },
  { icon: Award,        title: "Proven Compliance",      desc: "Fully licensed by the Department of Culture and Tourism — operating with full regulatory authority." },
  { icon: Star,         title: "Hassle Free",            desc: "We're committed to making your ownership experience smooth, comfortable, and enjoyable." },
  { icon: Percent,      title: "Value for Money",        desc: "Transparent pricing you can trust. We constantly evaluate our offerings to deliver real value." },
];

const PORTFOLIO = [
  { v: "160+",   l: "Managed Premium Properties", icon: Building2 },
  { v: "5,000+", l: "5-Star Guest Reviews",        icon: Star },
  { v: "1,000+", l: "Bookings per Month",          icon: Calendar },
  { v: "3,500+", l: "Travelers Hosted Monthly",    icon: Users },
  { v: "AED 250M", l: "Assets Under Management",   icon: Award },
  { v: "100+",   l: "Trusted Home Owners",          icon: Shield },
];

const TABS = [
  { id: "overview",    label: "Overview" },
  { id: "financials",  label: "Financials" },
  { id: "why-str",     label: "Why STR?" },
  { id: "process",     label: "Our Process" },
  { id: "next-steps",  label: "Next Steps" },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PublicProposal() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const { data: proposal, isLoading, error } = useGetPublicProposal(token || "");
  const submitAction = useSubmitProposalAction();

  const [activeTab, setActiveTab] = useState("overview");
  const [dialogType, setDialogType] = useState<"accept" | "call" | "question" | null>(null);
  const [comment, setComment] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  if (isLoading) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: DARK }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 48, height: 48, border: `3px solid ${GOLD}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 20px" }} />
        <p style={{ color: "#888", fontFamily: "serif", fontSize: 16, letterSpacing: 1 }}>Preparing your proposal…</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !proposal) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: DARK, padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <FileText style={{ width: 56, height: 56, color: "#555", margin: "0 auto 20px" }} />
        <h2 style={{ fontSize: 24, fontFamily: "serif", fontWeight: 700, marginBottom: 12, color: WHITE }}>Proposal Unavailable</h2>
        <p style={{ color: "#888", lineHeight: 1.7 }}>This link has expired or is invalid. Please contact your Royal Holiday Homes representative.</p>
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
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const confidentScenario = scenarios.find((s: any) => s.name === "Confident") ?? scenarios[Math.floor(scenarios.length / 2)];

  return (
    <div style={{ background: CREAM, fontFamily: "'Inter','Segoe UI',sans-serif", color: DARK, minHeight: "100dvh" }}>

      {/* ── Sticky Header ── */}
      <header className="print:hidden" style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(28,28,28,0.97)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(201,168,76,0.2)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "0 16px" : "0 40px" }}>
          {/* Top bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src="/rhh-logo.png" alt="RHH" style={{ height: 28, width: "auto" }}
                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              {!isMobile && <span style={{ fontFamily: "serif", fontSize: 15, fontWeight: 700, color: WHITE, letterSpacing: 0.5 }}>Royal Holiday Homes</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 12 : 24 }}>
              {!isMobile && (
                <>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#666", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 1 }}>Ref</div>
                    <div style={{ fontSize: 12, color: "#ccc", fontWeight: 600 }}>{proposal.referenceNumber}</div>
                  </div>
                  <div style={{ width: 1, height: 30, background: "rgba(255,255,255,0.1)" }} />
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#666", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 1 }}>Date</div>
                    <div style={{ fontSize: 12, color: "#ccc", fontWeight: 600 }}>{propDate}</div>
                  </div>
                </>
              )}
              <button onClick={() => window.print()}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 6, background: GOLD, color: DARK, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                <Printer style={{ width: 14, height: 14 }} /> {isMobile ? "PDF" : "Download PDF"}
              </button>
            </div>
          </div>

          {/* Tab nav */}
          <nav style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: isMobile ? "10px 14px" : "13px 20px",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: isMobile ? 12 : 13, fontWeight: activeTab === tab.id ? 700 : 500,
                  color: activeTab === tab.id ? GOLD : "#888",
                  borderBottom: activeTab === tab.id ? `2px solid ${GOLD}` : "2px solid transparent",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                  letterSpacing: 0.3,
                }}>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Tab Content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "0 16px 60px" : "0 40px 80px" }}>

        {/* ════════════════════════ OVERVIEW ════════════════════════ */}
        {(activeTab === "overview") && (
          <div>
            {/* Hero */}
            <div style={{
              margin: isMobile ? "24px -16px 0" : "32px -40px 0",
              padding: isMobile ? "56px 24px 48px" : "80px 80px 64px",
              background: `linear-gradient(135deg, ${DARK2} 0%, #2a2218 60%, ${DARK} 100%)`,
              position: "relative", overflow: "hidden",
            }}>
              {/* Gold accent line */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD2} 50%, transparent 100%)` }} />
              {/* Background pattern */}
              <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle at 70% 50%, #C9A84C 0%, transparent 60%)" }} />

              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: GOLD, marginBottom: 20 }}>
                  Exclusively Prepared For
                </div>
                <h1 style={{ fontFamily: "serif", fontSize: isMobile ? 28 : 48, fontWeight: 800, color: WHITE, lineHeight: 1.15, marginBottom: 8, maxWidth: 700 }}>
                  {proposal.ownerTitle ? `${proposal.ownerTitle} ` : ""}{proposal.ownerName}
                </h1>
                <p style={{ fontSize: isMobile ? 14 : 18, color: "#aaa", marginBottom: 40, fontWeight: 400 }}>
                  Property Management Proposal
                </p>

                {/* Property chip */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8, marginBottom: 40 }}>
                  <MapPin style={{ width: 14, height: 14, color: GOLD }} />
                  <span style={{ fontSize: 13, color: "#ccc" }}>{proposal.propertyAddress}</span>
                </div>

                {/* Hero KPI strip */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 1, background: "rgba(255,255,255,0.06)", borderRadius: 12, overflow: "hidden" }}>
                  {[
                    { label: "Annual Net Income",   value: `AED ${fmt(proposal.netOwnerIncome)}`,    accent: true },
                    { label: "Monthly Payout",       value: `AED ${fmt(proposal.monthlyPayout)}`,     accent: false },
                    { label: "Occupancy Assumed",    value: `${recOcc}%`,                              accent: false },
                    ...(hasLtr ? [{ label: "vs Long-Term Rental", value: `+${proposal.increaseVsLtrPct ?? 0}%`, accent: false, green: true }] : []),
                  ].map(({ label, value, accent, green }: any) => (
                    <div key={label} style={{ padding: isMobile ? "20px 16px" : "28px 24px", background: accent ? `rgba(201,168,76,0.12)` : "transparent", borderLeft: accent ? `3px solid ${GOLD}` : "none", transition: "background 0.2s" }}>
                      <div style={{ fontSize: 10, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
                      <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, fontFamily: "serif", color: accent ? GOLD : green ? "#4ade80" : WHITE }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Property Details + Narrative */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1.6fr", gap: 24, marginTop: 32 }}>
              {/* Property card */}
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "28px 28px", background: WHITE }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: MUTED, marginBottom: 20 }}>Property Details</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { label: "Type",    value: proposal.propertyType },
                    { label: "Beds",    value: `${proposal.bedrooms} Bedroom${(proposal.bedrooms ?? 1) !== 1 ? "s" : ""}` },
                    { label: "Baths",   value: `${proposal.bathrooms} Bathroom${(proposal.bathrooms ?? 1) !== 1 ? "s" : ""}` },
                    { label: "Size",    value: proposal.internalArea ? `${fmt(proposal.internalArea)} sq.ft.` : null },
                    { label: "View",    value: proposal.view },
                  ].filter(x => x.value).map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `1px solid ${BORDER}` }}>
                      <span style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: DARK, textTransform: "capitalize" }}>{value}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 20, padding: "12px 16px", background: CREAM, borderRadius: 8, fontSize: 12, color: "#666", lineHeight: 1.6 }}>
                  <span style={{ color: MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 4 }}>Representative</span>
                  {proposal.advisorName ?? "Royal Holiday Homes Team"}
                </div>
              </div>

              {/* Narrative card */}
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "28px 32px", background: WHITE, display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: MUTED, marginBottom: 20 }}>Our Assessment</div>
                <p style={{ fontSize: 16, color: "#444", lineHeight: 1.9, fontFamily: "serif", flex: 1 }}>
                  {proposal.narrativeText ??
                    `Based on our analysis of comparable units in ${proposal.propertyAddress?.split(",")[0] ?? "Abu Dhabi"}, we forecast your property to generate AED ${fmt(proposal.grossAnnualRevenue)} annually at ${recOcc}% occupancy — representing a +${proposal.increaseVsLtrPct ?? 0}% increase compared to traditional long-term leasing.`}
                </p>
                <div style={{ marginTop: 28, paddingTop: 20, borderTop: `1px solid ${BORDER}`, display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button onClick={() => { setActiveTab("financials"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 8, background: DARK, color: WHITE, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                    View Financials <ChevronRight style={{ width: 15, height: 15 }} />
                  </button>
                  <button onClick={() => setDialogType("question")}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 8, background: WHITE, color: DARK, border: `1.5px solid ${BORDER}`, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                    Ask a Question
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════ FINANCIALS ════════════════════════ */}
        {activeTab === "financials" && (
          <div style={{ paddingTop: 40 }}>
            {/* Section header */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>Executive Summary</div>
              <h2 style={{ fontFamily: "serif", fontSize: isMobile ? 26 : 36, fontWeight: 800, color: DARK }}>Financial Forecast</h2>
              <div style={{ height: 3, width: 48, background: GOLD, marginTop: 12 }} />
            </div>

            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
              {[
                { label: "Gross Annual Revenue",   value: `AED ${fmt(proposal.grossAnnualRevenue)}`, sub: "Before costs", highlight: false },
                { label: "Annual Net Income",       value: `AED ${fmt(proposal.netOwnerIncome)}`,     sub: "Your take-home", highlight: true },
                { label: "Monthly Net Payout",      value: `AED ${fmt(proposal.monthlyPayout)}`,      sub: "Avg per month", highlight: false },
                { label: "Avg Daily Rate",          value: `AED ${fmt(proposal.weightedAdr)}`,         sub: `At ${recOcc}% occupancy`, highlight: false },
              ].map(({ label, value, sub, highlight }) => (
                <div key={label} style={{
                  border: highlight ? `2px solid ${GOLD}` : `1px solid ${BORDER}`,
                  borderRadius: 12, padding: "24px 20px",
                  background: highlight ? `linear-gradient(135deg, ${DARK} 0%, #2a2218 100%)` : WHITE,
                  position: "relative", overflow: "hidden",
                }}>
                  {highlight && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${GOLD}, ${GOLD2})` }} />}
                  <div style={{ fontSize: 10, color: highlight ? "#888" : MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>{label}</div>
                  <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 900, fontFamily: "serif", color: highlight ? GOLD : DARK, marginBottom: 4 }}>{value}</div>
                  <div style={{ fontSize: 11, color: highlight ? "#666" : "#aaa" }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* LTR comparison */}
            {hasLtr && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 40 }}>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px", background: WHITE }}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>LTR Market Rate</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>AED {fmt(proposal.netLtrIncome)}</div>
                </div>
                <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "20px 24px", background: WHITE }}>
                  <div style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>LTR With 10% Vacancy</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: DARK }}>AED {fmt((proposal.netLtrIncome ?? 0) * 0.9)}</div>
                </div>
                <div style={{ border: `2px solid #bbf7d0`, borderRadius: 10, padding: "20px 24px", background: "#f0fdf4" }}>
                  <div style={{ fontSize: 10, color: "#166534", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Your STR Advantage</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>+{proposal.increaseVsLtrPct ?? 0}% Higher</div>
                </div>
              </div>
            )}

            {/* Scenarios table */}
            {hasScenarios && (
              <div style={{ marginBottom: 40 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: DARK, marginBottom: 20, textTransform: "uppercase", letterSpacing: 1 }}>Income Calculator — By Scenario</h3>
                {isMobile ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {scenarios.map((s: any) => {
                      const isConf = s.name === "Confident";
                      const occ = Math.round(s.occupancyRate * 100);
                      const fee = (s.grossRevenue ?? 0) * 0.17;
                      const costs = (s.grossRevenue ?? 0) - (s.netOwnerIncome ?? 0) - fee;
                      const ltr = proposal.netLtrIncome ?? 0;
                      const pct = hasLtr && ltr > 0 ? Math.round(((s.netOwnerIncome ?? 0) - ltr) / ltr * 100) : null;
                      return (
                        <div key={s.id} style={{ border: isConf ? `2px solid ${GOLD}` : `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden", background: isConf ? `${DARK}` : WHITE }}>
                          <div style={{ padding: "14px 20px", background: isConf ? `rgba(201,168,76,0.12)` : CREAM, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${BORDER}` }}>
                            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "serif", color: isConf ? GOLD : DARK }}>{occ}%</div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: isConf ? GOLD : MUTED, letterSpacing: 1, textTransform: "uppercase" }}>{s.name}</span>
                          </div>
                          {[
                            { label: "Gross Revenue",      value: `AED ${fmt(s.grossRevenue)}` },
                            { label: "Operating Costs",    value: `AED ${fmt(Math.max(0, costs))}` },
                            { label: "Management (17%)",   value: `AED ${fmt(fee)}` },
                            { label: "Net Annual Income",  value: `AED ${fmt(s.netOwnerIncome)}`, bold: true },
                            ...(pct != null ? [{ label: "vs LTR", value: `${pct >= 0 ? "+" : ""}${pct}%`, color: pct >= 0 ? GREEN : RED }] : []),
                          ].map(({ label, value, bold, color }: any) => (
                            <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "11px 20px", borderBottom: `1px solid ${BORDER}` }}>
                              <span style={{ fontSize: 12, color: isConf ? "#999" : "#666" }}>{label}</span>
                              <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: color ?? (isConf ? GOLD : DARK) }}>{value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "14px 20px", textAlign: "left", fontWeight: 600, color: MUTED, background: CREAM, borderBottom: `1px solid ${BORDER}`, width: "34%" }}></th>
                          {scenarios.map((s: any) => {
                            const isConf = s.name === "Confident";
                            return (
                              <th key={s.id} style={{ padding: "14px 16px", textAlign: "right", fontWeight: 700, borderBottom: `2px solid ${isConf ? GOLD : BORDER}`, borderLeft: `1px solid ${BORDER}`, background: isConf ? DARK : CREAM, color: isConf ? GOLD : DARK }}>
                                <div style={{ fontSize: 20 }}>{Math.round(s.occupancyRate * 100)}%</div>
                                <div style={{ fontSize: 10, fontWeight: 500, marginTop: 2, color: isConf ? "#888" : MUTED }}>{s.name}</div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: "Gross Annual Revenue", fn: (s: any) => fmt(s.grossRevenue) },
                          { label: "Operating Costs",      fn: (s: any) => fmt(Math.max(0, (s.grossRevenue ?? 0) - (s.netOwnerIncome ?? 0) - (s.grossRevenue ?? 0) * 0.17)) },
                          { label: "Management Fee (17%)", fn: (s: any) => fmt((s.grossRevenue ?? 0) * 0.17) },
                          { label: "Net Annual Income",    fn: (s: any) => fmt(s.netOwnerIncome), bold: true, large: true },
                          ...(hasLtr ? [{ label: "vs Long-Term Rental", fn: (s: any) => {
                            const ltr = proposal.netLtrIncome ?? 0;
                            const p = ltr > 0 ? Math.round(((s.netOwnerIncome ?? 0) - ltr) / ltr * 100) : null;
                            return p != null ? `${p >= 0 ? "+" : ""}${p}%` : "—";
                          }, green: true }] : []),
                        ].map(({ label, fn, bold, large, green }: any) => (
                          <tr key={label} style={{ borderTop: `1px solid ${BORDER}` }}>
                            <td style={{ padding: "13px 20px", fontSize: 13, color: "#555", background: `${CREAM}80` }}>{label}</td>
                            {scenarios.map((s: any) => {
                              const isConf = s.name === "Confident";
                              const val = fn(s);
                              const isGreenVal = green && val?.startsWith("+");
                              return (
                                <td key={s.id} style={{ padding: "13px 16px", textAlign: "right", fontWeight: bold ? 800 : 600, fontSize: large ? 15 : 13, background: isConf ? `rgba(28,28,28,0.03)` : "transparent", borderLeft: `1px solid ${isConf ? GOLD + "40" : BORDER}`, color: isConf && bold ? GOLD : green ? (isGreenVal ? GREEN : RED) : DARK }}>
                                  {val}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: "10px 20px", background: CREAM, borderTop: `1px solid ${BORDER}` }}>
                      <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>Projection based on current market data. Actual figures may vary with market conditions.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Charts */}
            {(hasMonthly || hasScenarios) && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24 }}>
                {hasMonthly && (
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "24px 20px", background: WHITE }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>Monthly Breakdown</div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 4 }}>STR vs LTR Monthly</h4>
                    <p style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Net income at {recOcc}% occupancy</p>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthly.map((m: any) => ({ name: MONTH_LABELS[(m.month - 1) % 12], str: Math.round(m.netOwnerIncome ?? 0), ltr: m.ltrBenchmark ? Math.round(m.ltrBenchmark) : null }))} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fill: MUTED, fontSize: 11 }} />
                          <RechartsTooltip formatter={(v: number) => `AED ${fmt(v)}`} contentStyle={{ borderRadius: 8, border: `1px solid ${BORDER}` }} />
                          <Line type="monotone" dataKey="str" name="STR Net" stroke={GOLD} strokeWidth={2.5} dot={{ fill: GOLD, r: 3 }} />
                          {hasLtr && <Line type="monotone" dataKey="ltr" name="LTR" stroke="#ccc" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 11, color: MUTED, justifyContent: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 20, height: 2.5, background: GOLD, display: "inline-block", borderRadius: 2 }} /> STR Net</span>
                      {hasLtr && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 20, height: 2, background: "#ccc", display: "inline-block", borderRadius: 2 }} /> LTR</span>}
                    </div>
                  </div>
                )}
                {hasScenarios && (
                  <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "24px 20px", background: WHITE }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: GOLD, marginBottom: 6 }}>Scenario Analysis</div>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: DARK, marginBottom: 4 }}>Revenue vs Net Income</h4>
                    <p style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Gross vs net per occupancy scenario</p>
                    <div style={{ height: 240 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scenarios.map((s: any) => ({ name: s.name, gross: Math.round(s.grossRevenue ?? 0), net: Math.round(s.netOwnerIncome ?? 0) }))} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: MUTED, fontSize: 11 }} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} tick={{ fill: MUTED, fontSize: 11 }} />
                          <RechartsTooltip formatter={(v: number) => `AED ${fmt(v)}`} contentStyle={{ borderRadius: 8, border: `1px solid ${BORDER}` }} />
                          <Bar dataKey="gross" name="Gross" radius={[3, 3, 0, 0]} maxBarSize={36}>
                            {scenarios.map((s: any) => <Cell key={s.id} fill={s.name === "Confident" ? `${GOLD}50` : "#E5E0D5"} />)}
                          </Bar>
                          <Bar dataKey="net" name="Net Income" radius={[3, 3, 0, 0]} maxBarSize={36}>
                            {scenarios.map((s: any) => <Cell key={s.id} fill={s.name === "Confident" ? GOLD : "#A09580"} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: MUTED, justifyContent: "center" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, background: "#E5E0D5", display: "inline-block", borderRadius: 2 }} /> Gross</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, background: "#A09580", display: "inline-block", borderRadius: 2 }} /> Net</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 12, background: GOLD, display: "inline-block", borderRadius: 2 }} /> Confident</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════ WHY STR ════════════════════════ */}
        {activeTab === "why-str" && (
          <div style={{ paddingTop: 40 }}>
            <div style={{ marginBottom: 48 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>The Smart Choice</div>
              <h2 style={{ fontFamily: "serif", fontSize: isMobile ? 26 : 36, fontWeight: 800, color: DARK }}>Why Short-Term Rental?</h2>
              <div style={{ height: 3, width: 48, background: GOLD, marginTop: 12 }} />
            </div>

            {/* STR vs LTR comparison */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 20, marginBottom: 48 }}>
              {/* STR column */}
              <div style={{ borderRadius: 16, overflow: "hidden", border: `2px solid ${GOLD}` }}>
                <div style={{ padding: "20px 28px", background: `linear-gradient(135deg, ${DARK} 0%, #2a2218 100%)`, borderBottom: `2px solid ${GOLD}` }}>
                  <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Holiday Home (Short-Term)</div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "serif", color: WHITE }}>Your Best Option</div>
                </div>
                <div style={{ background: WHITE }}>
                  {[
                    { title: "20-58% Higher Returns",           desc: "Higher yield through seasonal demand pricing" },
                    { title: "Asset Protection & Monitoring",    desc: "Reduced long-term tenant risk and wear" },
                    { title: "Flexibility & Owner Usage",        desc: "Block dates and use your own property" },
                    { title: "Dynamic Revenue Capture",          desc: "Leverage peak-season pricing surges" },
                    { title: "Professional Management",          desc: "We handle everything end-to-end" },
                  ].map(({ title, desc }) => (
                    <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 28px", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${GOLD}20`, border: `1.5px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <Check style={{ width: 12, height: 12, color: GOLD }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 2 }}>{title}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LTR column */}
              <div style={{ borderRadius: 16, overflow: "hidden", border: `1px solid ${BORDER}` }}>
                <div style={{ padding: "20px 28px", background: CREAM, borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 11, color: MUTED, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Traditional Long-Term Rental</div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "serif", color: "#888" }}>Standard Option</div>
                </div>
                <div style={{ background: WHITE }}>
                  {[
                    { title: "Limited Pricing Flexibility",    desc: "Fixed annual income regardless of market" },
                    { title: "Property Tied Up 12+ Months",   desc: "You cannot use your own property" },
                    { title: "Tenant Disputes & Issues",      desc: "Difficult eviction process if problems arise" },
                    { title: "Wear & Tear Over Time",         desc: "Less frequent property inspections" },
                    { title: "Minimal Revenue Upside",        desc: "No ability to benefit from peak seasons" },
                  ].map(({ title, desc }) => (
                    <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 28px", borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff0f0", border: "1.5px solid #fca5a5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                        <X style={{ width: 12, height: 12, color: "#dc2626" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#888", marginBottom: 2 }}>{title}</div>
                        <div style={{ fontSize: 12, color: "#aaa" }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ADR by season */}
            <div style={{ marginBottom: 48 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: MUTED, marginBottom: 20 }}>Average Daily Rate (ADR) by Season</h3>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
                {[
                  { label: "Low Season",     value: (proposal as any).lowSeasonAdr,  acc: "75% Accuracy",  bg: CREAM },
                  { label: "Average Yearly", value: proposal.weightedAdr,             acc: "85% Accuracy",  bg: `${GOLD}10` },
                  { label: "Peak Season",    value: (proposal as any).peakSeasonAdr, acc: "92% Accuracy",  bg: DARK, dark: true },
                ].map(({ label, value, acc, bg, dark }) => (
                  <div key={label} style={{ borderRadius: 12, padding: "28px 24px", background: bg, border: dark ? `2px solid ${GOLD}` : `1px solid ${BORDER}`, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: dark ? "#888" : MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10 }}>{label}</div>
                    <div style={{ fontSize: 30, fontWeight: 900, fontFamily: "serif", color: dark ? GOLD : DARK, marginBottom: 6 }}>AED {fmt(value as any)}</div>
                    <div style={{ fontSize: 11, color: dark ? "#666" : "#bbb", fontStyle: "italic" }}>{acc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Earn more callout */}
            <div style={{ borderRadius: 16, padding: isMobile ? "32px 24px" : "48px 56px", background: `linear-gradient(135deg, ${DARK2} 0%, #2a2218 100%)`, border: `1px solid ${GOLD}40`, textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, opacity: 0.06, backgroundImage: `radial-gradient(circle at 50% 50%, ${GOLD} 0%, transparent 60%)` }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 12 }}>Your Property's Potential</div>
                <div style={{ fontFamily: "serif", fontSize: isMobile ? 28 : 44, fontWeight: 900, color: WHITE, marginBottom: 8 }}>
                  +{proposal.increaseVsLtrPct ?? 0}% More Than LTR
                </div>
                <p style={{ fontSize: 15, color: "#888", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.7 }}>
                  Holiday homes allow your property to earn more by adapting pricing to market demand and seasonal trends. This is your estimated additional income.
                </p>
                <div style={{ fontSize: 32, fontWeight: 900, fontFamily: "serif", color: GOLD }}>
                  AED {fmt((proposal.netOwnerIncome ?? 0) - (proposal.netLtrIncome ?? 0))} / year extra
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════ PROCESS ════════════════════════ */}
        {activeTab === "process" && (
          <div style={{ paddingTop: 40 }}>
            {/* How It Works */}
            <div style={{ marginBottom: 56 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>Simple & Transparent</div>
              <h2 style={{ fontFamily: "serif", fontSize: isMobile ? 26 : 36, fontWeight: 800, color: DARK }}>How It Works</h2>
              <div style={{ height: 3, width: 48, background: GOLD, marginTop: 12, marginBottom: 40 }} />

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 2 }}>
                {HOW_IT_WORKS.slice(0, 4).map(({ n, title, desc }) => (
                  <div key={n} style={{ padding: "28px 24px", background: WHITE, border: `1px solid ${BORDER}`, borderLeft: n === 1 ? `3px solid ${GOLD}` : `1px solid ${BORDER}`, position: "relative" }}>
                    <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "serif", color: `${GOLD}30`, marginBottom: 12, lineHeight: 1 }}>{String(n).padStart(2, "0")}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: DARK, marginBottom: 8 }}>{title}</div>
                    <div style={{ fontSize: 12, color: "#666", lineHeight: 1.7 }}>{desc}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 2, marginTop: 2 }}>
                {HOW_IT_WORKS.slice(4).map(({ n, title, desc }) => (
                  <div key={n} style={{ padding: "28px 24px", background: n === 7 ? DARK : WHITE, border: `1px solid ${BORDER}`, position: "relative" }}>
                    <div style={{ fontSize: 36, fontWeight: 900, fontFamily: "serif", color: n === 7 ? GOLD : `${GOLD}30`, marginBottom: 12, lineHeight: 1 }}>{String(n).padStart(2, "0")}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: n === 7 ? WHITE : DARK, marginBottom: 8 }}>{title}</div>
                    <div style={{ fontSize: 12, color: n === 7 ? "#888" : "#666", lineHeight: 1.7 }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Why RHH */}
            <div style={{ marginBottom: 56 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>Our Difference</div>
              <h2 style={{ fontFamily: "serif", fontSize: isMobile ? 24 : 32, fontWeight: 800, color: DARK }}>Why Royal Holiday Homes?</h2>
              <p style={{ fontSize: 14, color: MUTED, fontStyle: "italic", marginTop: 4, marginBottom: 32 }}>We are Operators, Not Just Agents.</p>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                {WHY_RHH.map(({ icon: Icon, title, desc }) => (
                  <div key={title} style={{ display: "flex", gap: 16, padding: "24px 24px", border: `1px solid ${BORDER}`, borderRadius: 12, background: WHITE, alignItems: "flex-start" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 10, background: `${GOLD}15`, border: `1px solid ${GOLD}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon style={{ width: 18, height: 18, color: GOLD }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: DARK, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{title}</div>
                      <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 8 }}>Track Record</div>
              <h2 style={{ fontFamily: "serif", fontSize: isMobile ? 24 : 32, fontWeight: 800, color: DARK, marginBottom: 32 }}>Our Portfolio</h2>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 16 }}>
                {PORTFOLIO.map(({ v, l, icon: Icon }) => (
                  <div key={l} style={{ textAlign: "center", padding: isMobile ? "24px 16px" : "36px 24px", border: `1px solid ${BORDER}`, borderRadius: 12, background: WHITE }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: `${GOLD}15`, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon style={{ width: 16, height: 16, color: GOLD }} />
                    </div>
                    <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 900, fontFamily: "serif", color: DARK, marginBottom: 6 }}>{v}</div>
                    <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1, lineHeight: 1.4 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, padding: "20px 28px", background: CREAM, borderRadius: 10, border: `1px solid ${BORDER}`, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: MUTED, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Our Distribution Partners</div>
                <p style={{ fontSize: 15, color: "#555", fontWeight: 600 }}>Airbnb · Booking.com · Vrbo · Expedia · And Much More</p>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════ NEXT STEPS ════════════════════════ */}
        {activeTab === "next-steps" && (
          <div style={{ paddingTop: 40 }}>
            {/* Hero CTA */}
            <div style={{ borderRadius: 20, padding: isMobile ? "40px 24px" : "64px 72px", background: `linear-gradient(135deg, ${DARK2} 0%, #2a2218 100%)`, border: `1px solid ${GOLD}40`, marginBottom: 48, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, opacity: 0.05, backgroundImage: `radial-gradient(circle at 80% 50%, ${GOLD} 0%, transparent 60%)` }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: GOLD, marginBottom: 16 }}>You're One Step Away</div>
                <h2 style={{ fontFamily: "serif", fontSize: isMobile ? 26 : 42, fontWeight: 800, color: WHITE, lineHeight: 1.2, marginBottom: 16, maxWidth: 560 }}>
                  Ready to Maximise Your Property's Potential?
                </h2>
                <p style={{ fontSize: isMobile ? 14 : 16, color: "#999", lineHeight: 1.8, marginBottom: 36, maxWidth: 500 }}>
                  {proposal.advisorName
                    ? `Your dedicated representative, ${proposal.advisorName}, is ready to guide you through every step.`
                    : "Our team will take care of everything required to prepare, position, and launch your property for successful bookings."}
                </p>
                {submitted ? (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "16px 28px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12 }}>
                    <CheckCircle2 style={{ width: 22, height: 22, color: GREEN }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: GREEN }}>Thank you! We'll be in touch shortly.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <button onClick={() => setDialogType("accept")}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 32px", borderRadius: 10, background: GOLD, color: DARK, border: "none", cursor: "pointer", fontSize: 15, fontWeight: 800, letterSpacing: 0.3 }}>
                      <CheckCircle2 style={{ width: 18, height: 18 }} /> Accept Proposal
                    </button>
                    <button onClick={() => setDialogType("call")}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 28px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: WHITE, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                      <Phone style={{ width: 16, height: 16 }} /> Request a Call
                    </button>
                    <button onClick={() => setDialogType("question")}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "15px 28px", borderRadius: 10, background: "rgba(255,255,255,0.08)", color: WHITE, border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
                      <ArrowRight style={{ width: 16, height: 16 }} /> Ask a Question
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Contact */}
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 24, marginBottom: 48 }}>
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: "32px 32px", background: WHITE }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: MUTED, marginBottom: 20 }}>Contact Us</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14, color: "#555" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>📞</span>
                    <span style={{ fontWeight: 600 }}>{proposal.companyPhone ?? "800 RHH"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🌐</span>
                    <a href="https://www.royalholidayhomes.ae" style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>www.royalholidayhomes.ae</a>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>📧</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>owners@royalholidayhomes.ae</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>bookings@royalholidayhomes.ae</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>📍</span>
                    <span style={{ fontSize: 13, lineHeight: 1.6 }}>Suite 503, Al Neyadi Building – Sheikh Rashid Bin Saeed St – Al Manhal – Abu Dhabi.</span>
                  </div>
                </div>
              </div>

              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: "32px 32px", background: WHITE }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: MUTED, marginBottom: 20 }}>Proposal Details</div>
                {[
                  { label: "Ref Number", value: proposal.referenceNumber },
                  { label: "Prepared For", value: `${proposal.ownerTitle ? proposal.ownerTitle + " " : ""}${proposal.ownerName}` },
                  { label: "Property", value: proposal.propertyAddress },
                  { label: "Issue Date", value: propDate },
                  { label: "Valid Until", value: new Date(proposal.expiresAt).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" }) },
                  ...(proposal.advisorName ? [{ label: "Representative", value: proposal.advisorName }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
                    <span style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: DARK, textAlign: "right", maxWidth: "58%" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ padding: "20px 24px", background: CREAM, borderRadius: 10, border: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.7, marginBottom: 6 }}>
                {proposal.disclaimer ?? "This forecast is an estimate based on historical market data and comparable properties. Actual revenue may vary and is not guaranteed."}
              </p>
              <p style={{ fontSize: 12, color: "#bbb" }}>Confidential © Royal Holiday Homes {new Date().getFullYear()}. All rights reserved.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Action Dialogs ── */}
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
              <Textarea
                placeholder={dialogType === "question" ? "e.g. When can we start the onboarding process?" : "e.g. Tomorrow afternoon works best for me."}
                value={comment} onChange={e => setComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogType(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitAction.isPending}
              style={{ background: DARK, color: WHITE }}>
              {submitAction.isPending ? "Submitting…" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print styles — show all sections */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 10mm; size: A4; }
        }
      `}</style>
    </div>
  );
}
