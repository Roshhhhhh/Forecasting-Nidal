import { useCreateOwner, useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  notes: z.string().optional(),
});

type OwnerFormValues = z.infer<typeof ownerSchema>;

export default function OwnerNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createOwner = useCreateOwner();
  const { data: users } = useListUsers();

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

  const onSubmit = async (data: OwnerFormValues) => {
    try {
      // Clean up empty optional fields
      const submitData = { ...data };
      if (submitData.assignedToId === 0) delete submitData.assignedToId;
      if (!submitData.companyName) delete submitData.companyName;

      const result = await createOwner.mutateAsync({ data: submitData as any });
      toast({ title: "Owner created", description: "The owner profile has been created successfully." });
      setLocation(`/owners/${result.id}`);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create owner.", variant: "destructive" });
    }
  };

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
                          <FormControl>
                            <RadioGroupItem value="individual" />
                          </FormControl>
                          <FormLabel className="font-medium flex-1 cursor-pointer">Individual</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border border-border p-4 bg-background flex-1 cursor-pointer">
                          <FormControl>
                            <RadioGroupItem value="company" />
                          </FormControl>
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
                        <FormControl>
                          <Input placeholder="Acme Holdings LLC" {...field} />
                        </FormControl>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.map(user => (
                          <SelectItem key={user.id} value={user.id.toString()}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any context regarding their investment goals..." className="min-h-[100px]" {...field} />
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
    </div>
  );
}
