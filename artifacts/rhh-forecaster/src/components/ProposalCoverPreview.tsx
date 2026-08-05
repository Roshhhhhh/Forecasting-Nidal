import { MapPin } from "lucide-react";

// ── Brand tokens (mirrors public/proposal.tsx) ────────────────────────────────
const GOLD   = "#C9A84C";
const GOLD2  = "#E6C97A";
const DARK   = "#1C1C1C";
const DARK2  = "#111111";
const CREAM  = "#FDFCF8";
const WHITE  = "#FFFFFF";
const BORDER = "#E8E4DC";
const MUTED  = "#888888";

function fmtNum(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 }).format(v);
}

export interface ProposalCoverPreviewProps {
  ownerName?: string | null;
  ownerTitle?: string | null;
  propertyAddress?: string | null;
  propertyType?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  internalArea?: number | null;
  view?: string | null;
  netOwnerIncome?: number | null;
  monthlyPayout?: number | null;
  recommendedOccupancy?: number | null;
  increaseVsLtrPct?: number | null;
  grossAnnualRevenue?: number | null;
  netLtrIncome?: number | null;
  advisorName?: string | null;
  /** Live narrative text — updates in real time from the editor */
  narrativeText: string;
  referenceNumber?: string | null;
}

/**
 * Scaled-down replica of the public proposal cover page (Overview tab hero +
 * property card + narrative card). Accepts `narrativeText` as a live prop so
 * the preview updates immediately as the staff member types.
 *
 * The inner content is rendered at 900 px wide and scaled down with
 * CSS transform so the layout matches the real proposal exactly.
 */
