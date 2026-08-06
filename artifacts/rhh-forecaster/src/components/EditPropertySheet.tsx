import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { SearchableSelect } from "@/components/ui/searchable-select";

// ─── Location data ─────────────────────────────────────────────────────────────
const UAE_EMIRATES = [
  "Abu Dhabi",
  "Al Ain",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
  "Other",
];

const ABU_DHABI_AREAS = [
  "Al Reem Island", "Yas Island", "Saadiyat Island", "Al Maryah Island",
  "Al Raha Beach", "Corniche", "Downtown Abu Dhabi", "Al Khalidiyah",
  "Al Manhal", "Al Mushrif", "Khalifa City", "Al Reef", "Masdar City",
  "Rabdan", "Al Hudairiyat Island", "Al Jubail Island", "Al Fahid Island",
  "Bani Yas", "Al Shamkha", "Al Falah", "Mohammed Bin Zayed City",
  "Al Karamah", "Madinat Zayed", "Al Wahda", "Al Danah", "Al Rawdah",
  "Al Bateen", "Al Musalla", "Tourist Club Area", "Al Nahyan", "Al Muroor",
  "Al Zaab", "Hamdan Street", "Electra Street", "Other",
];

const AL_AIN_AREAS = [
  "Al Ain City Centre", "Al Jimi", "Al Muwaiji", "Al Mutawaa",
  "Al Ain Industrial Area", "Al Hili", "Al Jahili", "Al Khabisi",
  "Al Markhaniya", "Al Maqam", "Al Sarouj", "Al Yahar", "Zakher",
  "Mezyad", "Al Ain Oasis", "Other",
];

const ABU_DHABI_COMMUNITIES = [
  "Waters Edge", "ANSAM", "MAYAN", "Gardenia Bay", "Sama Yas",
  "Yas Golf Collection", "Yas Acres", "Noya", "Yas Riva", "Yas Park Gate",
  "West Yas", "Yas Living", "Saadiyat Bay", "Branded Residences by Ghana",
  "Al Deem Townhomes", "Diva", "Perla 1", "Perla 2", "Perla 3",
  "Selina Bay", "Bab Al Qasr Residence 25", "Bab Al Qasr Residence 31",
  "The Icon", "Sea La Vie", "The Bay Residences 1", "The Bay Residences 2",
  "Al Zeina Island", "Al Muneira Island", "Al Bandar Island", "Al Hadeel",
  "Raha Gardens", "Golf Gardens", "Loft 1", "Lofts 2",
  "Bab Al Qasr Residence 22", "Brabus Island", "Leonardo", "Oasis 1",
  "Oasis 2", "The Gate", "Plaza 1", "Plaza 2", "Royal Park",
  "Ville 11", "Ville 12", "Bab Al Qasr 18", "Bab Al Qasr 19",
  "Bab Al Qasr 46", "Mahra", "Vista 1", "Vista 2", "Reportage Tower",
  "V Residence", "St. Regis the Residence", "Mamsha", "Nuhu", "The Arc",
  "Mandarin Oriental", "The Source", "The Source 2", "The Arthouse",
  "Louvre", "Manaret Living 1", "Manaret Living 2", "Nouran Living",
  "Lagoons", "Jawaher", "Wadi Saadiyat", "Reserve", "Soho Square",
  "Park View", "Alyasa Village", "Soley", "Miran", "Vida",
  "Reeman Living", "Fay Al Reeman 1", "Fay Al Reeman 2", "Bloom Living",
  "Reef Downtown", "Reef Villas", "Sun & Sky Towers", "Mangrove Place",
  "Sas 1 to 14", "Hydra Avenue C1 to C6", "Marina Bay 1", "Marina Bay 2",
  "Sigma Tower", "Raahen Residence", "Reflection", "Beach Tower",
  "Ocean Scape", "Silkhaus", "Horizons", "Tala Island", "Yasmina Tower",
  "Amaya Tower", "Shams Meer", "Parkside", "The Kite", "Azure",
  "Ocean Terrace", "Tala Tower", "Rak Tower", "Bay View", "Bandar",
  "Maha Towers", "Marina Heights 1 & 2", "Marina Blue", "Khalidiya",
  "Al Durrah", "Tamouh", "Townhouse Khalifa Square", "Rovi",
  "The Bridges", "The Wave", "Marina Bay", "Alwafra", "Marina Sunset Bay",
  "Al Reem Plaza", "Al Bateen Towers", "Royal Villa", "Hydra Village",
  "Other…",
];

