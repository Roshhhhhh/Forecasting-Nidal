/**
 * ProposalPreviewModal
 *
 * Full-page, read-only preview of the public proposal rendered inside a
 * full-screen modal. Accepts forecast / proposal / scenarios / monthly data
 * directly so it works before the proposal is published.
 *
 * Interactive owner dialogs (Accept / Call / Question) are intentionally
 * absent — this is a staff-only QA view.
 */

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  FileText, Printer, Phone, CheckCircle2, ArrowRight, MapPin,
  TrendingUp, X, Check, Star, Shield, Award, Building2, Users,
  Percent, Calendar, ChevronDown, ChevronUp, BedDouble, Bath,
  Maximize2, Eye, Layers, BarChart2, Activity, Home, Clock,
  MessageSquare, Camera, Wrench, FileCheck, Lock, Globe, DollarSign,
  LayoutDashboard, X as CloseIcon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Cell, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";

// ── Brand tokens (mirrors public/proposal.tsx) ────────────────────────────────
const GOLD   = "#C9A84C";
const GOLD2  = "#E6C97A";
const DARK   = "#1C1C1C";
const DARK2  = "#111111";
const CREAM  = "#FDFCF8";
const WHITE  = "#FFFFFF";
const BORDER = "#E8E4DC";
const MUTED  = "#888888";
const GREEN  = "#16a34a";

function fmt(v?: number | null) {
  if (v == null || isNaN(Number(v))) return "—";
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(v);
}

function formatOwnerDisplayName(
  title: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const fn = firstName?.trim() ?? "";
  const ln = lastName?.trim() ?? "";
  const fullName = [fn, ln].filter(Boolean).join(" ") || "Valued Owner";
  if (!title) return fullName;
  return `${title.trim()} ${fullName}`;
}

