import { useListProperties } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Search, MapPin, Home, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { usePermission } from "@/hooks/usePermission";

export default function PropertiesList() {
  const { data: properties, isLoading } = useListProperties();
  const canCreateProperty = usePermission("properties.create");
  const canCreateForecast = usePermission("forecasts.create");
  const [search, setSearch] = useState("");

  const filteredProperties = properties?.filter(p => 
    `${p.area} ${p.projectBuilding || ''} ${p.ownerName || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Properties</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage the portfolio of actual and prospective units.</p>
        </div>
        {canCreateProperty && (
          <Link href="/properties/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Link>
        )}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="py-4 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by area, building, or owner..." 
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-background cursor-pointer hover:bg-muted">All Emirates</Badge>
              <Badge variant="outline" className="bg-background cursor-pointer hover:bg-muted">All Types</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Details</th>
                  <th className="px-6 py-4 font-medium">Owner</th>
                  <th className="px-6 py-4 font-medium">Condition</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading properties...</td></tr>
                ) : filteredProperties?.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No properties found matching your criteria.</td></tr>
                ) : filteredProperties?.map((property) => (
                  <tr key={property.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/properties/${property.id}`} className="block">
                        <div className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          {property.projectBuilding ? `${property.unitNumber ? property.unitNumber + ', ' : ''}${property.projectBuilding}` : property.area}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 ml-6">
                          {property.area}, {property.emirate}
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Home className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="capitalize">{property.bedrooms} Bed {property.propertyType}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 ml-5.5">
                        {property.internalArea} sqft
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/owners/${property.ownerId}`} className="text-foreground hover:text-primary hover:underline">
                        {property.ownerName || `Owner #${property.ownerId}`}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {property.furnishingStatus && (
                          <Badge variant="outline" className="capitalize text-[10px] bg-background">
                            {property.furnishingStatus.replace('_', ' ')}
                          </Badge>
                        )}
                        {property.propertyCondition && (
                          <Badge variant="outline" className="capitalize text-[10px] bg-background">
                            {property.propertyCondition.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/properties/${property.id}`}>View Property</Link>
                          </DropdownMenuItem>
                          {canCreateForecast && (
                            <DropdownMenuItem asChild>
                              <Link href={`/forecasts/new?propertyId=${property.id}`}>Create Forecast</Link>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
