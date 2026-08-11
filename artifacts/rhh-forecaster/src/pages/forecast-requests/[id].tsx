import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useListOwners, useListProperties, useListUsers } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  User, Building2, DollarSign, FileText, Paperclip, ArrowLeft,
  CheckCircle2, Circle, Clock, Eye, XCircle, UserCheck,
  Link2, UserPlus, PlusCircle, ExternalLink, ChevronDown, ChevronUp,
  Search, Percent, MapPin, Loader2,
} from "lucide-react";

// ── helpers ────────────────────────────────────────────────────────────────────
function frRef(id: number) {
  return `FR-${new Date().getFullYear()}-${String(id).padStart(4, "0")}`;
}

function ownerLabel(fr: any) {
  const parts = [fr.ownerTitle, fr.ownerFirstName, fr.ownerLastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (fr.ownerCompanyName) return fr.ownerCompanyName;
  if (fr.ownerContactPerson) return fr.ownerContactPerson;
  return null;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

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
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${meta.color}`}>
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function DataRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground w-32 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground flex-1">{value}</span>
    </div>
  );
}

function Section({ icon: Icon, title, children, defaultOpen = true }: {
  icon: React.FC<any>; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border/50 shadow-sm">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/10 transition-colors text-left">
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <CardContent className="px-5 pb-5 pt-0 border-t border-border/30">{children}</CardContent>}
    </Card>
  );
}

// ── main ───────────────────────────────────────────────────────────────────────
export default function ForecastRequestDetail() {
  const { id: idStr } = useParams<{ id: string }>();
  const id = parseInt(idStr, 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: fr, isLoading, isError } = useQuery({
    queryKey: ["forecast-request", id],
    queryFn: () => fetch(`/api/forecast-requests/${id}`).then(r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
  });

  const { data: owners = [] } = useListOwners();
  const { data: properties = [] } = useListProperties();
  const { data: users = [] } = useListUsers();

  // ── dialogs ──
  const [linkOwnerOpen, setLinkOwnerOpen] = useState(false);
  const [linkPropertyOpen, setLinkPropertyOpen] = useState(false);
  const [assignRmOpen, setAssignRmOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const [propSearch, setPropSearch] = useState("");

  // ── mutations ──
  const apiPatch = (path: string, body: object) =>
    fetch(`/api/forecast-requests/${id}/${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => { if (!r.ok) throw new Error(); return r.json(); });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["forecast-request", id] });
    qc.invalidateQueries({ queryKey: ["forecast-requests"] });
  };

  const { mutate: linkOwner, isPending: linkingOwner } = useMutation({
    mutationFn: (ownerId: number) => apiPatch("link-owner", { ownerId }),
    onSuccess: () => { invalidate(); setLinkOwnerOpen(false); toast({ title: "Owner linked" }); },
    onError: () => toast({ title: "Failed to link owner", variant: "destructive" }),
  });

  const { mutate: linkProperty, isPending: linkingProperty } = useMutation({
    mutationFn: (propertyId: number) => apiPatch("link-property", { propertyId }),
    onSuccess: () => { invalidate(); setLinkPropertyOpen(false); toast({ title: "Property linked" }); },
    onError: () => toast({ title: "Failed to link property", variant: "destructive" }),
  });

  const { mutate: assignRm, isPending: assigningRm } = useMutation({
    mutationFn: (userId: number) => apiPatch("assign-rm", { userId }),
    onSuccess: () => { invalidate(); setAssignRmOpen(false); toast({ title: "Revenue Manager assigned" }); },
    onError: () => toast({ title: "Failed to assign", variant: "destructive" }),
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: (status: string) =>
      fetch(`/api/forecast-requests/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then(r => r.json()),
    onSuccess: () => invalidate(),
  });

  if (isLoading) return (
    <div className="max-w-3xl mx-auto px-4 py-10 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (isError || !fr) return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-center">
      <p className="text-muted-foreground">Request not found.</p>
      <Link href="/forecast-requests"><Button variant="outline" className="mt-4">Back to list</Button></Link>
    </div>
  );

  const ref = frRef(fr.id);
  const ownerName = ownerLabel(fr);
  const ownerLinked = !!fr.ownerId;
  const propertyLinked = !!fr.propertyId;
  const forecastLinked = !!fr.convertedForecastId;
  const canCreateForecast = ownerLinked && propertyLinked && !forecastLinked;

  // find linked records
  const linkedOwner = (owners as any[]).find((o: any) => o.id === fr.ownerId);
  const linkedProperty = (properties as any[]).find((p: any) => p.id === fr.propertyId);

  // filtered lists
  const filteredOwners = (owners as any[]).filter((o: any) => {
    const q = ownerSearch.toLowerCase();
    if (!q) return true;
    const name = [o.firstName, o.lastName].filter(Boolean).join(" ").toLowerCase();
    return name.includes(q) || (o.companyName ?? "").toLowerCase().includes(q)
      || (o.email ?? "").toLowerCase().includes(q) || (o.phone ?? "").toLowerCase().includes(q);
  }).slice(0, 8);

  const filteredProps = (properties as any[]).filter((p: any) => {
    const q = propSearch.toLowerCase();
    if (!q) return true;
    return [p.projectBuilding, p.area, p.unitNumber, p.emirate].filter(Boolean).join(" ").toLowerCase().includes(q);
  }).slice(0, 8);

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-4 pb-24">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/forecast-requests" className="hover:text-foreground flex items-center gap-1 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Forecast Requests
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground font-semibold">{ref}</span>
      </div>

      {/* ── Header card ── */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <h1 className="text-xl font-bold font-mono">{ref}</h1>
                <StatusBadge status={fr.status} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5">
                {fr.createdByName && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <User className="h-3 w-3" /> Submitted by {fr.createdByName}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" /> {formatDate(fr.createdAt)}
                </div>
                {fr.assignedRevenueManagerName && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserCheck className="h-3 w-3" /> RM: {fr.assignedRevenueManagerName}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={fr.status} onValueChange={updateStatus}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setAssignRmOpen(true)}>
                <UserCheck className="h-3.5 w-3.5" />
                {fr.assignedRevenueManagerId ? "Reassign RM" : "Assign to Me"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Conversion progress ── */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="px-5 py-4 pb-0">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Conversion Progress</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-3 space-y-3">
          {/* Owner step */}
          <div className="flex items-start gap-3">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ownerLinked ? "bg-green-100" : "bg-muted"}`}>
              {ownerLinked ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium">1. Owner</p>
                  {ownerLinked && linkedOwner ? (
                    <p className="text-xs text-green-600 font-medium">
                      {linkedOwner.ownerType === "company" ? linkedOwner.companyName : [linkedOwner.firstName, linkedOwner.lastName].filter(Boolean).join(" ")}
                      <Link href={`/owners/${linkedOwner.id}`} className="ml-2 text-primary hover:underline inline-flex items-center gap-0.5">
                        <ExternalLink className="h-2.5 w-2.5" /> View
                      </Link>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not yet linked</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setLinkOwnerOpen(true)}>
                    <Link2 className="h-3 w-3" /> Link Existing
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => navigate(`/owners/new?forecastRequestId=${fr.id}`)}>
                    <UserPlus className="h-3 w-3" /> Create
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Property step */}
          <div className="flex items-start gap-3">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${propertyLinked ? "bg-green-100" : "bg-muted"}`}>
              {propertyLinked ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium">2. Property</p>
                  {propertyLinked && linkedProperty ? (
                    <p className="text-xs text-green-600 font-medium">
                      {[linkedProperty.projectBuilding, linkedProperty.unitNumber && `Unit ${linkedProperty.unitNumber}`].filter(Boolean).join(" · ") || `Property #${linkedProperty.id}`}
                      <Link href={`/properties/${linkedProperty.id}`} className="ml-2 text-primary hover:underline inline-flex items-center gap-0.5">
                        <ExternalLink className="h-2.5 w-2.5" /> View
                      </Link>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not yet linked</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setLinkPropertyOpen(true)}>
                    <Link2 className="h-3 w-3" /> Link Existing
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => navigate(`/properties/new?forecastRequestId=${fr.id}${fr.ownerId ? `&ownerId=${fr.ownerId}` : ""}`)}>
                    <PlusCircle className="h-3 w-3" /> Create
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast step */}
          <div className="flex items-start gap-3">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${forecastLinked ? "bg-green-100" : "bg-muted"}`}>
              {forecastLinked ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <p className="text-sm font-medium">3. Revenue Forecast</p>
                  {forecastLinked ? (
                    <p className="text-xs text-green-600 font-medium">
                      Created
                      <Link href={`/forecasts/${fr.convertedForecastId}`} className="ml-2 text-primary hover:underline inline-flex items-center gap-0.5">
                        <ExternalLink className="h-2.5 w-2.5" /> View Forecast
                      </Link>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {canCreateForecast ? "Ready to create" : "Link owner and property first"}
                    </p>
                  )}
                </div>
                {!forecastLinked && (
                  <Button size="sm" disabled={!canCreateForecast} className="h-7 text-xs gap-1"
                    onClick={() => navigate(`/forecasts/new?forecastRequestId=${fr.id}&ownerId=${fr.ownerId}&propertyId=${fr.propertyId}`)}>
                    <PlusCircle className="h-3 w-3" /> Create Forecast
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Submitted data sections ── */}
      <Section icon={User} title="Owner Information">
        <div className="mt-3 space-y-0">
          <DataRow label="Type" value={fr.ownerType === "company" ? "Company" : "Individual"} />
          <DataRow label="Name" value={ownerName} />
          <DataRow label="Company" value={fr.ownerCompanyName} />
          <DataRow label="Contact Person" value={fr.ownerContactPerson} />
          <DataRow label="Position" value={fr.ownerContactPosition} />
          <DataRow label="Email" value={fr.ownerEmail} />
          <DataRow label="Mobile" value={fr.ownerPhone} />
          <DataRow label="WhatsApp" value={fr.ownerWhatsapp} />
          <DataRow label="Nationality" value={fr.ownerNationality} />
        </div>
      </Section>

      <Section icon={Building2} title="Property Information">
        <div className="mt-3 space-y-0">
          <DataRow label="Emirate" value={fr.propertyEmirate} />
          <DataRow label="Area" value={fr.propertyArea} />
          <DataRow label="Community" value={fr.propertyCommunity} />
          <DataRow label="Building" value={fr.propertyDevelopment} />
          <DataRow label="Unit Number" value={fr.propertyUnitNumber} />
          <DataRow label="Type" value={fr.propertyType} />
          <DataRow label="Layout" value={fr.propertyLayout} />
          <DataRow label="Bathrooms" value={fr.propertyBathrooms != null ? String(fr.propertyBathrooms) : null} />
          <DataRow label="Size" value={fr.propertyInternalArea ? `${fr.propertyInternalArea} Sq Ft` : null} />
          <DataRow label="View" value={fr.propertyView} />
          <DataRow label="Furnishing" value={fr.propertyFurnishing} />
          <DataRow label="Condition" value={fr.propertyCondition} />
          <DataRow label="Waterfront" value={fr.propertyIsWaterfront ? "Yes" : null} />
        </div>
      </Section>

      <Section icon={DollarSign} title="Commercial & Referral">
        <div className="mt-3 space-y-0">
          <DataRow label="Management PMC" value={fr.proposedManagementCommission} />
          <DataRow label="Referee" value={fr.refereeName} />
        </div>
      </Section>

      {(fr.mediaUrls?.length > 0) && (
        <Section icon={Paperclip} title={`Media (${fr.mediaUrls.length} file${fr.mediaUrls.length !== 1 ? "s" : ""})`} defaultOpen={false}>
          <div className="mt-3 space-y-1.5">
            {fr.mediaUrls.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline py-1.5 border-b border-border/30 last:border-0">
                <Paperclip className="h-3 w-3 shrink-0" />
                <span className="truncate">{url.split("/").pop() || `File ${i + 1}`}</span>
                <ExternalLink className="h-3 w-3 ml-auto shrink-0" />
              </a>
            ))}
          </div>
        </Section>
      )}

      {fr.notes && (
        <Section icon={FileText} title="Notes" defaultOpen={false}>
          <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{fr.notes}</p>
        </Section>
      )}

      {/* ── Sticky bottom CTA ── */}
      {canCreateForecast && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border px-4 py-3">
          <Button className="w-full h-11 gap-2"
            onClick={() => navigate(`/forecasts/new?forecastRequestId=${fr.id}&ownerId=${fr.ownerId}&propertyId=${fr.propertyId}`)}>
            <PlusCircle className="h-4 w-4" /> Create Revenue Forecast
          </Button>
        </div>
      )}

      {/* ── Link Owner Dialog ── */}
      <Dialog open={linkOwnerOpen} onOpenChange={setLinkOwnerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Existing Owner</DialogTitle>
            <p className="text-sm text-muted-foreground">Search and select a matching owner record.</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search by name, company, email or mobile…"
                value={ownerSearch} onChange={e => setOwnerSearch(e.target.value)} className="pl-9 h-9" autoFocus />
            </div>
            {/* Suggested match banner */}
            {ownerName && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs font-medium text-amber-700 mb-1">Submitted owner name</p>
                <p className="text-sm font-semibold text-amber-900">{ownerName}</p>
              </div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredOwners.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No owners found. Try a different search.</p>
              )}
              {filteredOwners.map((o: any) => {
                const name = o.ownerType === "company" ? o.companyName : [o.firstName, o.lastName].filter(Boolean).join(" ");
                return (
                  <div key={o.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 border border-transparent">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {(name?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.email ?? o.phone ?? ""}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs"
                      disabled={linkingOwner}
                      onClick={() => linkOwner(o.id)}>
                      {linkingOwner ? <Loader2 className="h-3 w-3 animate-spin" /> : "Link"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkOwnerOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => { setLinkOwnerOpen(false); navigate(`/owners/new?forecastRequestId=${fr.id}`); }}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Create New Owner Instead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link Property Dialog ── */}
      <Dialog open={linkPropertyOpen} onOpenChange={setLinkPropertyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Existing Property</DialogTitle>
            <p className="text-sm text-muted-foreground">Search and select a matching property record.</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search by building, unit, area…"
                value={propSearch} onChange={e => setPropSearch(e.target.value)} className="pl-9 h-9" autoFocus />
            </div>
            {(fr.propertyArea || fr.propertyCommunity) && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                <p className="text-xs font-medium text-amber-700 mb-1">Submitted property details</p>
                <p className="text-sm font-semibold text-amber-900">
                  {[fr.propertyCommunity, fr.propertyArea, fr.propertyEmirate].filter(Boolean).join(", ")}
                </p>
                {fr.propertyLayout && <p className="text-xs text-amber-700">{fr.propertyLayout} {fr.propertyType}</p>}
              </div>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredProps.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No properties found.</p>
              )}
              {filteredProps.map((p: any) => {
                const label = [p.projectBuilding, p.unitNumber && `Unit ${p.unitNumber}`].filter(Boolean).join(" · ");
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 border border-transparent">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{label || `Property #${p.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">{[p.area, p.emirate].filter(Boolean).join(", ")}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs"
                      disabled={linkingProperty}
                      onClick={() => linkProperty(p.id)}>
                      {linkingProperty ? <Loader2 className="h-3 w-3 animate-spin" /> : "Link"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkPropertyOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={() => { setLinkPropertyOpen(false); navigate(`/properties/new?forecastRequestId=${fr.id}${fr.ownerId ? `&ownerId=${fr.ownerId}` : ""}`); }}>
              <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Create New Property Instead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign RM Dialog ── */}
      <Dialog open={assignRmOpen} onOpenChange={setAssignRmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Revenue Manager</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(users as any[]).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                  {(u.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Button size="sm" variant={fr.assignedRevenueManagerId === u.id ? "default" : "outline"}
                  className="shrink-0 h-7 text-xs" disabled={assigningRm}
                  onClick={() => assignRm(u.id)}>
                  {fr.assignedRevenueManagerId === u.id ? "Assigned" : "Assign"}
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignRmOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
