import { useListProperties } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Search, MapPin, Home, MoreHorizontal, X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { usePermission } from "@/hooks/usePermission";
import { DataTable, ColumnDef } from "@/components/DataTable";

const BEDROOM_OPTIONS = [
  { label: "Any", value: "all" },
  { label: "Studio", value: "0" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5+", value: "5+" },
];

const PROPERTY_TYPES = ["all", "apartment", "villa", "townhouse", "penthouse", "duplex", "studio"];
const FURNISHING_OPTIONS = ["all", "furnished", "unfurnished", "partially_furnished"];

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

function NumBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-9 rounded-lg text-sm font-medium border transition-all
        ${active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-foreground border-border hover:border-primary/50"
        }`}
    >
      {children}
    </button>
  );
}

type PropertyRow = NonNullable<ReturnType<typeof useListProperties>["data"]>[number];

const PROPERTY_COLUMNS: ColumnDef<PropertyRow>[] = [
  {
    key: "location",
    label: "Location",
    description: "Building, unit number, area and emirate",
    render: (p) => (
      <Link href={`/properties/${p.id}`} className="block">
        <div className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          {p.projectBuilding
            ? `${p.unitNumber ? p.unitNumber + ", " : ""}${p.projectBuilding}`
            : p.area}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 ml-6">{p.area}, {p.emirate}</div>
      </Link>
    ),
    exportValue: (p) => p.projectBuilding
      ? `${p.unitNumber ? p.unitNumber + ", " : ""}${p.projectBuilding}, ${p.area}`
      : `${p.area}, ${p.emirate}`,
    minWidth: "min-w-[180px]",
  },
  {
    key: "details",
    label: "Type & Size",
    description: "Bedroom count, property type, and internal area",
    render: (p) => (
      <div>
        <div className="flex items-center gap-2">
          <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="capitalize">
            {p.bedrooms === 0 ? "Studio" : `${p.bedrooms} Bed`} {p.propertyType}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 ml-5">
          {p.internalArea ? `${p.internalArea.toLocaleString()} sqft` : "—"}
        </div>
      </div>
    ),
    exportValue: (p) => `${p.bedrooms === 0 ? "Studio" : `${p.bedrooms} Bed`} ${p.propertyType ?? ""}`.trim(),
  },
  {
    key: "owner",
    label: "Owner",
    description: "Property owner name",
    render: (p) => (
      <Link href={`/owners/${p.ownerId}`} className="text-foreground hover:text-primary hover:underline">
        {p.ownerName || `Owner #${p.ownerId}`}
      </Link>
    ),
    exportValue: (p) => p.ownerName ?? `Owner #${p.ownerId}`,
  },
  {
    key: "area",
    label: "Area",
    description: "Community or neighbourhood",
    defaultVisible: false,
    render: (p) => <span className="text-sm text-muted-foreground">{p.area || "—"}</span>,
    exportValue: (p) => p.area ?? "",
  },
  {
    key: "emirate",
    label: "Emirate",
    description: "Emirate where the property is located",
    defaultVisible: false,
    render: (p) => <span className="text-sm text-muted-foreground capitalize">{p.emirate || "—"}</span>,
    exportValue: (p) => p.emirate ?? "",
  },
  {
    key: "bedrooms",
    label: "Bedrooms",
    description: "Number of bedrooms",
    defaultVisible: false,
    render: (p) => <span className="text-sm">{p.bedrooms === 0 ? "Studio" : (p.bedrooms ?? "—")}</span>,
    exportValue: (p) => p.bedrooms === 0 ? "Studio" : (p.bedrooms?.toString() ?? ""),
  },
  {
    key: "internalArea",
    label: "Size (sqft)",
    description: "Internal area in square feet",
    defaultVisible: false,
    render: (p) => <span className="text-sm">{p.internalArea ? p.internalArea.toLocaleString() : "—"}</span>,
    exportValue: (p) => p.internalArea ?? "",
  },
  {
    key: "furnishing",
    label: "Furnishing",
    description: "Furnished, unfurnished, or partially furnished",
    render: (p) => p.furnishingStatus ? (
      <Badge variant="outline" className="capitalize text-[10px] bg-background">
        {p.furnishingStatus.replace(/_/g, " ")}
      </Badge>
    ) : <span className="text-muted-foreground">—</span>,
    exportValue: (p) => p.furnishingStatus?.replace(/_/g, " ") ?? "",
  },
  {
    key: "condition",
    label: "Condition",
    description: "Property condition (new, good, fair, etc.)",
    render: (p) => p.propertyCondition ? (
      <Badge variant="outline" className="capitalize text-[10px] bg-background">
        {p.propertyCondition.replace(/_/g, " ")}
      </Badge>
    ) : <span className="text-muted-foreground">—</span>,
    exportValue: (p) => p.propertyCondition?.replace(/_/g, " ") ?? "",
  },
];

