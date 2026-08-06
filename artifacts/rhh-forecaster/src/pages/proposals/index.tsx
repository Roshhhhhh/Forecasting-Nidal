import { useListProposals } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Search, Globe, Bell, X, Eye, EyeOff, Clock, Building2, User, ExternalLink, Send, CheckCircle,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DataTable, ColumnDef } from "@/components/DataTable";
import { SmartReport } from "@/components/SmartReport";
import { PageTabs } from "@/components/PageTabs";

const NEW_VIEW_WINDOW_MS = 2 * 60 * 60 * 1000;

const STATUSES = [
  { value: "all",       label: "All" },
  { value: "published", label: "Published" },
  { value: "viewed",    label: "Viewed" },
  { value: "accepted",  label: "Accepted" },
  { value: "declined",  label: "Declined" },
  { value: "expired",   label: "Expired" },
];

const ENGAGEMENT_OPTIONS = [
  { value: "all",      label: "Any Engagement" },
  { value: "hot",      label: "🔥 Active (24h)" },
  { value: "unviewed", label: "Not Opened" },
  { value: "multiple", label: "5+ Views" },
];

const EXPIRY_OPTIONS = [
  { value: "all",     label: "Any" },
  { value: "active",  label: "Active" },
  { value: "soon",    label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap select-none
        ${active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
        }`}
    >
      {children}
    </button>
  );
}

const getStatusColor = (s: string) => {
  switch (s) {
    case "published": return "bg-primary/20 text-primary border-primary/30";
    case "viewed":    return "bg-blue-500/20 text-blue-700 border-blue-500/30";
    case "accepted":  return "bg-green-500/20 text-green-700 border-green-500/30";
    case "declined":  return "bg-red-500/20 text-red-700 border-red-500/30";
    case "expired":   return "bg-gray-500/20 text-gray-700 border-gray-500/30";
    default:          return "bg-secondary/20 text-secondary-foreground border-secondary/30";
  }
};

type ProposalRow = NonNullable<ReturnType<typeof useListProposals>["data"]>[number];

const PROPOSAL_COLUMNS: ColumnDef<ProposalRow>[] = [
  {
    key: "reference",
    label: "Reference",
    description: "Proposal reference and generation date",
    render: (p) => (
      <div>
        <Link href={`/proposals/${p.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
          {p.referenceNumber}
        </Link>
        <div className="text-xs text-muted-foreground mt-0.5 font-normal">
          {new Date(p.createdAt).toLocaleDateString()}
        </div>
      </div>
    ),
    exportValue: (p) => p.referenceNumber,
    minWidth: "min-w-[130px]",
  },
  {
    key: "owner",
    label: "Owner",
    description: "Property owner name and type",
    render: (p) => {
      const anyP = p as any;
      if (!anyP.ownerName) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <div className="flex items-center gap-1.5">
          {anyP.ownerType === "company"
            ? <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            : <User      className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          }
          {anyP.ownerId ? (
            <Link
              href={`/owners/${anyP.ownerId}`}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate max-w-[140px]"
            >
              {anyP.ownerName}
            </Link>
          ) : (
            <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{anyP.ownerName}</span>
          )}
        </div>
      );
    },
    exportValue: (p) => (p as any).ownerName ?? "",
    minWidth: "min-w-[140px]",
  },
  {
    key: "property",
    label: "Property",
    description: "Property type, size, and area",
    render: (p) => {
      const anyP = p as any;
      const propLine = [
        anyP.bedrooms != null
          ? anyP.bedrooms === 0 ? "Studio" : `${anyP.bedrooms}BR`
          : null,
        anyP.propertyType
          ? anyP.propertyType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
          : null,
        anyP.area ?? anyP.community,
      ].filter(Boolean).join(" · ");
      return propLine
        ? <span className="text-sm text-muted-foreground truncate block max-w-[160px]">{propLine}</span>
        : <span className="text-muted-foreground text-xs">—</span>;
    },
    exportValue: (p) => {
      const anyP = p as any;
      return [
        anyP.bedrooms != null ? (anyP.bedrooms === 0 ? "Studio" : `${anyP.bedrooms}BR`) : "",
        anyP.propertyType ?? "",
        anyP.area ?? anyP.community ?? "",
      ].filter(Boolean).join(" · ");
    },
    minWidth: "min-w-[150px]",
  },
  {
    key: "status",
    label: "Status",
    description: "Current proposal status",
    render: (p) => (
      <div>
        <Badge variant="outline" className={`capitalize ${getStatusColor(p.status)}`}>
          {p.status.replace("_", " ")}
        </Badge>
        {(p as any).ownerAction && (
          <div className="text-xs text-muted-foreground mt-1 capitalize flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            {(p as any).ownerAction.replace("_", " ")}
          </div>
        )}
      </div>
    ),
    exportValue: (p) => p.status.replace("_", " "),
  },
  {
    key: "views",
    label: "Views",
    description: "Total and unique view counts",
    render: (p) => (
      <div className="flex flex-col items-center">
        <span className="font-medium">{p.totalViews ?? 0}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.uniqueViews ?? 0} unique</span>
      </div>
    ),
    exportValue: (p) => p.totalViews ?? 0,
  },
  {
    key: "lastViewed",
    label: "Last Viewed",
    description: "Date the proposal was last opened",
    render: (p) => {
      if (!p.lastViewedAt) return <span className="text-muted-foreground">—</span>;
      const isNew = Date.now() - new Date(p.lastViewedAt).getTime() < NEW_VIEW_WINDOW_MS;
      return (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">{new Date(p.lastViewedAt).toLocaleDateString()}</span>
          {isNew && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 w-fit bg-blue-500 hover:bg-blue-500 text-white gap-1">
              <Bell className="h-2.5 w-2.5" /> New View
            </Badge>
          )}
        </div>
      );
    },
    exportValue: (p) => p.lastViewedAt ? new Date(p.lastViewedAt).toLocaleDateString() : "",
  },
  {
    key: "leadOwner",
    label: "Lead Owner",
    description: "Assigned staff member",
    defaultVisible: false,
    render: (p) => <span className="text-sm text-muted-foreground">{(p as any).assignedToName ?? "—"}</span>,
    exportValue: (p) => (p as any).assignedToName ?? "",
  },
  {
    key: "expires",
    label: "Expires",
    description: "Proposal expiry date",
    render: (p) => {
      if (!p.expiresAt) return <span className="text-muted-foreground">—</span>;
      const isExpired = new Date(p.expiresAt).getTime() < Date.now();
      return (
        <span className={isExpired ? "text-red-500" : "text-muted-foreground"}>
          {new Date(p.expiresAt).toLocaleDateString()}
        </span>
      );
    },
    exportValue: (p) => p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : "",
  },
];

