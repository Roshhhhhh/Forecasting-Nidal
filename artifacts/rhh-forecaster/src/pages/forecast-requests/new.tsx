import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useGetMe, useListOwners, useListUsers, useListReferees } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User, Building2, Users, Paperclip, FileText,
  ChevronDown, ChevronUp, Search, Upload, X, CheckCircle2,
  Send, Loader2, Image, Video
} from "lucide-react";

// ── types ──────────────────────────────────────────────────────────────────────
type OwnerMode = "existing" | "new";
type PropertyMode = "existing" | "new";

const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Fujairah", "Ras Al Khaimah", "Umm Al Quwain"];
const PROPERTY_TYPES = ["apartment", "villa", "townhouse", "penthouse", "studio", "duplex", "chalet"];
const FURNISHING = ["fully_furnished", "partially_furnished", "unfurnished", "shell_and_core"];
const CONDITIONS = ["excellent", "good", "fair", "needs_renovation", "under_construction", "off_plan"];

function formatLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── collapsible section ────────────────────────────────────────────────────────
function Section({
  icon: Icon, title, badge, children, defaultOpen = true,
}: {
  icon: React.FC<any>; title: string; badge?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="shadow-sm border-border/50">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
          {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <CardContent className="px-5 pb-5 pt-0">
          <Separator className="mb-4" />
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ── media file row ─────────────────────────────────────────────────────────────
function MediaItem({ name, type, progress, onRemove }: {
  name: string; type: string; progress: number | null; onRemove: () => void;
}) {
  const isVideo = type.startsWith("video");
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border/40">
      {isVideo
        ? <Video className="h-5 w-5 text-primary shrink-0" />
        : <Image className="h-5 w-5 text-primary shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{name}</p>
        {progress !== null && progress < 100 && (
          <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        )}
        {progress === 100 && <p className="text-xs text-green-600 mt-0.5">Uploaded</p>}
      </div>
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── main form ─────────────────────────────────────────────────────────────────
export default function NewForecastRequest() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const { data: owners = [] } = useListOwners();
  const { data: users = [] } = useListUsers();
  const { data: referees = [] } = useListReferees();

  // owner section
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("new");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [ownerForm, setOwnerForm] = useState({
    firstName: "", lastName: "", companyName: "", email: "", phone: "", whatsapp: "", nationality: "", type: "individual",
  });

  // property section
  const [propMode, setPropMode] = useState<PropertyMode>("new");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [propForm, setPropForm] = useState({
    emirate: "Abu Dhabi", area: "", community: "", development: "", unitNumber: "",
    type: "", bedrooms: "", bathrooms: "", internalArea: "", furnishing: "", condition: "", view: "",
    isWaterfront: false,
  });

  // rep / referee
  const [representativeId, setRepresentativeId] = useState<number | null>(null);
  const [refereeId, setRefereeId] = useState<number | null>(null);

  // notes
  const [notes, setNotes] = useState("");

  // media uploads
  const [mediaFiles, setMediaFiles] = useState<{
    name: string; type: string; progress: number | null; objectPath: string | null;
  }[]>([]);
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── filtered owner search ──────────────────────────────────────────────────
  const filteredOwners = owners.filter(o => {
    const q = ownerSearch.toLowerCase();
    if (!q) return true;
    const name = [o.firstName, o.lastName].filter(Boolean).join(" ").toLowerCase();
    return name.includes(q) || (o.email ?? "").toLowerCase().includes(q) || (o.phone ?? "").toLowerCase().includes(q);
  }).slice(0, 8);

  // ── file upload handler ────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";

    for (const file of files) {
      const idx = mediaFiles.length;
      setMediaFiles(prev => [...prev, { name: file.name, type: file.type, progress: 0, objectPath: null }]);

      try {
        setUploading(true);
        // Step 1: request presigned URL
        const meta = await fetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
        }).then(r => r.json());

        setMediaFiles(prev => prev.map((f, i) =>
          i === prev.findIndex(x => x.objectPath === null && x.name === file.name && x.progress === 0)
            ? { ...f, progress: 30 } : f
        ));

        // Step 2: upload directly to GCS
        await fetch(meta.uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });

        setMediaFiles(prev => prev.map((f, i) => {
          const target = prev.findIndex(x => x.name === file.name && x.objectPath === null);
          return i === target ? { ...f, progress: 100, objectPath: meta.objectPath } : f;
        }));
      } catch {
        setMediaFiles(prev => prev.filter(f => f.name !== file.name));
        toast({ title: "Upload failed", description: `Could not upload ${file.name}`, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    }
  }, [mediaFiles, toast]);

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: Record<string, any> = {
        representativeId,
        refereeId,
        notes: notes || null,
        mediaUrls: mediaFiles.filter(f => f.objectPath).map(f => f.objectPath!),
      };

      if (ownerMode === "existing") {
        payload.ownerId = selectedOwnerId;
      } else {
        payload.ownerFirstName = ownerForm.firstName || null;
        payload.ownerLastName = ownerForm.lastName || null;
        payload.ownerCompanyName = ownerForm.companyName || null;
        payload.ownerEmail = ownerForm.email || null;
        payload.ownerPhone = ownerForm.phone || null;
        payload.ownerWhatsapp = ownerForm.whatsapp || null;
        payload.ownerNationality = ownerForm.nationality || null;
        payload.ownerType = ownerForm.type;
      }

      if (propMode === "existing") {
        payload.propertyId = selectedPropertyId;
      } else {
        payload.propertyEmirate = propForm.emirate || null;
        payload.propertyArea = propForm.area || null;
        payload.propertyCommunity = propForm.community || null;
        payload.propertyDevelopment = propForm.development || null;
        payload.propertyUnitNumber = propForm.unitNumber || null;
        payload.propertyType = propForm.type || null;
        payload.propertyBedrooms = propForm.bedrooms ? parseInt(propForm.bedrooms) : null;
        payload.propertyBathrooms = propForm.bathrooms ? parseFloat(propForm.bathrooms) : null;
        payload.propertyInternalArea = propForm.internalArea ? parseFloat(propForm.internalArea) : null;
        payload.propertyFurnishing = propForm.furnishing || null;
        payload.propertyCondition = propForm.condition || null;
        payload.propertyView = propForm.view || null;
        payload.propertyIsWaterfront = propForm.isWaterfront;
      }

      const res = await fetch("/api/forecast-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Submission failed");

      setSubmitted(true);
      toast({ title: "Request submitted!", description: "The revenue manager has been notified." });
    } catch {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-1">Request Submitted</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            The revenue manager has been alerted and will review this request shortly.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/forecast-requests")}>View All Requests</Button>
          <Button onClick={() => { setSubmitted(false); }}>Submit Another</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-28">
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-xl font-bold tracking-tight">New Forecast Request</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submit owner and property details so the revenue manager can prepare a forecast.
        </p>
      </div>

      {/* ── OWNER SECTION ── */}
      <Section icon={User} title="Owner Details">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setOwnerMode("existing")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
              ownerMode === "existing"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            Existing Owner
          </button>
          <button
            type="button"
            onClick={() => setOwnerMode("new")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
              ownerMode === "new"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            New Owner
          </button>
        </div>

        {ownerMode === "existing" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or phone…"
                value={ownerSearch}
                onChange={e => setOwnerSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {filteredOwners.map(o => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { setSelectedOwnerId(o.id); setOwnerSearch(""); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                    selectedOwnerId === o.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-primary">
                      {(o.firstName?.[0] ?? o.lastName?.[0] ?? "?").toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{[o.firstName, o.lastName].filter(Boolean).join(" ") || o.companyName || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{o.email ?? o.phone ?? ""}</p>
                  </div>
                  {selectedOwnerId === o.id && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                </button>
              ))}
              {filteredOwners.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-4 text-center">No owners found</p>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={ownerForm.type} onValueChange={v => setOwnerForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nationality</Label>
              <Input placeholder="e.g. Emirati" value={ownerForm.nationality}
                onChange={e => setOwnerForm(f => ({ ...f, nationality: e.target.value }))} className="h-9" />
            </div>
            {ownerForm.type === "company" && (
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Company Name</Label>
                <Input placeholder="e.g. Al Mansouri Holdings LLC" value={ownerForm.companyName}
                  onChange={e => setOwnerForm(f => ({ ...f, companyName: e.target.value }))} className="h-9" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">First Name</Label>
              <Input placeholder="First name" value={ownerForm.firstName}
                onChange={e => setOwnerForm(f => ({ ...f, firstName: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Last Name</Label>
              <Input placeholder="Last name" value={ownerForm.lastName}
                onChange={e => setOwnerForm(f => ({ ...f, lastName: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" placeholder="owner@example.com" value={ownerForm.email}
                onChange={e => setOwnerForm(f => ({ ...f, email: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone</Label>
              <Input placeholder="+971 50 000 0000" value={ownerForm.phone}
                onChange={e => setOwnerForm(f => ({ ...f, phone: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">WhatsApp</Label>
              <Input placeholder="+971 50 000 0000 (if different)" value={ownerForm.whatsapp}
                onChange={e => setOwnerForm(f => ({ ...f, whatsapp: e.target.value }))} className="h-9" />
            </div>
          </div>
        )}
      </Section>

      {/* ── PROPERTY SECTION ── */}
      <Section icon={Building2} title="Property Details">
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setPropMode("existing")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
              propMode === "existing" ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
            }`}>
            Existing Property
          </button>
          <button type="button" onClick={() => setPropMode("new")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
              propMode === "new" ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
            }`}>
            New Property
          </button>
        </div>

        {propMode === "existing" ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Select a property ID or leave blank and describe below.</p>
            <Input
              type="number"
              placeholder="Property ID (optional)"
              className="mt-3 max-w-xs mx-auto h-9 text-center"
              onChange={e => setSelectedPropertyId(e.target.value ? parseInt(e.target.value) : null)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Emirate</Label>
              <Select value={propForm.emirate} onValueChange={v => setPropForm(f => ({ ...f, emirate: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Area</Label>
              <Input placeholder="e.g. Al Reem Island" value={propForm.area}
                onChange={e => setPropForm(f => ({ ...f, area: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Community / Project</Label>
              <Input placeholder="Community name" value={propForm.community}
                onChange={e => setPropForm(f => ({ ...f, community: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Development / Building</Label>
              <Input placeholder="Building or development" value={propForm.development}
                onChange={e => setPropForm(f => ({ ...f, development: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit Number</Label>
              <Input placeholder="e.g. 402" value={propForm.unitNumber}
                onChange={e => setPropForm(f => ({ ...f, unitNumber: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Property Type</Label>
              <Select value={propForm.type} onValueChange={v => setPropForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bedrooms</Label>
              <Input type="number" min="0" max="20" placeholder="0" value={propForm.bedrooms}
                onChange={e => setPropForm(f => ({ ...f, bedrooms: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bathrooms</Label>
              <Input type="number" min="0" max="20" step="0.5" placeholder="0" value={propForm.bathrooms}
                onChange={e => setPropForm(f => ({ ...f, bathrooms: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Internal Area (sqft)</Label>
              <Input type="number" min="0" placeholder="0" value={propForm.internalArea}
                onChange={e => setPropForm(f => ({ ...f, internalArea: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">View</Label>
              <Input placeholder="e.g. Sea view" value={propForm.view}
                onChange={e => setPropForm(f => ({ ...f, view: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Furnishing</Label>
              <Select value={propForm.furnishing} onValueChange={v => setPropForm(f => ({ ...f, furnishing: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{FURNISHING.map(t => <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Condition</Label>
              <Select value={propForm.condition} onValueChange={v => setPropForm(f => ({ ...f, condition: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{CONDITIONS.map(t => <SelectItem key={t} value={t}>{formatLabel(t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3 py-1">
              <input
                id="waterfront"
                type="checkbox"
                checked={propForm.isWaterfront}
                onChange={e => setPropForm(f => ({ ...f, isWaterfront: e.target.checked }))}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="waterfront" className="text-sm cursor-pointer">Waterfront / beachfront property</Label>
            </div>
          </div>
        )}
      </Section>

      {/* ── REPRESENTATIVE & REFEREE ── */}
      <Section icon={Users} title="Representative & Referee" defaultOpen={true}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Assigned Representative</Label>
            <Select
              value={representativeId?.toString() ?? ""}
              onValueChange={v => setRepresentativeId(v ? parseInt(v) : null)}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id.toString()}>
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Referee (optional)</Label>
            <Select
              value={refereeId?.toString() ?? "none"}
              onValueChange={v => setRefereeId(v && v !== "none" ? parseInt(v) : null)}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {referees.map(r => (
                  <SelectItem key={r.id} value={r.id.toString()}>
                    {[r.firstName, r.lastName].filter(Boolean).join(" ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      {/* ── MEDIA UPLOADS ── */}
      <Section icon={Paperclip} title="Photos & Videos" defaultOpen={true}>
        <div className="space-y-3">
          <label
            htmlFor="media-upload"
            className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground text-center">
              Tap to attach photos or videos<br />
              <span className="text-xs opacity-70">JPG, PNG, HEIC, MP4, MOV • Max 50MB each</span>
            </span>
            <input
              id="media-upload"
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>

          {mediaFiles.length > 0 && (
            <div className="space-y-2">
              {mediaFiles.map((f, i) => (
                <MediaItem
                  key={i}
                  name={f.name}
                  type={f.type}
                  progress={f.progress}
                  onRemove={() => setMediaFiles(prev => prev.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── NOTES ── */}
      <Section icon={FileText} title="Additional Notes" defaultOpen={false}>
        <Textarea
          placeholder="Any special context, urgency notes, or instructions for the revenue manager…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          className="resize-none"
        />
      </Section>

      {/* ── STICKY SUBMIT ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-3 sm:static sm:bg-transparent sm:backdrop-blur-none sm:border-none sm:px-0 sm:py-0">
        <Button
          type="submit"
          disabled={submitting || uploading}
          className="w-full h-12 text-base font-semibold gap-2 shadow-lg"
        >
          {submitting
            ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting…</>
            : uploading
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Uploading files…</>
              : <><Send className="h-5 w-5" /> Submit Forecast Request</>}
        </Button>
      </div>
    </form>
  );
}
