import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Plus, Clock, Eye, CheckCircle2, XCircle,
  Building2, User, Percent, UserCheck, Paperclip, Circle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function LinkIndicator({ linked, label }: { linked: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1 text-[11px] font-medium ${linked ? "text-green-600" : "text-muted-foreground/60"}`}>
      {linked
        ? <CheckCircle2 className="h-3 w-3" />
        : <Circle className="h-3 w-3" />}
      {label}
    </div>
  );
}

// ── status meta ────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  pending:   { label: "Pending Review", color: "bg-amber-100 text-amber-700 border-amber-200",  icon: Clock },
  in_review: { label: "In Review",      color: "bg-blue-100 text-blue-700 border-blue-200",     icon: Eye },
  converted: { label: "Converted",      color: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle2 },
  declined:  { label: "Declined",       color: "bg-red-100 text-red-700 border-red-200",        icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "bg-muted text-muted-foreground border-border", icon: Clock };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

// ── date helpers ───────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Date unavailable";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date unavailable";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "Date unavailable";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Date unavailable";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return formatDate(dateStr);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

// ── owner display name ─────────────────────────────────────────────────────────
function ownerDisplayName(req: any): string {
  if (req.ownerId) return `Owner #${req.ownerId}`;
  if (req.ownerType === "company" && req.ownerCompanyName) return req.ownerCompanyName;
  const parts = [req.ownerTitle, req.ownerFirstName, req.ownerLastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (req.ownerContactPerson) return req.ownerContactPerson;
  return null!;
}

// ── property summary ───────────────────────────────────────────────────────────
function propertySummary(req: any): { primary: string; secondary: string } {
  if (req.propertyId) return { primary: `Property #${req.propertyId}`, secondary: "" };

  const layout = req.propertyLayout || "";
  const type = req.propertyType || "";
  const unitParts = [req.propertyCommunity || req.propertyDevelopment, req.propertyUnitNumber && `Unit ${req.propertyUnitNumber}`].filter(Boolean);
  const primary = [unitParts.join(" "), layout && type ? `${layout} ${type}` : layout || type].filter(Boolean).join(" · ");
  const secondary = [req.propertyArea, req.propertyEmirate].filter(Boolean).join(", ");
  return { primary: primary || "Property details provided", secondary };
}

// ── list ───────────────────────────────────────────────────────────────────────
export default function ForecastRequestsList() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["forecast-requests"],
    queryFn: () => fetch("/api/forecast-requests").then(r => r.json()).then(d => Array.isArray(d) ? d : []),
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/forecast-requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["forecast-requests"] });
      toast({ title: "Status updated" });
    },
  });

  const filtered = filter === "all" ? requests : requests.filter((r: any) => r.status === filter);
  const pendingCount = requests.filter((r: any) => r.status === "pending").length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Forecast Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pendingCount > 0 ? `${pendingCount} pending review` : "No pending requests"}
          </p>
        </div>
        <Link href="/forecast-requests/new">
          <Button className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> New Request
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "pending", "in_review", "converted", "declined"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            {s === "all" ? "All" : STATUS_META[s]?.label ?? s}
            {s !== "all" && (
              <span className="ml-1.5 opacity-70">
                {requests.filter((r: any) => r.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-border/50">
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">No requests found</p>
            <Link href="/forecast-requests/new">
              <Button variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> Submit First Request
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req: any) => {
            const owner = ownerDisplayName(req);
            const prop = propertySummary(req);
            const isReducedPmc = req.proposedManagementCommission && req.proposedManagementCommission !== "20%";

            return (
              <Link key={req.id} href={`/forecast-requests/${req.id}`}>
              <Card className="shadow-sm border-border/50 hover:border-primary/20 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Top row: status + time */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={req.status} />
                        <span className="text-xs text-muted-foreground">{timeAgo(req.createdAt)}</span>
                        {req.mediaUrls?.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" /> {req.mediaUrls.length}
                          </span>
                        )}
                      </div>

                      {/* Owner */}
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{owner || <span className="italic text-muted-foreground">Owner not specified</span>}</span>
                      </div>

                      {/* Property */}
                      {prop.primary && (
                        <div className="flex items-start gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{prop.primary}</p>
                            {prop.secondary && <p className="text-xs text-muted-foreground truncate">{prop.secondary}</p>}
                          </div>
                        </div>
                      )}

                      {/* PMC + Referee row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {req.proposedManagementCommission && (
                          <div className="flex items-center gap-1">
                            <Percent className="h-3 w-3 text-muted-foreground" />
                            <span className={`text-xs font-medium ${isReducedPmc ? "text-amber-600" : "text-muted-foreground"}`}>
                              PMC {req.proposedManagementCommission}
                            </span>
                          </div>
                        )}
                        {req.refereeName && (
                          <div className="flex items-center gap-1">
                            <UserCheck className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">via {req.refereeName}</span>
                          </div>
                        )}
                      </div>

                      {/* Notes preview */}
                      {req.notes && (
                        <p className="text-xs text-muted-foreground line-clamp-1 italic">"{req.notes}"</p>
                      )}

                      {/* Link indicators */}
                      <div className="flex items-center gap-3 pt-0.5">
                        <LinkIndicator linked={!!req.ownerId} label="Owner" />
                        <LinkIndicator linked={!!req.propertyId} label="Property" />
                        <LinkIndicator linked={!!req.convertedForecastId} label="Forecast" />
                      </div>
                    </div>

                    {/* Status selector — stop propagation so click doesn't open detail */}
                    <div className="shrink-0" onClick={e => e.preventDefault()}>
                      <Select value={req.status} onValueChange={status => updateStatus({ id: req.id, status })}>
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