function plural(n: number | null | undefined, unit: string) {
  const count = n ?? 0;
  return `${count} ${unit}${count !== 1 ? "s" : ""}`;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const HOW_IT_WORKS = [
  { n:  1, title: "Proposal Acceptance",           desc: "Express your interest to proceed. Your representative will confirm the next steps within one business day." },
  { n:  2, title: "Consultation & Review",         desc: "A dedicated team member will meet to review the proposal, the property, and your expectations." },
  { n:  3, title: "Management Agreement",          desc: "We prepare a transparent property management agreement covering fees, scope of service, and operational terms." },
  { n:  4, title: "DCT Licensing",                 desc: "We handle all documentation, applications, and approvals required by the Department of Culture and Tourism." },
  { n:  5, title: "Property Inspection",           desc: "A thorough inspection to assess readiness, identify any improvements, and document the property's condition." },
  { n:  6, title: "Setup & Improvement Plan",      desc: "We prepare a structured setup plan to maximise the property's appeal, occupancy potential, and guest experience." },
  { n:  7, title: "Professional Photography",      desc: "High-quality photography and a compelling listing description to attract quality bookings on every platform." },
  { n:  8, title: "Listing & Distribution",        desc: "Your property is listed across Airbnb, Booking.com, Vrbo, Expedia, Agoda and other approved channels." },
  { n:  9, title: "Dynamic Pricing & Launch",      desc: "Pricing is calibrated to current demand, comparable properties, and seasonal market conditions." },
  { n: 10, title: "Guest Operations",              desc: "All guest communication, check-in, check-out, and in-stay coordination is managed by our team." },
  { n: 11, title: "Housekeeping & Maintenance",    desc: "Coordinated turnover cleaning, linen management, and maintenance so your property is always guest-ready." },
  { n: 12, title: "Reporting & Monthly Payout",   desc: "A clear monthly performance report and your net income transferred directly to you each month." },
];

const WHY_RHH = [
  { icon: MapPin,          title: "Abu Dhabi Specialists",       desc: "Deep local knowledge of Abu Dhabi developments, guest demand, regulations and operational requirements." },
  { icon: FileCheck,       title: "Licensed & Compliant",        desc: "Experienced in holiday-home licensing, documentation and DCT compliance requirements." },
  { icon: Percent,         title: "Performance-Aligned",         desc: "Our management model is directly linked to the property's revenue performance — we earn when you earn." },
  { icon: Layers,          title: "End-to-End Operations",       desc: "Guest communication, property readiness, housekeeping, maintenance oversight and owner reporting." },
  { icon: Activity,        title: "Active Revenue Management",   desc: "Pricing is actively adjusted based on seasonality, events, demand and property performance." },
  { icon: Globe,           title: "Multi-Platform Distribution", desc: "Professional positioning across leading booking and travel channels including Airbnb and Booking.com." },
  { icon: LayoutDashboard, title: "Transparent Reporting",       desc: "Clear monthly performance reports and full payout visibility — no hidden figures." },
  { icon: Shield,          title: "Owner-Focused Service",       desc: "One point of coordination from onboarding through ongoing management, with your interests at the centre." },
];

const OWNER_BENEFITS = [
  { icon: TrendingUp,     title: "Dynamic Revenue Capture",      desc: "Pricing adapts to demand, events, and seasons — maximising revenue for every available night." },
  { icon: BarChart2,      title: "Market Intelligence",          desc: "Data-driven decisions based on comparable properties, booking trends, and Abu Dhabi demand signals." },
  { icon: LayoutDashboard,title: "Transparent Analytics",        desc: "Monthly reports with occupancy, ADR, gross revenue, expenses, and net payout detail." },
  { icon: Home,           title: "Consistent Oversight",         desc: "Your property is inspected, cleaned, and maintained to a consistent standard after every stay." },
  { icon: Calendar,       title: "Owner Usage Flexibility",      desc: "Block dates for personal use at any time, with no penalties or minimum notice requirements." },
  { icon: Lock,           title: "Property Protection",          desc: "Regular inspections and a documented condition record reduce the risk of undetected damage." },
  { icon: Globe,          title: "Multi-Platform Distribution",  desc: "Visibility across major booking platforms with coordinated listing management." },
  { icon: FileText,       title: "Monthly Reporting",            desc: "A clear, itemised statement every month so you always know exactly where your income stands." },
  { icon: MessageSquare,  title: "Guest Communication",          desc: "Every guest enquiry, question, and review is handled professionally by our team." },
  { icon: Eye,            title: "Housekeeping Coordination",    desc: "Turnover cleaning, linen management, and in-stay requests are all coordinated for you." },
  { icon: Wrench,         title: "Maintenance Coordination",     desc: "We log, schedule and oversee repairs and maintenance on your behalf." },
  { icon: Camera,         title: "Professional Presentation",    desc: "High-quality photography and a compelling listing keep your property competitive." },
];

const PORTFOLIO = [
  { v: "160+",    l: "Managed Premium Properties", icon: Building2 },
  { v: "5,000+",  l: "Five-Star Guest Reviews",    icon: Star },
  { v: "1,000+",  l: "Bookings per Month",         icon: Calendar },
  { v: "3,500+",  l: "Travellers Hosted Monthly",  icon: Users },
  { v: "AED 250M",l: "Assets Under Management",    icon: Award },
  { v: "100+",    l: "Trusted Home Owners",        icon: Shield },
];

const NAV_SECTIONS = [
  { id: "pv-overview",   label: "Overview" },
  { id: "pv-financials", label: "Financials" },
  { id: "pv-why-str",    label: "Why STR?" },
  { id: "pv-process",    label: "Our Process" },
  { id: "pv-next-steps", label: "Next Steps" },
];

// ── Props ──────────────────────────────────────────────────────────────────────
export interface ProposalPreviewModalProps {
  open: boolean;
  onClose: () => void;
  forecast: any;
  proposal: any | null;
  scenarios: any[];
  monthly: any[];
  narrativeText: string;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function ProposalPreviewModal({
  open, onClose, forecast, proposal, scenarios: rawScenarios, monthly: rawMonthly, narrativeText,
}: ProposalPreviewModalProps) {
  const [activeSection, setActiveSection] = useState("pv-overview");
  const [scrolled, setScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [chartView, setChartView] = useState<"net" | "gross" | "occ" | "adr">("net");
  const [mobileScenarioIndex, setMobileScenarioIndex] = useState(0);

  // Sorted data
  const scenarios = ([...rawScenarios]).sort((a, b) => a.occupancyRate - b.occupancyRate);
  const monthly   = ([...rawMonthly]).sort((a, b) => a.month - b.month);

  // Scroll container ref – we scroll inside the modal body, not window
  const scrollContainerId = "proposal-preview-scroll";

  useEffect(() => {
    if (!open) return;
    setScrolled(false);
    setActiveSection("pv-overview");
  }, [open]);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(scrollContainerId);
    if (!el) return;
    const handleScroll = () => {
      setScrolled(el.scrollTop > 80);
      const scrollPos = el.scrollTop + 140;
      for (const sec of [...NAV_SECTIONS].reverse()) {
        const node = el.querySelector(`#${sec.id}`) as HTMLElement | null;
        if (node && node.offsetTop <= scrollPos) {
          setActiveSection(sec.id);
          break;
        }
      }
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const scrollToSection = useCallback((id: string) => {
    const container = document.getElementById(scrollContainerId);
    const el = document.getElementById(id);
    if (container && el) {
      container.scrollTo({ top: el.offsetTop - 100, behavior: "smooth" });
    }
  }, []);

  if (!open) return null;

  // ── Derived data ─────────────────────────────────────────────────────────────
  const recScenario: any =
    scenarios.find(s => s.name === "Realistic") ??
    (scenarios.length
      ? scenarios.reduce((best: any, s: any) =>
          Math.abs(s.occupancyRate - 0.80) < Math.abs(best.occupancyRate - 0.80) ? s : best,
          scenarios[0])
      : null);

  const recGross   = recScenario?.grossRevenue   ?? forecast.grossAnnualRevenue ?? 0;
  const recNet     = recScenario?.netOwnerIncome ?? forecast.netOwnerIncome     ?? 0;
  const recMonthly = recNet ? Math.round(recNet / 12) : 0;
  const recOccPct  = recScenario
    ? Math.round((recScenario.occupancyRate ?? 0.80) * 100)
    : Math.round((forecast.recommendedOccupancy ?? 0.80) * 100);

  const mgtFee      = forecast.managementFeePercent ?? 20;
  const ltrVacancy  = forecast.ltrVacancyPercent    ?? 10;
  const annualLtr   = forecast.annualLtr             ?? null;
  const ltrAdjusted = annualLtr ? Math.round(annualLtr * (1 - ltrVacancy / 100)) : null;
  const recUpliftAmt = (recNet && ltrAdjusted) ? recNet - ltrAdjusted : null;
  const recUpliftPct = (recNet && ltrAdjusted && ltrAdjusted > 0)
    ? Math.round((recNet - ltrAdjusted) / ltrAdjusted * 100)
    : forecast.increaseVsLtrPct ?? null;

  const utilityCost     = forecast.utilityCost     ?? 0;
  const internetCost    = forecast.internetCost    ?? 0;
  const maintenanceCost = forecast.maintenanceCost ?? 0;
  const miscCost        = forecast.miscCost        ?? 0;
  const weightedAdr     = forecast.weightedAdr     ?? 0;

  // Seasonal ADRs
  const seasonGroups: Record<string, number[]> = { low:[], shoulder:[], peak:[], event:[] };
  monthly.forEach((m: any) => {
    const st = m.seasonType || "shoulder";
    if (seasonGroups[st]) seasonGroups[st].push(m.adr ?? 0);
    else seasonGroups.shoulder.push(m.adr ?? 0);
  });
  const avgSeasonAdr = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const lowAdr      = avgSeasonAdr(seasonGroups.low);
  const shoulderAdr = avgSeasonAdr(seasonGroups.shoulder);
  const peakAdr     = avgSeasonAdr(seasonGroups.peak);
  const eventAdr    = avgSeasonAdr(seasonGroups.event);

  const displayName = formatOwnerDisplayName(
    forecast.ownerTitle,
    forecast.ownerFirstName,
    forecast.ownerLastName,
  );

  const coverNarrative = narrativeText.trim() || proposal?.coverNarrative || "";
  // advisorName: prefer the enriched forecast join (assignedToId → users.name),
  // fall back to the proposal record's snapshot, then null.
  const advisorName    = (forecast.advisorName as string | null) ?? (proposal as any)?.advisorName ?? null;
  const referenceNum   = proposal?.referenceNumber ?? forecast.referenceNumber ?? "—";
  const propDate       = new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
  const expiryDate     = proposal?.expiresAt
    ? new Date(proposal.expiresAt).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })
    : null;

  const hasLtr       = ltrAdjusted != null && ltrAdjusted > 0;
  const hasScenarios = scenarios.length > 0;
  const hasMonthly   = monthly.length > 0;

  function scenarioCosts(s: any) {
    const gross    = s.grossRevenue ?? 0;
    const mgmtAmt  = Math.round(gross * mgtFee / 100);
    const opCosts  = utilityCost + internetCost + maintenanceCost + miscCost;
    const totalExp = mgmtAmt + opCosts;
    const net      = s.netOwnerIncome ?? Math.round(gross - totalExp);
    const monthly_ = Math.round(net / 12);
    const uplift   = ltrAdjusted ? net - ltrAdjusted : null;
    const upliftPct= (ltrAdjusted && ltrAdjusted > 0) ? Math.round((net - ltrAdjusted) / ltrAdjusted * 100) : null;
    return { gross, mgmtAmt, opCosts, totalExp, net, monthly: monthly_, uplift, upliftPct };
  }

  const SectionHeading = ({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) => (
    <div style={{ marginBottom: 40 }}>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:4, textTransform:"uppercase", color:GOLD, marginBottom:10 }}>{eyebrow}</div>
      <h2 style={{ fontFamily:"serif", fontSize:isMobile?26:36, fontWeight:800, color:DARK, lineHeight:1.2, marginBottom:subtitle?8:0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize:14, color:MUTED, marginTop:4, lineHeight:1.6 }}>{subtitle}</p>}
      <div style={{ height:3, width:48, background:`linear-gradient(90deg,${GOLD},${GOLD2})`, marginTop:14, borderRadius:2 }} />
    </div>
  );

  // ── Modal shell ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", flexDirection: "column",
        background: "rgba(0,0,0,0.7)",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal window */}
      <div style={{
        position: "relative",
        width: "100%", height: "100%",
        display: "flex", flexDirection: "column",
        background: CREAM,
        overflow: "hidden",
      }}>
        {/* ── Staff preview banner ── */}
        <div style={{
          background: DARK2, color: GOLD,
          fontSize: 11, fontWeight: 700, letterSpacing: 2,
          textTransform: "uppercase",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 20px",
          borderBottom: `1px solid rgba(201,168,76,0.2)`,
          flexShrink: 0,
          zIndex: 20,
        }}>
          <span>Staff Preview — Read Only · Not visible to owner</span>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 6,
              color: "#ccc",
              cursor: "pointer",
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <CloseIcon style={{ width: 13, height: 13 }} /> Close Preview
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div id={scrollContainerId} style={{ flex: 1, overflowY: "auto" }}>

          {/* ════════════════ STICKY HEADER ════════════════ */}
          <header style={{
            position: "sticky", top: 0, zIndex: 100,
            background: "rgba(17,17,17,0.97)", backdropFilter: "blur(16px)",
            borderBottom: "1px solid rgba(201,168,76,0.15)",
          }}>
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 16px" : "0 48px" }}>
              {/* Top bar */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding: scrolled ? "9px 0" : "12px 0", transition:"padding 0.3s", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <img src="/rhh-logo.png" alt="RHH" style={{ height: scrolled ? 24 : 28, transition:"height 0.3s", width:"auto" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  {!isMobile && <span style={{ fontFamily:"serif", fontSize:15, fontWeight:700, color:WHITE, letterSpacing:0.5 }}>Royal Holiday Homes</span>}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap: isMobile ? 10 : 20 }}>
                  {!isMobile && (
                    <>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:10, color:"#555", letterSpacing:1.5, textTransform:"uppercase", marginBottom:2 }}>Ref</div>
                        <div style={{ fontSize:12, color:"#bbb", fontWeight:600 }}>{referenceNum}</div>
                      </div>
                      <div style={{ width:1, height:28, background:"rgba(255,255,255,0.08)" }} />
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:10, color:"#555", letterSpacing:1.5, textTransform:"uppercase", marginBottom:2 }}>Date</div>
                        <div style={{ fontSize:12, color:"#bbb", fontWeight:600 }}>{propDate}</div>
                      </div>
                      <div style={{ width:1, height:28, background:"rgba(255,255,255,0.08)" }} />
                    </>
                  )}
                  {/* In preview mode, action buttons are replaced with a label */}
                  <span style={{ fontSize:11, color:"#666", fontStyle:"italic", padding:"8px 12px" }}>
                    Read-only preview
                  </span>
                </div>
              </div>

              {/* Anchor nav */}
              <nav style={{ display:"flex", gap:0, overflowX:"auto", scrollbarWidth:"none" }}>
                {NAV_SECTIONS.map(sec => (
                  <button key={sec.id} onClick={() => scrollToSection(sec.id)}
                    style={{
                      padding: isMobile ? "9px 12px" : "11px 20px",
                      background:"none", border:"none", cursor:"pointer",
                      fontSize: isMobile ? 11 : 12, fontWeight: activeSection === sec.id ? 700 : 500,
                      color: activeSection === sec.id ? GOLD : "#666",
                      borderBottom: activeSection === sec.id ? `2px solid ${GOLD}` : "2px solid transparent",
                      transition:"all 0.2s", whiteSpace:"nowrap", letterSpacing:0.3,
                    }}>
                    {sec.label}
                  </button>
                ))}
              </nav>
            </div>
          </header>

          {/* ════════════════ SECTION 1 — HERO ════════════════ */}
          <section id="pv-overview">
            <div style={{
              padding: isMobile ? "72px 24px 56px" : "96px 48px 80px",
              background: `linear-gradient(140deg, ${DARK2} 0%, #1e180e 55%, ${DARK} 100%)`,
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:`linear-gradient(90deg, ${GOLD} 0%, ${GOLD2} 40%, transparent 100%)` }} />
              <div style={{ position:"absolute", inset:0, opacity:0.06, backgroundImage:"radial-gradient(ellipse at 75% 40%, #C9A84C 0%, transparent 65%)" }} />
              <div style={{ position:"absolute", inset:0, opacity:0.03, backgroundImage:"linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)", backgroundSize:"48px 48px" }} />

              <div style={{ maxWidth:1200, margin:"0 auto", position:"relative" }}>
                <div style={{ fontSize: isMobile ? 10 : 11, fontWeight:700, letterSpacing: isMobile ? 3 : 4, textTransform:"uppercase", color:GOLD, marginBottom:20 }}>
                  Exclusively Prepared For
                </div>
                <h1 style={{ fontFamily:"serif", fontSize: isMobile ? 30 : 56, fontWeight:800, color:WHITE, lineHeight:1.1, marginBottom:8, maxWidth:720 }}>
                  {displayName}
                </h1>
                <p style={{ fontSize: isMobile ? 14 : 18, color:"#9a8c78", marginBottom: isMobile ? 32 : 44, fontWeight:400 }}>
                  Property Management Proposal
                </p>

                {/* Property chip */}
                <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"10px 18px", background:"rgba(255,255,255,0.05)", border:`1px solid rgba(201,168,76,0.25)`, borderRadius:8, marginBottom: isMobile ? 36 : 52 }}>
                  <MapPin style={{ width:14, height:14, color:GOLD, flexShrink:0 }} />
                  <span style={{ fontSize:13, color:"#c8bfa8" }}>{forecast.propertyAddress}</span>
                </div>

                {/* Recommended badge */}
                <div style={{ fontSize:11, color:GOLD, letterSpacing:2, textTransform:"uppercase", marginBottom:14, fontWeight:700, display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:20, height:1, background:GOLD }} />
                  Recommended Forecast — Realistic Scenario at {recOccPct}% Occupancy
                  <div style={{ width:20, height:1, background:GOLD }} />
                </div>

                {/* KPI strip */}
                <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(3, 1fr) 1fr${hasLtr ? " 1fr" : ""}`, gap:1, background:"rgba(255,255,255,0.04)", borderRadius:12, overflow:"hidden", border:`1px solid rgba(201,168,76,0.12)` }}>
                  {[
                    { label:"Annual Net Owner Income",  value:`AED ${fmt(recNet)}`,       accent:true },
                    { label:"Average Monthly Payout",   value:`AED ${fmt(recMonthly)}`,   accent:false },
                    { label:"Recommended Occupancy",    value:`${recOccPct}%`,             accent:false },
                    { label:"Weighted Avg. Daily Rate", value:`AED ${fmt(weightedAdr)}`,  accent:false },
                    ...(hasLtr ? [{ label:"vs. Long-Term Rental", value:`+${recUpliftPct ?? 0}%`, accent:false, green:true }] : []),
                  ].map(({ label, value, accent, green }: any) => (
                    <div key={label} style={{ padding: isMobile ? "20px 14px" : "28px 24px", background: accent ? `rgba(201,168,76,0.10)` : "transparent", borderLeft: accent ? `3px solid ${GOLD}` : "3px solid transparent" }}>
                      <div style={{ fontSize:10, color:"#665c4a", textTransform:"uppercase", letterSpacing:1.5, marginBottom:9, lineHeight:1.4 }}>{label}</div>
                      <div style={{ fontSize: isMobile ? 20 : 30, fontWeight:900, fontFamily:"serif", color: accent ? GOLD : green ? "#4ade80" : WHITE }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Property details + narrative */}
            <div style={{ maxWidth:1200, margin:"0 auto", display:"grid", gridTemplateColumns: isMobile ? "1fr" : "280px 1fr", gap:24, padding: isMobile ? "32px 16px" : "48px 48px" }}>
              <div>
                {/* Property card */}
                <div style={{ border:`1px solid ${BORDER}`, borderRadius:12, padding:"24px", background:WHITE, marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:MUTED, marginBottom:16 }}>Property Details</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {[
                      { icon:BedDouble,  label:"Bedrooms",   value: forecast.bedrooms != null ? plural(forecast.bedrooms, "Bedroom") : null },
                      { icon:Bath,       label:"Bathrooms",  value: forecast.bathrooms != null ? plural(forecast.bathrooms, "Bathroom") : null },
                      { icon:Maximize2,  label:"Size",       value: forecast.internalArea ? `${fmt(forecast.internalArea)} sq.ft.` : null },
                      { icon:Layers,     label:"Type",       value: forecast.propertyType ? String(forecast.propertyType).replace(/_/g," ") : null },
                      { icon:Eye,        label:"View",       value: forecast.view },
                    ].filter(x => x.value).map(({ icon: Icon, label, value }) => (
                      <div key={label} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 0", borderBottom:`1px solid ${BORDER}` }}>
                        <div style={{ width:30, height:30, borderRadius:6, background:CREAM, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <Icon style={{ width:14, height:14, color:GOLD }} />
                        </div>
                        <span style={{ fontSize:12, color:MUTED, flex:1, textTransform:"capitalize" }}>{label}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:DARK, textTransform:"capitalize" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Advisor card */}
                <div style={{ border:`1px solid ${BORDER}`, borderRadius:12, padding:"20px 24px", background:WHITE }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:MUTED, marginBottom:12 }}>Your Representative</div>
                  <div style={{ fontSize:14, fontWeight:700, color:DARK }}>{advisorName ?? "Royal Holiday Homes Team"}</div>
                  <div style={{ fontSize:12, color:MUTED, marginTop:4 }}>Property Management Division</div>
                </div>
              </div>

              {/* Narrative */}
              <div style={{ border:`1px solid ${BORDER}`, borderRadius:12, padding:"32px 36px", background:WHITE }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:MUTED, marginBottom:16 }}>Our Assessment</div>
                <p style={{ fontSize:16, color: coverNarrative ? "#444" : "#bbb", lineHeight:1.9, fontFamily:"serif", fontStyle: coverNarrative ? "normal" : "italic" }}>
                  {coverNarrative || "Your personalised narrative will appear here once you save it on the Proposal tab."}
                </p>
              </div>
            </div>
          </section>

          {/* ════════════════ SECTION 2 — FINANCIALS ════════════════ */}
          <section id="pv-financials" style={{ maxWidth:1200, margin:"0 auto", padding: isMobile ? "56px 16px" : "80px 48px" }}>
            <SectionHeading
              eyebrow="Executive Financial Summary"
              title="Your Projected Returns"
              subtitle={`Based on the Realistic scenario at ${recOccPct}% recommended occupancy.`}
            />

            {/* KPI cards */}
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap:16, marginBottom:24 }}>
              {[
                { label:"Gross Annual Revenue",    value:`AED ${fmt(recGross)}`,   sub:"Projected at 80% Occupancy", accent:false },
                { label:"Annual Net Owner Income", value:`AED ${fmt(recNet)}`,     sub:"After all fees & expenses",   accent:true },
                { label:"Avg. Monthly Payout",     value:`AED ${fmt(recMonthly)}`, sub:"Estimated net per month",     accent:false },
                { label:"Weighted Average ADR",    value:`AED ${fmt(weightedAdr)}`,sub:"Across all occupied nights",  accent:false },
              ].map(({ label, value, sub, accent }) => (
                <div key={label} style={{ padding: isMobile ? "20px 18px" : "28px 24px", borderRadius:14, background: accent ? `linear-gradient(135deg, ${DARK2} 0%, #2a1e08 100%)` : WHITE, border: accent ? `2px solid ${GOLD}40` : `1px solid ${BORDER}`, position:"relative", overflow:"hidden" }}>
                  {accent && <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${GOLD}, ${GOLD2})` }} />}
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color: accent ? GOLD : MUTED, marginBottom:10 }}>{label}</div>
                  <div style={{ fontSize: isMobile ? 22 : 28, fontWeight:900, fontFamily:"serif", color: accent ? GOLD : DARK, lineHeight:1 }}>{value}</div>
                  <div style={{ fontSize:11, color: accent ? "#666" : MUTED, marginTop:8 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* LTR comparison */}
            {hasLtr && (
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap:16, marginBottom:48 }}>
                {[
                  { label:"LTR Market Benchmark",                   value:`AED ${fmt(annualLtr)}`,    sub:"Annual long-term rental estimate" },
                  { label:`Adjusted for ${ltrVacancy}% Vacancy`,    value:`AED ${fmt(ltrAdjusted)}`,  sub:"Net LTR after vacancy allowance" },
                  { label:"Projected Increase vs LTR",              value:`+AED ${fmt(recUpliftAmt)}`,sub:`+${recUpliftPct ?? 0}% improvement`, green:true },
                ].map(({ label, value, sub, green }: any) => (
                  <div key={label} style={{ padding:"20px 24px", borderRadius:12, background: green ? `${GREEN}10` : CREAM, border: green ? `1px solid ${GREEN}40` : `1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                    <div>
                      <div style={{ fontSize:10, color:MUTED, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{label}</div>
                      <div style={{ fontSize:11, color:MUTED }}>{sub}</div>
                    </div>
                    <div style={{ fontSize:22, fontWeight:900, fontFamily:"serif", color: green ? GREEN : DARK }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Scenario cards */}
            {hasScenarios && (
              <div style={{ marginBottom:64 }}>
                <div style={{ marginBottom:20 }}>
                  <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, color:DARK, fontFamily:"serif" }}>Scenario Comparison</h3>
                  <p style={{ fontSize:13, color:MUTED, marginTop:6, lineHeight:1.6, maxWidth:720 }}>
                    The scenarios below illustrate potential performance at different occupancy levels. The Realistic 80% scenario is Royal Holiday Homes' recommended planning forecast for this proposal.
                  </p>
                </div>
                <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${Math.min(scenarios.length, 4)}, 1fr)`, gap:12 }}>
                  {scenarios.map((s: any) => {
                    const isRec = s.id === recScenario?.id || s.name === "Realistic" || (recScenario && s.occupancyRate === recScenario.occupancyRate);
                    const occ = Math.round((s.occupancyRate ?? 0) * 100);
                    return (
                      <div key={s.id ?? s.occupancyRate} style={{ borderRadius:14, overflow:"hidden", border: isRec ? `2px solid ${GOLD}` : `1px solid ${BORDER}`, background: isRec ? `linear-gradient(160deg,#1c1709 0%,#201c11 100%)` : WHITE, position:"relative" }}>
                        {isRec && <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${GOLD}, ${GOLD2})` }} />}
                        <div style={{ padding: isMobile ? "16px 14px" : "20px 20px" }}>
                          {isRec && (
                            <div style={{ display:"inline-block", padding:"3px 10px", background:GOLD, borderRadius:20, fontSize:9, fontWeight:800, letterSpacing:1.5, textTransform:"uppercase", color:DARK, marginBottom:10 }}>
                              ★ Recommended
                            </div>
                          )}
                          <div style={{ fontSize: isMobile ? 10 : 11, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color: isRec ? GOLD : MUTED, marginBottom:4 }}>{s.name ?? "Scenario"}</div>
                          <div style={{ fontSize: isMobile ? 26 : 32, fontWeight:900, fontFamily:"serif", color: isRec ? GOLD : DARK, lineHeight:1 }}>{occ}%</div>
                          <div style={{ fontSize:11, color: isRec ? "#665" : MUTED, marginBottom: isMobile ? 12 : 16 }}>Occupancy</div>
                          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                            {[
                              { label:"Gross Revenue",  value:`AED ${fmt(s.grossRevenue)}` },
                              { label:"Net Income",     value:`AED ${fmt(s.netOwnerIncome)}` },
                              { label:"Monthly Payout", value:`AED ${fmt(s.netOwnerIncome ? Math.round(s.netOwnerIncome/12) : 0)}` },
                            ].map(({ label, value }) => (
                              <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingBottom:8, borderBottom:`1px solid ${isRec ? "rgba(201,168,76,0.15)" : BORDER}` }}>
                                <span style={{ fontSize:10, color: isRec ? "#665" : MUTED, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</span>
                                <span style={{ fontSize:12, fontWeight:700, color: isRec ? GOLD : DARK }}>{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Income Calculator Table */}
            {hasScenarios && !isMobile && (
              <div style={{ marginBottom:64 }}>
                <div style={{ marginBottom:20 }}>
                  <h3 style={{ fontSize:22, fontWeight:800, color:DARK, fontFamily:"serif" }}>Detailed Income Calculator</h3>
                  <p style={{ fontSize:13, color:MUTED, marginTop:6, lineHeight:1.6 }}>
                    Illustrative comparison across occupancy scenarios. The Realistic 80% scenario is highlighted.
                  </p>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", background:WHITE, border:`1px solid ${BORDER}`, borderRadius:14, overflow:"hidden", fontSize:13 }}>
                    <thead>
                      <tr style={{ background:DARK }}>
                        <th style={{ padding:"14px 20px", textAlign:"left", color:"#888", fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", borderRight:`1px solid rgba(255,255,255,0.05)`, width:"30%" }}>Metric</th>
                        {hasLtr && (
                          <th style={{ padding:"14px 16px", textAlign:"center", color:"#888", fontSize:11, fontWeight:600, letterSpacing:1, textTransform:"uppercase", borderRight:`1px solid rgba(255,255,255,0.05)` }}>
                            LTR<br/><span style={{ fontWeight:400, fontSize:10 }}>Adjusted {ltrVacancy}%</span>
                          </th>
                        )}
                        {scenarios.map((s: any) => {
                          const isRec = recScenario && s.occupancyRate === recScenario.occupancyRate;
                          return (
                            <th key={s.id ?? s.occupancyRate} style={{ padding:"14px 16px", textAlign:"center", background: isRec ? `rgba(201,168,76,0.12)` : "transparent", borderRight:`1px solid rgba(255,255,255,0.05)`, borderTop: isRec ? `3px solid ${GOLD}` : "none" }}>
                              {isRec && <div style={{ fontSize:9, color:GOLD, fontWeight:800, letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>★ Recommended</div>}
                              <div style={{ fontSize:12, fontWeight:700, color: isRec ? GOLD : WHITE }}>{s.name}</div>
                              <div style={{ fontSize:11, color: isRec ? GOLD2 : "#666" }}>{Math.round((s.occupancyRate??0)*100)}% Occ.</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { section:"Income",        label:"Gross Annual Revenue",           fn:(s:any,c:any)=>`AED ${fmt(c.gross)}`,    lfn:()=>`AED ${fmt(ltrAdjusted)}`, bold:false },
                        { section:"Operating Costs",label:"Internet & Telecommunications",  fn:()=>`AED ${fmt(internetCost)}`,           lfn:()=>"—",                       bold:false },
                        { section:"",              label:"Utility Bills",                  fn:()=>`AED ${fmt(utilityCost)}`,            lfn:()=>"—",                       bold:false },
                        { section:"",              label:"Maintenance Allowance",           fn:()=>`AED ${fmt(maintenanceCost)}`,        lfn:()=>"—",                       bold:false },
                        { section:"",              label:"Miscellaneous Expenses",          fn:()=>`AED ${fmt(miscCost)}`,               lfn:()=>"—",                       bold:false },
                        { section:"Fees",          label:`RHH Management Fee (${mgtFee}%)`,fn:(s:any,c:any)=>`AED ${fmt(c.mgmtAmt)}`,  lfn:()=>"—",                       bold:false },
                        { section:"Net Outcome",   label:"Total Annual Expenses",          fn:(s:any,c:any)=>`AED ${fmt(c.totalExp)}`,  lfn:()=>"—",                       bold:true },
                        { section:"",              label:"Net Annual Owner Income",        fn:(s:any,c:any)=>`AED ${fmt(c.net)}`,       lfn:()=>`AED ${fmt(ltrAdjusted)}`, bold:true, gold:true },
                        { section:"",              label:"Avg. Monthly Payout",            fn:(s:any,c:any)=>`AED ${fmt(c.monthly)}`,   lfn:()=>`AED ${fmt(ltrAdjusted ? Math.round(ltrAdjusted/12) : null)}`, bold:false },
                        ...(hasLtr ? [
                          { section:"Comparison",  label:"Additional Income vs LTR",       fn:(s:any,c:any)=>c.uplift!=null?`+AED ${fmt(c.uplift)}`:"—", lfn:()=>"—", bold:false, green:true },
                          { section:"",            label:"Percentage Increase vs LTR",    fn:(s:any,c:any)=>c.upliftPct!=null?`+${c.upliftPct}%`:"—",    lfn:()=>"—", bold:false, green:true },
                        ] : []),
                      ].map(({ section, label, fn, lfn, bold, gold, green }: any, ri: number) => {
                        const isSection = section !== "";
                        return (
                          <Fragment key={`row-${label}-${ri}`}>
                            {isSection && (
                              <tr style={{ background:CREAM }}>
                                <td colSpan={(hasLtr?1:0) + scenarios.length + 1}
                                  style={{ padding:"10px 20px", fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:MUTED, borderTop:`1px solid ${BORDER}`, borderBottom:`1px solid ${BORDER}` }}>
                                  {section}
                                </td>
                              </tr>
                            )}
                            <tr style={{ background: gold ? `${GOLD}06` : undefined, borderBottom:`1px solid ${BORDER}` }}>
                              <td style={{ padding:"13px 20px", color: bold ? DARK : MUTED, fontWeight: bold ? 700 : 400 }}>{label}</td>
                              {hasLtr && <td style={{ padding:"13px 16px", textAlign:"center", color:MUTED, fontSize:12 }}>{lfn()}</td>}
                              {scenarios.map((s: any) => {
                                const isRec = recScenario && s.occupancyRate === recScenario.occupancyRate;
                                const c = scenarioCosts(s);
                                return (
                                  <td key={s.id ?? s.occupancyRate} style={{ padding:"13px 16px", textAlign:"center", fontWeight: bold ? 700 : 500, color: gold ? GOLD : green ? GREEN : DARK, background: isRec ? `rgba(201,168,76,0.04)` : "transparent", borderLeft: isRec ? `1px solid rgba(201,168,76,0.15)` : undefined, borderRight: isRec ? `1px solid rgba(201,168,76,0.15)` : undefined }}>
                                    {fn(s, c)}
                                  </td>
                                );
                              })}
                            </tr>
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Monthly Chart */}
            {hasMonthly && (
              <div style={{ marginBottom:64 }}>
                <div style={{ display:"flex", alignItems: isMobile ? "flex-start" : "center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                  <div>
                    <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, color:DARK, fontFamily:"serif" }}>Monthly Forecast</h3>
                    <p style={{ fontSize:13, color:MUTED, marginTop:4 }}>Realistic 80% scenario — January to December</p>
                  </div>
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {[
                      { key:"net",   label:"Net vs LTR" },
                      { key:"gross", label:"Gross Revenue" },
                      { key:"occ",   label:"Occupancy" },
                      { key:"adr",   label:"ADR" },
                    ].map(({ key, label }) => (
                      <button key={key} onClick={() => setChartView(key as any)}
                        style={{ padding:"6px 14px", borderRadius:20, border: chartView===key ? `2px solid ${GOLD}` : `1px solid ${BORDER}`, background: chartView===key ? `${GOLD}15` : WHITE, color: chartView===key ? GOLD : MUTED, fontSize:11, fontWeight:600, cursor:"pointer" }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ background:WHITE, border:`1px solid ${BORDER}`, borderRadius:14, padding:"24px 20px" }}>
                  <div style={{ height:280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {chartView === "net" ? (
                        <LineChart data={monthly.map((m: any) => ({ name: MONTH_LABELS[(m.month-1)%12], str: Math.round(m.netOwnerIncome??0), ltr: m.ltrBenchmark ? Math.round(m.ltrBenchmark) : null }))} margin={{ top:8, right:12, left:0, bottom:4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:MUTED, fontSize:11 }} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} tick={{ fill:MUTED, fontSize:11 }} />
                          <RechartsTooltip formatter={(v:number)=>`AED ${fmt(v)}`} contentStyle={{ borderRadius:8, border:`1px solid ${BORDER}` }} />
                          <Legend wrapperStyle={{ fontSize:11, color:MUTED }} />
                          <Line type="monotone" dataKey="str" name="Net Owner Income" stroke={GOLD} strokeWidth={2.5} dot={{ fill:GOLD, r:3 }} />
                          {hasLtr && <Line type="monotone" dataKey="ltr" name="LTR Benchmark" stroke="#ccc" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />}
                        </LineChart>
                      ) : chartView === "gross" ? (
                        <BarChart data={monthly.map((m: any) => ({ name: MONTH_LABELS[(m.month-1)%12], gross: Math.round(m.grossRevenue??0), ltr: m.ltrBenchmark ? Math.round(m.ltrBenchmark) : null }))} margin={{ top:8, right:12, left:0, bottom:4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:MUTED, fontSize:11 }} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} tick={{ fill:MUTED, fontSize:11 }} />
                          <RechartsTooltip formatter={(v:number)=>`AED ${fmt(v)}`} contentStyle={{ borderRadius:8, border:`1px solid ${BORDER}` }} />
                          <Legend wrapperStyle={{ fontSize:11, color:MUTED }} />
                          <Bar dataKey="gross" name="Gross Revenue" fill={GOLD} radius={[4,4,0,0]} maxBarSize={36} />
                          {hasLtr && <Bar dataKey="ltr" name="LTR Benchmark" fill="#e5e0d5" radius={[4,4,0,0]} maxBarSize={36} />}
                        </BarChart>
                      ) : chartView === "occ" ? (
                        <BarChart data={monthly.map((m: any) => ({ name: MONTH_LABELS[(m.month-1)%12], occ: Math.round((m.occupancyRate??0)*100) }))} margin={{ top:8, right:12, left:0, bottom:4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:MUTED, fontSize:11 }} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} tick={{ fill:MUTED, fontSize:11 }} domain={[0,100]} />
                          <RechartsTooltip formatter={(v:number)=>`${v}%`} contentStyle={{ borderRadius:8, border:`1px solid ${BORDER}` }} />
                          <Bar dataKey="occ" name="Occupancy %" radius={[4,4,0,0]} maxBarSize={36}>
                            {monthly.map((m: any) => {
                              const occ = m.occupancyRate ?? 0;
                              return <Cell key={m.month} fill={occ >= 0.85 ? GOLD : occ >= 0.70 ? "#d4a840" : "#a09070"} />;
                            })}
                          </Bar>
                        </BarChart>
                      ) : (
                        <LineChart data={monthly.map((m: any) => ({ name: MONTH_LABELS[(m.month-1)%12], adr: Math.round(m.adr??0) }))} margin={{ top:8, right:12, left:0, bottom:4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:MUTED, fontSize:11 }} />
                          <YAxis axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} tick={{ fill:MUTED, fontSize:11 }} />
                          <RechartsTooltip formatter={(v:number)=>`AED ${fmt(v)}`} contentStyle={{ borderRadius:8, border:`1px solid ${BORDER}` }} />
                          <Line type="monotone" dataKey="adr" name="ADR" stroke={GOLD} strokeWidth={2.5} dot={{ fill:GOLD, r:3 }} />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Gross vs Net chart */}
            {hasScenarios && (
              <div>
                <div style={{ marginBottom:20 }}>
                  <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, color:DARK, fontFamily:"serif" }}>Gross Revenue vs Net Income</h3>
                  <p style={{ fontSize:13, color:MUTED, marginTop:4 }}>Comparison across all occupancy scenarios</p>
                </div>
                <div style={{ background:WHITE, border:`1px solid ${BORDER}`, borderRadius:14, padding:"24px 20px" }}>
                  <div style={{ height:260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={scenarios.map((s: any) => ({ name:`${Math.round((s.occupancyRate??0)*100)}%`, gross: Math.round(s.grossRevenue??0), net: Math.round(s.netOwnerIncome??0) }))} margin={{ top:8, right:12, left:0, bottom:4 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill:MUTED, fontSize:11 }} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} tick={{ fill:MUTED, fontSize:11 }} />
                        <RechartsTooltip formatter={(v:number)=>`AED ${fmt(v)}`} contentStyle={{ borderRadius:8, border:`1px solid ${BORDER}` }} />
                        <Legend wrapperStyle={{ fontSize:11, color:MUTED }} />
                        <Bar dataKey="gross" name="Gross Revenue" radius={[4,4,0,0]} maxBarSize={40}>
                          {scenarios.map((s: any) => {
                            const isRec = recScenario && s.occupancyRate === recScenario.occupancyRate;
                            return <Cell key={s.id??s.occupancyRate} fill={isRec ? `${GOLD}70` : "#E5E0D5"} />;
                          })}
                        </Bar>
                        <Bar dataKey="net" name="Net Income" radius={[4,4,0,0]} maxBarSize={40}>
                          {scenarios.map((s: any) => {
                            const isRec = recScenario && s.occupancyRate === recScenario.occupancyRate;
                            return <Cell key={s.id??s.occupancyRate} fill={isRec ? GOLD : "#A09580"} />;
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ════════════════ SECTION 3 — WHY STR? ════════════════ */}
          <section id="pv-why-str" style={{ background:DARK2, padding: isMobile ? "56px 16px" : "80px 48px" }}>
            <div style={{ maxWidth:1200, margin:"0 auto" }}>
              <div style={{ marginBottom:40 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:4, textTransform:"uppercase", color:GOLD, marginBottom:10 }}>The Smart Choice</div>
                <h2 style={{ fontFamily:"serif", fontSize: isMobile ? 26 : 36, fontWeight:800, color:WHITE, lineHeight:1.2 }}>Why Short-Term Rental?</h2>
                <div style={{ height:3, width:48, background:`linear-gradient(90deg,${GOLD},${GOLD2})`, marginTop:14, borderRadius:2 }} />
              </div>

              {/* STR vs LTR */}
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:16, marginBottom:64 }}>
                <div style={{ borderRadius:16, overflow:"hidden", border:`2px solid ${GOLD}` }}>
                  <div style={{ padding:"20px 28px", background:`linear-gradient(135deg, #1c1709 0%, #201c11 100%)`, borderBottom:`2px solid ${GOLD}40` }}>
                    <div style={{ fontSize:11, color:GOLD, fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Holiday Home (Short-Term Rental)</div>
                    <div style={{ fontSize:22, fontWeight:900, fontFamily:"serif", color:WHITE }}>Recommended Model</div>
                  </div>
                  <div style={{ background:"#111" }}>
                    {[
                      { title:"Demand-Based Pricing",          desc:"Revenue adapts to seasonal demand, events and market conditions." },
                      { title:"Potentially Higher Returns",     desc:"Based on this forecast, STR is projected to outperform the adjusted LTR benchmark." },
                      { title:"Event & Peak-Season Upside",     desc:"Capture elevated nightly rates during Abu Dhabi events and peak travel periods." },
                      { title:"Regular Property Oversight",     desc:"Frequent inspections, cleaning coordination and documented property condition." },
                      { title:"Owner-Use Flexibility",          desc:"Block dates for personal use at any time with no penalties." },
                      { title:"Active Revenue Management",      desc:"Pricing continuously optimised based on comparable properties and demand signals." },
                      { title:"Multi-Platform Distribution",    desc:"Listed across all major booking channels for maximum visibility." },
                      { title:"Monthly Performance Reporting",  desc:"Clear monthly reports and direct income transfer." },
                    ].map(({ title, desc }) => (
                      <div key={title} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 24px", borderBottom:`1px solid rgba(255,255,255,0.05)` }}>
                        <div style={{ width:20, height:20, borderRadius:"50%", background:`${GOLD}20`, border:`1px solid ${GOLD}40`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                          <Check style={{ width:11, height:11, color:GOLD }} />
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:"#e8e0cc", marginBottom:2 }}>{title}</div>
                          <div style={{ fontSize:12, color:"#665" }}>{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ borderRadius:16, overflow:"hidden", border:`1px solid rgba(255,255,255,0.08)` }}>
                  <div style={{ padding:"20px 28px", background:"rgba(255,255,255,0.04)", borderBottom:`1px solid rgba(255,255,255,0.08)` }}>
                    <div style={{ fontSize:11, color:"#555", fontWeight:700, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Traditional Long-Term Rental</div>
                    <div style={{ fontSize:22, fontWeight:900, fontFamily:"serif", color:"#666" }}>Standard Option</div>
                  </div>
                  <div style={{ background:"#0e0e0e" }}>
                    {[
                      { title:"Fixed Annual Income",              desc:"Income is fixed regardless of market conditions or seasonal demand." },
                      { title:"Limited Pricing Flexibility",      desc:"No ability to adjust rates to capture events, holidays or peak demand." },
                      { title:"Long Tenancy Commitment",          desc:"Typically 12-month or longer commitments with restricted access." },
                      { title:"Vacancy Risk Between Leases",      desc:"Income gaps between tenancies affect annual net yield." },
                      { title:"No Owner-Use Flexibility",         desc:"You cannot use your own property during the tenancy period." },
                      { title:"No Event-Season Upside",           desc:"You do not benefit from Abu Dhabi events or seasonal pricing surges." },
                      { title:"Tenant & Renewal Dependency",      desc:"Tenant quality, renewal decisions and disputes can affect income." },
                      { title:"Less Frequent Operational Oversight",desc:"Fewer inspections and less operational control compared to STR management." },
                    ].map(({ title, desc }) => (
                      <div key={title} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"14px 24px", borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
                        <div style={{ width:20, height:20, borderRadius:"50%", background:"rgba(220,38,38,0.1)", border:"1px solid rgba(220,38,38,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:1 }}>
                          <X style={{ width:11, height:11, color:"#dc2626" }} />
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:"#666", marginBottom:2 }}>{title}</div>
                          <div style={{ fontSize:12, color:"#444" }}>{desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Seasonal ADR */}
              <div style={{ marginBottom:64 }}>
                <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, color:WHITE, fontFamily:"serif", marginBottom:8 }}>Seasonal Pricing Strategy</h3>
                <p style={{ fontSize:13, color:"#666", marginBottom:28, lineHeight:1.6 }}>
                  The weighted average ADR reflects the expected mix of occupied nights across low, shoulder, peak and main-event periods.
                </p>
                <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap:12 }}>
                  {[
                    { label:"Low Season",      adr:lowAdr,      sub:"Jun — Aug",          bg:"rgba(255,255,255,0.04)" },
                    { label:"Shoulder Season", adr:shoulderAdr, sub:"Mar–May, Sep",       bg:"rgba(255,255,255,0.04)" },
                    { label:"Peak Season",     adr:peakAdr,     sub:"Jan–Feb, Oct",       bg:"rgba(201,168,76,0.06)" },
                    { label:"Main Events",     adr:eventAdr,    sub:"Nov — Dec",          bg:"rgba(201,168,76,0.04)" },
                    { label:"Weighted Annual", adr:weightedAdr, sub:"All occupied nights", bg:`rgba(201,168,76,0.12)`, highlight:true },
                  ].map(({ label, adr, sub, bg, highlight }: any) => (
                    <div key={label} style={{ borderRadius:12, padding:"24px 18px", background:bg, border: highlight ? `2px solid ${GOLD}40` : `1px solid rgba(255,255,255,0.07)`, textAlign:"center" }}>
                      <div style={{ fontSize:10, color: highlight ? GOLD : "#555", textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>{label}</div>
                      <div style={{ fontSize: isMobile ? 22 : 28, fontWeight:900, fontFamily:"serif", color: highlight ? GOLD : WHITE, marginBottom:4 }}>
                        AED {fmt(adr)}
                      </div>
                      <div style={{ fontSize:11, color:"#444" }}>{sub}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Owner Benefits */}
              <div>
                <h3 style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, color:WHITE, fontFamily:"serif", marginBottom:8 }}>Owner Benefits</h3>
                <p style={{ fontSize:13, color:"#666", marginBottom:28 }}>Everything included in your management arrangement.</p>
                <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap:12 }}>
                  {OWNER_BENEFITS.map(({ icon:Icon, title, desc }) => (
                    <div key={title} style={{ padding:"20px 18px", borderRadius:12, background:"rgba(255,255,255,0.03)", border:`1px solid rgba(255,255,255,0.07)` }}>
                      <div style={{ width:36, height:36, borderRadius:8, background:`${GOLD}15`, border:`1px solid ${GOLD}20`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}>
                        <Icon style={{ width:16, height:16, color:GOLD }} />
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#e0d8c8", marginBottom:6, textTransform:"uppercase", letterSpacing:0.5 }}>{title}</div>
                      <div style={{ fontSize:12, color:"#555", lineHeight:1.6 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ════════════════ SECTION 4 — OUR PROCESS ════════════════ */}
          <section id="pv-process" style={{ maxWidth:1200, margin:"0 auto", padding: isMobile ? "56px 16px" : "80px 48px" }}>
            <SectionHeading
              eyebrow="Simple & Transparent"
              title="How It Works"
              subtitle="A clear end-to-end journey from proposal acceptance to monthly payout."
            />

            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap:2, marginBottom:48 }}>
              {HOW_IT_WORKS.map(({ n, title, desc }) => {
                const isLast = n === HOW_IT_WORKS.length;
                return (
                  <div key={n} style={{ padding:"28px 24px", background: isLast ? DARK : WHITE, border:`1px solid ${BORDER}`, borderTop: n<=4 ? `3px solid ${n===1?GOLD:BORDER}` : `1px solid ${BORDER}`, position:"relative" }}>
                    <div style={{ fontSize:40, fontWeight:900, fontFamily:"serif", color: isLast ? GOLD : `${GOLD}25`, marginBottom:12, lineHeight:1 }}>
                      {String(n).padStart(2, "0")}
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:0.5, color: isLast ? WHITE : DARK, marginBottom:8 }}>{title}</div>
                    <div style={{ fontSize:12, color: isLast ? "#666" : "#777", lineHeight:1.7 }}>{desc}</div>
                  </div>
                );
              })}
            </div>

            {/* Why RHH */}
            <div style={{ marginBottom:64 }}>
              <div style={{ marginBottom:32 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:4, textTransform:"uppercase", color:GOLD, marginBottom:10 }}>Our Difference</div>
                <h2 style={{ fontFamily:"serif", fontSize: isMobile ? 24 : 32, fontWeight:800, color:DARK }}>Why Royal Holiday Homes?</h2>
                <p style={{ fontSize:14, color:MUTED, fontStyle:"italic", marginTop:4 }}>We Are Operators, Not Just Agents.</p>
                <div style={{ height:3, width:48, background:`linear-gradient(90deg,${GOLD},${GOLD2})`, marginTop:12, borderRadius:2 }} />
              </div>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:16 }}>
                {WHY_RHH.map(({ icon:Icon, title, desc }) => (
                  <div key={title} style={{ display:"flex", gap:16, padding:"24px 24px", border:`1px solid ${BORDER}`, borderRadius:12, background:WHITE, alignItems:"flex-start" }}>
                    <div style={{ width:42, height:42, borderRadius:10, background:`${GOLD}12`, border:`1px solid ${GOLD}25`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Icon style={{ width:18, height:18, color:GOLD }} />
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:DARK, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>{title}</div>
                      <div style={{ fontSize:13, color:"#666", lineHeight:1.7 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Portfolio */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, letterSpacing:4, textTransform:"uppercase", color:GOLD, marginBottom:10 }}>Track Record</div>
              <h2 style={{ fontFamily:"serif", fontSize: isMobile ? 24 : 32, fontWeight:800, color:DARK, marginBottom:28 }}>Our Portfolio</h2>
              <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)", gap:16, marginBottom:20 }}>
                {PORTFOLIO.map(({ v, l, icon:Icon }) => (
                  <div key={l} style={{ textAlign:"center", padding: isMobile ? "24px 16px" : "36px 24px", border:`1px solid ${BORDER}`, borderRadius:12, background:WHITE }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:`${GOLD}12`, margin:"0 auto 12px", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Icon style={{ width:16, height:16, color:GOLD }} />
                    </div>
                    <div style={{ fontSize: isMobile ? 22 : 32, fontWeight:900, fontFamily:"serif", color:DARK, marginBottom:6 }}>{v}</div>
                    <div style={{ fontSize:11, color:MUTED, textTransform:"uppercase", letterSpacing:1, lineHeight:1.4 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding:"20px 28px", background:CREAM, borderRadius:10, border:`1px solid ${BORDER}`, textAlign:"center" }}>
                <div style={{ fontSize:11, color:MUTED, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>Distribution Partners</div>
                <p style={{ fontSize:15, color:"#555", fontWeight:600 }}>Airbnb · Booking.com · Vrbo · Expedia · Agoda · And More</p>
              </div>
            </div>
          </section>

          {/* ════════════════ SECTION 5 — NEXT STEPS ════════════════ */}
          <section id="pv-next-steps">
            {/* Disclaimer strip */}
            <div style={{ background:CREAM, borderTop:`1px solid ${BORDER}`, borderBottom:`1px solid ${BORDER}`, padding: isMobile ? "32px 16px" : "40px 48px" }}>
              <div style={{ maxWidth:1200, margin:"0 auto" }}>
                <div style={{ display:"flex", gap:16, alignItems:"flex-start", flexWrap:"wrap" }}>
                  <div style={{ flexShrink:0 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:MUTED, marginBottom:4 }}>Important Notes</div>
                    <div style={{ width:32, height:2, background:GOLD, borderRadius:1 }} />
                  </div>
                  <p style={{ fontSize:12, color:MUTED, lineHeight:1.8 }}>
                    All figures are in AED and may be rounded to the nearest whole number.
                    {expiryDate ? ` This proposal is valid until ${expiryDate}.` : ""}
                    {" "}Final management terms are subject to the property management agreement. DCT eligibility and property readiness may affect launch timing. Owner-blocked dates and unplanned repairs may affect annual net income.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Section — read-only banner replaces action buttons */}
            <div style={{ background:`linear-gradient(140deg, ${DARK2} 0%, #1e180e 60%, ${DARK} 100%)`, padding: isMobile ? "64px 24px" : "96px 48px", position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, opacity:0.05, backgroundImage:`radial-gradient(ellipse at 80% 50%, ${GOLD} 0%, transparent 65%)` }} />
              <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${GOLD}, ${GOLD2}, transparent)` }} />

              <div style={{ maxWidth:1200, margin:"0 auto", position:"relative" }}>
                <div style={{ maxWidth:640, marginBottom: isMobile ? 40 : 56 }}>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:4, textTransform:"uppercase", color:GOLD, marginBottom:16 }}>You're One Step Away</div>
                  <h2 style={{ fontFamily:"serif", fontSize: isMobile ? 28 : 48, fontWeight:800, color:WHITE, lineHeight:1.15, marginBottom:16 }}>
                    Ready to Maximise Your Property's Potential?
                  </h2>
                  <p style={{ fontSize: isMobile ? 14 : 16, color:"#888", lineHeight:1.8, marginBottom:8 }}>
                    {advisorName
                      ? `Your dedicated representative, ${advisorName}, is ready to guide you through every step of the onboarding process.`
                      : "Our team will contact you to review the proposal, confirm property requirements, and prepare the management and onboarding documentation."}
                  </p>
                </div>

                {/* Read-only notice instead of action buttons */}
                <div style={{ display:"inline-flex", alignItems:"center", gap:12, padding:"16px 28px", background:"rgba(201,168,76,0.08)", border:`1px solid rgba(201,168,76,0.25)`, borderRadius:10, marginBottom:48 }}>
                  <Eye style={{ width:18, height:18, color:GOLD }} />
                  <span style={{ fontSize:14, color:GOLD, fontWeight:600 }}>
                    Staff Preview — Accept / Call / Question actions are hidden in this view
                  </span>
                </div>

                {/* Contact + Proposal details */}
                <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:24 }}>
                  <div style={{ border:`1px solid rgba(255,255,255,0.08)`, borderRadius:16, padding:"32px 32px", background:"rgba(255,255,255,0.02)" }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:2.5, textTransform:"uppercase", color:"#555", marginBottom:20 }}>Contact Us</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:14, fontSize:14, color:"#666" }}>
                      {[
                        { icon:"📞", value:"800 RHH" },
                        { icon:"🌐", link:"https://www.royalholidayhomes.ae", value:"www.royalholidayhomes.ae" },
                        { icon:"📧", value:"owners@royalholidayhomes.ae" },
                        { icon:"📍", value:"Suite 503, Al Neyadi Building – Sheikh Rashid Bin Saeed St – Al Manhal – Abu Dhabi" },
                      ].map(({ icon, value, link }) => (
                        <div key={value} style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                          <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
                          {link
                            ? <a href={link} target="_blank" rel="noreferrer" style={{ color:GOLD, textDecoration:"none", fontWeight:600 }}>{value}</a>
                            : <span style={{ lineHeight:1.5 }}>{value}</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ border:`1px solid rgba(255,255,255,0.08)`, borderRadius:16, padding:"32px 32px", background:"rgba(255,255,255,0.02)" }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:2.5, textTransform:"uppercase", color:"#555", marginBottom:20 }}>Proposal Details</div>
                    {[
                      { label:"Reference",   value: referenceNum },
                      { label:"Prepared For",value: displayName },
                      { label:"Property",    value: forecast.propertyAddress },
                      { label:"Recommended", value:`${recScenario?.name ?? "Realistic"} at ${recOccPct}% Occupancy` },
                      { label:"Issue Date",  value: propDate },
                      ...(expiryDate ? [{ label:"Valid Until", value:expiryDate }] : []),
                      ...(advisorName ? [{ label:"Representative", value:advisorName }] : []),
                    ].map(({ label, value }) => (
                      <div key={label} style={{ display:"flex", justifyContent:"space-between", paddingBottom:12, marginBottom:12, borderBottom:`1px solid rgba(255,255,255,0.05)` }}>
                        <span style={{ fontSize:11, color:"#444", textTransform:"uppercase", letterSpacing:0.5 }}>{label}</span>
                        <span style={{ fontSize:12, fontWeight:600, color:"#ccc", textAlign:"right", maxWidth:"56%" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ background:DARK2, padding:"24px 48px", borderTop:`1px solid rgba(255,255,255,0.05)` }}>
              <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
                <p style={{ fontSize:11, color:"#444" }}>Confidential · Royal Holiday Homes © {new Date().getFullYear()}</p>
                <p style={{ fontSize:11, color:"#333" }}>This proposal is prepared exclusively for {displayName} and is not for distribution.</p>
              </div>
            </div>
          </section>

        </div>{/* end scroll container */}
      </div>{/* end modal window */}
    </div>
  );
}
