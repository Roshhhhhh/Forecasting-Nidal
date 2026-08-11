import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useListOwners, useListProperties, useListMarketAreas } from "@workspace/api-client-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  User, Building2, DollarSign, Paperclip, FileText,
  ChevronDown, ChevronUp, Upload, X, CheckCircle2,
  Send, Loader2, Image, Video, AlertTriangle, Search,
} from "lucide-react";

// ── constants ──────────────────────────────────────────────────────────────────
const EMIRATES = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Ras Al Khaimah", "Umm Al Quwain", "Fujairah", "Other"];
const TITLES = ["Mr.", "Mrs.", "Ms.", "Dr.", "Sheikh", "Sheikha", "Other"];
const PROPERTY_TYPES = ["Apartment", "Duplex", "Penthouse", "Townhouse", "Villa", "Hotel Apartment", "Other"];
const LAYOUTS = ["Studio", "1 Bedroom", "2 Bedrooms", "3 Bedrooms", "4 Bedrooms", "5 Bedrooms", "6 Bedrooms", "7 Bedrooms", "8 Bedrooms", "9 Bedrooms", "10 Bedrooms", "10+ Bedrooms"];
const BATHROOMS_OPTS = ["Unknown", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6", "7", "8", "9", "10", "10+"];
const VIEWS = ["Unknown", "Sea View", "Full Sea View", "Partial Sea View", "Canal View", "Marina View", "Waterfront View", "Pool View", "Golf View", "Park View", "Community View", "City View", "Skyline View", "Landmark View", "Mangrove View", "Yas Waterworld View", "Ferrari World View", "Theme Park View", "Garden View", "Street View", "Other"];
const FURNISHINGS = ["Unknown", "Unfurnished", "Partially Furnished", "Fully Furnished", "Premium Furnished", "Previously Managed as Holiday Home"];
const CONDITIONS = ["Unknown", "Brand New", "Excellent", "Good", "Requires Minor Improvements", "Requires Renovation"];
const PMC_OPTS = ["20%", "19.5%", "19%", "18.5%", "18%", "17.5%", "17%", "16.5%", "16%", "15.5%", "15%"];

const ABU_DHABI_AREAS = [
  "Yas Island", "Saadiyat Island", "Al Reem Island", "Al Raha Beach", "Al Maryah Island",
  "Masdar City", "Khalifa City", "Al Reef", "Al Raha Gardens", "Al Muneera", "Al Zeina",
  "Al Bateen", "Corniche", "Al Khalidiyah", "Al Mushrif", "Al Manhal", "Al Rawdah",
  "Al Shamkha", "Al Shawamekh", "Al Ghadeer", "Al Hudayriyat", "Al Jubail Island",
  "Al Raha Golf Gardens", "Tourist Club Area", "Al Danah", "Al Nahyan", "Al Zahiyah",
  "Al Marina", "Other",
];

const COMMUNITIES: Record<string, string[]> = {
  "Yas Island": ["Waters Edge", "Ansam", "Mayan", "Yas Golf Collection", "Noya", "Noya Viva", "Noya Luma", "West Yas", "Yas Acres", "Yas Park Views", "Yas Park Gate", "Gardenia Bay", "The Sustainable City Yas Island", "Yas Riva", "Yas Canopies", "Other"],
  "Saadiyat Island": ["Mamsha Al Saadiyat", "Saadiyat Beach Residences", "Hidd Al Saadiyat", "Louvre Abu Dhabi Residences", "Grove", "Saadiyat Lagoons", "Jawaher", "Nobu Residences", "Other"],
  "Al Reem Island": ["Shams Abu Dhabi", "City of Lights", "Najmat Abu Dhabi", "Marina Square", "Other"],
  "Al Raha Beach": ["Al Muneera", "Al Zeina", "Al Bandar", "Al Naseem", "Al Nada", "Other"],
};

// ── section component ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children, defaultOpen = true }: {
  icon: React.FC<any>; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/60 shadow-sm bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0">
          <Separator className="mb-3" />
          {children}
        </div>
      )}
    </div>
  );
}

