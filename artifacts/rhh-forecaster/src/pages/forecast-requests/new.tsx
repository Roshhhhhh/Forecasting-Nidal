import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMe, useListOwners, useListUsers, useListReferees, useListRoles,
  useCreateReferee, useCreateUser,
  getListRefereesQueryKey, getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  User, Building2, Users, Paperclip, FileText,
  ChevronDown, ChevronUp, Search, Upload, X, CheckCircle2,
  Send, Loader2, Image, Video, UserPlus, Plus, RefreshCw, Home,
} from "lucide-react";

// ── constants ──────────────────────────────────────────────────────────────────
type OwnerMode = "existing" | "new";
type PropertyMode = "existing" | "new";

const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Fujairah", "Ras Al Khaimah", "Umm Al Quwain"];
const PROPERTY_TYPES = ["apartment", "villa", "townhouse", "penthouse", "studio", "duplex", "chalet"];
const FURNISHING = ["fully_furnished", "partially_furnished", "unfurnished", "shell_and_core"];
const CONDITIONS = ["excellent", "good", "fair", "needs_renovation", "under_construction", "off_plan"];
const FEE_FIELDS = [
  { label: "Studio",      field: "referralFeeStudio"   },
  { label: "1 Bedroom",   field: "referralFee1br"      },
  { label: "2 Bedrooms",  field: "referralFee2br"      },
  { label: "3 Bedrooms",  field: "referralFee3br"      },
  { label: "4+ Bedrooms", field: "referralFee4brPlus"  },
] as const;

