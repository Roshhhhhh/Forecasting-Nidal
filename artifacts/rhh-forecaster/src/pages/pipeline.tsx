import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Building2, User, TrendingUp, Clock, AlertTriangle, ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface PipelineCard {
  ownerId: number;
  ownerName: string;
  ownerType: string;
  leadSource: string | null;
  isExistingClient: boolean;
  assignedToName: string | null;
  forecastId: number | null;
  forecastStatus: string | null;
  forecastRequestId: number | null;
  projectedPayout: number | null;
  propertyType: string | null;
  bedrooms: number | null;
  area: string | null;
  community: string | null;
  daysInStage: number;
}

interface PipelineStage {
  key: string;
  cards: PipelineCard[];
  count: number;
  totalPayout: number;
}

interface PipelineData {
  stages: PipelineStage[];
  lostCount: number;
  lostCards: PipelineCard[];
}

// ── Stage config ─────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, {
  label: string;
  headerBg: string;
  colBg: string;
  border: string;
  accent: string;
}> = {
  new_lead:            { label: "New Lead",           headerBg: "bg-slate-600",   colBg: "bg-slate-50",    border: "border-slate-200",   accent: "#475569" },
  forecast_requested:  { label: "Forecast Requested", headerBg: "bg-teal-600",    colBg: "bg-teal-50",     border: "border-teal-200",    accent: "#0d9488" },
  in_review:           { label: "In Review",          headerBg: "bg-blue-600",    colBg: "bg-blue-50",     border: "border-blue-200",    accent: "#2563eb" },
  proposal_sent:       { label: "Proposal Sent",      headerBg: "bg-amber-500",   colBg: "bg-amber-50",    border: "border-amber-200",   accent: "#d97706" },
  proposal_viewed:     { label: "Viewed",             headerBg: "bg-orange-500",  colBg: "bg-orange-50",   border: "border-orange-200",  accent: "#ea580c" },
  negotiating:         { label: "Negotiating",        headerBg: "bg-violet-600",  colBg: "bg-violet-50",   border: "border-violet-200",  accent: "#7c3aed" },
  accepted:            { label: "Accepted",           headerBg: "bg-emerald-600", colBg: "bg-emerald-50",  border: "border-emerald-200", accent: "#059669" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAed(n: number) {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `AED ${Math.round(n / 1_000)}K`;
  return `AED ${n.toLocaleString()}`;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DaysBadge({ days }: { days: number }) {
  const cls =
    days <= 2  ? "text-emerald-700 bg-emerald-100" :
    days <= 7  ? "text-amber-700 bg-amber-100" :
                 "text-red-700 bg-red-100";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${cls}`}>
      <Clock className="h-2.5 w-2.5" />
      {days === 0 ? "Today" : `${days}d`}
    </span>
  );
}

function OwnerCard({ card, accent }: { card: PipelineCard; accent: string }) {
  const propLine = [
    card.bedrooms != null ? `${card.bedrooms}BR` : null,
    card.propertyType ? titleCase(card.propertyType) : null,
    card.area ?? card.community,
  ].filter(Boolean).join(" · ");

  return (
    <div
      className="bg-white rounded-lg border border-border shadow-sm hover:shadow-md transition-all p-3 space-y-2 group"
      style={{ borderLeftWidth: 3, borderLeftColor: accent }}
    >
      {/* Name + days */}
      <div className="flex items-start justify-between gap-2">
        <Link href={`/owners/${card.ownerId}`} className="flex items-center gap-1.5 min-w-0 cursor-pointer">
          {card.ownerType === "company"
            ? <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            : <User       className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          }
          <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {card.ownerName}
          </span>
        </Link>
        <DaysBadge days={card.daysInStage} />
      </div>

      {/* Property */}
      <p className="text-xs text-muted-foreground truncate">
        {propLine || <span className="italic">No property yet</span>}
      </p>

      {/* Payout + rep + source */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {card.projectedPayout != null ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <TrendingUp className="h-3 w-3" />
              {fmtAed(card.projectedPayout)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No forecast</span>
          )}
          {card.leadSource && (
            <span className="text-[10px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
              {titleCase(card.leadSource)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {card.forecastRequestId != null && (
            <Link href={`/forecast-requests/${card.forecastRequestId}`}>
              <span
                title="View forecast request"
                className="inline-flex items-center gap-1 text-[10px] font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded px-1.5 py-0.5 hover:bg-teal-100 transition-colors cursor-pointer"
              >
                <ClipboardList className="h-2.5 w-2.5" />
                Request
              </span>
            </Link>
          )}
          {card.assignedToName && (
            <span
              title={`Assigned to ${card.assignedToName}`}
              className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0"
            >
              {initials(card.assignedToName)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ stage }: { stage: PipelineStage }) {
  const cfg = STAGE_CONFIG[stage.key] ?? STAGE_CONFIG.new_lead;

  return (
    <div className={`flex flex-col rounded-xl border ${cfg.border} w-[268px] shrink-0`}>
      {/* Column header */}
      <div className={`${cfg.headerBg} text-white rounded-t-xl px-3 py-2.5 shrink-0`}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">{cfg.label}</span>
          <span className="bg-white/25 text-white text-xs font-bold px-2 py-0.5 rounded-full tabular-nums">
            {stage.count}
          </span>
        </div>
        {stage.totalPayout > 0 && (
          <p className="text-xs text-white/70 mt-0.5 tabular-nums">
            {fmtAed(stage.totalPayout)} total
          </p>
        )}
      </div>

      {/* Cards scroll area */}
      <div
        className={`${cfg.colBg} rounded-b-xl flex-1 overflow-y-auto p-2 space-y-2`}
        style={{ minHeight: 100, maxHeight: "calc(100vh - 260px)" }}
      >
        {stage.cards.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8 italic">Empty</p>
        ) : (
          stage.cards.map(card => (
            <OwnerCard key={card.ownerId} card={card} accent={cfg.accent} />
          ))
        )}
      </div>
    </div>
  );
}

function LostSection({ cards }: { cards: PipelineCard[] }) {
  const [open, setOpen] = useState(false);
  if (cards.length === 0) return null;
  return (
    <div className="border-t border-border bg-muted/30">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-6 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <span className="font-medium">{cards.length} declined / expired</span>
      </button>
      {open && (
        <div className="px-6 pb-4 flex flex-wrap gap-2">
          {cards.map(card => (
            <Link key={card.ownerId} href={`/owners/${card.ownerId}`}>
              <span className="inline-flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 bg-background hover:bg-muted cursor-pointer">
                {card.ownerType === "company"
                  ? <Building2 className="h-3 w-3 text-muted-foreground" />
                  : <User       className="h-3 w-3 text-muted-foreground" />
                }
                {card.ownerName}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const { data, isLoading, error } = useQuery<PipelineData>({
    queryKey: ["pipeline"],
    queryFn: async () => {
      const res = await fetch("/api/pipeline", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load pipeline");
      return res.json();
    },
    refetchInterval: 60_000,
  });

  const totalOwners = data?.stages.reduce((s, st) => s + st.count, 0) ?? 0;
  const totalValue  = data?.stages.reduce((s, st) => s + st.totalPayout, 0) ?? 0;

  return (
    <div className="flex flex-col" style={{ height: "100dvh" }}>
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-background shrink-0">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Deal Pipeline</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Every owner from first contact to onboarded
            </p>
          </div>
          {data && (
            <div className="flex items-center gap-5 text-sm mt-1">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{totalOwners}</span>{" "}
                active owners
              </span>
              {totalValue > 0 && (
                <span className="text-muted-foreground">
                  <span className="font-semibold text-emerald-600 tabular-nums">{fmtAed(totalValue)}</span>{" "}
                  pipeline value
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-sm text-muted-foreground animate-pulse">Loading pipeline…</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-64 text-red-500 text-sm">
            Failed to load pipeline data.
          </div>
        ) : (
          <div className="p-4 flex gap-3 items-start" style={{ minWidth: "max-content", minHeight: "calc(100% - 1px)" }}>
            {data?.stages.map(stage => (
              <KanbanColumn key={stage.key} stage={stage} />
            ))}
          </div>
        )}
      </div>

      {/* Lost section */}
      {data?.lostCards && data.lostCards.length > 0 && (
        <LostSection cards={data.lostCards} />
      )}
    </div>
  );
}
