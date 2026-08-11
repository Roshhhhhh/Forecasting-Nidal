import { useCreateProperty, useListOwners } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState, useCallback } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AmenitiesPicker } from "@/components/AmenitiesPicker";
import { ForecastRequestContextBar } from "@/components/ForecastRequestContextBar";

const UAE_EMIRATES = [
  { value: "Abu Dhabi",      group: "Abu Dhabi Emirate" },
  { value: "Al Ain",         group: "Abu Dhabi Emirate" },
  { value: "Dubai",          group: "Other Emirates" },
  { value: "Sharjah",        group: "Other Emirates" },
  { value: "Ajman",          group: "Other Emirates" },
  { value: "Umm Al Quwain",  group: "Other Emirates" },
  { value: "Ras Al Khaimah", group: "Other Emirates" },
  { value: "Fujairah",       group: "Other Emirates" },
  { value: "Other",          group: "Other Emirates" },
];

const ABU_DHABI_AREAS = [
  "Al Reem Island",
  "Yas Island",
  "Saadiyat Island",
  "Al Maryah Island",
  "Al Raha Beach",
  "Corniche",
  "Downtown Abu Dhabi",
  "Al Khalidiyah",
  "Al Manhal",
  "Al Mushrif",
  "Khalifa City",
  "Al Reef",
  "Masdar City",
  "Rabdan",
  "Al Hudairiyat Island",
  "Al Jubail Island",
  "Al Fahid Island",
  "Bani Yas",
  "Al Shamkha",
  "Al Falah",
  "Mohammed Bin Zayed City",
  "Al Karamah",
  "Madinat Zayed",
  "Al Wahda",
  "Al Danah",
  "Al Rawdah",
  "Al Bateen",
  "Al Musalla",
  "Tourist Club Area",
  "Al Nahyan",
  "Al Muroor",
  "Al Zaab",
  "Hamdan Street",
  "Electra Street",
  "Other",
];

const AL_AIN_AREAS = [
  "Al Ain City Centre",
  "Al Jimi",
  "Al Muwaiji",
  "Al Mutawaa",
  "Al Ain Industrial Area",
  "Al Hili",
  "Al Jahili",
  "Al Khabisi",
  "Al Markhaniya",
  "Al Maqam",
  "Al Sarouj",
  "Al Yahar",
  "Zakher",
  "Mezyad",
  "Al Ain Oasis",
  "Other",
];

