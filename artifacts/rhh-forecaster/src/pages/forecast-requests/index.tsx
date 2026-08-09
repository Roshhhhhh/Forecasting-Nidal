import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Plus, Clock, Eye, CheckCircle2, XCircle,
  RefreshCw, Building2, User, Users, Paperclip, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_META: Record<string, { label: string; color: string; icon: React.FC<any> }> = {
  pending:    { label: "Pending",    color: "bg-amber-100 text-amber-700 border-amber-200",   icon: Clock },
  in_review:  { label: "In Review",  color: "bg-blue-100 text-blue-700 border-blue-200",      icon: Eye },
  converted:  { label: "Converted",  color: "bg-green-100 text-green-700 border-green-200",   icon: CheckCircle2 },
  declined:   { label: "Declined",   color: "bg-red-100 text-red-700 border-red-200",         icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, color: "bg-muted text-muted-foreground", icon: Clock };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Forecast Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {requests.filter((r: any) => r.status === "pending").length} pending review
          </p>
        </div>
        <Link href="/forecast-requests/new">
          <Button className="gap-2 shrink-0">
            <Plus className="h-4 w-4" /> New Request
          </Button>
        </Link>
      </div>

      {/* Filter */}
      <div className="flex gap-2 items-center flex-wrap">
        {["all", "pending", "in_review", "converted", "declined"].map(s => (
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
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
          ))}
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
            const ownerName = req.ownerId
              ? `Owner #${req.ownerId}`
              : [req.ownerFirstName, req.ownerLastName].filter(Boolean).join(" ") || "Unknown Owner";
            const propSummary = req.propertyId
              ? `Property #${req.propertyId}`
              : [req.propertyType, req.propertyArea, req.propertyEmirate].filter(Boolean).join(" · ") || "Property details provided";

            return (
              <Card key={req.id} className="shadow-sm border-border/50 hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {/* Top row */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <StatusBadge status={req.status} />
                        <span className="text-xs text-muted-foreground">{timeAgo(req.createdAt)}</span>
                        {req.mediaUrls?.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Paperclip className="h-3 w-3" /> {req.mediaUrls.length}
                          </span>
                        )}
                      </div>
                      {/* Owner */}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{ownerName}</span>
                      </div>
                      {/* Property */}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">{propSummary}</span>
                      </div>
                      {/* Rep */}
                      {req.representativeName && (
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground truncate">{req.representativeName}</span>
                        </div>
                      )}
                      {/* Notes */}
                      {req.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 italic">
                          "{req.notes}"
                        </p>
                      )}
                    </div>

                    {/* Status selector */}
                    <div className="shrink-0">
                      <Select
                        value={req.status}
                        onValueChange={status => updateStatus({ id: req.id, status })}
                      >
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
            );
          })}
        </div>
      )}
    </div>
  );
}
