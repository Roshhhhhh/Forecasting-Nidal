/**
 * ProposalSharePanel
 * Premium WhatsApp / Email share card for the owner proposal.
 * Renders an in-browser preview of the message card, then provides
 * one-click WhatsApp and Email share buttons.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle, Mail, ChevronDown, ChevronUp, Pencil, Check,
  TrendingUp, DollarSign, Home,
} from "lucide-react";

interface Props {
  ownerName:    string | null;
  propertyAddress: string | null;
  propertyType: string | null;
  bedrooms:     number | null;
  area:         string | null;
  grossRevenue: number | null;
  netPayout:    number | null;
  occupancy:    number | null;   // e.g. 0.80
  vsLtrPct:     number | null;
  shareUrl:     string;          // full URL
  referenceNumber: string;
  advisorName:  string | null;
}

function fmtAed(n: number) {
  return `AED ${Math.round(n).toLocaleString("en-AE")}`;
}

function buildWhatsAppMessage(p: Props, customNote: string): string {
  const owner  = p.ownerName  ?? "Valued Client";
  const prop   = p.propertyAddress ?? (p.area ?? "your property");
  const beds   = p.bedrooms ? `${p.bedrooms}-bedroom ` : "";
  const type   = p.propertyType ? p.propertyType.replace(/_/g, " ") : "property";
  const gross  = p.grossRevenue ? `*${fmtAed(p.grossRevenue)}*` : null;
  const net    = p.netPayout   ? `*${fmtAed(p.netPayout)}*`   : null;
  const occ    = p.occupancy   ? `*${Math.round(p.occupancy * 100)}%*` : null;
  const uplift = p.vsLtrPct != null && p.vsLtrPct > 0
    ? `*+${Math.round(p.vsLtrPct)}%* above long-term rental income` : null;

  const lines: string[] = [
    `🏡 *Your Royal Holiday Homes Proposal is Ready*`,
    ``,
    `Dear ${owner},`,
    ``,
    customNote.trim()
      ? customNote.trim()
      : `We're excited to share your personalised revenue forecast for your ${beds}${type} in ${prop}. Based on our in-depth analysis of the current short-term rental market, here are the headline projections:`,
    ``,
    ...(gross  ? [`💰 Gross Annual Revenue: ${gross}`]      : []),
    ...(net    ? [`💼 Net Owner Payout: ${net}`]            : []),
    ...(occ    ? [`📊 Projected Occupancy: ${occ}`]         : []),
    ...(uplift ? [`📈 Estimated uplift: ${uplift}`]         : []),
    ``,
    `👉 View your full branded proposal here:`,
    p.shareUrl,
    ``,
    `This link is private and exclusive to you. It expires in 30 days.`,
    ``,
    `Warm regards,`,
    p.advisorName ? `${p.advisorName}` : `The Royal Holiday Homes Team`,
    `_Royal Holiday Homes — Premium Short-Term Rental Management, Abu Dhabi_`,
  ];
  return lines.join("\n");
}

function buildEmailBody(p: Props, customNote: string): { subject: string; body: string } {
  const owner  = p.ownerName  ?? "Valued Client";
  const prop   = p.propertyAddress ?? (p.area ?? "your property");
  const beds   = p.bedrooms ? `${p.bedrooms}-bedroom ` : "";
  const type   = p.propertyType ? p.propertyType.replace(/_/g, " ") : "property";
  const gross  = p.grossRevenue ? fmtAed(p.grossRevenue) : null;
  const net    = p.netPayout   ? fmtAed(p.netPayout)   : null;
  const occ    = p.occupancy   ? `${Math.round(p.occupancy * 100)}%` : null;
  const uplift = p.vsLtrPct != null && p.vsLtrPct > 0
    ? `+${Math.round(p.vsLtrPct)}% above long-term rental income` : null;

  const subject = `Your Royal Holiday Homes Revenue Forecast — ${p.referenceNumber}`;
  const body = [
    `Dear ${owner},`,
    ``,
    customNote.trim()
      ? customNote.trim()
      : `We're pleased to share your personalised revenue forecast for your ${beds}${type} in ${prop}. Below are the key projections based on current short-term rental market conditions:`,
    ``,
    ...(gross  ? [`• Gross Annual Revenue: ${gross}`]            : []),
    ...(net    ? [`• Net Owner Payout: ${net}`]                  : []),
    ...(occ    ? [`• Projected Occupancy: ${occ}`]               : []),
    ...(uplift ? [`• Estimated uplift: ${uplift}`]               : []),
    ``,
    `Please click the link below to view your full branded proposal:`,
    p.shareUrl,
    ``,
    `This link is private and expires in 30 days. If you have any questions or would like to discuss the findings, please don't hesitate to reach out.`,
    ``,
    `Warm regards,`,
    p.advisorName ? p.advisorName : `The Royal Holiday Homes Team`,
    `Royal Holiday Homes`,
    `Premium Short-Term Rental Management, Abu Dhabi`,
  ].join("\n");
  return { subject, body };
}

export default function ProposalSharePanel(props: Props) {
  const [customNote, setCustomNote]   = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [cardExpanded, setCardExpanded] = useState(true);

  const waMessage  = buildWhatsAppMessage(props, customNote);
  const { subject, body: emailBody } = buildEmailBody(props, customNote);

  const waUrl    = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;

  const owner    = props.ownerName ?? "Valued Client";
  const prop     = props.propertyAddress ?? (props.area ?? "—");
  const occ      = props.occupancy ? `${Math.round(props.occupancy * 100)}%` : null;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#25D366]" />
          <h3 className="text-sm font-semibold text-foreground">Share with Owner</h3>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-[#25D366]/10 text-[#128C7E] border-[#25D366]/20">
            Premium message included
          </Badge>
        </div>
        <button
          onClick={() => setCardExpanded(v => !v)}
          className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
        >
          Preview {cardExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── Premium card preview ── */}
      {cardExpanded && (
        <div
          className="rounded-2xl overflow-hidden shadow-xl"
          style={{ background: "linear-gradient(145deg, #0e0b06 0%, #1c1508 40%, #241a08 70%, #1a1207 100%)" }}
        >
          {/* Top gold accent line */}
          <div style={{ height: 3, background: "linear-gradient(90deg, #8B6914, #D4AF37, #F5D76E, #D4AF37, #8B6914)" }} />

          <div className="p-6 space-y-5">
            {/* Logo + brand line */}
            <div className="flex items-center justify-between">
              <img src="/rhh-logo-gold.png" alt="Royal Holiday Homes" className="h-10 w-auto" />
              <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "#9b8040" }}>
                Revenue Forecast
              </span>
            </div>

            {/* Owner greeting */}
            <div>
              <p className="text-xs font-medium mb-0.5" style={{ color: "#9b8040" }}>Prepared exclusively for</p>
              <p className="text-xl font-serif font-bold" style={{ color: "#F5D76E" }}>{owner}</p>
              <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "#7a6830" }}>
                <Home className="h-3 w-3" />
                {prop}
              </p>
            </div>

            {/* Key metrics */}
            {(props.grossRevenue || props.netPayout || occ) && (
              <div className="grid grid-cols-3 gap-3">
                {props.grossRevenue && (
                  <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)" }}>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" style={{ color: "#D4AF37" }} />
                      <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#9b8040" }}>Gross Revenue</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums leading-tight" style={{ color: "#F5D76E" }}>
                      {fmtAed(props.grossRevenue)}
                    </p>
                    <p className="text-[9px]" style={{ color: "#7a6830" }}>per year</p>
                  </div>
                )}
                {props.netPayout && (
                  <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(212,175,55,0.12)", border: "1px solid rgba(212,175,55,0.3)" }}>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" style={{ color: "#D4AF37" }} />
                      <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#9b8040" }}>Your Payout</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums leading-tight" style={{ color: "#F5D76E" }}>
                      {fmtAed(props.netPayout)}
                    </p>
                    <p className="text-[9px]" style={{ color: "#7a6830" }}>net annual</p>
                  </div>
                )}
                {occ && (
                  <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(212,175,55,0.08)", border: "1px solid rgba(212,175,55,0.2)" }}>
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" style={{ color: "#D4AF37" }} />
                      <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: "#9b8040" }}>Occupancy</p>
                    </div>
                    <p className="text-sm font-bold tabular-nums leading-tight" style={{ color: "#F5D76E" }}>{occ}</p>
                    <p className="text-[9px]" style={{ color: "#7a6830" }}>projected</p>
                  </div>
                )}
              </div>
            )}

            {/* Personalized note */}
            <div className="rounded-xl p-3.5 space-y-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,175,55,0.12)" }}>
              <p className="text-xs leading-relaxed" style={{ color: "#c8a84b" }}>
                {customNote.trim() || "We've prepared your exclusive revenue forecast. Click below to view your personalised proposal with full financials, scenario comparisons, and market evidence."}
              </p>
            </div>

            {/* Uplift badge */}
            {props.vsLtrPct != null && props.vsLtrPct > 0 && (
              <div className="flex items-center gap-2">
                <div className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: "rgba(212,175,55,0.15)", color: "#D4AF37", border: "1px solid rgba(212,175,55,0.3)" }}>
                  +{Math.round(props.vsLtrPct)}% above long-term rental
                </div>
              </div>
            )}

            {/* CTA link */}
            <div className="rounded-xl p-3.5" style={{ background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)" }}>
              <p className="text-[9px] uppercase tracking-wider mb-1.5 font-semibold" style={{ color: "#9b8040" }}>
                Your private proposal link
              </p>
              <p className="text-xs font-mono truncate" style={{ color: "#F5D76E" }}>{props.shareUrl}</p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1" style={{ borderTop: "1px solid rgba(212,175,55,0.1)" }}>
              <p className="text-[9px] uppercase tracking-[0.15em] font-medium" style={{ color: "#6b5820" }}>
                Royal Holiday Homes
              </p>
              <p className="text-[9px]" style={{ color: "#6b5820" }}>
                Premium Short-Term Rental · Abu Dhabi
              </p>
            </div>
          </div>

          {/* Bottom gold accent */}
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #D4AF37, transparent)" }} />
        </div>
      )}

      {/* ── Personalised note editor ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Pencil className="h-3 w-3" />
            Personal note (optional)
          </label>
          {customNote.trim() && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => setCustomNote("")}
            >
              <Check className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
        {editingNote ? (
          <div className="space-y-2">
            <Textarea
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              placeholder="e.g. It was a pleasure speaking with you today. As discussed, here is the detailed revenue projection for your property…"
              className="text-sm leading-relaxed min-h-[80px] resize-none"
              maxLength={400}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground">{customNote.length}/400</p>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingNote(false)}>Done</Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            {customNote.trim() || <span className="italic">Add a personal note to the message… (optional)</span>}
          </button>
        )}
      </div>

      {/* ── Share buttons ── */}
      <div className="flex gap-3">
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95 shadow-sm"
          style={{ background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)" }}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Share via WhatsApp
        </a>
        <a
          href={emailUrl}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-95 active:scale-95 shadow-sm border"
          style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)", color: "#e8d5a3", borderColor: "rgba(212,175,55,0.3)" }}
        >
          <Mail className="h-4 w-4" />
          Share via Email
        </a>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Opens WhatsApp / your email client with a pre-written message. You choose who to send it to.
      </p>
    </div>
  );
}