// All known communities / projects in Abu Dhabi (shown to users as a searchable dropdown)
const ABU_DHABI_COMMUNITIES = [
  "Waters Edge",
  "ANSAM",
  "MAYAN",
  "Gardenia Bay",
  "Sama Yas",
  "Yas Golf Collection",
  "Yas Acres",
  "Noya",
  "Yas Riva",
  "Yas Park Gate",
  "West Yas",
  "Yas Living",
  "Saadiyat Bay",
  "Branded Residences by Ghana",
  "Al Deem Townhomes",
  "Diva",
  "Perla 1",
  "Perla 2",
  "Perla 3",
  "Selina Bay",
  "Bab Al Qasr Residence 25",
  "Bab Al Qasr Residence 31",
  "The Icon",
  "Sea La Vie",
  "The Bay Residences 1",
  "The Bay Residences 2",
  "Al Zeina Island",
  "Al Muneira Island",
  "Al Bandar Island",
  "Al Hadeel",
  "Raha Gardens",
  "Golf Gardens",
  "Loft 1",
  "Lofts 2",
  "Bab Al Qasr Residence 22",
  "Brabus Island",
  "Leonardo",
  "Oasis 1",
  "Oasis 2",
  "The Gate",
  "Plaza 1",
  "Plaza 2",
  "Royal Park",
  "Ville 11",
  "Ville 12",
  "Bab Al Qasr 18",
  "Bab Al Qasr 19",
  "Bab Al Qasr 46",
  "Mahra",
  "Vista 1",
  "Vista 2",
  "Reportage Tower",
  "V Residence",
  "St. Regis the Residence",
  "Mamsha",
  "Nuhu",
  "The Arc",
  "Mandarin Oriental",
  "The Source",
  "The Source 2",
  "The Arthouse",
  "Louvre",
  "Manaret Living 1",
  "Manaret Living 2",
  "Nouran Living",
  "Lagoons",
  "Jawaher",
  "Wadi Saadiyat",
  "Reserve",
  "Soho Square",
  "Park View",
  "Alyasa Village",
  "Soley",
  "Miran",
  "Vida",
  "Reeman Living",
  "Fay Al Reeman 1",
  "Fay Al Reeman 2",
  "Bloom Living",
  "Reef Downtown",
  "Reef Villas",
  "Sun & Sky Towers",
  "Mangrove Place",
  "Sas 1 to 14",
  "Hydra Avenue C1 to C6",
  "Marina Bay 1",
  "Marina Bay 2",
  "Sigma Tower",
  "Raahen Residence",
  "Reflection",
  "Beach Tower",
  "Ocean Scape",
  "Silkhaus",
  "Horizons",
  "Tala Island",
  "Yasmina Tower",
  "Amaya Tower",
  "Shams Meer",
  "Parkside",
  "The Kite",
  "Azure",
  "Ocean Terrace",
  "Tala Tower",
  "Rak Tower",
  "Bay View",
  "Bandar",
  "Maha Towers",
  "Marina Heights 1 & 2",
  "Marina Blue",
  "Khalidiya",
  "Al Durrah",
  "Tamouh",
  "Townhouse Khalifa Square",
  "Rovi",
  "The Bridges",
  "The Wave",
  "Marina Bay",
  "Alwafra",
  "Marina Sunset Bay",
  "Al Reem Plaza",
  "Al Bateen Towers",
  "Royal Villa",
  "Hydra Village",
  "Other…",
];

const LAYOUTS = [
  "Studio",
  "1 Bedroom", "2 Bedrooms", "3 Bedrooms", "4 Bedrooms",
  "5 Bedrooms", "6 Bedrooms", "7 Bedrooms", "8 Bedrooms",
  "9 Bedrooms", "10 Bedrooms", "10+ Bedrooms",
];

const OWNERSHIP_TYPES = [
  { value: "sole",        label: "Sole Owner" },
  { value: "joint_title", label: "Joint Title" },
  { value: "trust",       label: "Trust / Family Trust" },
  { value: "company",     label: "Company / Corporate" },
  { value: "poa",         label: "Power of Attorney" },
  { value: "other",       label: "Other" },
];

interface OwnerRow {
  ownerId: number;
  ownershipPercentage: number;
  ownershipType: string;
  isPrimary: boolean;
}

