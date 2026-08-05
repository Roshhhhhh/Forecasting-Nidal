import { useState } from "react";
import {
  useGetOwner, useUpdateOwner, useListProperties, useListForecasts,
  useListUsers, useListReferees, useCreateReferee, useCreateUser,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Plus, Mail, Phone, MapPin, FileText, Pencil, Home, Globe,
  UserCheck, UserPlus, Loader2, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const editSchema = z.object({
  ownerType: z.enum(["individual", "company"]),
  title: z.string().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().optional(),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  nationality: z.string().optional(),
  leadSource: z.string().optional(),
  isExistingClient: z.boolean().default(false),
  assignedToId: z.coerce.number().optional().nullable(),
  refereeId: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

interface RepQuickFormValues {
  name: string; email: string; password: string;
  role: "sales" | "revenue_manager" | "admin" | "super_admin" | "read_only";
  phone?: string;
}

interface RefereeQuickFormValues {
  name: string; phone?: string; email?: string; companyName?: string;
  referralFeeStudio: number; referralFee1br: number; referralFee2br: number;
  referralFee3br: number; referralFee4brPlus: number; isRecurringEnabled: boolean;
}

export default function OwnerDetail() {
  const { id } = useParams<{ id: string }>();
  const ownerId = parseInt(id || "0", 10);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: owner, isLoading: isOwnerLoading } = useGetOwner(ownerId);
  const { data: properties, isLoading: isPropsLoading } = useListProperties();
  const { data: forecasts, isLoading: isForecastsLoading } = useListForecasts();
  const { data: users } = useListUsers();
  const { data: referees } = useListReferees();

  const updateOwner = useUpdateOwner();
  const createUser = useCreateUser();
  const createReferee = useCreateReferee();

  const [editOpen, setEditOpen] = useState(false);
  const [addRepOpen, setAddRepOpen] = useState(false);
  const [addRefereeOpen, setAddRefereeOpen] = useState(false);

  const form = useForm<EditFormValues>({ resolver: zodResolver(editSchema) });
  const repForm = useForm<RepQuickFormValues>({
    defaultValues: { name: "", email: "", password: "", role: "sales" },
  });
  const refereeForm = useForm<RefereeQuickFormValues>({
    defaultValues: {
      name: "", referralFeeStudio: 1500, referralFee1br: 2000,
      referralFee2br: 2500, referralFee3br: 3000, referralFee4brPlus: 3500,
      isRecurringEnabled: false,
    },
  });

  const watchedOwnerType = form.watch("ownerType");
  const watchedLeadSource = form.watch("leadSource");
  const watchedRefereeId = form.watch("refereeId");
  const isRefereeRecurring = refereeForm.watch("isRecurringEnabled");

  const selectedReferee = referees?.find((r: any) => r.id === watchedRefereeId);

  function openEdit() {
    if (!owner) return;
    form.reset({
      ownerType: (owner.ownerType as any) ?? "individual",
      title: (owner as any).title ?? "",
      firstName: owner.firstName,
      lastName: owner.lastName,
      companyName: (owner as any).companyName ?? "",
      email: owner.email,
      phone: owner.phone ?? "",
      whatsapp: (owner as any).whatsapp ?? "",
      nationality: (owner as any).nationality ?? "",
      leadSource: (owner as any).leadSource ?? "",
      isExistingClient: (owner as any).isExistingClient ?? false,
      assignedToId: (owner as any).assignedToId ?? null,
      refereeId: (owner as any).refereeId ?? null,
      notes: (owner as any).notes ?? "",
    });
    setEditOpen(true);
  }

  async function onSave(data: EditFormValues) {
    try {
      const payload: any = { ...data };
      if (!payload.assignedToId) delete payload.assignedToId;
      if (!payload.refereeId) delete payload.refereeId;
      if (!payload.companyName) delete payload.companyName;
      await updateOwner.mutateAsync({ id: ownerId, data: payload });
      queryClient.invalidateQueries({ queryKey: ["getOwner"] });
      toast({ title: "Profile updated" });
      setEditOpen(false);
    } catch {
      toast({ title: "Failed to save changes", variant: "destructive" });
    }
  }

  async function handleCreateRep(data: RepQuickFormValues) {
    try {
      const newUser = await createUser.mutateAsync({ data: data as any });
      queryClient.invalidateQueries({ queryKey: ["listUsers"] });
      form.setValue("assignedToId", (newUser as any).id);
      setAddRepOpen(false);
      repForm.reset({ name: "", email: "", password: "", role: "sales" });
      toast({ title: "Representative added", description: `${(newUser as any).name} created.` });
    } catch {
      toast({ title: "Failed to create representative", variant: "destructive" });
    }
  }

  async function handleCreateReferee(data: RefereeQuickFormValues) {
    try {
      const newRef = await createReferee.mutateAsync({ data: data as any });
      queryClient.invalidateQueries({ queryKey: ["listReferees"] });
      form.setValue("refereeId", (newRef as any).id);
      setAddRefereeOpen(false);
      refereeForm.reset({ name: "", referralFeeStudio: 1500, referralFee1br: 2000, referralFee2br: 2500, referralFee3br: 3000, referralFee4brPlus: 3500, isRecurringEnabled: false });
      toast({ title: "Referee created", description: `${(newRef as any).refereeCode} — ${(newRef as any).name}` });
    } catch {
      toast({ title: "Failed to create referee", variant: "destructive" });
    }
  }

  if (isOwnerLoading) return <div className="p-8 text-center text-muted-foreground">Loading owner profile...</div>;
  if (!owner) return <div className="p-8 text-center text-red-500">Owner not found.</div>;

  const ownerProperties = properties?.filter(p => p.ownerId === ownerId) || [];
  const ownerForecasts = forecasts?.filter(f => f.ownerId === ownerId) || [];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/owners" className="hover:text-foreground transition-colors">Owners</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{owner.firstName} {owner.lastName}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-serif">
            {(owner as any).companyName ? (owner as any).companyName.charAt(0) : owner.firstName.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
              {(owner as any).ownerType === "company" && (owner as any).companyName
                ? (owner as any).companyName
                : `${(owner as any).title ? (owner as any).title + " " : ""}${owner.firstName} ${owner.lastName}`}
              {(owner as any).isExistingClient && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-sans">Active Client</Badge>
              )}
            </h1>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> <a href={`mailto:${owner.email}`} className="hover:text-foreground">{owner.email}</a></span>
              {owner.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> <a href={`tel:${owner.phone}`} className="hover:text-foreground">{owner.phone}</a></span>}
              {(owner as any).nationality && <span className="flex items-center gap-1.5"><Globe className="h-4 w-4" /> {(owner as any).nationality}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Edit Profile
          </Button>
          <Link href={`/properties/new?ownerId=${owner.id}`} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <Plus className="mr-2 h-4 w-4" /> Add Property
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/20 border-b border-border pb-4">
              <CardTitle className="text-base">Profile Details</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Entity Type</div>
                <div className="font-medium capitalize">{(owner as any).ownerType}</div>

                {(owner as any).ownerType === "company" && (
                  <>
                    <div className="text-muted-foreground">Contact Person</div>
                    <div className="font-medium">{owner.firstName} {owner.lastName}</div>
                  </>
                )}

                <div className="text-muted-foreground">Lead Source</div>
                <div className="font-medium capitalize">{(owner as any).leadSource?.replace("_", " ") || "—"}</div>

                {(owner as any).assignedToName && (
                  <>
                    <div className="text-muted-foreground">Representative</div>
                    <div className="font-medium">{(owner as any).assignedToName}</div>
                  </>
                )}

                {(owner as any).refereeName && (
                  <>
                    <div className="text-muted-foreground">Referee</div>
                    <div className="font-medium flex items-center gap-1.5">
                      <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 border-primary/30 text-primary py-0">
                        {(owner as any).refereeCode}
                      </Badge>
                      {(owner as any).refereeName}
                    </div>
                  </>
                )}

                <div className="text-muted-foreground">Added On</div>
                <div className="font-medium">{new Date(owner.createdAt).toLocaleDateString()}</div>
              </div>

              {(owner as any).notes && (
                <div className="pt-4 border-t border-border">
                  <div className="text-muted-foreground mb-1">Internal Notes</div>
                  <p className="text-foreground">{(owner as any).notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Tabs defaultValue="properties" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
              <TabsTrigger value="properties">Properties ({ownerProperties.length})</TabsTrigger>
              <TabsTrigger value="forecasts">Forecasts ({ownerForecasts.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="properties" className="mt-6">
              <Card className="shadow-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b border-border">
                  <div>
                    <CardTitle className="text-lg font-serif">Portfolio</CardTitle>
                    <CardDescription>Properties owned by this client</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isPropsLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading properties...</div>
                  ) : ownerProperties.length === 0 ? (
                    <div className="p-12 text-center border-b border-border last:border-0">
                      <Home className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-foreground mb-1">No properties yet</h3>
                      <p className="text-muted-foreground mb-4">Add a property to start forecasting revenue.</p>
                      <Link href={`/properties/new?ownerId=${owner.id}`} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted transition-colors">
                        Add Property
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {ownerProperties.map(prop => (
                        <div key={prop.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded bg-secondary/10 flex items-center justify-center flex-shrink-0">
                              <MapPin className="h-5 w-5 text-secondary" />
                            </div>
                            <div>
                              <Link href={`/properties/${prop.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                                {(prop as any).projectBuilding ? `${(prop as any).unitNumber ? (prop as any).unitNumber + ", " : ""}${(prop as any).projectBuilding}` : prop.area}
                              </Link>
                              <div className="text-sm text-muted-foreground mt-0.5">
                                {prop.area}, {prop.emirate} • {prop.bedrooms} Bed {prop.propertyType}
                              </div>
                            </div>
                          </div>
                          <Link href={`/forecasts/new?propertyId=${prop.id}`} className="inline-flex h-8 items-center justify-center rounded-md bg-secondary/10 px-3 text-xs font-medium text-secondary hover:bg-secondary/20 transition-colors">
                            New Forecast
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="forecasts" className="mt-6">
              <Card className="shadow-sm border-border/50">
                <CardHeader className="flex flex-row items-center justify-between bg-muted/20 border-b border-border">
                  <div>
                    <CardTitle className="text-lg font-serif">Forecast History</CardTitle>
                    <CardDescription>Revenue projections created for this owner</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isForecastsLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading forecasts...</div>
                  ) : ownerForecasts.length === 0 ? (
                    <div className="p-12 text-center">
                      <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <h3 className="text-lg font-medium text-foreground mb-1">No forecasts yet</h3>
                      <p className="text-muted-foreground">Create a forecast for one of their properties.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {ownerForecasts.map(forecast => (
                        <div key={forecast.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                          <div>
                            <Link href={`/forecasts/${forecast.id}`} className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2">
                              {forecast.referenceNumber}
                              <Badge variant="outline" className="text-[10px] uppercase bg-background">
                                {forecast.status.replace("_", " ")}
                              </Badge>
                            </Link>
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {(forecast as any).propertyAddress} • Proj. Income: {forecast.netOwnerIncome ? `AED ${forecast.netOwnerIncome.toLocaleString()}` : "TBD"}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(forecast.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Edit Owner Profile</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-6 pt-2">

              {/* Entity type */}
              <FormField control={form.control} name="ownerType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Entity Type</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value}
                      className="flex gap-4">
                      <FormItem className="flex items-center gap-2 space-y-0 rounded-md border border-border p-3 flex-1 cursor-pointer">
                        <FormControl><RadioGroupItem value="individual" /></FormControl>
                        <FormLabel className="cursor-pointer font-medium">Individual</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center gap-2 space-y-0 rounded-md border border-border p-3 flex-1 cursor-pointer">
                        <FormControl><RadioGroupItem value="company" /></FormControl>
                        <FormLabel className="cursor-pointer font-medium">Corporate Entity</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )} />

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                {watchedOwnerType === "company" && (
                  <div className="col-span-2">
                    <FormField control={form.control} name="companyName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company Name</FormLabel>
                        <FormControl><Input {...field} placeholder="Acme Holdings LLC" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {["Mr.", "Mrs.", "Ms.", "Dr.", "H.E."].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <div />
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} placeholder="+971 50 123 4567" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="nationality" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nationality</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. British" /></FormControl>
                  </FormItem>
                )} />
              </div>

              {/* Internal tracking */}
              <div className="border-t border-border pt-4 space-y-4">
                <p className="text-sm font-semibold text-foreground">Internal Tracking</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="leadSource" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Lead Source</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value ?? ""}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Where did they come from?" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website Inquiry</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                          <SelectItem value="agent">Real Estate Agent</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  {/* Assigned rep with quick-add */}
                  <FormField control={form.control} name="assignedToId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assigned Representative</FormLabel>
                      <div className="flex gap-2">
                        <Select
                          onValueChange={(val) => field.onChange(val ? parseInt(val) : null)}
                          value={field.value ? String(field.value) : ""}
                        >
                          <FormControl><SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {users?.map((u: any) => (
                              <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button type="button" variant="outline" size="icon" className="shrink-0"
                          title="Add new representative" onClick={() => setAddRepOpen(true)}>
                          <UserPlus className="h-4 w-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Referee section */}
                {watchedLeadSource === "referral" && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm text-primary">Referee</h4>
                    </div>
                    <div className="flex gap-2 items-start">
                      <FormField control={form.control} name="refereeId" render={({ field }) => (
                        <FormItem className="flex-1">
                          <Select
                            onValueChange={(val) => field.onChange(val ? parseInt(val) : null)}
                            value={field.value ? String(field.value) : ""}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Choose existing referee..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {referees?.filter((r: any) => r.isActive).map((r: any) => (
                                <SelectItem key={r.id} value={String(r.id)}>
                                  <span className="font-mono text-xs text-primary mr-2">{r.refereeCode}</span>
                                  {r.name}{r.companyName && ` (${r.companyName})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )} />
                      <Button type="button" variant="outline" className="gap-1.5 bg-background shrink-0"
                        onClick={() => setAddRefereeOpen(true)}>
                        <Plus className="h-4 w-4" /> New Referee
                      </Button>
                    </div>
                    {selectedReferee && (
                      <div className="p-3 bg-background rounded-md border border-border/50 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs bg-primary/5 border-primary/30 text-primary">
                            {(selectedReferee as any).refereeCode}
                          </Badge>
                          <span className="text-sm font-medium">{selectedReferee.name}</span>
                          {(selectedReferee as any).isRecurringEnabled && (
                            <Badge variant="outline" className="text-xs gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
                              <RefreshCw className="h-2.5 w-2.5" /> Recurring
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-5 gap-1 text-center text-xs">
                          {[
                            { l: "Studio", v: (selectedReferee as any).referralFeeStudio },
                            { l: "1 BR", v: (selectedReferee as any).referralFee1br },
                            { l: "2 BR", v: (selectedReferee as any).referralFee2br },
                            { l: "3 BR", v: (selectedReferee as any).referralFee3br },
                            { l: "4+ BR", v: (selectedReferee as any).referralFee4brPlus },
                          ].map(({ l, v }) => (
                            <div key={l} className="bg-muted/40 rounded p-1">
                              <p className="text-[10px] text-muted-foreground">{l}</p>
                              <p className="font-semibold">{Number(v ?? 0).toLocaleString()} AED</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Internal Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Any context regarding their investment goals..." className="min-h-[80px]" />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="isExistingClient" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 rounded-md border border-border p-3 bg-muted/10">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div>
                      <FormLabel>Existing Management Client</FormLabel>
                      <p className="text-xs text-muted-foreground">Already has properties managed by RHH.</p>
                    </div>
                  </FormItem>
                )} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={updateOwner.isPending} className="gap-2">
                  {updateOwner.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Quick-create Representative */}
      <Dialog open={addRepOpen} onOpenChange={setAddRepOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Add New Representative</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">They'll be able to log in immediately with these credentials.</p>
          </DialogHeader>
          <form onSubmit={repForm.handleSubmit(handleCreateRep)} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input {...repForm.register("name", { required: true })} placeholder="Sarah Mitchell" />
            </div>
            <div className="space-y-2">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" {...repForm.register("email", { required: true })} placeholder="sarah@royalholiday.ae" />
            </div>
            <div className="space-y-2">
              <Label>Temporary Password <span className="text-destructive">*</span></Label>
              <Input type="password" {...repForm.register("password", { required: true, minLength: 8 })} placeholder="Min. 8 characters" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select {...repForm.register("role")} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="sales">Sales</option>
                <option value="revenue_manager">Revenue Manager</option>
                <option value="admin">Admin</option>
                <option value="read_only">Read Only</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...repForm.register("phone")} placeholder="+971 50 123 4567" />
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

      {/* Quick-create Referee */}
      <Dialog open={addRefereeOpen} onOpenChange={setAddRefereeOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Register New Referee</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">A unique Referee ID will be automatically generated.</p>
          </DialogHeader>
          <form onSubmit={refereeForm.handleSubmit(handleCreateReferee)} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input {...refereeForm.register("name", { required: true })} placeholder="e.g. Ahmed Al-Mansoori" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...refereeForm.register("phone")} placeholder="+971 50 000 0000" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...refereeForm.register("email")} placeholder="ahmed@example.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company / Agency</Label>
              <Input {...refereeForm.register("companyName")} placeholder="Al Mansoori Real Estate" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
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
                      <Input type="number" min="0" step="100"
                        {...refereeForm.register(field, { valueAsNumber: true })}
                        className="pr-10 text-sm h-8" />
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
              <Switch checked={isRefereeRecurring}
                onCheckedChange={(val) => refereeForm.setValue("isRecurringEnabled", val)} />
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
    </div>
  );
}