export default function PropertiesList() {
  const { data: properties, isLoading } = useListProperties();
  const canCreateProperty = usePermission("properties.create");
  const canCreateForecast = usePermission("forecasts.create");

  const [search, setSearch] = useState("");
  const [emirate, setEmirate] = useState("all");
  const [propertyType, setPropertyType] = useState("all");
  const [bedrooms, setBedrooms] = useState("all");
  const [furnishing, setFurnishing] = useState("all");
  const [areaMin, setAreaMin] = useState("");
  const [areaMax, setAreaMax] = useState("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const emirates = useMemo(() => {
    const set = new Set<string>();
    properties?.forEach(p => { if (p.emirate) set.add(p.emirate); });
    return ["all", ...Array.from(set).sort()];
  }, [properties]);

  const activeFilterCount = useMemo(() => [
    emirate !== "all",
    propertyType !== "all",
    bedrooms !== "all",
    furnishing !== "all",
    !!areaMin || !!areaMax,
  ].filter(Boolean).length, [emirate, propertyType, bedrooms, furnishing, areaMin, areaMax]);

  const filteredProperties = useMemo(() => properties?.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      const haystack = `${p.area} ${p.projectBuilding || ""} ${p.ownerName || ""} ${p.unitNumber || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (emirate !== "all" && p.emirate !== emirate) return false;
    if (propertyType !== "all" && (p.propertyType?.toLowerCase() !== propertyType)) return false;
    if (bedrooms !== "all") {
      if (bedrooms === "5+" && (p.bedrooms ?? 0) < 5) return false;
      if (bedrooms !== "5+" && String(p.bedrooms) !== bedrooms) return false;
    }
    if (furnishing !== "all" && p.furnishingStatus !== furnishing) return false;
    if (areaMin && (p.internalArea ?? 0) < Number(areaMin)) return false;
    if (areaMax && (p.internalArea ?? 0) > Number(areaMax)) return false;
    return true;
  }), [properties, search, emirate, propertyType, bedrooms, furnishing, areaMin, areaMax]);

  function clearAll() {
    setSearch(""); setEmirate("all"); setPropertyType("all"); setBedrooms("all");
    setFurnishing("all"); setAreaMin(""); setAreaMax("");
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (emirate !== "all") activeChips.push({ label: emirate, clear: () => setEmirate("all") });
  if (propertyType !== "all") activeChips.push({ label: propertyType.replace("_", " "), clear: () => setPropertyType("all") });
  if (bedrooms !== "all") activeChips.push({ label: bedrooms === "0" ? "Studio" : `${bedrooms} Bed`, clear: () => setBedrooms("all") });
  if (furnishing !== "all") activeChips.push({ label: furnishing.replace("_", " "), clear: () => setFurnishing("all") });
  if (areaMin || areaMax) activeChips.push({ label: `${areaMin || "0"}–${areaMax || "∞"} sqft`, clear: () => { setAreaMin(""); setAreaMax(""); } });

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Properties</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage the portfolio of actual and prospective units.</p>
        </div>
        {canCreateProperty && (
          <Link href="/properties/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Property
          </Link>
        )}
      </div>

      <Card className="border-border/50 shadow-sm">
        <div className="p-4 border-b border-border space-y-3 bg-muted/20">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search area, building, or owner..."
                className="pl-9 bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 h-10 ${showMoreFilters ? "border-primary text-primary" : ""}`}
              onClick={() => setShowMoreFilters(v => !v)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              More Filters
              {activeFilterCount > 0 && (
                <Badge className="h-5 w-5 p-0 text-[10px] flex items-center justify-center rounded-full bg-primary text-primary-foreground ml-0.5">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMoreFilters ? "rotate-180" : ""}`} />
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" className="h-10 text-muted-foreground hover:text-foreground gap-1.5" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear all
              </Button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {emirates.map(em => (
              <Chip key={em} active={emirate === em} onClick={() => setEmirate(em)}>
                {em === "all" ? "All Emirates" : em}
              </Chip>
            ))}
          </div>

          {showMoreFilters && (
            <div className="rounded-xl border border-border bg-background p-5 space-y-5 shadow-sm">
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Property Type</p>
                <div className="flex flex-wrap gap-2">
                  {PROPERTY_TYPES.map(t => (
                    <Chip key={t} active={propertyType === t} onClick={() => setPropertyType(t)}>
                      {t === "all" ? "All Types" : t.charAt(0).toUpperCase() + t.slice(1).replace("_", " ")}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bedrooms</p>
                <div className="flex gap-2 flex-wrap">
                  {BEDROOM_OPTIONS.map(opt => (
                    <NumBtn key={opt.value} active={bedrooms === opt.value} onClick={() => setBedrooms(opt.value)}>
                      {opt.label}
                    </NumBtn>
                  ))}
                </div>
              </div>
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal Area (sqft)</p>
                <div className="flex items-center gap-3 max-w-sm">
                  <Input type="number" placeholder="Min. sqft" className="text-sm" value={areaMin} onChange={e => setAreaMin(e.target.value)} />
                  <span className="text-muted-foreground">—</span>
                  <Input type="number" placeholder="Max. sqft" className="text-sm" value={areaMax} onChange={e => setAreaMax(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Furnishing</p>
                <div className="flex flex-wrap gap-2">
                  {FURNISHING_OPTIONS.map(f => (
                    <Chip key={f} active={furnishing === f} onClick={() => setFurnishing(f)}>
                      {f === "all" ? "Any" : f.replace("_", " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

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

        <div className="px-6 py-2.5 border-b border-border/50 bg-muted/10 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredProperties?.length ?? 0}</span> of{" "}
            <span className="font-semibold text-foreground">{properties?.length ?? 0}</span> properties
          </p>
        </div>

        <CardContent className="p-0">
          <DataTable
            id="properties"
            columns={PROPERTY_COLUMNS}
            data={filteredProperties}
            isLoading={isLoading}
            rowKey={p => p.id}
            exportFileName="Properties"
            emptyState={
              <div>
                <Home className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-foreground">No properties match your filters</p>
                <p className="text-sm mt-1">Try adjusting your search or clearing some filters.</p>
                {activeFilterCount > 0 && (
                  <Button variant="link" className="mt-2 text-primary" onClick={clearAll}>Clear all filters</Button>
                )}
              </div>
            }
            actions={property => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/properties/${property.id}`}>View Property</Link>
                  </DropdownMenuItem>
                  {canCreateForecast && (
                    <DropdownMenuItem asChild>
                      <Link href={`/forecasts/new?propertyId=${property.id}`}>Create Forecast</Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
