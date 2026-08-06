import { useListOwners } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Search, Mail, Phone, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { usePermission } from "@/hooks/usePermission";

export default function OwnersList() {
  const { data: owners, isLoading } = useListOwners();
  const canCreateOwner = usePermission("owners.create");
  const canCreateProperty = usePermission("properties.create");
  const [search, setSearch] = useState("");

  const filteredOwners = owners?.filter(o => 
    `${o.firstName} ${o.lastName} ${o.companyName || ''} ${o.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Property Owners</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your client relationships and leads.</p>
        </div>
        {canCreateOwner && (
          <Link href="/owners/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Owner
          </Link>
        )}
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="py-4 border-b border-border bg-muted/20">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, company, or email..." 
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Name / Company</th>
                  <th className="px-6 py-4 font-medium">Contact</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Added</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading owners...</td></tr>
                ) : filteredOwners?.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No owners found matching your criteria.</td></tr>
                ) : filteredOwners?.map((owner) => (
                  <tr key={owner.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/owners/${owner.id}`} className="block">
                        <div className="font-medium text-foreground hover:text-primary transition-colors">
                          {owner.ownerType === 'company' && owner.companyName ? owner.companyName : `${owner.firstName} ${owner.lastName}`}
                        </div>
                        {owner.ownerType === 'company' && (
                          <div className="text-xs text-muted-foreground mt-0.5">Contact: {owner.firstName} {owner.lastName}</div>
                        )}
                      </Link>
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center text-muted-foreground">
                        <Mail className="mr-2 h-3 w-3" />
                        <a href={`mailto:${owner.email}`} className="hover:text-foreground hover:underline">{owner.email}</a>
                      </div>
                      {owner.phone && (
                        <div className="flex items-center text-muted-foreground">
                          <Phone className="mr-2 h-3 w-3" />
                          <a href={`tel:${owner.phone}`} className="hover:text-foreground">{owner.phone}</a>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="capitalize bg-background text-muted-foreground">
                        {owner.ownerType}
                      </Badge>
                      {owner.isExistingClient && (
                        <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20">Client</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(owner.createdAt).toLocaleDateString()}
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
                            <Link href={`/owners/${owner.id}`}>View Profile</Link>
                          </DropdownMenuItem>
                          {canCreateProperty && (
                            <DropdownMenuItem asChild>
                              <Link href={`/properties/new?ownerId=${owner.id}`}>Add Property</Link>
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
