import { useCreateProperty, useListOwners } from "@workspace/api-client-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";

const UAE_EMIRATES = [
  "Abu Dhabi",
  "Dubai",
  "Sharjah",
  "Ajman",
  "Umm Al Quwain",
  "Ras Al Khaimah",
  "Fujairah",
];

const ABU_DHABI_AREAS = [
  "Al Reem Island",
  "Yas Island",
  "Saadiyat Island",
  "Al Marriyah Island",
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

const propertySchema = z.object({
  ownerId: z.coerce.number().min(1, "Owner is required"),
  emirate: z.string().min(1, "Emirate is required"),
  area: z.string().min(1, "Area is required"),
  projectBuilding: z.string().optional(),
  unitNumber: z.string().optional(),
  propertyType: z.enum(["apartment", "duplex", "penthouse", "townhouse", "villa", "studio", "hotel_apartment", "other"]),
  bedrooms: z.coerce.number().min(0),
  bathrooms: z.coerce.number().min(0).optional(),
  internalArea: z.coerce.number().min(1, "Size is required"),
  furnishingStatus: z.enum(["unfurnished", "partially_furnished", "fully_furnished", "premium_furnished", "hotel_grade"]).optional(),
  propertyCondition: z.enum(["new", "excellent", "good", "requires_refresh", "requires_renovation"]).optional(),
  view: z.string().optional(),
  isWaterfront: z.boolean().default(false),
  hasPrivatePool: z.boolean().default(false),
  vacancyStatus: z.enum(["vacant", "owner_staying", "tenant_staying", "off_plan"]).optional(),
  expectedDate: z.string().optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

export default function PropertyNew() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const initialOwnerId = searchParams.get("ownerId");
  
  const { toast } = useToast();
  const createProperty = useCreateProperty();
  const { data: owners } = useListOwners();

  const form = useForm<PropertyFormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      ownerId: initialOwnerId ? parseInt(initialOwnerId, 10) : 0,
      emirate: "Abu Dhabi",
      propertyType: "apartment",
      bedrooms: 1,
      bathrooms: 1,
      internalArea: 0,
      isWaterfront: false,
      hasPrivatePool: false,
    },
  });

  const watchedEmirate    = form.watch("emirate");
  const watchedArea       = form.watch("area");
  const watchedVacancy    = form.watch("vacancyStatus");
  const isAbuDhabi        = watchedEmirate === "Abu Dhabi";
  const [customArea, setCustomArea] = useState("");

  const needsDate = watchedVacancy === "owner_staying" || watchedVacancy === "tenant_staying" || watchedVacancy === "off_plan";
  const dateLabel = watchedVacancy === "off_plan" ? "Expected Handover Date" : "Expected Vacancy Date";

  const onSubmit = async (data: PropertyFormValues) => {
    try {
      const submitData: any = { ...data };
      if (!submitData.bathrooms) submitData.bathrooms = submitData.bedrooms;
      // Map vacancy fields to API fields
      if (data.vacancyStatus) submitData.currentTenancyStatus = data.vacancyStatus;
      if (data.expectedDate)  submitData.availabilityDate     = data.expectedDate;
      delete submitData.vacancyStatus;
      delete submitData.expectedDate;
      
      const result = await createProperty.mutateAsync({ data: submitData });
      toast({ title: "Property created", description: "The property has been added to the portfolio." });
      setLocation(`/properties/${result.id}`);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add property.", variant: "destructive" });
    }
  };

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/properties" className="hover:text-foreground transition-colors">Properties</Link>
        <span>/</span>
        <span className="text-foreground font-medium">New Property</span>
      </div>

      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Add Property</h1>
        <p className="text-muted-foreground mt-1">Register a new unit to generate revenue forecasts.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Ownership</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Owner <span className="text-destructive">*</span></FormLabel>
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? field.value.toString() : ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Choose an owner" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {owners?.map(owner => (
                          <SelectItem key={owner.id} value={owner.id.toString()}>
                            {owner.ownerType === 'company' && owner.companyName ? owner.companyName : `${owner.firstName} ${owner.lastName}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        // Reset area when emirate changes
                        form.setValue("area", "");
                        setCustomArea("");
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select emirate" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {UAE_EMIRATES.map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    {isAbuDhabi ? (
                      <>
                        <Select
                          onValueChange={(val) => {
                            if (val === "Other") {
                              field.onChange("Other");
                              setCustomArea("");
                            } else {
                              field.onChange(val);
                              setCustomArea("");
                            }
                          }}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-72">
                            <SelectGroup>
                              <SelectLabel>Abu Dhabi Areas</SelectLabel>
                              {ABU_DHABI_AREAS.map(a => (
                                <SelectItem key={a} value={a}>{a}</SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
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

              <FormField
                control={form.control}
                name="projectBuilding"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project / Building</FormLabel>
                    <FormControl><Input placeholder="e.g. Mamsha Al Saadiyat" {...field} /></FormControl>
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
              <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="propertyType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <div className="col-span-1 md:col-span-3 flex gap-6">
                <FormField
                  control={form.control}
                  name="isWaterfront"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Waterfront Property</FormLabel>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="hasPrivatePool"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Private Pool</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
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