export default function ProposalsList() {
  const { toast } = useToast();
  const { data: proposals, isLoading } = useListProposals({
    query: { refetchInterval: 30_000 } as any,
  });

  const [search, setSearch]         = useState("");
  const [status, setStatus]         = useState("all");
  const [engagement, setEngagement] = useState("all");
  const [expiry, setExpiry]         = useState("all");

  // ── New-view toast notification ───────────────────────────────────────────
  const prevViewsRef = useRef<Record<number, number>>({});
  useEffect(() => {
    if (!proposals) return;
    const prev = prevViewsRef.current;
    proposals.forEach(p => {
      const prevCount = prev[p.id];
      const current = p.totalViews ?? 0;
      if (prevCount !== undefined && current > prevCount) {
        toast({
          title: "Owner viewed a proposal",
          description: `Proposal ${p.referenceNumber} was just opened — great time to follow up.`,
          duration: 8000,
        });
      }
    });
    const next: Record<number, number> = {};
    proposals.forEach(p => { next[p.id] = p.totalViews ?? 0; });
    prevViewsRef.current = next;
  }, [proposals]);

  const now = Date.now();

  // ── SmartReport metrics ───────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const all = proposals ?? [];
    const nowMs = Date.now();
    const accepted = all.filter(p => p.status === "accepted").length;
    const active   = all.filter(p => {
      if (p.status === "expired") return false;
      if (p.expiresAt && new Date(p.expiresAt).getTime() < nowMs) return false;
      return true;
    }).length;
    const totalViews = all.reduce((sum, p) => sum + (p.totalViews ?? 0), 0);
    const hot = all.filter(p => {
      const last = p.lastViewedAt ? new Date(p.lastViewedAt).getTime() : null;
      return last && nowMs - last < 24 * 60 * 60 * 1000;
    }).length;
    return [
      { icon: <Send         className="h-4 w-4" />, label: "Total Proposals", value: all.length },
      { icon: <Clock        className="h-4 w-4" />, label: "Active",          value: active },
      { icon: <Eye          className="h-4 w-4" />, label: "Total Views",     value: totalViews },
      { icon: <CheckCircle  className="h-4 w-4" />, label: "Accepted",        value: accepted, color: accepted > 0 ? "green" as const : "default" as const },
      {                                              label: "Viewed Today",    value: hot, color: hot > 0 ? "amber" as const : "default" as const },
    ];
  }, [proposals]);

  // ── Status tabs ───────────────────────────────────────────────────────────
  const statusTabs = useMemo(() =>
    STATUSES.map(s => ({
      value: s.value,
      label: s.label,
      count: s.value === "all"
        ? (proposals?.length ?? 0)
        : (proposals?.filter(p => p.status === s.value).length ?? 0),
    }))
  , [proposals]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const filteredProposals = useMemo(() => proposals?.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      const haystack = [
        p.referenceNumber,
        (p as any).ownerName,
        (p as any).area,
        (p as any).community,
        (p as any).assignedToName,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (status !== "all" && p.status !== status) return false;
    if (engagement === "hot") {
      const lastViewed = p.lastViewedAt ? new Date(p.lastViewedAt).getTime() : null;
      if (!lastViewed || now - lastViewed > 24 * 60 * 60 * 1000) return false;
    }
    if (engagement === "unviewed" && (p.totalViews ?? 0) > 0) return false;
    if (engagement === "multiple" && (p.totalViews ?? 0) < 5) return false;
    if (expiry === "active" && p.expiresAt && new Date(p.expiresAt).getTime() < now) return false;
    if (expiry === "soon") {
      if (!p.expiresAt) return false;
      const diff = new Date(p.expiresAt).getTime() - now;
      if (diff < 0 || diff > 7 * 24 * 60 * 60 * 1000) return false;
    }
    if (expiry === "expired" && (!p.expiresAt || new Date(p.expiresAt).getTime() > now)) return false;
    return true;
  }), [proposals, search, status, engagement, expiry, now]);

  const activeFilterCount = useMemo(() => [
    engagement !== "all", expiry !== "all",
  ].filter(Boolean).length, [engagement, expiry]);

  function clearAll() {
    setSearch(""); setStatus("all"); setEngagement("all"); setExpiry("all");
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (engagement !== "all") activeChips.push({ label: ENGAGEMENT_OPTIONS.find(e => e.value === engagement)!.label, clear: () => setEngagement("all") });
  if (expiry !== "all") activeChips.push({ label: EXPIRY_OPTIONS.find(e => e.value === expiry)!.label, clear: () => setExpiry("all") });

  const hot24hCount = proposals?.filter(p => {
    const last = p.lastViewedAt ? new Date(p.lastViewedAt).getTime() : null;
    return last && now - last < 24 * 60 * 60 * 1000;
  }).length ?? 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Proposals</h1>
          <p className="text-muted-foreground mt-1 text-lg">Track client engagement and deal status.</p>
        </div>
      </div>

      {/* SmartReport */}
      <SmartReport metrics={metrics} />

      {/* Main card */}
      <Card className="border-border/50 shadow-sm">
        {/* Nav Tabs — status */}
        <PageTabs tabs={statusTabs} value={status} onChange={setStatus} />

        {/* Filter bar */}
        <div className="p-4 border-b border-border space-y-3 bg-muted/20">
          {/* Search + clear */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reference, owner, area, or rep..."
                className="pl-9 bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(activeFilterCount > 0 || search) && (
              <Button variant="ghost" size="sm" className="h-10 text-muted-foreground hover:text-foreground gap-1.5" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
          </div>

          {/* Engagement + Expiry chips */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Engagement:</span>
              {ENGAGEMENT_OPTIONS.map(e => (
                <Chip key={e.value} active={engagement === e.value} onClick={() => setEngagement(e.value)}>
                  {e.label}
                </Chip>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Expiry:</span>
              {EXPIRY_OPTIONS.map(e => (
                <Chip key={e.value} active={expiry === e.value} onClick={() => setExpiry(e.value)}>
                  {e.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {activeChips.map(({ label, clear }) => (
                <button
                  key={label}
                  onClick={clear}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {label} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Record count */}
        <div className="px-6 py-2.5 border-b border-border/50 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredProposals?.length ?? 0}</span> of{" "}
            <span className="font-semibold text-foreground">{proposals?.length ?? 0}</span> proposals
            {hot24hCount > 0 && (
              <span className="ml-3 text-blue-600 font-medium">
                🔥 {hot24hCount} viewed in last 24h
              </span>
            )}
          </p>
        </div>

        <CardContent className="p-0">
          <DataTable
            id="proposals"
            columns={PROPOSAL_COLUMNS}
            data={filteredProposals}
            isLoading={isLoading}
            rowKey={p => p.id}
            exportFileName="Proposals"
            emptyState={
              <div>
                <EyeOff className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-foreground">No proposals match your filters</p>
                <p className="text-sm mt-1">Try adjusting your status or engagement filters.</p>
                {(activeFilterCount > 0 || search) && (
                  <Button variant="link" className="mt-2 text-primary" onClick={clearAll}>Clear all filters</Button>
                )}
              </div>
            }
            actions={proposal => (
              <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/proposals/${proposal.id}`}>
                  <button
                    className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="Manage Proposal"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </Link>
                {proposal.shareUrl && (
                  <a href={proposal.shareUrl} target="_blank" rel="noreferrer">
                    <button
                      className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      title="View Public Link"
                    >
                      <Globe className="h-3.5 w-3.5" />
                    </button>
                  </a>
                )}
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