export default function ProposalCoverPreview({
  ownerName,
  ownerTitle,
  propertyAddress,
  propertyType,
  bedrooms,
  bathrooms,
  internalArea,
  view,
  netOwnerIncome,
  monthlyPayout,
  recommendedOccupancy,
  increaseVsLtrPct,
  grossAnnualRevenue,
  netLtrIncome,
  advisorName,
  narrativeText,
  referenceNumber,
}: ProposalCoverPreviewProps) {
  const recOcc = Math.round((recommendedOccupancy ?? 0) * 100);
  const hasLtr = (netLtrIncome ?? 0) > 0;

  // The inner canvas is 900 px wide; the container will scale it down.
  const INNER_W = 900;

  const propertyRows = [
    { label: "Type",  value: propertyType },
    { label: "Beds",  value: bedrooms != null ? `${bedrooms} Bedroom${bedrooms !== 1 ? "s" : ""}` : null },
    { label: "Baths", value: bathrooms != null ? `${bathrooms} Bathroom${bathrooms !== 1 ? "s" : ""}` : null },
    { label: "Size",  value: internalArea ? `${fmtNum(internalArea)} sq.ft.` : null },
    { label: "View",  value: view },
  ].filter(r => r.value);

  const kpiStrip = [
    { label: "Annual Net Income",   value: `AED ${fmtNum(netOwnerIncome)}`,  accent: true },
    { label: "Monthly Payout",       value: `AED ${fmtNum(monthlyPayout)}`,   accent: false },
    { label: "Occupancy Assumed",    value: `${recOcc}%`,                      accent: false },
    ...(hasLtr
      ? [{ label: "vs Long-Term Rental", value: `+${increaseVsLtrPct ?? 0}%`, accent: false, green: true }]
      : []),
  ];

  const fallbackNarrative = grossAnnualRevenue
    ? `Based on our analysis of comparable units in ${propertyAddress?.split(",")[0] ?? "Abu Dhabi"}, we forecast your property to generate AED ${fmtNum(grossAnnualRevenue)} annually at ${recOcc}% occupancy — representing a +${increaseVsLtrPct ?? 0}% increase compared to traditional long-term leasing.`
    : "Your personalised narrative will appear here once you type it above.";

  const displayNarrative = narrativeText.trim() || fallbackNarrative;

  return (
    /* Outer wrapper — constrains width and clips the scaled content */
    <div
      style={{ width: "100%", overflow: "hidden", position: "relative", borderRadius: 12, border: `1px solid ${BORDER}`, background: CREAM }}
      aria-label="Proposal cover preview"
    >
      {/* Scale container: renders at INNER_W, then CSS scale brings it to fit */}
      <div
        style={{
          width: INNER_W,
          transformOrigin: "top left",
          // scale is applied dynamically via a CSS custom property set on mount/resize,
          // but for SSR / no-JS we default to 0.55 which fits ~500px containers.
          // We rely on a ResizeObserver below to keep it accurate.
        }}
        className="proposal-preview-inner"
      >
        {/* ── Hero ── */}
        <div style={{
          padding: "56px 56px 48px",
          background: `linear-gradient(135deg, ${DARK2} 0%, #2a2218 60%, ${DARK} 100%)`,
          position: "relative", overflow: "hidden",
        }}>
          {/* Gold accent line */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${GOLD} 0%, ${GOLD2} 50%, transparent 100%)` }} />
          {/* Radial glow */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle at 70% 50%, #C9A84C 0%, transparent 60%)" }} />

          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: GOLD, marginBottom: 16 }}>
              Exclusively Prepared For
            </div>
            <h1 style={{ fontFamily: "serif", fontSize: 38, fontWeight: 800, color: WHITE, lineHeight: 1.15, marginBottom: 6, maxWidth: 600 }}>
              {ownerTitle ? `${ownerTitle} ` : ""}{ownerName || "—"}
            </h1>
            <p style={{ fontSize: 15, color: "#aaa", marginBottom: 32, fontWeight: 400 }}>
              Property Management Proposal
            </p>

            {/* Property chip */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8, marginBottom: 32 }}>
              <MapPin style={{ width: 13, height: 13, color: GOLD, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#ccc" }}>{propertyAddress || "Property address"}</span>
            </div>

            {/* KPI strip */}
            <div style={{
              display: "grid",
              gridTemplateColumns: `repeat(${kpiStrip.length}, 1fr)`,
              gap: 1,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 10,
              overflow: "hidden",
            }}>
              {kpiStrip.map(({ label, value, accent, green }: any) => (
                <div key={label} style={{
                  padding: "22px 18px",
                  background: accent ? "rgba(201,168,76,0.12)" : "transparent",
                  borderLeft: accent ? `3px solid ${GOLD}` : "none",
                }}>
                  <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "serif", color: accent ? GOLD : green ? "#4ade80" : WHITE }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Property details + Narrative ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 20, padding: "24px 28px 28px", background: CREAM }}>
          {/* Property card */}
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "22px 22px", background: WHITE }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Property Details</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {propertyRows.length > 0 ? propertyRows.map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 10, borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: DARK, textTransform: "capitalize" }}>{value}</span>
                </div>
              )) : (
                <p style={{ fontSize: 11, color: "#bbb", fontStyle: "italic" }}>Property details will appear once the owner profile is populated.</p>
              )}
            </div>
            <div style={{ marginTop: 16, padding: "10px 14px", background: CREAM, borderRadius: 8 }}>
              <span style={{ color: MUTED, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 3 }}>Representative</span>
              <span style={{ fontSize: 11, color: "#555" }}>{advisorName ?? "Royal Holiday Homes Team"}</span>
            </div>
          </div>

          {/* Narrative card */}
          <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: "22px 24px", background: WHITE, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: MUTED, marginBottom: 16 }}>Our Assessment</div>
            <p style={{ fontSize: 14, color: narrativeText.trim() ? "#444" : "#bbb", lineHeight: 1.9, fontFamily: "serif", flex: 1, fontStyle: narrativeText.trim() ? "normal" : "italic" }}>
              {displayNarrative}
            </p>
          </div>
        </div>
      </div>

      {/* CSS to handle scaling */}
      <style>{`
        .proposal-preview-inner {
          /* default scale for ~500px containers; overridden by ResizeObserver */
          transform: scale(var(--proposal-preview-scale, 0.56));
          transform-origin: top left;
          /* height is adjusted dynamically below */
        }
      `}</style>
      {/* ResizeObserver script — adjusts scale and container height */}
      <ProposalPreviewScaler innerWidth={INNER_W} />
    </div>
  );
}

/** Tiny helper that runs a ResizeObserver to keep the scale correct. */
function ProposalPreviewScaler({ innerWidth }: { innerWidth: number }) {
  // We use a ref-based approach via a tiny useEffect in this sibling component.
  // This keeps the main component pure (no refs entangled in the JSX tree).
  return <_Scaler innerWidth={innerWidth} />;
}

import { useEffect, useRef } from "react";

function _Scaler({ innerWidth }: { innerWidth: number }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrapper = ref.current?.closest("[aria-label='Proposal cover preview']") as HTMLElement | null;
    if (!wrapper) return;

    const inner = wrapper.querySelector(".proposal-preview-inner") as HTMLElement | null;
    if (!inner) return;

    function update() {
      const containerW = wrapper!.offsetWidth;
      const scale = containerW / innerWidth;
      inner!.style.transform = `scale(${scale})`;
      // Adjust the wrapper height so it matches the scaled content height
      wrapper!.style.height = `${inner!.scrollHeight * scale}px`;
    }

    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [innerWidth]);

  return <div ref={ref} style={{ display: "none" }} />;
}
