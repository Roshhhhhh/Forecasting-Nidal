import { useListMarketAreas, useListBenchmarks } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Search, Upload, Download, MapPin } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function MarketList() {
  const { data: areas, isLoading: isAreasLoading } = useListMarketAreas();
  const { data: benchmarks, isLoading: isBenchmarksLoading } = useListBenchmarks();
  
  const [search, setSearch] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);

  const filteredAreas = areas?.filter(a => 
    `${a.area} ${a.emirate}`.toLowerCase().includes(search.toLowerCase())
  );

  const displayedBenchmarks = selectedAreaId 
    ? benchmarks?.filter(b => b.marketAreaId === selectedAreaId) 
    : benchmarks;

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6 h-[calc(100vh-theme(spacing.16))] flex flex-col">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Market Data</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage area comps, ADRs, and LTR benchmarks.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Link href="/market/import" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
            <Upload className="mr-2 h-4 w-4" />
            Import Data
          </Link>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left Sidebar - Areas */}
        <Card className="w-80 flex flex-col border-border/50 shadow-sm shrink-0">
          <CardHeader className="p-4 border-b border-border bg-muted/10 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search areas..." 
                className="pl-8 bg-background h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <Button 
              variant="ghost" 
              className={`w-full justify-start font-normal ${selectedAreaId === null ? 'bg-primary/10 text-primary font-medium' : ''}`}
              onClick={() => setSelectedAreaId(null)}
            >
              <MapPin className="h-4 w-4 mr-2" /> All Areas
            </Button>
            
            {isAreasLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Loading areas...</div>
            ) : filteredAreas?.map((area) => (
              <Button 
                key={area.id}
                variant="ghost" 
                className={`w-full justify-start text-left h-auto py-2 ${selectedAreaId === area.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground font-normal'}`}
                onClick={() => setSelectedAreaId(area.id)}
              >
                <div className="flex flex-col items-start truncate">
                  <span className="truncate">{area.area}</span>
                  <span className="text-xs text-muted-foreground font-normal">{area.emirate}</span>
                </div>
              </Button>
            ))}
          </div>
        </Card>

        {/* Right Content - Benchmarks Table */}
        <Card className="flex-1 flex flex-col border-border/50 shadow-sm min-w-0">
          <CardHeader className="p-4 border-b border-border bg-muted/20 shrink-0 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-serif">Unit Benchmarks</CardTitle>
              <CardDescription>
                {selectedAreaId 
                  ? `Showing data for ${areas?.find(a => a.id === selectedAreaId)?.area}`
                  : 'Showing all market data'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-background">STR Rates</Badge>
              <Badge variant="outline" className="bg-background">LTR Values</Badge>
            </div>
          </CardHeader>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Beds</th>
                  <th className="px-4 py-3 font-medium">Avg ADR</th>
                  <th className="px-4 py-3 font-medium">Occupancy</th>
                  <th className="px-4 py-3 font-medium">Annual LTR</th>
                  <th className="px-4 py-3 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isBenchmarksLoading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading benchmarks...</td></tr>
                ) : !displayedBenchmarks || displayedBenchmarks.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No benchmark data available.</td></tr>
                ) : displayedBenchmarks.map((benchmark) => (
                  <tr key={benchmark.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 font-medium capitalize text-foreground">{benchmark.propertyType}</td>
                    <td className="px-4 py-3">{benchmark.bedrooms} Bed</td>
                    <td className="px-4 py-3">{benchmark.typicalAdr ? `AED ${benchmark.typicalAdr}` : '-'}</td>
                    <td className="px-4 py-3">{benchmark.expectedOccupancy ? `${benchmark.expectedOccupancy}%` : '-'}</td>
                    <td className="px-4 py-3">{benchmark.annualLtr ? `AED ${benchmark.annualLtr.toLocaleString()}` : '-'}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={`capitalize text-[10px] ${
                        benchmark.confidenceLevel === 'high' ? 'text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20' : 
                        benchmark.confidenceLevel === 'medium' ? 'text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20' : 
                        'text-muted-foreground'
                      }`}>
                        {benchmark.confidenceLevel || 'Unknown'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
