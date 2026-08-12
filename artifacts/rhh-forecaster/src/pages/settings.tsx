import { useGetCompanySettings, useUpdateCompanySettings, useGetMe, getGetCompanySettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { Save, Bell } from "lucide-react";
import { AmenitiesTab } from "./settings/amenities-tab";
import { MarketDataTab } from "./settings/market-data-tab";

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
  portfolioManagedProperties: z.string().optional(),
  portfolioFiveStarReviews: z.string().optional(),
  portfolioMonthlyBookings: z.string().optional(),
  portfolioMonthlyTravelers: z.string().optional(),
  portfolioAssetsUnderManagement: z.string().optional(),
  portfolioTrustedOwners: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

function GeneralTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetCompanySettings();
  const updateSettings = useUpdateCompanySettings();

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

  // Sync form to server data every time it (re)loads — no one-shot guard so
  // navigating away and back always shows the latest saved values.
  useEffect(() => {
    if (!settings) return;
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
      portfolioManagedProperties: (settings as any).portfolioManagedProperties ?? "",
      portfolioFiveStarReviews: (settings as any).portfolioFiveStarReviews ?? "",
      portfolioMonthlyBookings: (settings as any).portfolioMonthlyBookings ?? "",
      portfolioMonthlyTravelers: (settings as any).portfolioMonthlyTravelers ?? "",
      portfolioAssetsUnderManagement: (settings as any).portfolioAssetsUnderManagement ?? "",
      portfolioTrustedOwners: (settings as any).portfolioTrustedOwners ?? "",
    });
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      await updateSettings.mutateAsync({ data: data as any });
      // Invalidate cache so the next mount always fetches fresh data from the server.
      await queryClient.invalidateQueries({ queryKey: getGetCompanySettingsQueryKey() });
      toast({ title: "Settings Saved", description: "Company configuration updated successfully." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading settings…</div>;

  return (
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

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="border-b border-border bg-muted/20">
            <CardTitle className="text-lg font-serif">Portfolio Stats</CardTitle>
            <CardDescription>Numbers shown in the "Our Portfolio" section on every public proposal.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField control={form.control} name="portfolioManagedProperties"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Managed Properties</FormLabel>
                  <FormControl><Input placeholder="160+" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="portfolioFiveStarReviews"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Five-Star Reviews</FormLabel>
                  <FormControl><Input placeholder="5,000+" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="portfolioMonthlyBookings"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bookings per Month</FormLabel>
                  <FormControl><Input placeholder="1,000+" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="portfolioMonthlyTravelers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Travellers Hosted Monthly</FormLabel>
                  <FormControl><Input placeholder="3,500+" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="portfolioAssetsUnderManagement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assets Under Management</FormLabel>
                  <FormControl><Input placeholder="AED 250M+" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="portfolioTrustedOwners"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trusted Home Owners</FormLabel>
                  <FormControl><Input placeholder="100+" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Fixed bottom bar for save */}
        <div className="fixed bottom-0 left-[var(--sidebar-width,250px)] right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border flex justify-end z-50">
          <Button type="submit" disabled={updateSettings.isPending} className="px-8 shadow-sm">
            <Save className="mr-2 h-4 w-4" />
            {updateSettings.isPending ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ── Pipeline settings tab (super_admin only) ──────────────────────────────────

function PipelineTab() {
  const { toast } = useToast();
  const [threshold, setThreshold] = useState<number>(3);
  const [dirty, setDirty] = useState(false);

  const { data: config, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["app-config"],
    queryFn: async () => {
      const res = await fetch("/api/config", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load config");
      return res.json();
    },
  });

  useEffect(() => {
    if (config?.follow_up_threshold_days) {
      setThreshold(parseInt(config.follow_up_threshold_days) || 3);
      setDirty(false);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (value: number) => {
      const res = await fetch("/api/config/follow_up_threshold_days", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: String(value) }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Follow-up threshold updated." });
      setDirty(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save setting.", variant: "destructive" });
    },
  });

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">Loading…</div>;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-lg font-serif">Follow-up Reminders</CardTitle>
        </div>
        <CardDescription>
          Control when the "Follow-ups Due" alert appears on the dashboard and pipeline for unresponsive owners.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">
              Days without owner response before alerting
            </label>
            <p className="text-xs text-muted-foreground">
              Applies to proposals in <strong>Sent</strong> or <strong>Viewed</strong> status with no owner action.
            </p>
            <div className="flex items-center gap-3 mt-1">
              <Input
                type="number"
                min={1}
                max={30}
                value={threshold}
                onChange={e => {
                  setThreshold(parseInt(e.target.value) || 1);
                  setDirty(true);
                }}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
          </div>
        </div>
        <div className="pt-2">
          <Button
            onClick={() => saveMutation.mutate(threshold)}
            disabled={!dirty || saveMutation.isPending}
            size="sm"
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { data: me } = useGetMe();
  const isSuperAdmin = (me as any)?.role === "super_admin";

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">Platform Settings</h1>
        <p className="text-muted-foreground mt-1">Configure company details, proposals, and the amenity library.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="amenities">Amenities</TabsTrigger>
          <TabsTrigger value="market-data">Market Data</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="pipeline">Pipeline</TabsTrigger>}
        </TabsList>

        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>

        <TabsContent value="amenities">
          <AmenitiesTab />
        </TabsContent>

        <TabsContent value="market-data">
          <MarketDataTab />
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="pipeline">
            <PipelineTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
