import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, Copy, User, Home, ChevronRight, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import {
  useListOwners, useListProperties,
} from "@workspace/api-client-react";
import type { Forecast } from "@workspace/api-client-react";

interface Props {
  forecast: Forecast;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function DuplicateForecastModal({ forecast, open, onOpenChange }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: owners,     isLoading: ownersLoading }  = useListOwners();
  const { data: properties, isLoading: propsLoading }   = useListProperties();

  const duplicate = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, number> }) => {
      const res = await fetch(`/api/forecasts/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<Forecast>;
    },
  });

  // Start with the original owner/property pre-selected
  const [selectedOwnerId,    setSelectedOwnerId]    = useState<number | null>(forecast.ownerId ?? null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(forecast.propertyId ?? null);

  // When owner changes, clear property only if the new owner doesn't own the current one
  function handleOwnerChange(val: string) {
    const id = Number(val);
    setSelectedOwnerId(id);
    const currentPropOwner = properties?.find(p => p.id === selectedPropertyId)?.ownerId;
    if (currentPropOwner !== id) setSelectedPropertyId(null);
  }

  const ownerOptions = useMemo(() =>
    (owners ?? []).map(o => ({
      value: String(o.id),
      label: o.ownerType === "company" && o.companyName
        ? o.companyName
        : [o.titlePrefix, o.firstName, o.lastName].filter(Boolean).join(" "),
    })), [owners]);

  const propertyOptions = useMemo(() => {
    const base = selectedOwnerId
      ? (properties ?? []).filter(p => p.ownerId === selectedOwnerId)
      : (properties ?? []);
    return base.map(p => ({
      value: String(p.id),
      label: [p.unitNumber, p.projectBuilding, p.area].filter(Boolean).join(", "),
    }));
  }, [properties, selectedOwnerId]);

  // Resolve display names for current original values
  const origOwnerLabel = useMemo(() => {
    if (!forecast.ownerId || !owners) return "—";
    const o = owners.find(x => x.id === forecast.ownerId);
    if (!o) return "—";
    return o.ownerType === "company" && o.companyName
      ? o.companyName
      : [o.titlePrefix, o.firstName, o.lastName].filter(Boolean).join(" ");
  }, [owners, forecast.ownerId]);

  const origPropertyLabel = useMemo(() => {
    if (!forecast.propertyId || !properties) return "—";
    const p = properties.find(x => x.id === forecast.propertyId);
    if (!p) return "—";
    return [p.unitNumber, p.projectBuilding, p.area].filter(Boolean).join(", ");
  }, [properties, forecast.propertyId]);

  const ownerChanged    = selectedOwnerId    !== (forecast.ownerId    ?? null);
  const propertyChanged = selectedPropertyId !== (forecast.propertyId ?? null);

  async function handleDuplicate() {
    try {
      const body: Record<string, number> = {};
      if (selectedOwnerId    !== null) body.ownerId    = selectedOwnerId;
      if (selectedPropertyId !== null) body.propertyId = selectedPropertyId;

      const newForecast = await duplicate.mutateAsync({ id: forecast.id, body });

      toast({
        title: "Forecast duplicated",
        description: `${newForecast.referenceNumber} created as a draft. Update inputs and recalculate.`,
      });
      onOpenChange(false);
      setLocation(`/forecasts/${newForecast.id}`);
    } catch {
      toast({ title: "Duplicate failed", description: "Please try again.", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-primary" />
            Duplicate Forecast
          </DialogTitle>
          <DialogDescription>
            Creates a draft copy of <strong>{forecast.referenceNumber}</strong> with all inputs, scenarios, and comparables preserved.
            Reassign the owner or property below, then save &amp; recalculate.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Original reference */}
          <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-sm space-y-1">
            <p className="font-medium text-foreground">{forecast.referenceNumber}</p>
            <p className="text-muted-foreground">{origOwnerLabel} · {origPropertyLabel}</p>
          </div>

          {/* Owner selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <User className="h-4 w-4 text-muted-foreground" />
                Owner
                {ownerChanged && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Changed</Badge>}
              </label>
              <a
                href="/owners/new"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> New owner
              </a>
            </div>
            <SearchableSelect
              options={ownerOptions}
              value={selectedOwnerId !== null ? String(selectedOwnerId) : ""}
              onChange={handleOwnerChange}
              placeholder={ownersLoading ? "Loading owners…" : "Search owners…"}
            />
          </div>

          {/* Property selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Home className="h-4 w-4 text-muted-foreground" />
                Property
                {propertyChanged && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Changed</Badge>}
              </label>
              {selectedOwnerId && (
                <a
                  href={`/properties/new?ownerId=${selectedOwnerId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> New property
                </a>
              )}
            </div>
            <SearchableSelect
              options={propertyOptions}
              value={selectedPropertyId !== null ? String(selectedPropertyId) : ""}
              onChange={v => setSelectedPropertyId(v ? Number(v) : null)}
              placeholder={
                propsLoading              ? "Loading…"
                : !selectedOwnerId        ? "Select an owner first…"
                : propertyOptions.length === 0 ? "No properties for this owner"
                : "Search properties…"
              }
              disabled={!selectedOwnerId || propertyOptions.length === 0}
            />
            {selectedOwnerId && propertyOptions.length === 0 && !propsLoading && (
              <p className="text-xs text-muted-foreground">
                No properties found for this owner.{" "}
                <a href={`/properties/new?ownerId=${selectedOwnerId}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Add one first.
                </a>
              </p>
            )}
          </div>

          {/* What gets copied notice */}
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2.5 text-xs text-blue-700 space-y-1">
            <p className="font-medium">What gets copied</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600">
              <li>All financial inputs (LTR, ADR, costs)</li>
              <li>Conservative / Realistic / Optimistic scenarios</li>
              <li>Monthly projections &amp; overrides</li>
              <li>Comparable listings</li>
            </ul>
            <p className="pt-1">The new forecast opens as <strong>Draft</strong> — run <em>Save &amp; Calculate</em> to generate fresh projections.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleDuplicate}
            disabled={duplicate.isPending}
            className="gap-2"
          >
            {duplicate.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><Copy className="h-4 w-4" /> Duplicate &amp; Open<ChevronRight className="h-4 w-4 -ml-1" /></>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
