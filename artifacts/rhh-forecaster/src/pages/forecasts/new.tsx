import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useListOwners, useListProperties, useCreateForecast } from "@workspace/api-client-react";
import { ForecastRequestContextBar } from "@/components/ForecastRequestContextBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronRight } from "lucide-react";

// For the wizard, we'll implement step 1 and 2 to create the entity, then redirect to the full editor.
const STEPS = [
  "Owner Information",
  "Property Selection",
  "Market Benchmark",
  "AI Recommendations",
  "Seasonal ADR",
  "Occupancy",
  "Expenses",
  "Scenarios",
  "Monthly Setup",
  "Proposal",
  "Review",
  "Publish"
];

const wizardSchema = z.object({
  ownerId: z.coerce.number().min(1, "Owner is required"),
  propertyId: z.coerce.number().min(1, "Property is required"),
});

type WizardFormValues = z.infer<typeof wizardSchema>;

export default function ForecastWizard() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const frIdStr = searchParams.get("forecastRequestId");
  const forecastRequestId = frIdStr ? parseInt(frIdStr, 10) : null;
  const urlOwnerId = searchParams.get("ownerId") ? parseInt(searchParams.get("ownerId")!, 10) : 0;
  const urlPropertyId = searchParams.get("propertyId") ? parseInt(searchParams.get("propertyId")!, 10) : 0;

  const { toast } = useToast();
  const createForecast = useCreateForecast();
  
  const { data: owners, isLoading: isOwnersLoading } = useListOwners();
  const { data: properties, isLoading: isPropsLoading } = useListProperties();

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      ownerId: urlOwnerId || 0,
      propertyId: urlPropertyId || 0,
    },
  });

  // If coming from a FR with owner+property pre-selected, skip to step 2 or submit directly
  const initialStep = (urlOwnerId && urlPropertyId) ? 2 : (urlOwnerId ? 2 : 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => { if (initialStep > 1) setStep(initialStep); });

  const selectedOwnerId = form.watch("ownerId");
  const filteredProperties = properties?.filter(p => p.ownerId === selectedOwnerId) || [];

  const handleNext = () => {
    if (step === 1 && !selectedOwnerId) {
      toast({ title: "Required", description: "Please select an owner first.", variant: "destructive" });
      return;
    }
    setStep(s => s + 1);
  };

  const onSubmit = async (data: WizardFormValues) => {
    try {
      const result = await createForecast.mutateAsync({ 
        data: {
          ownerId: data.ownerId,
          propertyId: data.propertyId,
          managementFeePercent: 20,
          ltrVacancyPercent: 5,
        } as any 
      });

      // Link forecast to the originating request
      if (forecastRequestId) {
        try {
          await fetch(`/api/forecast-requests/${forecastRequestId}/link-forecast`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ forecastId: result.id }),
          });
        } catch {
          // non-critical — forecast is created, just log
          console.warn("Could not link forecast to request");
        }
      }

      toast({ title: "Draft Created", description: "Navigating to forecast builder..." });
      setLocation(`/forecasts/${result.id}`);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create forecast.", variant: "destructive" });
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8">
      {forecastRequestId && (
        <ForecastRequestContextBar forecastRequestId={forecastRequestId} context="forecast" />
      )}
      <div>
        <h1 className="text-3xl font-serif font-bold text-foreground">New Revenue Forecast</h1>
        <p className="text-muted-foreground mt-1 text-lg">Guided setup for accurate income projections.</p>
      </div>

      {/* Stepper */}
      <div className="w-full overflow-hidden">
        <div className="flex items-center space-x-2 overflow-x-auto pb-4 hide-scrollbar">
          {STEPS.map((label, index) => {
            const stepNum = index + 1;
            const isActive = stepNum === step;
            const isPast = stepNum < step;
            return (
              <div key={label} className="flex items-center">
                <div className={`flex items-center justify-center h-8 w-8 rounded-full border-2 text-sm font-medium shrink-0
                  ${isActive ? 'border-primary bg-primary text-primary-foreground' : 
                    isPast ? 'border-primary bg-primary/10 text-primary' : 
                    'border-muted bg-background text-muted-foreground'}`}
                >
                  {isPast ? <Check className="h-4 w-4" /> : stepNum}
                </div>
                <span className={`ml-2 text-sm whitespace-nowrap ${isActive ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {label}
                </span>
                {index < STEPS.length - 1 && (
                  <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground/50 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-border/50 shadow-sm min-h-[400px] flex flex-col">
            <CardHeader className="border-b border-border bg-muted/20">
              <CardTitle>{STEPS[step-1]}</CardTitle>
              <CardDescription>
                {step === 1 ? "Select the client you are forecasting for." : "Select the specific property."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-8">
              {step === 1 && (
                <div className="max-w-md mx-auto space-y-6">
                  <FormField
                    control={form.control}
                    name="ownerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client / Owner</FormLabel>
                        <SearchableSelect
                          options={(owners ?? []).map(o => ({
                            value: o.id.toString(),
                            label: o.ownerType === "company" && o.companyName
                              ? o.companyName
                              : `${o.firstName} ${o.lastName}`,
                          }))}
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          placeholder={isOwnersLoading ? "Loading…" : "Search owners…"}
                          searchPlaceholder="Type name…"
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="text-center text-sm text-muted-foreground py-4">
                    Or <button type="button" onClick={() => setLocation('/owners/new')} className="text-primary hover:underline">create a new owner</button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="max-w-md mx-auto space-y-6">
                  <FormField
                    control={form.control}
                    name="propertyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Property</FormLabel>
                        <SearchableSelect
                          options={filteredProperties.map(p => ({
                            value: p.id.toString(),
                            label: `${p.projectBuilding ? `${p.unitNumber ? p.unitNumber + ", " : ""}${p.projectBuilding}` : p.area} (${p.emirate})`,
                          }))}
                          value={field.value ? field.value.toString() : ""}
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          placeholder={isPropsLoading ? "Loading…" : filteredProperties.length === 0 ? "No properties for this owner" : "Search properties…"}
                          searchPlaceholder="Type building or area…"
                          disabled={filteredProperties.length === 0}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="text-center text-sm text-muted-foreground py-4">
                    Or <button type="button" onClick={() => setLocation(`/properties/new?ownerId=${selectedOwnerId}`)} className="text-primary hover:underline">add a new property</button>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="border-t border-border p-6 flex justify-between bg-muted/10">
              <Button type="button" variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
                Back
              </Button>
              {step < 2 ? (
                <Button type="button" onClick={handleNext}>Continue</Button>
              ) : (
                <Button type="submit" disabled={createForecast.isPending}>
                  {createForecast.isPending ? "Creating..." : "Start Forecast"}
                </Button>
              )}
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}