// ── field label ────────────────────────────────────────────────────────────────
function FL({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs text-muted-foreground font-medium mb-1 block">
      {children}{required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );
}

// ── media row ──────────────────────────────────────────────────────────────────
function MediaRow({ name, type, size, progress, onRemove }: {
  name: string; type: string; size: number; progress: number | null; onRemove: () => void;
}) {
  const isVideo = type.startsWith("video");
  const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;
  return (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/40">
      {isVideo ? <Video className="h-4 w-4 text-primary shrink-0" /> : <Image className="h-4 w-4 text-primary shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{sizeStr}</span>
          {progress !== null && progress < 100 && (
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {progress === 100 && <span className="text-[10px] text-green-600 font-medium">✓ Uploaded</span>}
        </div>
      </div>
      {(progress === null || progress === 100) && (
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive shrink-0">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ── main ───────────────────────────────────────────────────────────────────────
export default function NewForecastRequest() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // data
  const { data: owners = [] } = useListOwners();
  const { data: properties = [] } = useListProperties();
  const { data: marketAreas = [] } = useListMarketAreas();

  // derive area list: DB areas + Abu Dhabi fallback, deduplicated
  const dbAreas = (marketAreas as any[]).map((a: any) => a.area).filter(Boolean);
  const allAreas = Array.from(new Set([...ABU_DHABI_AREAS.filter(a => a !== "Other"), ...dbAreas, "Other"]));
  const areaOpts = allAreas.map(a => ({ value: a, label: a }));

  // ── owner ──
  const [ownerMode, setOwnerMode] = useState<"existing" | "new">("new");
  const [ownerSearch, setOwnerSearch] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [ownerType, setOwnerType] = useState("individual");
  const [ownerTitle, setOwnerTitle] = useState("");
  const [ownerFirst, setOwnerFirst] = useState("");
  const [ownerLast, setOwnerLast] = useState("");
  const [ownerNationality, setOwnerNationality] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [ownerWhatsapp, setOwnerWhatsapp] = useState("");
  const [whatsappSameAsMobile, setWhatsappSameAsMobile] = useState(false);
  const [ownerCompanyName, setOwnerCompanyName] = useState("");
  const [ownerContactPerson, setOwnerContactPerson] = useState("");
  const [ownerContactPosition, setOwnerContactPosition] = useState("");

  // ── property ──
  const [propMode, setPropMode] = useState<"existing" | "new">("new");
  const [propSearch, setPropSearch] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [emirate, setEmirate] = useState("Abu Dhabi");
  const [emirateOther, setEmirateOther] = useState("");
  const [area, setArea] = useState("");
  const [areaOther, setAreaOther] = useState("");
  const [community, setCommunity] = useState("");
  const [communityOther, setCommunityOther] = useState("");
  const [building, setBuilding] = useState("");
  const [unitNumber, setUnitNumber] = useState("");
  const [propType, setPropType] = useState("");
  const [propTypeOther, setPropTypeOther] = useState("");
  const [layout, setLayout] = useState("");
  const [bathrooms, setBathrooms] = useState("Unknown");
  const [internalArea, setInternalArea] = useState("");
  const [view, setView] = useState("Unknown");
  const [viewOther, setViewOther] = useState("");
  const [furnishing, setFurnishing] = useState("Unknown");
  const [condition, setCondition] = useState("Unknown");
  const [isWaterfront, setIsWaterfront] = useState(false);

  // ── commercial ──
  const [pmc, setPmc] = useState("20%");
  const [refereeName, setRefereeName] = useState("");
  const [refereeContact, setRefereeContact] = useState("");
  const [showRefereeContact, setShowRefereeContact] = useState(false);

  // ── media ──
  const [mediaFiles, setMediaFiles] = useState<{ name: string; type: string; size: number; progress: number | null; objectPath: string | null }[]>([]);
  const [uploading, setUploading] = useState(false);

  // ── notes ──
  const [notes, setNotes] = useState("");

  // ── submit ──
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: number; ref: string } | null>(null);

  // ── computed ──
  const communityOptions = (community !== "Other")
    ? [...(COMMUNITIES[area] ?? []).filter(c => c !== "Other"), "Other"].map(c => ({ value: c, label: c }))
    : [];
  const showCommunityOther = community === "Other";
  const isReducedPmc = pmc !== "20%";

  // filtered owner list
  const filteredOwners = (owners as any[]).filter((o: any) => {
    const q = ownerSearch.toLowerCase();
    if (!q) return true;
    const name = [o.firstName, o.lastName].filter(Boolean).join(" ").toLowerCase();
    const company = (o.companyName ?? "").toLowerCase();
    return name.includes(q) || company.includes(q) || (o.email ?? "").toLowerCase().includes(q) || (o.phone ?? "").toLowerCase().includes(q);
  }).slice(0, 8);

  // filtered property list
  const filteredProps = (properties as any[]).filter((p: any) => {
    const q = propSearch.toLowerCase();
    if (!q) return true;
    const str = [p.development, p.community, p.unitNumber, p.area].filter(Boolean).join(" ").toLowerCase();
    return str.includes(q);
  }).slice(0, 8);

  const selectedOwner = (owners as any[]).find((o: any) => o.id === selectedOwnerId);
  const selectedProp = (properties as any[]).find((p: any) => p.id === selectedPropertyId);

  // ── file upload ──
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    for (const file of files) {
      const entry = { name: file.name, type: file.type, size: file.size, progress: 0, objectPath: null as null | string };
      setMediaFiles(prev => [...prev, entry]);
      try {
        setUploading(true);
        const meta = await fetch("/api/storage/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
        }).then(r => r.json());

        setMediaFiles(prev => {
          const idx = prev.findLastIndex(f => f.name === file.name && f.objectPath === null);
          return prev.map((f, i) => i === idx ? { ...f, progress: 40 } : f);
        });

        await fetch(meta.uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });

        setMediaFiles(prev => {
          const idx = prev.findLastIndex(f => f.name === file.name && f.objectPath === null);
          return prev.map((f, i) => i === idx ? { ...f, progress: 100, objectPath: meta.objectPath } : f);
        });
      } catch {
        setMediaFiles(prev => prev.slice(0, -1));
        toast({ title: "Upload failed", description: `Could not upload ${file.name}`, variant: "destructive" });
      } finally {
        setUploading(false);
      }
    }
  }, [toast]);

  // ── submit ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // validation
    if (ownerMode === "existing" && !selectedOwnerId) {
      toast({ title: "Select an owner", description: "Please choose an existing owner or switch to New Owner.", variant: "destructive" }); return;
    }
    if (ownerMode === "new") {
      if (ownerType === "individual" && !ownerFirst.trim()) {
        toast({ title: "First name required", variant: "destructive" }); return;
      }
      if (ownerType === "individual" && !ownerLast.trim()) {
        toast({ title: "Last name required", variant: "destructive" }); return;
      }
      if (ownerType === "company" && !ownerCompanyName.trim()) {
        toast({ title: "Company name required", variant: "destructive" }); return;
      }
      if (ownerType === "company" && !ownerContactPerson.trim()) {
        toast({ title: "Contact person required", variant: "destructive" }); return;
      }
      if (!ownerPhone.trim()) {
        toast({ title: "Mobile number required", variant: "destructive" }); return;
      }
    }
    if (propMode === "new") {
      if (!area.trim() && !areaOther.trim()) {
        toast({ title: "Area required", variant: "destructive" }); return;
      }
      if (!layout) {
        toast({ title: "Layout required", variant: "destructive" }); return;
      }
      if (!propType) {
        toast({ title: "Property type required", variant: "destructive" }); return;
      }
    }

    setSubmitting(true);
    try {
      const effectiveEmirate = emirate === "Other" ? emirateOther : emirate;
      const effectiveArea    = area === "Other" ? areaOther : area;
      const effectiveCommunity = community === "Other" ? communityOther : community;
      const effectivePropType  = propType === "Other" ? propTypeOther : propType;
      const effectiveView      = view === "Other" ? viewOther : view;

      // bedrooms from layout
      let bedrooms: number | null = null;
      if (layout === "Studio") bedrooms = 0;
      else { const m = layout.match(/^(\d+)/); if (m) bedrooms = parseInt(m[1], 10); }

      const payload: Record<string, any> = {
        proposedManagementCommission: pmc,
        refereeName: refereeName.trim() || null,
        mediaUrls: mediaFiles.filter(f => f.objectPath).map(f => f.objectPath!),
        notes: notes.trim() || null,
      };

      if (ownerMode === "existing") {
        payload.ownerId = selectedOwnerId;
      } else {
        payload.ownerType = ownerType;
        if (ownerType === "individual") {
          payload.ownerTitle = ownerTitle || null;
          payload.ownerFirstName = ownerFirst.trim();
          payload.ownerLastName = ownerLast.trim();
          payload.ownerNationality = ownerNationality.trim() || null;
        } else {
          payload.ownerCompanyName = ownerCompanyName.trim();
          payload.ownerContactPerson = ownerContactPerson.trim();
          payload.ownerContactPosition = ownerContactPosition.trim() || null;
        }
        payload.ownerEmail = ownerEmail.trim() || null;
        payload.ownerPhone = ownerPhone.trim();
        payload.ownerWhatsapp = whatsappSameAsMobile ? ownerPhone.trim() : (ownerWhatsapp.trim() || null);
      }

      if (propMode === "existing") {
        payload.propertyId = selectedPropertyId;
      } else {
        payload.propertyEmirate = effectiveEmirate;
        payload.propertyArea = effectiveArea;
        payload.propertyCommunity = effectiveCommunity || null;
        payload.propertyDevelopment = building.trim() || null;
        payload.propertyUnitNumber = unitNumber.trim() || null;
        payload.propertyType = effectivePropType || null;
        payload.propertyLayout = layout || null;
        payload.propertyBedrooms = bedrooms;
        payload.propertyBathrooms = bathrooms !== "Unknown" ? parseFloat(bathrooms) : null;
        payload.propertyInternalArea = internalArea ? parseFloat(internalArea) : null;
        payload.propertyView = view !== "Unknown" ? (view === "Other" ? viewOther : view) : null;
        payload.propertyFurnishing = furnishing !== "Unknown" ? furnishing : null;
        payload.propertyCondition = condition !== "Unknown" ? condition : null;
        payload.propertyIsWaterfront = isWaterfront;
      }

      const res = await fetch("/api/forecast-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      const created = await res.json();
      const year = new Date().getFullYear();
      const ref = `FR-${year}-${String(created.id).padStart(4, "0")}`;
      setSubmitted({ id: created.id, ref });
    } catch {
      toast({ title: "Submission failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-6">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-1">Request Submitted</h2>
          <p className="text-sm text-muted-foreground">Your request has been sent to the Revenue Management team for review.</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-2 text-left">
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Reference</span>
            <span className="font-mono font-semibold text-sm text-primary">{submitted.ref}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Status</span>
            <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Pending Review</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate("/forecast-requests")} variant="outline" className="w-full">View All Requests</Button>
          <Button onClick={() => setSubmitted(null)} className="w-full">Submit Another Request</Button>
          <Button onClick={() => navigate("/")} variant="ghost" className="w-full text-muted-foreground">Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  // ── form ───────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-5 space-y-3.5 pb-28">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">New Forecast Request</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Provide owner and property details for the Revenue Manager to prepare a forecast.
        </p>
      </div>

      {/* ── SECTION 1: OWNER ── */}
      <Section icon={User} title="Owner Details">
        {/* Toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden mb-3">
          {(["existing", "new"] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setOwnerMode(m)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${ownerMode === m ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted/30"}`}
            >
              {m === "existing" ? "Existing Owner" : "New Owner"}
            </button>
          ))}
        </div>

        {ownerMode === "existing" ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search by name, company, email or mobile…" value={ownerSearch}
                onChange={e => setOwnerSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {filteredOwners.length === 0 && ownerSearch && (
                <p className="text-xs text-muted-foreground text-center py-4">No owners found</p>
              )}
              {filteredOwners.map((o: any) => {
                const name = o.ownerType === "company" ? o.companyName : [o.firstName, o.lastName].filter(Boolean).join(" ");
                return (
                  <button key={o.id} type="button" onClick={() => { setSelectedOwnerId(o.id); setOwnerSearch(""); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${selectedOwnerId === o.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}>
                    <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {(name?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{name || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">{o.email ?? o.phone ?? ""}</p>
                    </div>
                    {selectedOwnerId === o.id && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
            {selectedOwner && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 space-y-0.5">
                <p className="text-xs font-semibold text-primary">Selected</p>
                <p className="text-sm font-medium">{[selectedOwner.firstName, selectedOwner.lastName].filter(Boolean).join(" ") || selectedOwner.companyName}</p>
                <p className="text-xs text-muted-foreground">{selectedOwner.email ?? selectedOwner.phone}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Owner type */}
            <div>
              <FL>Owner Type</FL>
              <Select value={ownerType} onValueChange={setOwnerType}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {ownerType === "individual" ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr] gap-2">
                  <div>
                    <FL>Title</FL>
                    <Select value={ownerTitle} onValueChange={setOwnerTitle}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Title" /></SelectTrigger>
                      <SelectContent>{TITLES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <FL required>First Name</FL>
                    <Input placeholder="First name" value={ownerFirst} onChange={e => setOwnerFirst(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <FL required>Last Name</FL>
                    <Input placeholder="Last name" value={ownerLast} onChange={e => setOwnerLast(e.target.value)} className="h-9" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <FL>Nationality</FL>
                    <Input placeholder="e.g. Emirati" value={ownerNationality} onChange={e => setOwnerNationality(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <FL>Email</FL>
                    <Input type="email" placeholder="owner@example.com" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <FL required>Mobile</FL>
                    <Input placeholder="+971 50 000 0000" value={ownerPhone} onChange={e => { setOwnerPhone(e.target.value); if (whatsappSameAsMobile) setOwnerWhatsapp(e.target.value); }} className="h-9" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <FL>WhatsApp</FL>
                      <button type="button" onClick={() => { setWhatsappSameAsMobile(v => !v); if (!whatsappSameAsMobile) setOwnerWhatsapp(ownerPhone); }}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors ${whatsappSameAsMobile ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                        Same as mobile
                      </button>
                    </div>
                    <Input placeholder="+971 50 000 0000" value={whatsappSameAsMobile ? ownerPhone : ownerWhatsapp}
                      onChange={e => { if (!whatsappSameAsMobile) setOwnerWhatsapp(e.target.value); }}
                      disabled={whatsappSameAsMobile} className="h-9" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <FL required>Company Name</FL>
                  <Input placeholder="e.g. Al Mansouri Holdings LLC" value={ownerCompanyName} onChange={e => setOwnerCompanyName(e.target.value)} className="h-9" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <FL required>Contact Person</FL>
                    <Input placeholder="Full name" value={ownerContactPerson} onChange={e => setOwnerContactPerson(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <FL>Position</FL>
                    <Input placeholder="e.g. Director" value={ownerContactPosition} onChange={e => setOwnerContactPosition(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <FL>Email</FL>
                    <Input type="email" placeholder="contact@company.com" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} className="h-9" />
                  </div>
                  <div>
                    <FL required>Mobile</FL>
                    <Input placeholder="+971 50 000 0000" value={ownerPhone} onChange={e => { setOwnerPhone(e.target.value); if (whatsappSameAsMobile) setOwnerWhatsapp(e.target.value); }} className="h-9" />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <FL>WhatsApp</FL>
                      <button type="button" onClick={() => { setWhatsappSameAsMobile(v => !v); if (!whatsappSameAsMobile) setOwnerWhatsapp(ownerPhone); }}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded border transition-colors ${whatsappSameAsMobile ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:border-primary/30"}`}>
                        Same as mobile
                      </button>
                    </div>
                    <Input placeholder="+971 50 000 0000" value={whatsappSameAsMobile ? ownerPhone : ownerWhatsapp}
                      onChange={e => { if (!whatsappSameAsMobile) setOwnerWhatsapp(e.target.value); }}
                      disabled={whatsappSameAsMobile} className="h-9" />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Section>

      {/* ── SECTION 2: PROPERTY ── */}
      <Section icon={Building2} title="Property Details">
        <div className="flex rounded-lg border border-border overflow-hidden mb-3">
          {(["existing", "new"] as const).map(m => (
            <button key={m} type="button" onClick={() => setPropMode(m)}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${propMode === m ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted/30"}`}>
              {m === "existing" ? "Existing Property" : "New Property"}
            </button>
          ))}
        </div>

        {propMode === "existing" ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Search by building, unit, area…" value={propSearch}
                onChange={e => setPropSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {filteredProps.length === 0 && propSearch && (
                <p className="text-xs text-muted-foreground text-center py-4">No properties found</p>
              )}
              {filteredProps.map((p: any) => {
                const label = [p.development, p.unitNumber && `Unit ${p.unitNumber}`].filter(Boolean).join(" · ");
                return (
                  <button key={p.id} type="button" onClick={() => { setSelectedPropertyId(p.id); setPropSearch(""); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${selectedPropertyId === p.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}>
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{label || `Property #${p.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">{[p.area, p.propertyType].filter(Boolean).join(" · ")}</p>
                    </div>
                    {selectedPropertyId === p.id && <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
            {selectedProp && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5">
                <p className="text-xs font-semibold text-primary mb-0.5">Selected</p>
                <p className="text-sm font-medium">{[selectedProp.development, selectedProp.unitNumber && `Unit ${selectedProp.unitNumber}`].filter(Boolean).join(" · ") || `Property #${selectedProp.id}`}</p>
                <p className="text-xs text-muted-foreground">{[selectedProp.area, selectedProp.emirate].filter(Boolean).join(", ")}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Emirate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <FL>Emirate</FL>
                <Select value={emirate} onValueChange={setEmirate}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{EMIRATES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {emirate === "Other" && (
                <div>
                  <FL required>Enter Emirate</FL>
                  <Input placeholder="Emirate name" value={emirateOther} onChange={e => setEmirateOther(e.target.value)} className="h-9" />
                </div>
              )}

              {/* Area */}
              <div className={emirate === "Other" ? "" : ""}>
                <FL required>Area</FL>
                <SearchableSelect
                  options={areaOpts}
                  value={area}
                  onValueChange={v => { setArea(v); setCommunity(""); }}
                  placeholder="Select area…"
                  searchPlaceholder="Search areas…"
                />
              </div>
              {area === "Other" && (
                <div>
                  <FL required>Enter Area</FL>
                  <Input placeholder="Area name" value={areaOther} onChange={e => setAreaOther(e.target.value)} className="h-9" />
                </div>
              )}
            </div>

            {/* Community */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <FL>Community / Project</FL>
                {communityOptions.length > 0 ? (
                  <SearchableSelect
                    options={communityOptions}
                    value={community}
                    onValueChange={setCommunity}
                    placeholder="Select community…"
                    searchPlaceholder="Search communities…"
                  />
                ) : (
                  <Input placeholder="Community or project name" value={community} onChange={e => setCommunity(e.target.value)} className="h-9" />
                )}
              </div>
              {showCommunityOther && (
                <div>
                  <FL>Enter Community / Project</FL>
                  <Input placeholder="Community or project name" value={communityOther} onChange={e => setCommunityOther(e.target.value)} className="h-9" />
                </div>
              )}

              {/* Building */}
              <div>
                <FL>Development / Building</FL>
                <Input placeholder="e.g. Mamsha, Building Lilac 5" value={building} onChange={e => setBuilding(e.target.value)} className="h-9" />
              </div>

              {/* Unit */}
              <div>
                <FL>Unit Number</FL>
                <Input placeholder="e.g. 402" value={unitNumber} onChange={e => setUnitNumber(e.target.value)} className="h-9" />
              </div>
            </div>

            {/* Type + Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <FL required>Property Type</FL>
                <Select value={propType} onValueChange={setPropType}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{PROPERTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {propType === "Other" && (
                <div>
                  <FL>Enter Type</FL>
                  <Input placeholder="Property type" value={propTypeOther} onChange={e => setPropTypeOther(e.target.value)} className="h-9" />
                </div>
              )}

              <div>
                <FL required>Layout</FL>
                <Select value={layout} onValueChange={setLayout}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select layout" /></SelectTrigger>
                  <SelectContent>{LAYOUTS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Bathrooms + Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <FL>Bathrooms</FL>
                <Select value={bathrooms} onValueChange={setBathrooms}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{BATHROOMS_OPTS.map(b => <SelectItem key={b} value={b}>{b === "Unknown" ? "Unknown" : `${b} Bathroom${parseFloat(b) !== 1 ? "s" : ""}`}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <FL>Approx. Size</FL>
                <div className="relative">
                  <Input type="number" min="0" placeholder="0" value={internalArea} onChange={e => setInternalArea(e.target.value)} className="h-9 pr-12" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Sq Ft</span>
                </div>
              </div>
            </div>

            {/* View + Furnishing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <FL>View</FL>
                <SearchableSelect
                  options={VIEWS.map(v => ({ value: v, label: v }))}
                  value={view}
                  onValueChange={setView}
                  placeholder="Unknown"
                  searchPlaceholder="Search views…"
                />
              </div>
              {view === "Other" && (
                <div>
                  <FL>Enter View</FL>
                  <Input placeholder="View description" value={viewOther} onChange={e => setViewOther(e.target.value)} className="h-9" />
                </div>
              )}

              <div>
                <FL>Furnishing</FL>
                <Select value={furnishing} onValueChange={setFurnishing}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{FURNISHINGS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div>
                <FL>Condition</FL>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Waterfront */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isWaterfront}
                onChange={e => setIsWaterfront(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm">Waterfront / beachfront property</span>
            </label>
          </div>
        )}
      </Section>

      {/* ── SECTION 3: COMMERCIAL & REFERRAL ── */}
      <Section icon={DollarSign} title="Commercial & Referral">
        <div className="space-y-3">
          {/* PMC */}
          <div>
            <FL required>Proposed Management Commission</FL>
            <Select value={pmc} onValueChange={setPmc}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PMC_OPTS.map(p => (
                  <SelectItem key={p} value={p}>
                    {p}{p === "20%" ? " (Standard)" : p === "15%" ? " (Minimum)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Default RHH management commission is 20%. Any reduced commission is subject to internal approval.
            </p>
            {isReducedPmc && (
              <div className="mt-1.5 flex items-center gap-1.5 text-amber-600 text-[11px] font-medium bg-amber-50 border border-amber-200 rounded px-2 py-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Reduced commission selected. Subject to management approval.
              </div>
            )}
          </div>

          {/* Referee */}
          <div>
            <FL>Referee Name</FL>
            <Input placeholder="e.g. Ahmed Al Mansoori" value={refereeName} onChange={e => setRefereeName(e.target.value)} className="h-9" />
          </div>

          {/* Referee contact toggle */}
          <button type="button" onClick={() => setShowRefereeContact(v => !v)}
            className="text-xs text-primary font-medium flex items-center gap-1 hover:underline">
            {showRefereeContact ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showRefereeContact ? "Hide" : "Add"} referee contact details
          </button>
          {showRefereeContact && (
            <div>
              <FL>Referee Contact</FL>
              <Input placeholder="Phone or email" value={refereeContact} onChange={e => setRefereeContact(e.target.value)} className="h-9" />
            </div>
          )}
        </div>
      </Section>

      {/* ── SECTION 4: MEDIA ── */}
      <Section icon={Paperclip} title="Photos & Media" defaultOpen={false}>
        <div className="space-y-2">
          <label htmlFor="media-upload"
            className="flex flex-col items-center gap-2 w-full border-2 border-dashed border-border rounded-xl p-5 cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-colors">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground text-center">
              Upload property photos, floorplans, videos or brochures<br />
              <span className="text-xs opacity-60">JPG · PNG · HEIC · WEBP · PDF · MP4 · MOV · Max 50 MB</span>
            </span>
            <input id="media-upload" type="file" multiple
              accept="image/*,.pdf,video/mp4,video/quicktime,.heic,.webp"
              className="hidden" onChange={handleFileChange} disabled={uploading} />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Upload any available property photos, floorplans, videos or brochures. You can also submit without media.
          </p>
          {mediaFiles.length > 0 && (
            <div className="space-y-1.5">
              {mediaFiles.map((f, i) => (
                <MediaRow key={i} name={f.name} type={f.type} size={f.size} progress={f.progress}
                  onRemove={() => setMediaFiles(prev => prev.filter((_, idx) => idx !== i))} />
              ))}
            </div>
          )}
        </div>
      </Section>

      {/* ── SECTION 5: NOTES ── */}
      <Section icon={FileText} title="Additional Notes" defaultOpen={false}>
        <div className="space-y-1.5">
          <Textarea
            placeholder="Add anything useful for the Revenue Manager, such as expected rent, owner expectations, current operator, previous holiday-home performance, urgency, property availability, or special instructions."
            value={notes}
            onChange={e => { if (e.target.value.length <= 1500) setNotes(e.target.value); }}
            rows={4}
            className="resize-none text-sm"
          />
          <p className={`text-[11px] text-right ${notes.length > 1400 ? "text-amber-600" : "text-muted-foreground"}`}>
            {notes.length}/1500
          </p>
        </div>
      </Section>

      {/* ── STICKY SUBMIT ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        <Button type="submit" disabled={submitting || uploading} className="w-full h-11 text-sm font-semibold gap-2">
          {submitting
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
            : uploading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading files…</>
              : <><Send className="h-4 w-4" /> Submit Forecast Request</>}
        </Button>
      </div>
    </form>
  );
}