function fmt(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── collapsible section ────────────────────────────────────────────────────────
function Section({
  icon: Icon, title, children, defaultOpen = true,
}: {
  icon: React.FC<any>; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/60 shadow-sm bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-0">
          <Separator className="mb-4" />
          {children}
        </div>
      )}
    </div>
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
        {progress === 100 && <p className="text-xs text-green-600 mt-0.5">Uploaded ✓</p>}
      </div>
      <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────
export default function NewForecastRequest() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  // data hooks
  const { data: owners = [] } = useListOwners();
  const { data: users } = useListUsers();
  const { data: referees } = useListReferees();
  const { data: roles } = useListRoles();
  const createUser = useCreateUser();
  const createReferee = useCreateReferee();

  // owner section
  const [ownerMode, setOwnerMode] = useState<OwnerMode>("new");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [ownerForm, setOwnerForm] = useState({
    firstName: "", lastName: "", companyName: "", email: "",
    phone: "", whatsapp: "", nationality: "", type: "individual",
  });

  // property section
  const [propMode, setPropMode] = useState<PropertyMode>("new");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [propForm, setPropForm] = useState({
    emirate: "Abu Dhabi", area: "", community: "", development: "",
    unitNumber: "", type: "", bedrooms: "", bathrooms: "",
    internalArea: "", furnishing: "", condition: "", view: "",
    isWaterfront: false,
  });

  // representative + referee
  const [representativeId, setRepresentativeId] = useState<number | null>(null);
  const [refereeId, setRefereeId] = useState<number | null>(null);

  // create rep dialog
  const [addRepOpen, setAddRepOpen] = useState(false);
  const repForm = useForm({ defaultValues: { name: "", email: "", password: "", roleId: "", phone: "" } });

  // create referee dialog
  const [addRefereeOpen, setAddRefereeOpen] = useState(false);
  const refereeForm = useForm({
    defaultValues: {
      name: "", phone: "", email: "", companyName: "",
      referralFeeStudio: 1500, referralFee1br: 2000, referralFee2br: 2500,
      referralFee3br: 3000, referralFee4brPlus: 3500, isRecurringEnabled: false,
    },
  });
  const isRefereeRecurring = refereeForm.watch("isRecurringEnabled");

  const selectedReferee = (referees as any[] | undefined)?.find((r: any) => r.id === refereeId);

  // notes + media
  const [notes, setNotes] = useState("");
  const [mediaFiles, setMediaFiles] = useState<{ name: string; type: string; progress: number | null; objectPath: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── filtered owner list ────────────────────────────────────────────────────
  const filteredOwners = (owners as any[]).filter(o => {
    const q = ownerSearch.toLowerCase();
    if (!q) return true;
    const name = [o.firstName, o.lastName].filter(Boolean).join(" ").toLowerCase();
    return name.includes(q) || (o.email ?? "").toLowerCase().includes(q) || (o.phone ?? "").toLowerCase().includes(q);
  }).slice(0, 8);

  // ── file upload ────────────────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    for (const file of files) {
      const placeholder = { name: file.name, type: file.type, progress: 0, objectPath: null };
      setMediaFiles(prev => [...prev, placeholder]);
      try {
        setUploading(true);
        const meta = await fetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
        }).then(r => r.json());

        setMediaFiles(prev => {
          const idx = prev.findIndex(f => f.name === file.name && f.objectPath === null);
          return prev.map((f, i) => i === idx ? { ...f, progress: 30 } : f);
        });

        await fetch(meta.uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });

        setMediaFiles(prev => {
          const idx = prev.findIndex(f => f.name === file.name && f.objectPath === null);
          return prev.map((f, i) => i === idx ? { ...f, progress: 100, objectPath: meta.objectPath } : f);
        });
      } catch {
        setMediaFiles(prev => prev.filter(f => !(f.name === file.name && f.objectPath === null)));
        toast({ title: "Upload failed", description: `Could not upload ${file.name}`, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    }
  }, [toast]);

  // ── create rep ─────────────────────────────────────────────────────────────
  async function handleCreateRep(data: any) {
    try {
      const newUser = await createUser.mutateAsync({
        data: { name: data.name, email: data.email, password: data.password, roleId: parseInt(data.roleId), phone: data.phone } as any,
      });
      qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setRepresentativeId((newUser as any).id);
      setAddRepOpen(false);
      repForm.reset({ name: "", email: "", password: "", roleId: "", phone: "" });
      toast({ title: "Representative added", description: `${(newUser as any).name} can now log in.` });
    } catch {
      toast({ title: "Failed to create representative", variant: "destructive" });
    }
  }

  // ── create referee ─────────────────────────────────────────────────────────
  async function handleCreateReferee(data: any) {
    try {
      const newReferee = await createReferee.mutateAsync({ data } as any);
      qc.invalidateQueries({ queryKey: getListRefereesQueryKey() });
      setRefereeId((newReferee as any).id);
      setAddRefereeOpen(false);
      refereeForm.reset({
        name: "", phone: "", email: "", companyName: "",
        referralFeeStudio: 1500, referralFee1br: 2000, referralFee2br: 2500,
        referralFee3br: 3000, referralFee4brPlus: 3500, isRecurringEnabled: false,
      });
      toast({ title: "Referee created", description: `${(newReferee as any).refereeCode} — ${(newReferee as any).name}` });
    } catch {
      toast({ title: "Failed to create referee", variant: "destructive" });
    }
  }

  // ── submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
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
      if (!res.ok) throw new Error("Failed");
      setSubmitted(true);
      toast({ title: "Request submitted!", description: "The revenue manager has been notified." });
    } catch {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

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
          <Button onClick={() => setSubmitted(false)}>Submit Another</Button>
        </div>
      </div>
    );
  }

  // ── form ───────────────────────────────────────────────────────────────────
  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-28">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-xl font-bold tracking-tight">New Forecast Request</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submit owner and property details so the revenue manager can prepare a forecast.
          </p>
        </div>

        {/* ── OWNER ── */}
        <Section icon={User} title="Owner Details">
          {/* Mode toggle */}
          <div className="flex gap-2 mb-4">
            {(["existing", "new"] as OwnerMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setOwnerMode(m)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  ownerMode === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {m === "existing" ? "Existing Owner" : "New Owner"}
              </button>
            ))}
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
                {filteredOwners.map((o: any) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { setSelectedOwnerId(o.id); setOwnerSearch(""); }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      selectedOwnerId === o.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
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

        {/* ── PROPERTY ── */}
        <Section icon={Building2} title="Property Details">
          <div className="flex gap-2 mb-4">
            {(["existing", "new"] as PropertyMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setPropMode(m)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  propMode === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
                }`}
              >
                {m === "existing" ? "Existing Property" : "New Property"}
              </button>
            ))}
          </div>

          {propMode === "existing" ? (
            <div className="text-center py-4 text-sm text-muted-foreground space-y-3">
              <p>Enter the Property ID if known, or switch to New Property to describe it.</p>
              <Input
                type="number"
                placeholder="Property ID (optional)"
                className="max-w-xs mx-auto h-9 text-center"
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
                  <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
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
                  <SelectContent>{FURNISHING.map(t => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Condition</Label>
                <Select value={propForm.condition} onValueChange={v => setPropForm(f => ({ ...f, condition: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map(t => <SelectItem key={t} value={t}>{fmt(t)}</SelectItem>)}</SelectContent>
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
        <Section icon={Users} title="Representative & Referee">
          <div className="space-y-4">
            {/* Representative */}
            <div className="space-y-1.5">
              <Label className="text-xs">Assigned Representative</Label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <SearchableSelect
                    options={(users as any[] | undefined)?.map((u: any) => ({ value: String(u.id), label: u.name })) ?? []}
                    value={representativeId ? String(representativeId) : ""}
                    onValueChange={v => setRepresentativeId(v ? parseInt(v) : null)}
                    placeholder={(users as any[] | undefined)?.length ? "Select team member" : "No team members yet"}
                    searchPlaceholder="Search team members…"
                    disabled={!(users as any[] | undefined)?.length}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="Add new representative"
                  onClick={() => setAddRepOpen(true)}
                >
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Referee */}
            <div className="space-y-1.5">
              <Label className="text-xs">Referee <span className="text-muted-foreground">(optional)</span></Label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <SearchableSelect
                    options={(referees as any[] | undefined)
                      ?.filter((r: any) => r.isActive)
                      .map((r: any) => ({
                        value: String(r.id),
                        label: `${r.refereeCode} — ${r.name}${r.companyName ? ` (${r.companyName})` : ""}`,
                      })) ?? []}
                    value={refereeId ? String(refereeId) : ""}
                    onValueChange={v => setRefereeId(v ? parseInt(v) : null)}
                    placeholder="Choose existing referee…"
                    searchPlaceholder="Search referees…"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 gap-1.5 text-xs px-3"
                  onClick={() => setAddRefereeOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" /> New
                </Button>
              </div>
            </div>

            {/* Selected referee card */}
            {selectedReferee && (
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs bg-primary/5 border-primary/30 text-primary shrink-0">
                    {selectedReferee.refereeCode}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm">{selectedReferee.name}</p>
                    {selectedReferee.companyName && (
                      <p className="text-xs text-muted-foreground">{selectedReferee.companyName}</p>
                    )}
                  </div>
                  {selectedReferee.isRecurringEnabled && (
                    <Badge variant="outline" className="text-xs gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 shrink-0">
                      <RefreshCw className="h-2.5 w-2.5" /> Recurring
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1 text-center text-xs">
                  {[
                    { label: "Studio", value: selectedReferee.referralFeeStudio },
                    { label: "1 BR",   value: selectedReferee.referralFee1br },
                    { label: "2 BR",   value: selectedReferee.referralFee2br },
                    { label: "3 BR",   value: selectedReferee.referralFee3br },
                    { label: "4+ BR",  value: selectedReferee.referralFee4brPlus },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted/60 rounded p-1">
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="font-semibold">{Number(value ?? 0).toLocaleString()} AED</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* ── MEDIA ── */}
        <Section icon={Paperclip} title="Photos & Videos">
          <div className="space-y-3">
            <label
              htmlFor="media-upload"
              className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground text-center">
                Tap to attach photos or videos<br />
                <span className="text-xs opacity-70">JPG, PNG, HEIC, MP4, MOV · Max 50MB each</span>
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

        {/* Sticky submit */}
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

      {/* ── Add Representative Dialog ── */}
      <Dialog open={addRepOpen} onOpenChange={setAddRepOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Add New Representative</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Create a team member account. They can log in immediately with these credentials.
            </p>
          </DialogHeader>
          <form onSubmit={repForm.handleSubmit(handleCreateRep)} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Sarah Mitchell" {...repForm.register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" placeholder="sarah@royalholiday.ae" {...repForm.register("email", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password <span className="text-destructive">*</span></Label>
              <Input type="password" placeholder="Min. 8 characters" {...repForm.register("password", { required: true, minLength: 8 })} />
              <p className="text-xs text-muted-foreground">Share this with them — they can change it after first login.</p>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+971 50 000 0000" {...repForm.register("phone")} />
            </div>
            <div className="space-y-2">
              <Label>Role <span className="text-destructive">*</span></Label>
              <select
                {...repForm.register("roleId", { required: true })}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a role…</option>
                {(roles as any[] | undefined)?.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.label ?? r.name}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddRepOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createUser.isPending} className="gap-2">
                {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create &amp; Select
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Add Referee Dialog ── */}
      <Dialog open={addRefereeOpen} onOpenChange={setAddRefereeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Register New Referee</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              A unique Referee ID (e.g. <span className="font-mono font-medium">REF-001</span>) will be auto-generated.
            </p>
          </DialogHeader>
          <form onSubmit={refereeForm.handleSubmit(handleCreateReferee)} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Ahmed Al-Mansoori" {...refereeForm.register("name", { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+971 50 000 0000" {...refereeForm.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="ahmed@example.com" {...refereeForm.register("email")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company / Agency</Label>
              <Input placeholder="Al Mansoori Real Estate" {...refereeForm.register("companyName")} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Home className="h-3.5 w-3.5 text-primary" />
                <Label className="text-sm">One-Time Referral Fees (AED)</Label>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                {FEE_FIELDS.map(({ label, field }) => (
                  <div key={field} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="relative">
                      <Input
                        type="number" min="0" step="100"
                        {...refereeForm.register(field, { valueAsNumber: true })}
                        className="pr-10 text-sm h-8"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">AED</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
                <div>
                  <Label className="text-sm font-medium">Recurring Commission</Label>
                  <p className="text-xs text-muted-foreground">Agent earns PM%−16% per year</p>
                </div>
              </div>
              <Switch
                checked={isRefereeRecurring}
                onCheckedChange={v => refereeForm.setValue("isRecurringEnabled", v)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddRefereeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createReferee.isPending} className="gap-2">
                {createReferee.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create &amp; Select
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
