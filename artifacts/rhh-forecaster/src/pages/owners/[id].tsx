import { useGetOwner, useListProperties, useListForecasts } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, MapPin, FileText, Pencil, Home, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function OwnerDetail() {
  const { id } = useParams<{ id: string }>();
  const ownerId = parseInt(id || "0", 10);
  
  const { data: owner, isLoading: isOwnerLoading } = useGetOwner(ownerId);
  const { data: properties, isLoading: isPropsLoading } = useListProperties();
  const { data: forecasts, isLoading: isForecastsLoading } = useListForecasts();

  if (isOwnerLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading owner profile...</div>;
  }

  if (!owner) {
    return <div className="p-8 text-center text-red-500">Owner not found.</div>;
  }

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
            {owner.companyName ? owner.companyName.charAt(0) : owner.firstName.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
              {owner.ownerType === 'company' && owner.companyName ? owner.companyName : `${owner.title ? owner.title + ' ' : ''}${owner.firstName} ${owner.lastName}`}
              {owner.isExistingClient && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-sans">Active Client</Badge>}
            </h1>
            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> <a href={`mailto:${owner.email}`} className="hover:text-foreground">{owner.email}</a></span>
              {owner.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> <a href={`tel:${owner.phone}`} className="hover:text-foreground">{owner.phone}</a></span>}
              {owner.nationality && <span className="flex items-center gap-1.5"><Globe className="h-4 w-4" /> {owner.nationality}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
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
                <div className="font-medium capitalize">{owner.ownerType}</div>
                
                {owner.ownerType === 'company' && (
                  <>
                    <div className="text-muted-foreground">Contact Person</div>
                    <div className="font-medium">{owner.firstName} {owner.lastName}</div>
                  </>
                )}

                <div className="text-muted-foreground">Lead Source</div>
                <div className="font-medium capitalize">{owner.leadSource?.replace('_', ' ') || '-'}</div>

                <div className="text-muted-foreground">Added On</div>
                <div className="font-medium">{new Date(owner.createdAt).toLocaleDateString()}</div>
              </div>

              {owner.notes && (
                <div className="pt-4 border-t border-border">
                  <div className="text-muted-foreground mb-1">Internal Notes</div>
                  <p className="text-foreground">{owner.notes}</p>
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
                                {prop.projectBuilding ? `${prop.unitNumber ? prop.unitNumber + ', ' : ''}${prop.projectBuilding}` : prop.area}
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
                                {forecast.status.replace('_', ' ')}
                              </Badge>
                            </Link>
                            <div className="text-sm text-muted-foreground mt-0.5">
                              {forecast.propertyAddress} • Proj. Income: {forecast.netOwnerIncome ? `AED ${forecast.netOwnerIncome.toLocaleString()}` : 'TBD'}
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
    </div>
  );
}
