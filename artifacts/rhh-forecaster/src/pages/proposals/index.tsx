import { useListProposals } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Search, MoreHorizontal, Globe, Bell, X, Eye, EyeOff, Clock, Building2, User } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

export default function ProposalsList() {
  const { toast } = useToast();
  const { data: proposals, isLoading } = useListProposals({
    query: { refetchInterval: 30_000 } as any,
  });

  const [search, setSearch]         = useState("");
  const [status, setStatus]         = useState("all");
  const [engagement, setEngagement] = useState("all");
  const [expiry, setExpiry]         = useState("all");

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
    status !== "all", engagement !== "all", expiry !== "all",
  ].filter(Boolean).length, [status, engagement, expiry]);

  function clearAll() {
    setSearch(""); setStatus("all"); setEngagement("all"); setExpiry("all");
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (status !== "all") activeChips.push({ label: STATUSES.find(s => s.value === status)!.label, clear: () => setStatus("all") });
  if (engagement !== "all") activeChips.push({ label: ENGAGEMENT_OPTIONS.find(e => e.value === engagement)!.label, clear: () => setEngagement("all") });
  if (expiry !== "all") activeChips.push({ label: EXPIRY_OPTIONS.find(e => e.value === expiry)!.label, clear: () => setExpiry("all") });

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'published': return 'bg-primary/20 text-primary border-primary/30';
      case 'viewed':    return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'accepted':  return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'declined':  return 'bg-red-500/20 text-red-700 border-red-500/30';
      case 'expired':   return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
      default:          return 'bg-secondary/20 text-secondary-foreground border-secondary/30';
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Proposals</h1>
          <p className="text-muted-foreground mt-1 text-lg">Track client engagement and deal status.</p>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <div className="p-4 border-b border-border space-y-3 bg-muted/20">
          {/* Search + clear */}
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search proposals by reference..."
                className="pl-9 bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(activeFilterCount > 0 || search) && (
              <Button variant="ghost" size="sm" className="h-10 text-muted-foreground hover:text-foreground gap-1.5" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear all
              </Button>
            )}
          </div>

          {/* Status chips */}
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map(s => (
              <Chip key={s.value} active={status === s.value} onClick={() => setStatus(s.value)}>
                {s.label}
              </Chip>
            ))}
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

        {/* Result count */}
        <div className="px-6 py-2.5 border-b border-border/50 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredProposals?.length ?? 0}</span> of{" "}
            <span className="font-semibold text-foreground">{proposals?.length ?? 0}</span> proposals
            {proposals && (proposals.filter(p => {
              const last = p.lastViewedAt ? new Date(p.lastViewedAt).getTime() : null;
              return last && now - last < 24 * 60 * 60 * 1000;
            }).length) > 0 && (
              <span className="ml-3 text-blue-600 font-medium">
                🔥 {proposals.filter(p => {
                  const last = p.lastViewedAt ? new Date(p.lastViewedAt).getTime() : null;
                  return last && now - last < 24 * 60 * 60 * 1000;
                }).length} viewed in last 24h
              </span>
            )}
          </p>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 font-medium">Owner</th>
                  <th className="px-6 py-4 font-medium">Property</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-center">Views</th>
                  <th className="px-6 py-4 font-medium">Last Viewed</th>
                  <th className="px-6 py-4 font-medium">Lead Owner</th>
                  <th className="px-6 py-4 font-medium">Expires</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Loading proposals...</td></tr>
                ) : filteredProposals?.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-muted-foreground">
                      <EyeOff className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="font-medium text-foreground">No proposals match your filters</p>
                      <p className="text-sm mt-1">Try adjusting your status or engagement filters.</p>
                      {(activeFilterCount > 0 || search) && (
                        <Button variant="link" className="mt-2 text-primary" onClick={clearAll}>Clear all filters</Button>
                      )}
                    </td>
                  </tr>
                ) : filteredProposals?.map((proposal) => {
                  const p = proposal as any;
                  const propLine = [
                    p.bedrooms != null ? `${p.bedrooms}BR` : null,
                    p.propertyType ? p.propertyType.replace(/_/g," ").replace(/\b\w/g,(c:string)=>c.toUpperCase()) : null,
                    p.area ?? p.community,
                  ].filter(Boolean).join(" · ");
                  return (
                  <tr key={proposal.id} className="hover:bg-muted/30 transition-colors group">
                    {/* Reference */}
                    <td className="px-6 py-4 font-medium text-foreground">
                      <Link href={`/proposals/${proposal.id}`} className="hover:text-primary transition-colors">
                        {proposal.referenceNumber}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-1 font-normal">
                        Generated {new Date(proposal.createdAt).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Owner */}
                    <td className="px-6 py-4">
                      {p.ownerName ? (
                        <div className="flex items-center gap-1.5">
                          {p.ownerType === "company"
                            ? <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            : <User       className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          }
                          {p.ownerId ? (
                            <Link href={`/owners/${p.ownerId}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate max-w-[140px]">
                              {p.ownerName}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium text-foreground truncate max-w-[140px]">{p.ownerName}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Property */}
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {propLine ? (
                        <span className="truncate block max-w-[160px]">{propLine}</span>
                      ) : (
                        <span className="text-xs">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`capitalize ${getStatusColor(proposal.status)}`}>
                        {proposal.status.replace('_', ' ')}
                      </Badge>
                      {proposal.ownerAction && (
                        <div className="text-xs text-muted-foreground mt-1.5 capitalize flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                          Action: {proposal.ownerAction.replace('_', ' ')}
                        </div>
                      )}
                    </td>

                    {/* Views */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-medium">{proposal.totalViews || 0}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{proposal.uniqueViews || 0} Unique</span>
                      </div>
                    </td>

                    {/* Last Viewed */}
                    <td className="px-6 py-4 text-muted-foreground">
                      {proposal.lastViewedAt ? (
                        <div className="flex flex-col gap-1">
                          <span>{new Date(proposal.lastViewedAt).toLocaleDateString()}</span>
                          {now - new Date(proposal.lastViewedAt).getTime() < NEW_VIEW_WINDOW_MS && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 w-fit bg-blue-500 hover:bg-blue-500 text-white gap-1">
                              <Bell className="h-2.5 w-2.5" /> New View
                            </Badge>
                          )}
                        </div>
                      ) : '—'}
                    </td>

                    {/* Lead Owner */}
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {p.assignedToName ?? <span className="text-xs">—</span>}
                    </td>

                    {/* Expires */}
                    <td className="px-6 py-4 text-muted-foreground">
                      {proposal.expiresAt ? (
                        <span className={new Date(proposal.expiresAt).getTime() < now ? "text-red-500" : ""}>
                          {new Date(proposal.expiresAt).toLocaleDateString()}
                        </span>
                      ) : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/proposals/${proposal.id}`}>Manage</Link>
                          </DropdownMenuItem>
                          {proposal.shareUrl && (
                            <DropdownMenuItem asChild>
                              <a href={proposal.shareUrl} target="_blank" rel="noreferrer">
                                <Globe className="mr-2 h-4 w-4" /> View Public Link
                              </a>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
