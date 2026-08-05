import { useState } from "react";
import { useLocation } from "wouter";
import { useListOwners, useListProperties, useCreateForecast } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const { toast } = useToast();
  const createForecast = useCreateForecast();
  
  const { data: owners, isLoading: isOwnersLoading } = useListOwners();
  const { data: properties, isLoading: isPropsLoading } = useListProperties();

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      ownerId: 0,
      propertyId: 0,
    },
  });

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
          managementFeePercent: 20, // defaults
          ltrVacancyPercent: 5
        } as any 
      });
      toast({ title: "Draft Created", description: "Navigating to forecast builder..." });
      // Redirect to the forecast detail page which will serve as the rest of the wizard
      setLocation(`/forecasts/${result.id}`);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create forecast.", variant: "destructive" });
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8">
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
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? field.value.toString() : ""}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base">
                              <SelectValue placeholder={isOwnersLoading ? "Loading..." : "Select an owner"} />
                            </SelectTrigger>
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
                        <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? field.value.toString() : ""}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base">
                              <SelectValue placeholder={isPropsLoading ? "Loading..." : "Select a property"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {filteredProperties.length === 0 && (
                              <SelectItem value="0" disabled>No properties found for this owner</SelectItem>
                            )}
                            {filteredProperties.map(prop => (
                              <SelectItem key={prop.id} value={prop.id.toString()}>
                                {prop.projectBuilding ? `${prop.unitNumber ? prop.unitNumber + ', ' : ''}${prop.projectBuilding}` : prop.area} ({prop.emirate})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
