import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList, ChevronDown, ChevronUp, ExternalLink,
  User, Building2, Percent, UserCheck, Calendar, AlertCircle,
} from "lucide-react";

function frRef(id: number) {
  return `FR-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;
}

function ownerLabel(fr: any) {
  const parts = [fr.ownerTitle, fr.ownerFirstName, fr.ownerLastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (fr.ownerCompanyName) return fr.ownerCompanyName;
  if (fr.ownerContactPerson) return fr.ownerContactPerson;
  return "—";
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

interface Props {
  forecastRequestId: number;
  context: "owner" | "property" | "forecast";
  linkedOwnerName?: string;
}

export function ForecastRequestContextBar({ forecastRequestId, context, linkedOwnerName }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { data: fr, isLoading, isError } = useQuery({
    queryKey: ["forecast-request", forecastRequestId],
    queryFn: () => fetch(`/api/forecast-requests/${forecastRequestId}`).then(r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
    retry: 1,
  });

  if (isLoading) return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-center gap-2 animate-pulse">
      <ClipboardList className="h-4 w-4 text-amber-600 shrink-0" />
      <span className="text-xs text-amber-700">Loading request context…</span>
    </div>
  );

  if (isError || !fr) return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2">
      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
      <span className="text-xs text-red-600">Could not load forecast request context.</span>
    </div>
  );

  const ref = frRef(fr.id);
  const owner = ownerLabel(fr);
  const location = [fr.propertyCommunity || fr.propertyDevelopment, fr.propertyArea, fr.propertyEmirate].filter(Boolean).join(", ");

  // ── Collapsed (mobile-optimised single-line) ──
  const collapsed = (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <ClipboardList className="h-3.5 w-3.5 text-amber-600 shrink-0" />
      <span className="text-xs font-semibold text-amber-800 font-mono shrink-0">{ref}</span>
      <span className="text-amber-400 shrink-0">·</span>
      <span className="text-xs text-amber-700 truncate">{owner}</span>
      {context === "property" && location && (
        <>
          <span className="text-amber-400 shrink-0">·</span>
          <span className="text-xs text-amber-700 truncate">{location}</span>
        </>
      )}
      {fr.proposedManagementCommission && (
        <>
          <span className="text-amber-400 shrink-0">·</span>
          <span className="text-xs text-amber-700 shrink-0">PMC {fr.proposedManagementCommission}</span>
        </>
      )}
    </div>
  );

  // ── Expanded rows per context ──
  const rows: { icon: React.FC<any>; label: string; value: string }[] = [];

  if (context === "owner") {
    rows.push(
      { icon: User, label: "Owner", value: owner },
      { icon: User, label: "Type", value: fr.ownerType === "company" ? "Company" : "Individual" },
    );
    if (fr.ownerPhone) rows.push({ icon: User, label: "Mobile", value: fr.ownerPhone });
    if (fr.ownerEmail) rows.push({ icon: User, label: "Email", value: fr.ownerEmail });
    if (fr.ownerCompanyName && fr.ownerType === "individual") rows.push({ icon: User, label: "Company", value: fr.ownerCompanyName });
    if (fr.refereeName) rows.push({ icon: UserCheck, label: "Referee", value: fr.refereeName });
    if (fr.createdByName) rows.push({ icon: User, label: "Submitted by", value: fr.createdByName });
    if (fr.createdAt) rows.push({ icon: Calendar, label: "Submitted", value: formatDate(fr.createdAt) });
  } else if (context === "property") {
    if (linkedOwnerName || owner) rows.push({ icon: User, label: "Owner", value: linkedOwnerName || owner });
    if (fr.propertyArea) rows.push({ icon: Building2, label: "Area", value: fr.propertyArea });
    if (fr.propertyCommunity) rows.push({ icon: Building2, label: "Community", value: fr.propertyCommunity });
    if (fr.propertyDevelopment) rows.push({ icon: Building2, label: "Building", value: fr.propertyDevelopment });
    if (fr.propertyUnitNumber) rows.push({ icon: Building2, label: "Unit", value: fr.propertyUnitNumber });
    if (fr.propertyType) rows.push({ icon: Building2, label: "Type", value: fr.propertyType });
    if (fr.propertyLayout) rows.push({ icon: Building2, label: "Layout", value: fr.propertyLayout });
    if (fr.proposedManagementCommission) rows.push({ icon: Percent, label: "PMC", value: fr.proposedManagementCommission });
    if (fr.refereeName) rows.push({ icon: UserCheck, label: "Referee", value: fr.refereeName });
  } else {
    // forecast context
    if (linkedOwnerName || owner) rows.push({ icon: User, label: "Owner", value: linkedOwnerName || owner });
    if (fr.propertyArea) rows.push({ icon: Building2, label: "Area", value: fr.propertyArea });
    if (fr.propertyCommunity) rows.push({ icon: Building2, label: "Community", value: fr.propertyCommunity });
    if (fr.propertyLayout && fr.propertyType) rows.push({ icon: Building2, label: "Property", value: `${fr.propertyLayout} ${fr.propertyType}` });
    if (fr.proposedManagementCommission) rows.push({ icon: Percent, label: "Proposed PMC", value: fr.proposedManagementCommission });
    if (fr.refereeName) rows.push({ icon: UserCheck, label: "Referee", value: fr.refereeName });
    if (fr.createdByName) rows.push({ icon: User, label: "Submitted by", value: fr.createdByName });
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-sm">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
          <ClipboardList className="h-3.5 w-3.5 text-amber-700" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-amber-600 uppercase tracking-wider leading-none mb-0.5">
            {context === "owner" ? "Creating Owner from" : context === "property" ? "Creating Property from" : "Forecast Source"}
          </p>
          {collapsed}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link href={`/forecast-requests/${fr.id}`} className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 transition-colors">
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">View Request</span>
          </Link>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-amber-600 hover:text-amber-800 p-0.5 transition-colors"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded detail grid */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-amber-200/70 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {rows.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-baseline gap-2 min-w-0">
                <span className="text-[10px] font-medium text-amber-600 w-20 shrink-0">{label}</span>
                <span className="text-xs text-amber-900 truncate">{value}</span>
              </div>
            ))}
          </div>
          {fr.notes && (
            <div className="mt-2 pt-2 border-t border-amber-200/50">
              <span className="text-[10px] font-medium text-amber-600">Notes </span>
              <span className="text-xs text-amber-800 italic">"{fr.notes}"</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