// ─── Form schema ───────────────────────────────────────────────────────────────
const editSchema = z.object({
  emirate: z.string().min(1, "Emirate is required"),
  area: z.string().min(1, "Area is required"),
  projectBuilding: z.string().optional(),
  unitNumber: z.string().optional(),
  propertyType: z.enum(["apartment", "duplex", "penthouse", "townhouse", "villa", "studio", "hotel_apartment", "other"]),
  bedrooms: z.coerce.number().min(0),
  bathrooms: z.coerce.number().min(0).optional(),
  hasMainRoom: z.boolean().default(false),
  hasStudy: z.boolean().default(false),
  internalArea: z.coerce.number().min(1, "Size is required"),
  furnishingStatus: z.enum(["unfurnished", "partially_furnished", "fully_furnished", "premium_furnished", "hotel_grade", "previously_holiday_home"]).optional(),
  propertyCondition: z.enum(["new", "excellent", "good", "requires_refresh", "requires_renovation"]).optional(),
  view: z.string().optional(),
  currentTenancyStatus: z.enum(["vacant", "owner_staying", "tenant_staying", "off_plan"]).optional(),
  availabilityDate: z.string().optional(),
  dctPermitStatus: z.string().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

// ─── Props ─────────────────────────────────────────────────────────────────────
interface Property {
  id: number;
  emirate: string;
  area: string;
  projectBuilding?: string | null;
  unitNumber?: string | null;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  hasMainRoom?: boolean;
  hasStudy?: boolean;
  internalArea: number;
  furnishingStatus?: string | null;
  propertyCondition?: string | null;
  view?: string | null;
  currentTenancyStatus?: string | null;
  availabilityDate?: string | null;
  dctPermitStatus?: string | null;
}

interface EditPropertySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function EditPropertySheet({ open, onOpenChange, property }: EditPropertySheetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [customArea, setCustomArea] = useState("");
  const [customEmirate, setCustomEmirate] = useState("");
  const [customCommunity, setCustomCommunity] = useState("");

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: buildDefaults(property),
  });

  // Reset form whenever the sheet opens with fresh property data
  useEffect(() => {
    if (open) {
      form.reset(buildDefaults(property));
      setCustomArea("");
      setCustomEmirate("");
      setCustomCommunity("");
    }
  }, [open, property]);

  const watchedEmirate = form.watch("emirate");
  const watchedArea = form.watch("area");
  const watchedCommunity = form.watch("projectBuilding");
  const watchedVacancy = form.watch("currentTenancyStatus");

  const isAbuDhabi = watchedEmirate === "Abu Dhabi";
  const isAlAin = watchedEmirate === "Al Ain";
  const isOtherEmirate = watchedEmirate === "Other";
  const hasAreaDropdown = isAbuDhabi || isAlAin;
  const areaList = isAlAin ? AL_AIN_AREAS : ABU_DHABI_AREAS;
  const isOtherArea = watchedArea === "Other";
  const isOtherCommunity = watchedCommunity === "Other…";
  const needsDate = watchedVacancy === "owner_staying" || watchedVacancy === "tenant_staying" || watchedVacancy === "off_plan";
  const dateLabel = watchedVacancy === "off_plan" ? "Expected Handover Date" : "Expected Vacancy Date";

  const updateProperty = useMutation({
    mutationFn: async (data: EditFormValues) => {
      const payload: Record<string, unknown> = { ...data };
      // Resolve "Other…" community
      if (payload.projectBuilding === "Other…") {
        payload.projectBuilding = customCommunity || undefined;
      }
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update property");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/properties/${property.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({ title: "Property updated", description: "Changes saved successfully." });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const onSubmit = (data: EditFormValues) => {
    updateProperty.mutate(data);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>Edit Property</SheetTitle>
          <SheetDescription>
            Update the property details below. Amenities can be edited directly on the property page.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-8">

            {/* ── Location ─────────────────────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Location</h3>

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
                        {UAE_EMIRATES.map(e => (
                          <SelectItem key={e} value={e}>{e === "Other" ? "Other…" : e}</SelectItem>
                        ))}
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

              {/* Area */}
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
                          value={isOtherArea ? "Other" : (field.value ?? "")}
                          onValueChange={(val) => {
                            field.onChange(val);
                            setCustomArea("");
                          }}
                          placeholder="Search & select area…"
                          searchPlaceholder="Type to filter areas…"
                        />
                        {isOtherArea && (
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

              {/* Community / Project */}
              <FormField
                control={form.control}
                name="projectBuilding"
                render={({ field }) => (
                  <FormItem>
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
                        <Input placeholder="e.g. Mamsha Al Saadiyat" {...field} value={field.value ?? ""} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Unit Number */}
              <FormField
                control={form.control}
                name="unitNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 402" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* ── Property Specifications ───────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Property Specifications</h3>

              <div className="grid grid-cols-3 gap-4">
                {/* Type */}
                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem className="col-span-3 sm:col-span-1">
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

                {/* Bedrooms */}
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

                {/* Bathrooms */}
                <FormField
                  control={form.control}
                  name="bathrooms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bathrooms</FormLabel>
                      <FormControl><Input type="number" min="0" step="0.5" {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Room checkboxes */}
              <div className="flex flex-wrap gap-6 pt-1">
                <FormField
                  control={form.control}
                  name="hasMainRoom"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          id="edit-hasMainRoom"
                          checked={!!field.value}
                          onChange={e => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border border-input accent-primary cursor-pointer"
                        />
                      </FormControl>
                      <FormLabel htmlFor="edit-hasMainRoom" className="cursor-pointer font-normal text-sm">Main Room</FormLabel>
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
                          id="edit-hasStudy"
                          checked={!!field.value}
                          onChange={e => field.onChange(e.target.checked)}
                          className="h-4 w-4 rounded border border-input accent-primary cursor-pointer"
                        />
                      </FormControl>
                      <FormLabel htmlFor="edit-hasStudy" className="cursor-pointer font-normal text-sm">Study Room</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              {/* Size */}
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
            </section>

            {/* ── Property Details ──────────────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Property Details</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Furnishing */}
                <FormField
                  control={form.control}
                  name="furnishingStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Furnishing</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select furnishing" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="unfurnished">Unfurnished</SelectItem>
                          <SelectItem value="partially_furnished">Partially Furnished</SelectItem>
                          <SelectItem value="fully_furnished">Fully Furnished</SelectItem>
                          <SelectItem value="premium_furnished">Premium Furnished</SelectItem>
                          <SelectItem value="hotel_grade">Hotel Grade</SelectItem>
                          <SelectItem value="previously_holiday_home">🏨 Previously Holiday Home</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Condition */}
                <FormField
                  control={form.control}
                  name="propertyCondition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
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

                {/* View */}
                <FormField
                  control={form.control}
                  name="view"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary View</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Full Sea View" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* DCT Permit Status */}
                <FormField
                  control={form.control}
                  name="dctPermitStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DCT Permit Status</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Approved, Pending…" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* ── Vacancy Status ────────────────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Vacancy Status</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currentTenancyStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Status</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          form.setValue("availabilityDate", "");
                        }}
                        value={field.value ?? ""}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="vacant">🟢 Vacant — Ready to Onboard</SelectItem>
                          <SelectItem value="owner_staying">🏠 Owner Staying In</SelectItem>
                          <SelectItem value="tenant_staying">🔑 Tenant Staying In</SelectItem>
                          <SelectItem value="off_plan">🏗️ Off-Plan / Under Construction</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {needsDate && (
                  <FormField
                    control={form.control}
                    name="availabilityDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{dateLabel}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </section>

            <SheetFooter className="flex flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
                disabled={updateProperty.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={updateProperty.isPending}>
                {updateProperty.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function buildDefaults(p: Property): EditFormValues {
  return {
    emirate: p.emirate ?? "Abu Dhabi",
    area: p.area ?? "",
    projectBuilding: p.projectBuilding ?? undefined,
    unitNumber: p.unitNumber ?? undefined,
    propertyType: (p.propertyType as EditFormValues["propertyType"]) ?? "apartment",
    bedrooms: p.bedrooms ?? 1,
    bathrooms: p.bathrooms ?? 1,
    hasMainRoom: p.hasMainRoom ?? false,
    hasStudy: p.hasStudy ?? false,
    internalArea: p.internalArea ?? 0,
    furnishingStatus: (p.furnishingStatus as EditFormValues["furnishingStatus"]) ?? undefined,
    propertyCondition: (p.propertyCondition as EditFormValues["propertyCondition"]) ?? undefined,
    view: p.view ?? undefined,
    currentTenancyStatus: (p.currentTenancyStatus as EditFormValues["currentTenancyStatus"]) ?? undefined,
    availabilityDate: p.availabilityDate ?? undefined,
    dctPermitStatus: p.dctPermitStatus ?? undefined,
  };
}
