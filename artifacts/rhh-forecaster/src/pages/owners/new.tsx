import { useState, useEffect, useCallback } from "react";
import { useCreateOwner, useListUsers, useListReferees, useCreateReferee, useCreateUser, useListRoles, useListProperties, getListRefereesQueryKey, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { ForecastRequestContextBar } from "@/components/ForecastRequestContextBar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import LeadSourcePicker from "@/components/LeadSourcePicker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { UserCheck, Plus, Loader2, RefreshCw, Home, UserPlus, X } from "lucide-react";

const OWNERSHIP_TYPES = [
  { value: "sole",        label: "Sole Owner" },
  { value: "joint_title", label: "Joint Title" },
  { value: "trust",       label: "Trust / Family Trust" },
  { value: "company",     label: "Company / Corporate" },
  { value: "poa",         label: "Power of Attorney" },
  { value: "other",       label: "Other" },
];

interface PropertyRow {
  propertyId: number;
  ownershipPercentage: number;
  ownershipType: string;
  isPrimary: boolean;
}

const ownerSchema = z.object({
  ownerType: z.enum(["individual", "company"]),
  title: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  email: z.string().email("Valid email required").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  nationality: z.string().optional(),
  leadSource: z.string().optional(),
  isExistingClient: z.boolean().default(false),
  assignedToId: z.coerce.number().optional().nullable(),
  refereeId: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

type OwnerFormValues = z.infer<typeof ownerSchema>;

interface RepQuickFormValues {
  name: string;
  email: string;
  password: string;
  roleId: string;   // stored as string in form, converted to number on submit
  phone?: string;
}

interface RefereeQuickFormValues {
  name: string;
  phone?: string;
  email?: string;
  companyName?: string;
  referralFeeStudio: number;
  referralFee1br: number;
  referralFee2br: number;
  referralFee3br: number;
  referralFee4brPlus: number;
  isRecurringEnabled: boolean;
}

export default function OwnerNew() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const frIdStr = searchParams.get("forecastRequestId");
  const forecastRequestId = frIdStr ? parseInt(frIdStr, 10) : null;
  const initialPropertyIdStr = searchParams.get("propertyId");
  const initialPropertyId = initialPropertyIdStr ? parseInt(initialPropertyIdStr, 10) : 0;

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOwner = useCreateOwner();
  const { data: allProperties } = useListProperties();

  // Owned Properties rows
  const [propertyRows, setPropertyRows] = useState<PropertyRow[]>(
    initialPropertyId > 0
      ? [{ propertyId: initialPropertyId, ownershipPercentage: 100, ownershipType: "sole", isPrimary: true }]
      : []
  );

  const addPropertyRow = useCallback(() => {
    setPropertyRows(rows => [...rows, { propertyId: 0, ownershipPercentage: 0, ownershipType: "joint_title", isPrimary: false }]);
  }, []);

  const removePropertyRow = useCallback((idx: number) => {
    setPropertyRows(rows => rows.filter((_, i) => i !== idx));
  }, []);

  const updatePropertyRow = useCallback((idx: number, patch: Partial<PropertyRow>) => {
    setPropertyRows(rows => rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }, []);

  const { data: forecastRequest } = useQuery({
    queryKey: ["forecast-request", forecastRequestId],
    queryFn: () => fetch(`/api/forecast-requests/${forecastRequestId}`).then(r => r.json()),
    enabled: !!forecastRequestId,
    staleTime: 60000,
  });
  const createReferee = useCreateReferee();
  const createUser = useCreateUser();
  const { data: users } = useListUsers();
  const { data: referees } = useListReferees();
  const { data: roles } = useListRoles();

  const [addRepOpen, setAddRepOpen] = useState(false);
  const repForm = useForm<RepQuickFormValues>({
    defaultValues: { name: "", email: "", password: "", roleId: "" },
  });

  const [addRefereeOpen, setAddRefereeOpen] = useState(false);
  const refereeForm = useForm<RefereeQuickFormValues>({
    defaultValues: {
      name: "",
      referralFeeStudio: 1500,
      referralFee1br: 2000,
      referralFee2br: 2500,
      referralFee3br: 3000,
      referralFee4brPlus: 3500,
      isRecurringEnabled: false,
    },
  });
  const isRefereeRecurring = refereeForm.watch("isRecurringEnabled");

  const form = useForm<OwnerFormValues>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      ownerType: "individual",
      firstName: "",
      lastName: "",
      email: "",
      isExistingClient: false,
    },
  });

  const ownerType = form.watch("ownerType");
  const leadSource = form.watch("leadSource");
  const selectedRefereeId = form.watch("refereeId");

  // Prefill from forecast request
  useEffect(() => {
    if (!forecastRequest) return;
    const fr = forecastRequest as any;
    if (fr.ownerType) form.setValue("ownerType", fr.ownerType);
    if (fr.ownerTitle) form.setValue("title", fr.ownerTitle);
    if (fr.ownerFirstName) form.setValue("firstName", fr.ownerFirstName);
    if (fr.ownerLastName) form.setValue("lastName", fr.ownerLastName);
    if (fr.ownerCompanyName) form.setValue("companyName", fr.ownerCompanyName);
    if (fr.ownerEmail) form.setValue("email", fr.ownerEmail);
    if (fr.ownerPhone) form.setValue("phone", fr.ownerPhone);
    if (fr.ownerWhatsapp) form.setValue("whatsapp", fr.ownerWhatsapp);
    if (fr.ownerNationality) form.setValue("nationality", fr.ownerNationality);
    if (fr.refereeName && !form.getValues("notes")) {
      form.setValue("notes", `Referee: ${fr.refereeName}`);
    }
  }, [forecastRequest]);

  const selectedReferee = referees?.find((r: any) => r.id === selectedRefereeId);

  const onSubmit = async (data: OwnerFormValues) => {
    try {
      const submitData: any = { ...data };
      if (submitData.assignedToId === 0 || !submitData.assignedToId) delete submitData.assignedToId;
      if (submitData.refereeId === 0 || !submitData.refereeId) delete submitData.refereeId;
      if (!submitData.companyName) delete submitData.companyName;

      const result = await createOwner.mutateAsync({ data: submitData });
      const newOwnerId = (result as any).id;

      // Write junction rows for any linked properties; collect and surface failures
      const validPropRows = propertyRows.filter(r => r.propertyId > 0);
      const linkFailures: number[] = [];
      for (const row of validPropRows) {
        try {
          const linkRes = await fetch(`/api/properties/${row.propertyId}/owners`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              ownerId: newOwnerId,
              ownershipPercentage: row.ownershipPercentage,
              ownershipType: row.ownershipType || undefined,
              isPrimary: row.isPrimary,
            }),
          });
          if (!linkRes.ok) {
            linkFailures.push(row.propertyId);
          }
        } catch {
          linkFailures.push(row.propertyId);
        }
      }
      if (linkFailures.length > 0) {
        toast({
          title: "Some property links failed",
          description: `${linkFailures.length} propert${linkFailures.length > 1 ? "ies" : "y"} could not be linked. You can link them from the property's Ownership panel.`,
          variant: "destructive",
        });
      }

      if (forecastRequestId) {
        try {
          await fetch(`/api/forecast-requests/${forecastRequestId}/link-owner`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerId: (result as any).id }),
          });
          toast({ title: "Owner created & linked", description: "Now add the property." });
          setLocation(`/properties/new?forecastRequestId=${forecastRequestId}&ownerId=${newOwnerId}`);
        } catch {
          toast({ title: "Owner created", description: "Could not auto-link to request.", variant: "destructive" });
          setLocation(`/forecast-requests/${forecastRequestId}`);
        }
      } else {
        toast({ title: "Owner created", description: "The owner profile has been created successfully." });
        setLocation(`/owners/${newOwnerId}`);
      }
    } catch (error) {
      toast({ title: "Failed to create owner", description: getApiErrorMessage(error), variant: "destructive" });
    }
  };

  async function handleCreateReferee(data: RefereeQuickFormValues) {
    try {
      const newReferee = await createReferee.mutateAsync({ data: data as any });
      queryClient.invalidateQueries({ queryKey: getListRefereesQueryKey() });
      form.setValue("refereeId", (newReferee as any).id);
      setAddRefereeOpen(false);
      refereeForm.reset({
        name: "",
        referralFeeStudio: 1500,
        referralFee1br: 2000,
        referralFee2br: 2500,
        referralFee3br: 3000,
        referralFee4brPlus: 3500,
        isRecurringEnabled: false,
      });
      toast({
        title: "Referee created",
        description: `${(newReferee as any).refereeCode} — ${(newReferee as any).name}`,
      });
    } catch (error) {
      toast({ title: "Failed to create referee", description: getApiErrorMessage(error), variant: "destructive" });
    }
  }

  async function handleCreateRep(data: RepQuickFormValues) {
    try {
      const newUser = await createUser.mutateAsync({
        data: {
          name:     data.name,
          email:    data.email,
          password: data.password,
          roleId:   parseInt(data.roleId),
          phone:    data.phone,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      form.setValue("assignedToId", (newUser as any).id);
      setAddRepOpen(false);
      repForm.reset({ name: "", email: "", password: "", roleId: "" });
      toast({ title: "Representative added", description: `${(newUser as any).name} can now log in with the provided credentials.` });
    } catch (error) {
      toast({ title: "Failed to create representative", description: getApiErrorMessage(error), variant: "destructive" });
    }
  }

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6">
      {forecastRequestId && (
        <ForecastRequestContextBar forecastRequestId={forecastRequestId} context="owner" />
      )}

      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        {forecastRequestId ? (
          <Link href={`/forecast-requests/${forecastRequestId}`} className="hover:text-foreground transition-colors">Forecast Request</Link>
        ) : (
          <Link href="/owners" className="hover:text-foreground transition-colors">Owners</Link>
        )}
        <span>/</span>
        <span className="text-foreground font-medium">New Owner</span>
      </div>

      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Create Owner Profile</h1>
        <p className="text-muted-foreground mt-1">
          {forecastRequestId ? "Form pre-filled from the forecast request. Review and save." : "Add a new property owner or corporate client to your database."}
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Entity Type */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Entity Type</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <FormField
                control={form.control}
                name="ownerType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1 md:flex-row md:space-x-4 md:space-y-0"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border border-border p-4 bg-background flex-1 cursor-pointer">
                          <FormControl><RadioGroupItem value="individual" /></FormControl>
                          <FormLabel className="font-medium flex-1 cursor-pointer">Individual</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border border-border p-4 bg-background flex-1 cursor-pointer">
                          <FormControl><RadioGroupItem value="company" /></FormControl>
                          <FormLabel className="font-medium flex-1 cursor-pointer">Corporate Entity</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Primary Details */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Primary Details</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {ownerType === "company" && (
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name <span className="text-destructive">*</span></FormLabel>
                        <FormControl><Input placeholder="Acme Holdings LLC" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select title" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Mr.">Mr.</SelectItem>
                        <SelectItem value="Mrs.">Mrs.</SelectItem>
                        <SelectItem value="Ms.">Ms.</SelectItem>
                        <SelectItem value="Dr.">Dr.</SelectItem>
                        <SelectItem value="H.E.">H.E.</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="hidden md:block"></div>

              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="John" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input placeholder="+971 50 123 4567" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nationality</FormLabel>
                    <FormControl><Input placeholder="e.g. British" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Internal Tracking */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg">Internal Tracking</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="leadSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lead Source</FormLabel>
                    <FormControl>
                      <LeadSourcePicker value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="assignedToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Representative</FormLabel>
                      <div className="flex gap-2 items-start">
                        <SearchableSelect
                          options={(users && users.length > 0)
                            ? users.map((u: any) => ({ value: String(u.id), label: u.name }))
                            : []}
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(val) => field.onChange(val ? parseInt(val) : null)}
                          placeholder={users && users.length > 0 ? "Select team member" : "No team members found"}
                          searchPlaceholder="Search team members…"
                          disabled={!users || users.length === 0}
                        />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Referee section — shown when leadSource === "referral" */}
              {leadSource === "referral" && (
                <div className="col-span-2">
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-primary" />
                      <h4 className="font-semibold text-primary">Referee</h4>
                      <p className="text-xs text-muted-foreground ml-1">
                        — Link this owner to a registered referee who will earn commission on this and future properties.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                      <FormField
                        control={form.control}
                        name="refereeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Referee</FormLabel>
                            <SearchableSelect
                              options={referees
                                ? referees.filter((r: any) => r.isActive).map((r: any) => ({
                                    value: String(r.id),
                                    label: `${r.refereeCode} — ${r.name}${r.companyName ? ` (${r.companyName})` : ""}`,
                                  }))
                                : []}
                              value={field.value ? String(field.value) : ""}
                              onValueChange={(val) => field.onChange(val ? parseInt(val) : null)}
                              placeholder="Choose existing referee…"
                              searchPlaceholder="Search referees…"
                              disabled={!referees || referees.filter((r: any) => r.isActive).length === 0}
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-2 bg-background"
                        onClick={() => setAddRefereeOpen(true)}
                      >
                        <Plus className="h-4 w-4" /> New Referee
                      </Button>
                    </div>

                    {/* Show selected referee details */}
                    {selectedReferee && (
                      <div className="p-3 bg-background rounded-md border border-border/50 space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-xs bg-primary/5 border-primary/30 text-primary shrink-0">
                            {(selectedReferee as any).refereeCode}
                          </Badge>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">{selectedReferee.name}</p>
                            {(selectedReferee as any).companyName && (
                              <p className="text-xs text-muted-foreground">{(selectedReferee as any).companyName}</p>
                            )}
                          </div>
                          {(selectedReferee as any).isRecurringEnabled && (
                            <Badge variant="outline" className="text-xs gap-1 text-emerald-700 border-emerald-300 bg-emerald-50 shrink-0">
                              <RefreshCw className="h-2.5 w-2.5" /> Recurring
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-5 gap-1 text-center text-xs pt-1">
                          {[
                            { label: "Studio", value: (selectedReferee as any).referralFeeStudio },
                            { label: "1 BR", value: (selectedReferee as any).referralFee1br },
                            { label: "2 BR", value: (selectedReferee as any).referralFee2br },
                            { label: "3 BR", value: (selectedReferee as any).referralFee3br },
                            { label: "4+ BR", value: (selectedReferee as any).referralFee4brPlus },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-muted/40 rounded p-1">
                              <p className="text-[10px] text-muted-foreground">{label}</p>
                              <p className="font-semibold">{Number(value ?? 0).toLocaleString()} AED</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any context regarding their investment goals..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="isExistingClient"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-border p-4 bg-muted/10">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Existing Management Client</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Check this if they already have properties managed by RHH.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── Owned Properties (optional) ──────────────────────── */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Owned Properties</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">Link existing properties to this owner (optional — can be done later).</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addPropertyRow} className="h-8 text-xs gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Property
                </Button>
              </div>
            </CardHeader>
            {propertyRows.length > 0 && (
              <CardContent className="p-0">
                {propertyRows.map((row, idx) => (
                  <div key={idx} className={`p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end ${idx < propertyRows.length - 1 ? "border-b border-border" : ""}`}>
                    {/* Property selector */}
                    <div className="md:col-span-5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Property</label>
                      <select
                        value={row.propertyId > 0 ? row.propertyId : ""}
                        onChange={e => updatePropertyRow(idx, { propertyId: parseInt(e.target.value, 10) || 0 })}
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select property…</option>
                        {(allProperties ?? []).map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.unitNumber ? `${p.unitNumber}, ` : ""}{p.projectBuilding || p.area} — {p.bedrooms} Bed
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Ownership % */}
                    <div className="md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stake %</label>
                      <div className="relative mt-1">
                        <Input
                          type="number" min={0} max={100} step={1}
                          value={row.ownershipPercentage}
                          onChange={e => updatePropertyRow(idx, { ownershipPercentage: parseFloat(e.target.value) || 0 })}
                          className="pr-6 h-9 text-sm"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                    {/* Ownership type */}
                    <div className="md:col-span-3">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</label>
                      <select
                        value={row.ownershipType}
                        onChange={e => updatePropertyRow(idx, { ownershipType: e.target.value })}
                        className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {OWNERSHIP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    {/* Primary + remove */}
                    <div className="md:col-span-2 flex items-center gap-3 pt-4 md:pt-0">
                      <button type="button" onClick={() => updatePropertyRow(idx, { isPrimary: !row.isPrimary })}
                        className={`text-xs font-medium ${row.isPrimary ? "text-amber-600" : "text-muted-foreground hover:text-amber-500"}`}>
                        {row.isPrimary ? "★ Primary" : "☆ Primary"}
                      </button>
                      <button type="button" onClick={() => removePropertyRow(idx)}
                        className="text-muted-foreground hover:text-red-600 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          <div className="flex justify-end gap-4">
            <Link href="/owners" className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-8 text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </Link>
            <Button type="submit" disabled={createOwner.isPending} className="px-8">
              {createOwner.isPending ? "Creating..." : "Save Owner Profile"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Quick-create Referee Dialog */}
      <Dialog open={addRefereeOpen} onOpenChange={setAddRefereeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Register New Referee</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              A unique Referee ID (e.g. <span className="font-mono font-medium">REF-001</span>) will be automatically generated.
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

            {/* One-time referral fees by layout */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5 text-primary" />
                <Label className="text-sm">One-Time Referral Fees (AED)</Label>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                {([
                  { label: "Studio", field: "referralFeeStudio" },
                  { label: "1 Bedroom", field: "referralFee1br" },
                  { label: "2 Bedrooms", field: "referralFee2br" },
                  { label: "3 Bedrooms", field: "referralFee3br" },
                  { label: "4+ Bedrooms", field: "referralFee4brPlus" },
                ] as const).map(({ label, field }) => (
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

            {/* Recurring commission toggle */}
            <div className="space-y-2">
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
                  onCheckedChange={(val) => refereeForm.setValue("isRecurringEnabled", val)}
                />
              </div>
              {isRefereeRecurring && (
                <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1.5">
                  e.g. 20% PM → agent gets 4%, RHH keeps 16%. Min RHH floor: 15%.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddRefereeOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createReferee.isPending} className="gap-2">
                {createReferee.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create & Select
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick-create Representative Dialog */}
      <Dialog open={addRepOpen} onOpenChange={setAddRepOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Add New Representative</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Create a team member account. They'll be able to log in immediately with these credentials.
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
              <Input
                type="password"
                placeholder="Min. 8 characters"
                {...repForm.register("password", { required: true, minLength: 8 })}
              />
              <p className="text-xs text-muted-foreground">Share this with them — they can change it after first login.</p>
            </div>
            <div className="space-y-2">
              <Label>Role <span className="text-destructive">*</span></Label>
              <select
                {...repForm.register("roleId", { required: true })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select a role…</option>
                {roles?.map(r => (
                  <option key={r.id} value={r.id.toString()}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input placeholder="+971 50 123 4567" {...repForm.register("phone")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddRepOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createUser.isPending} className="gap-2">
                {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create & Select
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
