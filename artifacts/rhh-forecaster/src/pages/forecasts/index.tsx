import { useListForecasts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Search, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function ForecastsList() {
  const { data: forecasts, isLoading } = useListForecasts();
  const [search, setSearch] = useState("");

  const filteredForecasts = forecasts?.filter(f => 
    `${f.referenceNumber} ${f.ownerName || ''} ${f.propertyAddress || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-primary/20 text-primary border-primary/30';
      case 'accepted': return 'bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400';
      case 'declined': return 'bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400';
      case 'draft': return 'bg-gray-500/20 text-gray-700 border-gray-500/30 dark:text-gray-400';
      default: return 'bg-secondary/20 text-secondary-foreground border-secondary/30';
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "-";
    return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Revenue Forecasts</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage and track all revenue projections.</p>
        </div>
        <Link href="/forecasts/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
          <Plus className="mr-2 h-4 w-4" />
          Create Forecast
        </Link>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="py-4 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by ref, owner, or property..." 
                className="pl-9 bg-background"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-background cursor-pointer hover:bg-muted">All Statuses</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Reference</th>
                  <th className="px-6 py-4 font-medium">Client / Property</th>
                  <th className="px-6 py-4 font-medium">Projected Revenue</th>
                  <th className="px-6 py-4 font-medium">vs LTR</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading forecasts...</td></tr>
                ) : filteredForecasts?.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No forecasts found matching your criteria.</td></tr>
                ) : filteredForecasts?.map((forecast) => (
                  <tr key={forecast.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <Link href={`/forecasts/${forecast.id}`} className="hover:text-primary transition-colors">
                        {forecast.referenceNumber}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-1 font-normal">
                        {new Date(forecast.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">
                        <Link href={`/owners/${forecast.ownerId}`} className="hover:underline">{forecast.ownerName || 'Unknown'}</Link>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-[200px] truncate" title={forecast.propertyAddress || ''}>
                        {forecast.propertyAddress || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{formatCurrency(forecast.grossAnnualRevenue)}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Net: {formatCurrency(forecast.netOwnerIncome)}</div>
                    </td>
                    <td className="px-6 py-4">
                      {forecast.increaseVsLtrPct !== null && forecast.increaseVsLtrPct !== undefined ? (
                        <div className={`font-medium ${forecast.increaseVsLtrPct > 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                          {forecast.increaseVsLtrPct > 0 ? '+' : ''}{forecast.increaseVsLtrPct}%
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`capitalize ${getStatusColor(forecast.status)}`}>
                        {forecast.status.replace('_', ' ')}
                      </Badge>
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
                            <Link href={`/forecasts/${forecast.id}`}>View Details</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/forecasts/${forecast.id}/edit`}>Edit Forecast</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive">Archive</DropdownMenuItem>
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
