import { useState } from "react";
import { useCreateOwner, useListUsers, useListReferees, useCreateReferee } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserCheck, Plus, Loader2 } from "lucide-react";

const ownerSchema = z.object({
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

type OwnerFormValues = z.infer<typeof ownerSchema>;

interface RefereeQuickFormValues {
  name: string;
  phone?: string;
  email?: string;
  companyName?: string;
  commissionPercent?: number;
}

export default function OwnerNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createOwner = useCreateOwner();
  const createReferee = useCreateReferee();
  const { data: users } = useListUsers();
  const { data: referees } = useListReferees();

  const [addRefereeOpen, setAddRefereeOpen] = useState(false);
  const refereeForm = useForm<RefereeQuickFormValues>({
    defaultValues: { name: "", commissionPercent: 5 },
  });

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

  const selectedReferee = referees?.find((r: any) => r.id === selectedRefereeId);

  const onSubmit = async (data: OwnerFormValues) => {
    try {
      const submitData: any = { ...data };
      if (submitData.assignedToId === 0 || !submitData.assignedToId) delete submitData.assignedToId;
      if (submitData.refereeId === 0 || !submitData.refereeId) delete submitData.refereeId;
      if (!submitData.companyName) delete submitData.companyName;

      const result = await createOwner.mutateAsync({ data: submitData });
      toast({ title: "Owner created", description: "The owner profile has been created successfully." });
      setLocation(`/owners/${result.id}`);
    } catch {
      toast({ title: "Error", description: "Failed to create owner.", variant: "destructive" });
    }
  };

  async function handleCreateReferee(data: RefereeQuickFormValues) {
    try {
      const newReferee = await createReferee.mutateAsync({ data: data as any });
      queryClient.invalidateQueries({ queryKey: ["listReferees"] });
      form.setValue("refereeId", (newReferee as any).id);
      setAddRefereeOpen(false);
      refereeForm.reset({ name: "", commissionPercent: 5 });
      toast({
        title: "Referee created",
        description: `${(newReferee as any).refereeCode} — ${(newReferee as any).name}`,
      });
    } catch {
      toast({ title: "Failed to create referee", variant: "destructive" });
    }
  }

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/owners" className="hover:text-foreground transition-colors">Owners</Link>
        <span>/</span>
        <span className="text-foreground font-medium">New Owner</span>
      </div>

      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Create Owner Profile</h1>
        <p className="text-muted-foreground mt-1">Add a new property owner or corporate client to your database.</p>
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
                    <FormLabel>Last Name <span className="text-destructive">*</span></FormLabel>
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
                    <FormLabel>Email Address <span className="text-destructive">*</span></FormLabel>
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
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Where did they come from?" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="website">Website Inquiry</SelectItem>
                        <SelectItem value="referral">Referral</SelectItem>
                        <SelectItem value="cold_outreach">Cold Outreach</SelectItem>
                        <SelectItem value="agent">Real Estate Agent</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assignedToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assigned Representative</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val ? parseInt(val) : null)}
                      value={field.value ? String(field.value) : ""}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users && users.length > 0 ? (
                          users.map((user: any) => (
                            <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                          ))
                        ) : (
                          <SelectItem value="_none" disabled>No team members found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                                {referees && referees.length > 0 ? (
                                  referees
                                    .filter((r: any) => r.isActive)
                                    .map((r: any) => (
                                      <SelectItem key={r.id} value={String(r.id)}>
                                        <span className="font-mono text-xs text-primary mr-2">{r.refereeCode}</span>
                                        {r.name}
                                        {r.companyName && <span className="text-muted-foreground ml-1">({r.companyName})</span>}
                                      </SelectItem>
                                    ))
                                ) : (
                                  <SelectItem value="_none" disabled>No referees registered yet</SelectItem>
                                )}
                              </SelectContent>
                            </Select>
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
                      <div className="flex items-center gap-3 p-3 bg-background rounded-md border border-border/50">
                        <Badge variant="outline" className="font-mono text-xs bg-primary/5 border-primary/30 text-primary shrink-0">
                          {(selectedReferee as any).refereeCode}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{selectedReferee.name}</p>
                          {(selectedReferee as any).companyName && (
                            <p className="text-xs text-muted-foreground">{(selectedReferee as any).companyName}</p>
                          )}
                        </div>
                        <div className="ml-auto text-sm shrink-0">
                          <span className="text-muted-foreground">Commission: </span>
                          <span className="font-semibold text-primary">{(selectedReferee as any).commissionPercent}%</span>
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
            <div className="space-y-2">
              <Label>Commission (%)</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  {...refereeForm.register("commissionPercent", { valueAsNumber: true })}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
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
