import { useGetProperty, useListForecasts } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Home, TrendingUp, Pencil, Ruler, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const propertyId = parseInt(id || "0", 10);
  
  const { data: property, isLoading: isPropLoading } = useGetProperty(propertyId);
  const { data: forecasts, isLoading: isForecastsLoading } = useListForecasts();

  if (isPropLoading) return <div className="p-8 text-center text-muted-foreground">Loading property...</div>;
  if (!property) return <div className="p-8 text-center text-red-500">Property not found.</div>;

  const propertyForecasts = forecasts?.filter(f => f.propertyId === propertyId) || [];

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/properties" className="hover:text-foreground transition-colors">Properties</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{property.projectBuilding || property.area}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
            {property.projectBuilding ? `${property.unitNumber ? property.unitNumber + ', ' : ''}${property.projectBuilding}` : property.area}
          </h1>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {property.area}, {property.emirate}</span>
            <span className="flex items-center gap-1.5 text-primary hover:underline">
              <Link href={`/owners/${property.ownerId}`}>{property.ownerName || 'View Owner'}</Link>
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Pencil className="h-4 w-4" /> Edit Property
          </Button>
          <Link href={`/forecasts/new?propertyId=${property.id}`} className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
            <TrendingUp className="mr-2 h-4 w-4" /> New Forecast
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/50 shadow-sm bg-muted/5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                <Home className="h-5 w-5 text-muted-foreground mb-2" />
                <span className="font-medium capitalize text-sm">{property.propertyType}</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-muted/5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                <div className="flex items-center gap-1 text-muted-foreground mb-2">
                  <span className="font-medium text-lg">{property.bedrooms}</span> Bed
                </div>
                <span className="font-medium text-sm text-muted-foreground">{property.bathrooms} Bath</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-muted/5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                <Ruler className="h-5 w-5 text-muted-foreground mb-2" />
                <span className="font-medium text-sm">{property.internalArea} sqft</span>
              </CardContent>
            </Card>
            <Card className="border-border/50 shadow-sm bg-muted/5">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-24">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mb-2" />
                <span className="font-medium capitalize text-sm">{property.propertyCondition?.replace('_', ' ') || 'Condition Unknown'}</span>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/20 border-b border-border pb-4">
              <CardTitle className="text-base">Additional Attributes</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm">
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Furnishing Status</span>
                  <span className="font-medium capitalize">{property.furnishingStatus?.replace('_', ' ') || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Primary View</span>
                  <span className="font-medium">{property.view || '-'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Waterfront</span>
                  <span className="font-medium">{property.isWaterfront ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">Private Pool</span>
                  <span className="font-medium">{property.hasPrivatePool ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="shadow-sm border-border/50 h-full">
            <CardHeader className="bg-muted/20 border-b border-border">
              <CardTitle className="text-base">Forecast History</CardTitle>
              <CardDescription>Projections for this specific unit</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isForecastsLoading ? (
                <div className="p-6 text-center text-muted-foreground">Loading...</div>
              ) : propertyForecasts.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">No forecasts generated yet.</p>
                  <Link href={`/forecasts/new?propertyId=${property.id}`} className="text-primary text-sm font-medium hover:underline">
                    Create the first forecast
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {propertyForecasts.map(forecast => (
                    <div key={forecast.id} className="p-4 hover:bg-muted/20 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <Link href={`/forecasts/${forecast.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                          {forecast.referenceNumber}
                        </Link>
                        <Badge variant="outline" className="text-[10px] uppercase bg-background">
                          {forecast.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="text-sm">
                          <span className="text-muted-foreground block text-xs mb-0.5">Net Income</span>
                          <span className="font-medium">{forecast.netOwnerIncome ? `AED ${forecast.netOwnerIncome.toLocaleString()}` : '-'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(forecast.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