const propertySchema = z.object({
  emirate: z.string().min(1, "Emirate is required"),
  area: z.string().min(1, "Area is required"),
  projectBuilding: z.string().optional(),
  buildingNumber: z.string().optional(),
  unitNumber: z.string().optional(),
  propertyType: z.enum(["apartment", "duplex", "penthouse", "townhouse", "villa", "studio", "hotel_apartment", "other"]),
  bedrooms: z.coerce.number().min(0),
  bathrooms: z.coerce.number().min(0).optional(),
  hasMaidsRoom: z.boolean().default(false),
  hasStudy: z.boolean().default(false),
  internalArea: z.coerce.number().min(1, "Size is required"),
  furnishingStatus: z.enum(["unfurnished", "partially_furnished", "fully_furnished", "premium_furnished", "hotel_grade", "previously_holiday_home"]).optional(),
  propertyCondition: z.enum(["new", "excellent", "good", "requires_refresh", "requires_renovation"]).optional(),
  view: z.string().optional(),
  isWaterfront: z.boolean().default(false),
  hasPrivatePool: z.boolean().default(false),
  vacancyStatus: z.enum(["vacant", "owner_staying", "tenant_staying", "off_plan"]).optional(),
  expectedDate: z.string().optional(),
  operatorType: z.enum(["self_operated", "management_company"]).optional(),
  operatorName: z.string().optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function PropertyNew() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialOwnerIdStr = searchParams.get("ownerId");
  const initialOwnerId = initialOwnerIdStr ? parseInt(initialOwnerIdStr, 10) : 0;
  const frIdStr = searchParams.get("forecastRequestId");
  const forecastRequestId = frIdStr ? parseInt(frIdStr, 10) : null;

  const { toast } = useToast();
  const createProperty = useCreateProperty();
  const { data: owners } = useListOwners();

  // Multi-owner state — starts with one row seeded from URL param
  const [ownerRows, setOwnerRows] = useState<OwnerRow[]>([
    { ownerId: initialOwnerId, ownershipPercentage: 100, ownershipType: "sole", isPrimary: true },
  ]);

  // Layout selector — drives bedrooms auto-fill
  const [layout, setLayout] = useState("");
  const handleLayoutChange = (val: string) => {
    setLayout(val);
    if (val === "Studio") {
      form.setValue("bedrooms", 0);
      form.setValue("propertyType", "studio");
    } else {
      const m = val.match(/^(\d+)/);
      if (m) form.setValue("bedrooms", parseInt(m[1], 10));
    }
  };

  const totalOwnershipPct = ownerRows.reduce((s, r) => s + r.ownershipPercentage, 0);
  const ownerRowError = ownerRows.every(r => r.ownerId === 0)
    ? "At least one owner is required"
    : null;

  const addOwnerRow = useCallback(() => {
    setOwnerRows(rows => [...rows, { ownerId: 0, ownershipPercentage: 0, ownershipType: "joint_title", isPrimary: false }]);
  }, []);

  const removeOwnerRow = useCallback((idx: number) => {
    setOwnerRows(rows => {
      const next = rows.filter((_, i) => i !== idx);
      // Ensure one primary
      if (next.length > 0 && !next.some(r => r.isPrimary)) next[0].isPrimary = true;
      return next;
    });
  }, []);

  const updateOwnerRow = useCallback((idx: number, patch: Partial<OwnerRow>) => {
    setOwnerRows(rows => rows.map((r, i) => {
      if (i !== idx) {
        // If setting a new primary, clear others
        if (patch.isPrimary) return { ...r, isPrimary: false };
        return r;
      }
      return { ...r, ...patch };
    }));
  }, []);

  const { data: forecastRequest } = useQuery({
    queryKey: ["forecast-request", forecastRequestId],
    queryFn: () => fetch(`/api/forecast-requests/${forecastRequestId}`).then(r => r.json()),
    enabled: !!forecastRequestId,
    staleTime: 60000,
  });

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      emirate: "Abu Dhabi",
      propertyType: "apartment",
      bedrooms: 1,
      bathrooms: 1,
      hasMaidsRoom: false,
      hasStudy: false,
      internalArea: 0,
      isWaterfront: false,
      hasPrivatePool: false,
    },
  });

  const watchedEmirate    = form.watch("emirate");
  const watchedArea       = form.watch("area");
  const watchedVacancy    = form.watch("vacancyStatus");
  const watchedFurnishing = form.watch("furnishingStatus");
  const watchedOperator   = form.watch("operatorType");
  const isAbuDhabi           = watchedEmirate === "Abu Dhabi";
  const isAlAin              = watchedEmirate === "Al Ain";
  const isOtherEmirate       = watchedEmirate === "Other";
  const hasAreaDropdown      = isAbuDhabi || isAlAin;
  const areaList             = isAlAin ? AL_AIN_AREAS : ABU_DHABI_AREAS;
  const isPrevHolidayHome    = watchedFurnishing === "previously_holiday_home";
  const isMgmtCompany        = watchedOperator === "management_company";
  const [customArea, setCustomArea]             = useState("");
  const [customEmirate, setCustomEmirate]       = useState("");
  const [customCommunity, setCustomCommunity]   = useState("");
  const [amenityIds, setAmenityIds]             = useState<number[]>([]);
  const [customTags, setCustomTags]             = useState<string[]>([]);

  const watchedCommunity = form.watch("projectBuilding");
  const isOtherCommunity = watchedCommunity === "Other…";

  // Prefill from forecast request
  useEffect(() => {
    if (!forecastRequest) return;
    const fr = forecastRequest as any;
    // Only prefill if user hasn't changed anything yet
    if (fr.propertyEmirate) form.setValue("emirate", fr.propertyEmirate);
    if (fr.propertyArea) form.setValue("area", fr.propertyArea);
    if (fr.propertyCommunity) {
      // If the stored community is in the known list, select it directly.
      // Otherwise fall back to "Other…" + free-text so the user can see and edit the value.
      if (ABU_DHABI_COMMUNITIES.includes(fr.propertyCommunity)) {
        form.setValue("projectBuilding", fr.propertyCommunity);
      } else {
        form.setValue("projectBuilding", "Other…");
        setCustomCommunity(fr.propertyCommunity);
      }
    }
    if (fr.propertyUnitNumber) form.setValue("unitNumber", fr.propertyUnitNumber);
    // Map layout → layout state + bedrooms
    if (fr.propertyLayout) {
      setLayout(fr.propertyLayout);
      if (fr.propertyLayout === "Studio") form.setValue("bedrooms", 0);
      else {
        const m = String(fr.propertyLayout).match(/^(\d+)/);
        if (m) form.setValue("bedrooms", parseInt(m[1], 10));
      }
    }
    if (fr.propertyBedrooms != null) form.setValue("bedrooms", fr.propertyBedrooms);
    if (fr.propertyBathrooms != null) form.setValue("bathrooms", fr.propertyBathrooms);
    if (fr.propertyInternalArea != null) form.setValue("internalArea", fr.propertyInternalArea);
    if (fr.propertyIsWaterfront != null) form.setValue("isWaterfront", fr.propertyIsWaterfront);
    // Map type string to enum
    if (fr.propertyType) {
      const typeMap: Record<string, string> = {
        "Apartment": "apartment", "Duplex": "duplex", "Penthouse": "penthouse",
        "Townhouse": "townhouse", "Villa": "villa", "Hotel Apartment": "hotel_apartment",
        "Studio": "studio",
      };
      const mapped = typeMap[fr.propertyType] ?? "apartment";
      form.setValue("propertyType", mapped as any);
    }
    // Map view
    if (fr.propertyView) form.setValue("view", fr.propertyView);
    // Map furnishing
    if (fr.propertyFurnishing) {
      const furnMap: Record<string, string> = {
        "Unfurnished": "unfurnished", "Partially Furnished": "partially_furnished",
        "Fully Furnished": "fully_furnished", "Premium Furnished": "premium_furnished",
        "Previously Managed as Holiday Home": "previously_holiday_home",
      };
      const mapped = furnMap[fr.propertyFurnishing];
      if (mapped) form.setValue("furnishingStatus", mapped as any);
    }
    // Map condition
    if (fr.propertyCondition) {
      const condMap: Record<string, string> = {
        "Brand New": "new", "Excellent": "excellent", "Good": "good",
        "Requires Minor Improvements": "requires_refresh", "Requires Renovation": "requires_renovation",
      };
      const mapped = condMap[fr.propertyCondition];
      if (mapped) form.setValue("propertyCondition", mapped as any);
    }
  }, [forecastRequest]);

  const needsDate = watchedVacancy === "owner_staying" || watchedVacancy === "tenant_staying" || watchedVacancy === "off_plan";
  const dateLabel = watchedVacancy === "off_plan" ? "Expected Handover Date" : "Expected Vacancy Date";

  const onSubmit = async (data: PropertyFormValues) => {
    // Validate owners before submission
    const validRows = ownerRows.filter(r => r.ownerId > 0);
    if (validRows.length === 0) {
      toast({ title: "Owner required", description: "Add at least one owner.", variant: "destructive" });
      return;
    }
    // Reject duplicate owner selections
    const ownerIdSet = new Set<number>();
    for (const row of validRows) {
      if (ownerIdSet.has(row.ownerId)) {
        toast({ title: "Duplicate owner", description: "Each owner can only appear once. Remove the duplicate row.", variant: "destructive" });
        return;
      }
      ownerIdSet.add(row.ownerId);
    }

    try {
      const submitData: any = { ...data };
      // Derive ownerId from primary (or first) owner for backward-compat column
      const primaryOwner = validRows.find(r => r.isPrimary) ?? validRows[0];
      submitData.ownerId = primaryOwner.ownerId;
      // Include full owners array for junction table
      submitData.owners = validRows.map((r, i) => ({
        ownerId: r.ownerId,
        ownershipPercentage: r.ownershipPercentage,
        ownershipType: r.ownershipType || undefined,
        isPrimary: r.isPrimary || i === 0,
      }));
      if (!submitData.bathrooms) submitData.bathrooms = submitData.bedrooms;
      // Map vacancy fields to API fields
      if (data.vacancyStatus) submitData.currentTenancyStatus = data.vacancyStatus;
      if (data.expectedDate)  submitData.availabilityDate     = data.expectedDate;
      delete submitData.vacancyStatus;
      delete submitData.expectedDate;
      // Operator fields — strip from payload (not in API schema)
      delete submitData.operatorType;
      delete submitData.operatorName;
      // Resolve "Other…" community to the free-text value
      if (submitData.projectBuilding === "Other…") {
        submitData.projectBuilding = customCommunity || undefined;
      }
      // Append building number to projectBuilding if both filled
      if (submitData.buildingNumber) {
        if (submitData.projectBuilding) {
          submitData.projectBuilding = `${submitData.projectBuilding}, Building ${submitData.buildingNumber}`;
        } else {
          submitData.projectBuilding = `Building ${submitData.buildingNumber}`;
        }
      }
      delete submitData.buildingNumber;
      
      const result = await createProperty.mutateAsync({ data: submitData });

      // Save amenities (fire-and-forget, don't block navigation on failure)
      if (amenityIds.length > 0 || customTags.length > 0) {
        try {
          await fetch(`/api/properties/${result.id}/amenities`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ amenityIds }),
          });
        } catch {
          // non-critical — amenities can be edited on the detail page
        }
      }

      if (forecastRequestId) {
        try {
          await fetch(`/api/forecast-requests/${forecastRequestId}/link-property`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ propertyId: result.id }),
          });
          toast({ title: "Property created & linked", description: "Now create the revenue forecast." });
          const frOwnerId = (forecastRequest as any)?.ownerId ?? (validRows.find(r => r.isPrimary) ?? validRows[0])?.ownerId;
          setLocation(`/forecasts/new?forecastRequestId=${forecastRequestId}&ownerId=${frOwnerId}&propertyId=${result.id}`);
        } catch {
          toast({ title: "Property created", description: "Could not auto-link to request.", variant: "destructive" });
          setLocation(`/forecast-requests/${forecastRequestId}`);
        }
      } else {
        toast({ title: "Property created", description: "The property has been added to the portfolio." });
        setLocation(`/properties/${result.id}`);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add property.", variant: "destructive" });
    }
  };

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6">
      {forecastRequestId && (
        <ForecastRequestContextBar forecastRequestId={forecastRequestId} context="property" />
      )}

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        {forecastRequestId ? (
          <Link href={`/forecast-requests/${forecastRequestId}`} className="hover:text-foreground transition-colors">Forecast Request</Link>
        ) : (
          <Link href="/properties" className="hover:text-foreground transition-colors">Properties</Link>
        )}
        <span>/</span>
        <span className="text-foreground font-medium">New Property</span>
      </div>

      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Add Property</h1>
        <p className="text-muted-foreground mt-1">
          {forecastRequestId ? "Form pre-filled from the forecast request. Review and save." : "Register a new unit to generate revenue forecasts."}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          {/* ── Multi-Owner Section ─────────────────────────────── */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Ownership</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">Assign one or more owners with their ownership stake.</p>
                </div>
                <div className="flex items-center gap-2">
                  {ownerRows.length > 1 && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${Math.round(totalOwnershipPct) === 100 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {totalOwnershipPct}% total
                    </span>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={addOwnerRow} className="h-8 text-xs gap-1.5">
                    <span className="text-base leading-none">+</span> Add Owner
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ownerRowError && (
                <div className="px-6 pt-4 text-sm text-destructive">{ownerRowError}</div>
              )}
              {ownerRows.map((row, idx) => {
                const ownerOptions = (owners ?? []).map(o => ({
                  value: o.id.toString(),
                  label: o.ownerType === "company" && o.companyName ? o.companyName : `${o.firstName} ${o.lastName ?? ""}`.trim(),
                }));
                return (
                  <div key={idx} className={`p-6 ${idx < ownerRows.length - 1 ? "border-b border-border" : ""} grid grid-cols-1 md:grid-cols-12 gap-4 items-start`}>
                    {/* Owner selector */}
                    <div className="md:col-span-5">
                      <label className="text-sm font-medium">Owner {ownerRows.length > 1 ? idx + 1 : ""} <span className="text-destructive">*</span></label>
                      <div className="mt-1.5">
                        <SearchableSelect
                          options={ownerOptions}
                          value={row.ownerId > 0 ? row.ownerId.toString() : ""}
                          onValueChange={(val) => updateOwnerRow(idx, { ownerId: parseInt(val, 10) })}
                          placeholder="Choose owner…"
                          searchPlaceholder="Search owners…"
                        />
                      </div>
                    </div>
                    {/* Ownership % */}
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium">Stake %</label>
                      <div className="relative mt-1.5">
                        <Input
                          type="number" min={0} max={100} step={1}
                          value={row.ownershipPercentage}
                          onChange={e => updateOwnerRow(idx, { ownershipPercentage: parseFloat(e.target.value) || 0 })}
                          className="pr-6"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    {/* Ownership type */}
                    <div className="md:col-span-3">
                      <label className="text-sm font-medium">Type</label>
                      <select
                        value={row.ownershipType}
                        onChange={e => updateOwnerRow(idx, { ownershipType: e.target.value })}
                        className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {OWNERSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    {/* Primary + remove */}
                    <div className="md:col-span-2 flex items-center justify-between md:justify-end gap-3 pt-0 md:pt-7">
                      <button
                        type="button"
                        title={row.isPrimary ? "Primary owner" : "Set as primary"}
                        onClick={() => updateOwnerRow(idx, { isPrimary: true })}
                        className={`flex items-center gap-1 text-xs font-medium transition-colors ${row.isPrimary ? "text-amber-600" : "text-muted-foreground hover:text-amber-500"}`}
                      >
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        {row.isPrimary ? "Primary" : "Set primary"}
                      </button>
                      {ownerRows.length > 1 && (
                        <button type="button" onClick={() => removeOwnerRow(idx)}
                          className="text-muted-foreground hover:text-red-600 transition-colors text-xs">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Location Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Emirate */}
              <FormField
                control={form.control}
                name="emirate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emirate <span className="text-destructive">*</span></FormLabel>
                    <Select
                      onValueChange={(val) => {
                        field.onChange(val);
                        form.setValue("area", "");
                        setCustomArea("");
                        setCustomEmirate("");
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select emirate" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Abu Dhabi Emirate</SelectLabel>
                          <SelectItem value="Abu Dhabi">Abu Dhabi</SelectItem>
                          <SelectItem value="Al Ain">Al Ain</SelectItem>
                        </SelectGroup>
                        <SelectGroup>
                          <SelectLabel>Other Emirates</SelectLabel>
                          <SelectItem value="Dubai">Dubai</SelectItem>
                          <SelectItem value="Sharjah">Sharjah</SelectItem>
                          <SelectItem value="Ajman">Ajman</SelectItem>
                          <SelectItem value="Umm Al Quwain">Umm Al Quwain</SelectItem>
                          <SelectItem value="Ras Al Khaimah">Ras Al Khaimah</SelectItem>
                          <SelectItem value="Fujairah">Fujairah</SelectItem>
                          <SelectItem value="Other">Other…</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {isOtherEmirate && (
                      <Input
                        className="mt-2"
                        placeholder="Type emirate name…"
                        value={customEmirate}
                        onChange={(e) => {
                          setCustomEmirate(e.target.value);
                          field.onChange(e.target.value || "Other");
                        }}
                      />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Area / District */}
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Area / District <span className="text-destructive">*</span></FormLabel>
                    {hasAreaDropdown ? (
                      <>
                        <SearchableSelect
                          options={areaList.map(a => ({ value: a, label: a }))}
                          value={field.value === "Other" ? "Other" : (field.value ?? "")}
                          onValueChange={(val) => {
                            field.onChange(val);
                            setCustomArea("");
                          }}
                          placeholder="Search & select area…"
                          searchPlaceholder="Type to filter areas…"
                        />
                        {field.value === "Other" && (
                          <Input
                            className="mt-2"
                            placeholder="Type area name…"
                            value={customArea}
                            onChange={(e) => {
                              setCustomArea(e.target.value);
                              field.onChange(e.target.value || "Other");
                            }}
                          />
                        )}
                      </>
                    ) : (
                      <FormControl>
                        <Input placeholder="e.g. Downtown, JBR, Palm…" {...field} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Community / Project — searchable dropdown with full Abu Dhabi list */}
              <FormField
                control={form.control}
                name="projectBuilding"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Community / Project</FormLabel>
                    {isAbuDhabi ? (
                      <>
                        <SearchableSelect
                          options={ABU_DHABI_COMMUNITIES.map(c => ({ value: c, label: c }))}
                          value={field.value ?? ""}
                          onValueChange={(val) => {
                            field.onChange(val);
                            setCustomCommunity("");
                          }}
                          placeholder="Search community or project…"
                          searchPlaceholder="Type to filter…"
                        />
                        {isOtherCommunity && (
                          <Input
                            className="mt-2"
                            placeholder="Type community / project name…"
                            value={customCommunity}
                            onChange={(e) => setCustomCommunity(e.target.value)}
                          />
                        )}
                      </>
                    ) : (
                      <FormControl>
                        <Input placeholder="e.g. Mamsha Al Saadiyat" {...field} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Building Number */}
              <FormField
                control={form.control}
                name="buildingNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Building Number</FormLabel>
                    <FormControl><Input placeholder="e.g. 12" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unitNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Number</FormLabel>
                    <FormControl><Input placeholder="e.g. 402" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Property Specifications</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Type + Layout */}
              <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="apartment">Apartment</SelectItem>
                          <SelectItem value="villa">Villa</SelectItem>
                          <SelectItem value="townhouse">Townhouse</SelectItem>
                          <SelectItem value="penthouse">Penthouse</SelectItem>
                          <SelectItem value="duplex">Duplex</SelectItem>
                          <SelectItem value="studio">Studio</SelectItem>
                          <SelectItem value="hotel_apartment">Hotel Apartment</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">Layout</label>
                  <Select value={layout} onValueChange={handleLayoutChange}>
                    <SelectTrigger><SelectValue placeholder="Select layout" /></SelectTrigger>
                    <SelectContent>
                      {LAYOUTS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Auto-fills bedrooms</p>
                </div>
              </div>

              {/* Bedrooms + Bathrooms */}
              <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="bedrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedrooms <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input type="number" min="0" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bathrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bathrooms</FormLabel>
                      <FormControl><Input type="number" min="0" step="0.5" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Room checkboxes row */}
              <div className="col-span-1 md:col-span-3 flex flex-wrap items-center gap-6 pt-1">
                <FormField
                  control={form.control}
                  name="hasMaidsRoom"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          id="hasMaidsRoom"
                          checked={!!field.value}
                          onChange={e => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border border-input accent-primary cursor-pointer"
                        />
                      </FormControl>
                      <FormLabel htmlFor="hasMaidsRoom" className="cursor-pointer font-normal text-sm">Maid Room</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hasStudy"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          id="hasStudy"
                          checked={!!field.value}
                          onChange={e => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border border-input accent-primary cursor-pointer"
                        />
                      </FormControl>
                      <FormLabel htmlFor="hasStudy" className="cursor-pointer font-normal text-sm">Study Room / Office Room</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="internalArea"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size (SqFt) <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input type="number" min="1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="furnishingStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Furnishing</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select furnishing" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unfurnished">Unfurnished</SelectItem>
                        <SelectItem value="partially_furnished">Partially Furnished</SelectItem>
                        <SelectItem value="fully_furnished">Fully Furnished</SelectItem>
                        <SelectItem value="premium_furnished">Premium Furnished</SelectItem>
                        <SelectItem value="hotel_grade">Hotel Grade</SelectItem>
                        <SelectItem value="previously_holiday_home">🏨 Previously Managed as Holiday Home</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Operator sub-fields — shown when Previously Holiday Home */}
              {isPrevHolidayHome && (
                <>
                  <FormField
                    control={form.control}
                    name="operatorType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Previous Operator</FormLabel>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            if (val !== "management_company") form.setValue("operatorName", "");
                          }}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="How was it operated?" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="self_operated">Self Operated by Owner</SelectItem>
                            <SelectItem value="management_company">Managed by a Company</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isMgmtCompany && (
                    <FormField
                      control={form.control}
                      name="operatorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Management Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Airbnb Superhost, Property Finder Homes…" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}

              <FormField
                control={form.control}
                name="propertyCondition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select condition" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new">Brand New</SelectItem>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="requires_refresh">Requires Refresh</SelectItem>
                        <SelectItem value="requires_renovation">Requires Renovation</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="view"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary View</FormLabel>
                    <FormControl><Input placeholder="e.g. Full Sea View" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

            </CardContent>
          </Card>

          {/* Amenities & Property Features */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Amenities &amp; Property Features</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {amenityIds.length + customTags.length > 0
                    ? `${amenityIds.length + customTags.length} selected`
                    : "Optional — improves AI forecasting accuracy"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <AmenitiesPicker
                selectedIds={amenityIds}
                customTags={customTags}
                onChange={setAmenityIds}
                onCustomTagsChange={setCustomTags}
              />
            </CardContent>
          </Card>

          {/* Vacancy Status */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Vacancy Status</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="vacancyStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Status</FormLabel>
                    <Select onValueChange={(val) => { field.onChange(val); form.setValue("expectedDate", ""); }} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select vacancy status" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="vacant">
                          <span className="flex items-center gap-2">🟢 Vacant — Ready to Onboard</span>
                        </SelectItem>
                        <SelectItem value="owner_staying">
                          <span className="flex items-center gap-2">🏠 Owner Staying In</span>
                        </SelectItem>
                        <SelectItem value="tenant_staying">
                          <span className="flex items-center gap-2">🔑 Tenant Staying In</span>
                        </SelectItem>
                        <SelectItem value="off_plan">
                          <span className="flex items-center gap-2">🏗️ Off-Plan / Under Construction</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {needsDate && (
                <FormField
                  control={form.control}
                  name="expectedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{dateLabel}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/properties" className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-8 text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </Link>
            <Button type="submit" disabled={createProperty.isPending} className="px-8">
              {createProperty.isPending ? "Saving..." : "Save Property"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
