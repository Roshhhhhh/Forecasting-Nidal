import { useGetCompanySettings, useUpdateCompanySettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useRef } from "react";
import { Save } from "lucide-react";

const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  brandName: z.string().min(1, "Brand name is required"),
  currency: z.string().default("AED"),
  phone: z.string().optional(),
  website: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  guestEmail: z.string().email().optional(),
  address: z.string().optional(),
  defaultManagementFeePercent: z.coerce.number().min(0).max(100),
  defaultLtrVacancyPercent: z.coerce.number().min(0).max(100),
  proposalValidityDays: z.coerce.number().min(1),
  disclaimer: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export default function Settings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const formInitialized = useRef(false);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: "",
      brandName: "",
      currency: "AED",
      defaultManagementFeePercent: 20,
      defaultLtrVacancyPercent: 5,
      proposalValidityDays: 14,
    },
  });

  useEffect(() => {
    if (settings && !formInitialized.current) {
      form.reset({
        companyName: settings.companyName,
        brandName: settings.brandName,
        currency: settings.currency,
        phone: settings.phone || "",
        website: settings.website || "",
        ownerEmail: settings.ownerEmail || "",
        guestEmail: settings.guestEmail || "",
        address: settings.address || "",
        defaultManagementFeePercent: settings.defaultManagementFeePercent || 20,
        defaultLtrVacancyPercent: settings.defaultLtrVacancyPercent || 5,
        proposalValidityDays: settings.proposalValidityDays || 14,
        disclaimer: settings.disclaimer || "",
      });
      formInitialized.current = true;
    }
  }, [settings, form]);

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      await updateSettings.mutateAsync({ data: data as any });
      toast({ title: "Settings Saved", description: "Company configuration updated successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">Configure company details, proposal defaults, and disclaimers.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg font-serif">Brand Identity</CardTitle>
              <CardDescription>How your company appears on public proposals.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legal Company Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brandName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand / Trading Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="col-span-1 md:col-span-2">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Headquarters Address</FormLabel>
                      <FormControl><Textarea {...field} className="min-h-[80px]" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg font-serif">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Main Phone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ownerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner Relations Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guestEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guest Support Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle className="text-lg font-serif">Forecast Defaults</CardTitle>
              <CardDescription>Default values used when creating new forecasts.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="defaultManagementFeePercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Management Fee (%)</FormLabel>
                    <FormControl><Input type="number" min="0" max="100" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultLtrVacancyPercent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LTR Vacancy Assumption (%)</FormLabel>
                    <FormControl><Input type="number" min="0" max="100" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="proposalValidityDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposal Validity (Days)</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="col-span-1 md:col-span-3">
                <FormField
                  control={form.control}
                  name="disclaimer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Disclaimer (Appears on all proposals)</FormLabel>
                      <FormControl><Textarea {...field} className="min-h-[120px]" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Fixed bottom bar for save */}
          <div className="fixed bottom-0 left-[var(--sidebar-width,250px)] right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border flex justify-end z-50">
            <Button type="submit" disabled={updateSettings.isPending} className="px-8 shadow-sm">
              <Save className="mr-2 h-4 w-4" />
              {updateSettings.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
