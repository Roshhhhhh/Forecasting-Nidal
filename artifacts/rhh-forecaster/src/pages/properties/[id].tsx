import { useGetProperty, useListForecasts } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Home, TrendingUp, Pencil, Ruler, FileText, CheckCircle2, Sparkles, Users, Plus, Trash2, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { AmenitiesPicker } from "@/components/AmenitiesPicker";
import { calculateScores, PropertyScoresPanel, type Amenity } from "@/components/property-scores";
import { EditPropertySheet } from "@/components/EditPropertySheet";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useListOwners } from "@workspace/api-client-react";

// ── Ownership Card ─────────────────────────────────────────────────────────────
function OwnershipCard({ propertyId, primaryOwnerId }: { propertyId: number; primaryOwnerId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: allOwners = [] } = useListOwners();

  const { data: coOwners = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/properties", propertyId, "owners"],
    queryFn: async () => {
      const r = await fetch(`/api/properties/${propertyId}/owners`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!propertyId,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addOwnerId, setAddOwnerId] = useState("");
  const [addPct, setAddPct] = useState("100");
  const [addPrimary, setAddPrimary] = useState(false);
  const [addOwnershipType, setAddOwnershipType] = useState("joint_title");
  const [addNotes, setAddNotes] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPct, setEditPct] = useState("");
  const [editOwnershipType, setEditOwnershipType] = useState("");
  const OWNERSHIP_TYPES = [
    { value: "sole",        label: "Sole Owner" },
    { value: "joint_title", label: "Joint Title" },
    { value: "trust",       label: "Trust / Family Trust" },
    { value: "company",     label: "Company / Corporate" },
    { value: "poa",         label: "Power of Attorney" },
    { value: "other",       label: "Other" },
  ];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "owners"] });

  const checkOk = async (r: Response) => {
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error((body as any)?.error ?? `Request failed (${r.status})`);
    }
    return r.json();
  };

  const addMutation = useMutation({
    mutationFn: () => fetch(`/api/properties/${propertyId}/owners`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownerId: parseInt(addOwnerId, 10),
        ownershipPercentage: parseFloat(addPct),
        isPrimary: addPrimary,
        ownershipType: addOwnershipType || undefined,
        notes: addNotes || undefined,
      }),
    }).then(checkOk),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setAddOwnerId(""); setAddPct("100"); setAddPrimary(false);
      setAddOwnershipType("joint_title"); setAddNotes("");
      toast({ title: "Co-owner added" });
    },
    onError: (e: Error) => toast({ title: "Failed to add co-owner", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (ownerId: number) => fetch(`/api/properties/${propertyId}/owners/${ownerId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownershipPercentage: parseFloat(editPct), ownershipType: editOwnershipType || undefined }),
    }).then(checkOk),
    onSuccess: () => { invalidate(); setEditingId(null); },
    onError: (e: Error) => toast({ title: "Failed to update ownership", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (ownerId: number) => fetch(`/api/properties/${propertyId}/owners/${ownerId}`, {
      method: "DELETE", credentials: "include",
    }).then(checkOk),
    onSuccess: () => { invalidate(); toast({ title: "Co-owner removed" }); },
    onError: (e: Error) => toast({ title: "Failed to remove co-owner", description: e.message, variant: "destructive" }),
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (ownerId: number) => fetch(`/api/properties/${propertyId}/owners/${ownerId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    }).then(checkOk),
    onSuccess: () => { invalidate(); toast({ title: "Primary owner updated" }); },
    onError: (e: Error) => toast({ title: "Failed to set primary", description: e.message, variant: "destructive" }),
  });

  const existingIds = new Set(coOwners.map((o: any) => o.ownerId));
  const availableOwners = allOwners.filter((o: any) => !existingIds.has(o.id));
  const totalPct = coOwners.reduce((sum: number, o: any) => sum + o.ownershipPercentage, 0);

  return (
    <Card className="shadow-sm border-border/50">
      <CardHeader className="bg-muted/20 border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Ownership</CardTitle>
            {coOwners.length > 1 && (
              <Badge variant="outline" className={`text-[10px] ${Math.round(totalPct) !== 100 ? "border-red-300 text-red-600" : "border-green-300 text-green-700"}`}>
                {Math.round(totalPct)}% allocated
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setAddOpen(v => !v)} className="h-7 text-xs gap-1.5">
            <Plus className="h-3 w-3" /> Add Co-owner
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Add form */}
        {addOpen && (
          <div className="p-4 border-b border-border bg-muted/10 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Co-owner</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={addOwnerId}
                onChange={e => setAddOwnerId(e.target.value)}
                className="sm:col-span-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select owner…</option>
                {availableOwners.map((o: any) => (
                  <option key={o.id} value={o.id}>{o.name || `${o.firstName} ${o.lastName}`}</option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <Input
                  type="number" min={0} max={100} step={1}
                  value={addPct}
                  onChange={e => setAddPct(e.target.value)}
                  className="w-20 h-9 text-sm"
                  placeholder="%"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <select
                value={addOwnershipType}
                onChange={e => setAddOwnershipType(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {OWNERSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="addPrimary" checked={addPrimary} onChange={e => setAddPrimary(e.target.checked)} className="h-4 w-4" />
              <label htmlFor="addPrimary" className="text-sm text-muted-foreground">Set as primary owner (receives proposals)</label>
            </div>
            <Input
              placeholder="Notes (optional)…"
              value={addNotes}
              onChange={e => setAddNotes(e.target.value)}
              className="h-9 text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!addOwnerId || addMutation.isPending}
                onClick={() => {
                  const newPct = parseFloat(addPct) || 0;
                  if (totalPct + newPct > 100) {
                    toast({
                      title: "Ownership would exceed 100%",
                      description: `Current total is ${Math.round(totalPct)}%. Adding ${newPct}% would reach ${Math.round(totalPct + newPct)}%.`,
                      variant: "destructive",
                    });
                    return;
                  }
                  addMutation.mutate();
                }}
              >
                {addMutation.isPending ? "Adding…" : "Add"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)} className="h-8 text-xs">Cancel</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading ownership…</div>
        ) : coOwners.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No ownership records yet. Add the first owner above.</div>
        ) : (
          <div className="divide-y divide-border">
            {coOwners.map((o: any) => (
              <div key={o.ownerId} className="flex items-center justify-between px-4 py-3 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-semibold flex-shrink-0">
                    {o.ownerName?.charAt(0) ?? "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/owners/${o.ownerId}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors truncate">
                        {o.ownerName}
                      </Link>
                      {o.isPrimary && (
                        <Badge className="h-4 text-[10px] px-1.5 bg-amber-100 text-amber-800 border-amber-200 gap-1">
                          <Star className="h-2.5 w-2.5" /> Primary
                        </Badge>
                      )}
                      {o.ownershipType && o.ownershipType !== "sole" && (
                        <Badge variant="outline" className="h-4 text-[10px] px-1.5 capitalize">
                          {o.ownershipType.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.email}
                      {o.notes && <span className="ml-2 italic opacity-70">· {o.notes}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {editingId === o.ownerId ? (
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} max={100} step={1} value={editPct}
                        onChange={e => setEditPct(e.target.value)}
                        className="w-16 h-7 text-xs" />
                      <span className="text-xs text-muted-foreground">%</span>
                      <select value={editOwnershipType} onChange={e => setEditOwnershipType(e.target.value)}
                        className="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none">
                        {OWNERSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <Button size="sm" className="h-7 text-xs px-2" onClick={() => updateMutation.mutate(o.ownerId)} disabled={updateMutation.isPending}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingId(null)}>✕</Button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(o.ownerId); setEditPct(String(o.ownershipPercentage)); setEditOwnershipType(o.ownershipType || ""); }}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors min-w-[48px] text-right">
                        {o.ownershipPercentage}%
                      </button>
                      {!o.isPrimary && (
                        <button onClick={() => setPrimaryMutation.mutate(o.ownerId)}
                          title="Set as primary" className="text-muted-foreground hover:text-amber-600 transition-colors">
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => removeMutation.mutate(o.ownerId)}
                        className="text-muted-foreground hover:text-red-600 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const propertyId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();

  const { data: property, isLoading: isPropLoading } = useGetProperty(propertyId);
  const { data: forecasts, isLoading: isForecastsLoading } = useListForecasts();

  // Fetch all amenity definitions (for score calc + editing)
  const { data: allAmenities = [] } = useQuery<Amenity[]>({
    queryKey: ["/api/amenities"],
    queryFn: async () => {
      const r = await fetch("/api/amenities");
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 5 * 60_000,
  });

  // Fetch this property's selected amenity IDs
  const { data: selectedIds = [] } = useQuery<number[]>({
    queryKey: ["/api/properties", propertyId, "amenities"],
    queryFn: async () => {
      const r = await fetch(`/api/properties/${propertyId}/amenities`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!propertyId,
  });

  // Edit property sheet state
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  // Edit amenities mode state
  const [editing, setEditing] = useState(false);
  const [draftIds, setDraftIds] = useState<number[]>([]);
  const [draftTags, setDraftTags] = useState<string[]>([]);

  const saveAmenities = useMutation({
    mutationFn: (ids: number[]) =>
      fetch(`/api/properties/${propertyId}/amenities`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ amenityIds: ids }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties", propertyId, "amenities"] });
      setEditing(false);
    },
  });

  const startEditing = () => {
    setDraftIds([...selectedIds]);
    setDraftTags([]);
    setEditing(true);
  };

  if (isPropLoading) return <div className="p-8 text-center text-muted-foreground">Loading property...</div>;
  if (!property) return <div className="p-8 text-center text-red-500">Property not found.</div>;

  const propertyForecasts = forecasts?.filter(f => f.propertyId === propertyId) || [];

  // Selected amenity objects
  const selectedAmenities = allAmenities.filter(a => selectedIds.includes(a.id));
  const scores = calculateScores(allAmenities, selectedIds);
  const hasAmenities = selectedAmenities.length > 0;

  // Group selected amenities by category for display
  const groupedSelected = selectedAmenities.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = [];
    acc[a.category].push(a);
    return acc;
  }, {} as Record<string, Amenity[]>);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/properties" className="hover:text-foreground transition-colors">Properties</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{property.projectBuilding || property.area}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
            {property.projectBuilding ? `${property.unitNumber ? property.unitNumber + ', ' : ''}${property.projectBuilding}` : property.area}
          </h1>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {property.area}, {property.emirate}</span>
            <span className="flex items-center gap-1.5 text-primary hover:underline">
              <Link href={`/owners/${property.ownerId}`}>{property.ownerName || 'View Owner'}</Link>
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setEditSheetOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit Property
          </Button>
          <Link href={`/forecasts/new?propertyId=${property.id}`} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <TrendingUp className="mr-2 h-4 w-4" /> New Forecast
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <div className="lg:col-span-2 space-y-6">

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/50 shadow-sm bg-muted/5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                <Home className="h-5 w-5 text-muted-foreground mb-2" />
                <span className="font-medium capitalize text-sm">{property.propertyType}</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-muted/5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                <div className="flex items-center gap-1 text-muted-foreground mb-2">
                  <span className="font-medium text-lg">{property.bedrooms}</span> Bed
                </div>
                <span className="font-medium text-sm text-muted-foreground">{property.bathrooms} Bath</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-muted/5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                <Ruler className="h-5 w-5 text-muted-foreground mb-2" />
                <span className="font-medium text-sm">{property.internalArea} sqft</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-muted/5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mb-2" />
                <span className="font-medium capitalize text-sm">{property.propertyCondition?.replace('_', ' ') || 'Condition Unknown'}</span>
              </CardContent>
            </Card>
          </div>

          {/* Ownership */}
          <OwnershipCard propertyId={propertyId} primaryOwnerId={property.ownerId} />

          {/* Additional Attributes */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/20 border-b border-border pb-4">
              <CardTitle className="text-base">Additional Attributes</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Furnishing Status</span>
                  <span className="font-medium capitalize">{property.furnishingStatus?.replace(/_/g, ' ') || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Primary View</span>
                  <span className="font-medium">{property.view || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Waterfront</span>
                  <span className="font-medium">{property.isWaterfront ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Private Pool</span>
                  <span className="font-medium">{property.hasPrivatePool ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Main Room</span>
                  <span className="font-medium">{(property as any).hasMainRoom ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Study Room</span>
                  <span className="font-medium">{(property as any).hasStudy ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Amenities & Property Features */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/20 border-b border-border pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <CardTitle className="text-base">Amenities &amp; Features</CardTitle>
                  {hasAmenities && (
                    <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4">
                      {selectedIds.length}
                    </Badge>
                  )}
                </div>
                {!editing ? (
                  <Button variant="ghost" size="sm" onClick={startEditing} className="h-7 text-xs gap-1.5">
                    <Pencil className="h-3 w-3" />
                    {hasAmenities ? "Edit Amenities" : "Add Amenities"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => setEditing(false)}
                      className="h-7 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveAmenities.mutate(draftIds)}
                      disabled={saveAmenities.isPending}
                      className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      {saveAmenities.isPending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {editing ? (
                <AmenitiesPicker
                  selectedIds={draftIds}
                  customTags={draftTags}
                  onChange={setDraftIds}
                  onCustomTagsChange={setDraftTags}
                />
              ) : hasAmenities ? (
                <div className="space-y-4">
                  {/* Scores */}
                  <PropertyScoresPanel scores={scores} />

                  {/* Grouped chips */}
                  <div className="space-y-3 mt-4">
                    {Object.entries(groupedSelected).map(([cat, items]) => (
                      <div key={cat}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{cat}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map(a => (
                            <span
                              key={a.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                                         bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300
                                         border border-amber-200 dark:border-amber-800/40"
                            >
                              <span>{a.icon}</span> {a.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium mb-1">No amenities recorded</p>
                  <p className="text-xs mb-4">Adding amenities improves AI forecasting accuracy and enriches owner proposals.</p>
                  <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5 text-xs">
                    <Pencil className="h-3 w-3" /> Add Amenities
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Forecast History sidebar */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm border-border/50 h-full">
            <CardHeader className="bg-muted/20 border-b border-border">
              <CardTitle className="text-base">Forecast History</CardTitle>
              <CardDescription>Projections for this specific unit</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isForecastsLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading...</div>
              ) : propertyForecasts.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No forecasts generated yet.</p>
                  <Link href={`/forecasts/new?propertyId=${property.id}`} className="text-primary text-sm font-medium hover:underline">
                    Create the first forecast
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {propertyForecasts.map(forecast => (
                    <div key={forecast.id} className="p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <Link href={`/forecasts/${forecast.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                          {forecast.referenceNumber}
                        </Link>
                        <Badge variant="outline" className="text-[10px] uppercase bg-background">
                          {forecast.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="text-sm">
                          <span className="text-muted-foreground block text-xs mb-0.5">Net Income</span>
                          <span className="font-medium">{forecast.netOwnerIncome ? `AED ${forecast.netOwnerIncome.toLocaleString()}` : '-'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(forecast.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Property Sheet */}
      <EditPropertySheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        property={property}
      />
    </div>
  );
}
