import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Pencil,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Loader2,
  GripVertical,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Amenity {
  id: number;
  category: string;
  name: string;
  icon: string;
  description?: string | null;
  adrBoost: number;
  occupancyBoost: number;
  luxuryScore: number;
  guestAppealScore: number;
  familyScore: number;
  corporateScore: number;
  holidayHomeScore: number;
  isProposalHighlight: boolean;
  seoKeyword?: string | null;
  sortOrder: number;
  isActive: boolean;
}

// ── Form schema ───────────────────────────────────────────────────────────────
const amenitySchema = z.object({
  category: z.string().min(1, "Category is required"),
  name: z.string().min(1, "Name is required"),
  icon: z.string().default("✓"),
  description: z.string().optional(),
  adrBoost: z.coerce.number().default(0),
  occupancyBoost: z.coerce.number().default(0),
  luxuryScore: z.coerce.number().int().default(0),
  guestAppealScore: z.coerce.number().int().default(0),
  familyScore: z.coerce.number().int().default(0),
  corporateScore: z.coerce.number().int().default(0),
  holidayHomeScore: z.coerce.number().int().default(0),
  isProposalHighlight: z.boolean().default(false),
  seoKeyword: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

type AmenityFormValues = z.infer<typeof amenitySchema>;

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const fetchAllAmenities = (): Promise<Amenity[]> =>
  apiFetch("/api/amenities?all=1");

const createAmenity = (data: AmenityFormValues): Promise<Amenity> =>
  apiFetch("/api/amenities", { method: "POST", body: JSON.stringify(data) });

const updateAmenity = (id: number, data: Partial<AmenityFormValues> & { isActive?: boolean }): Promise<Amenity> =>
  apiFetch(`/api/amenities/${id}`, { method: "PATCH", body: JSON.stringify(data) });

// ── Score field config ────────────────────────────────────────────────────────
const SCORE_FIELDS: { key: keyof AmenityFormValues; label: string }[] = [
  { key: "luxuryScore",      label: "Luxury" },
  { key: "guestAppealScore", label: "Guest Appeal" },
  { key: "familyScore",      label: "Family" },
  { key: "corporateScore",   label: "Corporate" },
  { key: "holidayHomeScore", label: "Holiday Home" },
];

// ── AmenityDialog ─────────────────────────────────────────────────────────────
interface AmenityDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  amenity?: Amenity | null;
  existingCategories: string[];
  onSaved: () => void;
}

function AmenityDialog({ open, onOpenChange, amenity, existingCategories, onSaved }: AmenityDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(amenity);

  const form = useForm<AmenityFormValues>({
    resolver: zodResolver(amenitySchema),
    defaultValues: amenity
      ? {
          category: amenity.category,
          name: amenity.name,
          icon: amenity.icon,
          description: amenity.description ?? "",
          adrBoost: amenity.adrBoost,
          occupancyBoost: amenity.occupancyBoost,
          luxuryScore: amenity.luxuryScore,
          guestAppealScore: amenity.guestAppealScore,
          familyScore: amenity.familyScore,
          corporateScore: amenity.corporateScore,
          holidayHomeScore: amenity.holidayHomeScore,
          isProposalHighlight: amenity.isProposalHighlight,
          seoKeyword: amenity.seoKeyword ?? "",
          sortOrder: amenity.sortOrder,
        }
      : {
          category: "",
          name: "",
          icon: "✓",
          description: "",
          adrBoost: 0,
          occupancyBoost: 0,
          luxuryScore: 0,
          guestAppealScore: 0,
          familyScore: 0,
          corporateScore: 0,
          holidayHomeScore: 0,
          isProposalHighlight: false,
          seoKeyword: "",
          sortOrder: 0,
        },
  });

  // Reset when dialog opens/closes or amenity changes
  const handleOpenChange = useCallback((o: boolean) => {
    if (!o) form.reset();
    onOpenChange(o);
  }, [form, onOpenChange]);

  // Keep form in sync when amenity prop changes
  useState(() => {
    if (amenity) {
      form.reset({
        category: amenity.category,
        name: amenity.name,
        icon: amenity.icon,
        description: amenity.description ?? "",
        adrBoost: amenity.adrBoost,
        occupancyBoost: amenity.occupancyBoost,
        luxuryScore: amenity.luxuryScore,
        guestAppealScore: amenity.guestAppealScore,
        familyScore: amenity.familyScore,
        corporateScore: amenity.corporateScore,
        holidayHomeScore: amenity.holidayHomeScore,
        isProposalHighlight: amenity.isProposalHighlight,
        seoKeyword: amenity.seoKeyword ?? "",
        sortOrder: amenity.sortOrder,
      });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (data: AmenityFormValues) => {
      if (isEdit && amenity) return updateAmenity(amenity.id, data);
      return createAmenity(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amenities-admin"] });
      toast({ title: isEdit ? "Amenity updated" : "Amenity created" });
      handleOpenChange(false);
      onSaved();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save amenity.", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {isEdit ? "Edit Amenity" : "New Amenity"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((data) => saveMutation.mutate(data))}
          className="space-y-5 pt-2"
        >
          {/* Category + Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Input
                {...form.register("category")}
                list="category-suggestions"
                placeholder="e.g. Kitchen, Pool, Safety"
              />
              <datalist id="category-suggestions">
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {form.formState.errors.category && (
                <p className="text-xs text-destructive">{form.formState.errors.category.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input {...form.register("name")} placeholder="e.g. Coffee Machine" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
          </div>

          {/* Icon + SEO keyword */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Icon (emoji or symbol)</Label>
              <Input {...form.register("icon")} placeholder="☕" />
            </div>
            <div className="space-y-1.5">
              <Label>SEO Keyword</Label>
              <Input {...form.register("seoKeyword")} placeholder="e.g. coffee-machine" />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...form.register("description")} placeholder="Short description for proposals" />
          </div>

          {/* Boost fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ADR Boost (%)</Label>
              <Input type="number" step="0.01" {...form.register("adrBoost")} />
            </div>
            <div className="space-y-1.5">
              <Label>Occupancy Boost (%)</Label>
              <Input type="number" step="0.01" {...form.register("occupancyBoost")} />
            </div>
          </div>

          {/* Score fields */}
          <div>
            <Label className="mb-2 block text-sm font-medium">Scores (0–100)</Label>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {SCORE_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    {...form.register(key)}
                    className="h-8 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sort order + Proposal highlight */}
          <div className="grid grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <Label>Sort Order</Label>
              <Input type="number" {...form.register("sortOrder")} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="proposalHighlight"
                checked={form.watch("isProposalHighlight")}
                onCheckedChange={(v) => form.setValue("isProposalHighlight", Boolean(v))}
              />
              <Label htmlFor="proposalHighlight" className="cursor-pointer">
                Show on proposal highlights
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Amenity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── AmenityRow ────────────────────────────────────────────────────────────────
interface AmenityRowProps {
  amenity: Amenity;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (a: Amenity) => void;
  onToggleActive: (a: Amenity) => void;
  onMove: (a: Amenity, direction: "up" | "down") => void;
  isToggling: boolean;
  isMoving: boolean;
}

function AmenityRow({ amenity, isFirst, isLast, onEdit, onToggleActive, onMove, isToggling, isMoving }: AmenityRowProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/40 last:border-0 transition-colors ${
        amenity.isActive ? "bg-background hover:bg-muted/30" : "bg-muted/20 opacity-60 hover:bg-muted/40"
      }`}
    >
      {/* Drag handle (visual only) */}
      <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />

      {/* Icon */}
      <span className="text-xl w-7 text-center flex-shrink-0">{amenity.icon}</span>

      {/* Name + keyword */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{amenity.name}</p>
        {amenity.seoKeyword && (
          <p className="text-xs text-muted-foreground truncate">{amenity.seoKeyword}</p>
        )}
      </div>

      {/* Boost badges */}
      <div className="hidden md:flex gap-1.5 flex-shrink-0">
        {amenity.adrBoost !== 0 && (
          <Badge variant="secondary" className="text-xs font-mono">
            ADR +{amenity.adrBoost}%
          </Badge>
        )}
        {amenity.occupancyBoost !== 0 && (
          <Badge variant="secondary" className="text-xs font-mono">
            Occ +{amenity.occupancyBoost}%
          </Badge>
        )}
        {amenity.isProposalHighlight && (
          <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50">
            Highlight
          </Badge>
        )}
      </div>

      {/* Reorder arrows */}
      <div className="flex flex-col gap-0 flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          disabled={isFirst || isMoving}
          onClick={() => onMove(amenity, "up")}
          title="Move up"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          disabled={isLast || isMoving}
          onClick={() => onMove(amenity, "down")}
          title="Move down"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-1.5 flex-shrink-0" title={amenity.isActive ? "Active" : "Inactive"}>
        {isToggling ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Switch
            checked={amenity.isActive}
            onCheckedChange={() => onToggleActive(amenity)}
            className="scale-75"
          />
        )}
      </div>

      {/* Edit button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={() => onEdit(amenity)}
        title="Edit amenity"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── CategoryGroup ─────────────────────────────────────────────────────────────
interface CategoryGroupProps {
  category: string;
  amenities: Amenity[];
  onEdit: (a: Amenity) => void;
  onToggleActive: (a: Amenity) => void;
  onMove: (a: Amenity, direction: "up" | "down") => void;
  togglingId: number | null;
  movingId: number | null;
}

function CategoryGroup({ category, amenities, onEdit, onToggleActive, onMove, togglingId, movingId }: CategoryGroupProps) {
  const [open, setOpen] = useState(true);
  const activeCount = amenities.filter((a) => a.isActive).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border border-border/50 rounded-lg overflow-hidden shadow-sm">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors border-b border-border/30">
          <div className="flex items-center gap-3">
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
            <span className="font-medium text-sm">{category}</span>
            <Badge variant="secondary" className="text-xs">
              {activeCount}/{amenities.length}
            </Badge>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="divide-y divide-border/30">
          {amenities.map((amenity, idx) => (
            <AmenityRow
              key={amenity.id}
              amenity={amenity}
              isFirst={idx === 0}
              isLast={idx === amenities.length - 1}
              onEdit={onEdit}
              onToggleActive={onToggleActive}
              onMove={onMove}
              isToggling={togglingId === amenity.id}
              isMoving={movingId === amenity.id}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Main AmenitiesTab ─────────────────────────────────────────────────────────
export function AmenitiesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<Amenity | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: amenities = [], isLoading } = useQuery<Amenity[]>({
    queryKey: ["amenities-admin"],
    queryFn: fetchAllAmenities,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      updateAmenity(id, { isActive }),
    onMutate: ({ id }) => setTogglingId(id),
    onSettled: () => setTogglingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amenities-admin"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update amenity.", variant: "destructive" });
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ amenity, direction, sibling }: { amenity: Amenity; direction: "up" | "down"; sibling: Amenity }) => {
      // Swap sort orders
      await Promise.all([
        updateAmenity(amenity.id, { sortOrder: sibling.sortOrder }),
        updateAmenity(sibling.id, { sortOrder: amenity.sortOrder }),
      ]);
    },
    onMutate: ({ amenity }) => setMovingId(amenity.id),
    onSettled: () => setMovingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["amenities-admin"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to reorder amenity.", variant: "destructive" });
    },
  });

  const handleToggle = useCallback((a: Amenity) => {
    toggleMutation.mutate({ id: a.id, isActive: !a.isActive });
  }, [toggleMutation]);

  const handleMove = useCallback((amenity: Amenity, direction: "up" | "down") => {
    // Find siblings in same category
    const siblings = amenities
      .filter((a) => a.category === amenity.category)
      .sort((x, y) => x.sortOrder - y.sortOrder || x.name.localeCompare(y.name));

    const idx = siblings.findIndex((a) => a.id === amenity.id);
    const siblingIdx = direction === "up" ? idx - 1 : idx + 1;
    if (siblingIdx < 0 || siblingIdx >= siblings.length) return;

    const sibling = siblings[siblingIdx];

    // If sort orders are the same, assign distinct ones first
    if (amenity.sortOrder === sibling.sortOrder) {
      const base = amenity.sortOrder;
      moveMutation.mutate({
        amenity: { ...amenity, sortOrder: direction === "up" ? base + 1 : base - 1 },
        direction,
        sibling: { ...sibling, sortOrder: direction === "up" ? base : base },
      });
    } else {
      moveMutation.mutate({ amenity, direction, sibling });
    }
  }, [amenities, moveMutation]);

  const handleEdit = useCallback((a: Amenity) => {
    setEditingAmenity(a);
    setDialogOpen(true);
  }, []);

  const handleNew = useCallback(() => {
    setEditingAmenity(null);
    setDialogOpen(true);
  }, []);

  // Group and filter
  const filtered = search.trim()
    ? amenities.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.category.toLowerCase().includes(search.toLowerCase()),
      )
    : amenities;

  const grouped = filtered.reduce<Record<string, Amenity[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  // Sort categories alphabetically
  const categories = Object.keys(grouped).sort();

  const existingCategories = [...new Set(amenities.map((a) => a.category))].sort();

  const totalActive = amenities.filter((a) => a.isActive).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading amenities…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {totalActive} active · {amenities.length} total · {categories.length} categories
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search amenities…"
            className="w-48 h-8 text-sm"
          />
          <Button size="sm" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-1" />
            Add Amenity
          </Button>
        </div>
      </div>

      {/* Category groups */}
      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {search ? "No amenities match your search." : "No amenities yet. Add the first one."}
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <CategoryGroup
              key={cat}
              category={cat}
              amenities={grouped[cat].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))}
              onEdit={handleEdit}
              onToggleActive={handleToggle}
              onMove={handleMove}
              togglingId={togglingId}
              movingId={movingId}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      <AmenityDialog
        key={editingAmenity?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        amenity={editingAmenity}
        existingCategories={existingCategories}
        onSaved={() => {
          setEditingAmenity(null);
        }}
      />
    </div>
  );
}
