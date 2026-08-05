import { useListProposals } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Search, Eye, Download, MoreHorizontal, Globe } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export default function ProposalsList() {
  const { data: proposals, isLoading } = useListProposals();
  const [search, setSearch] = useState("");

  const filteredProposals = proposals?.filter(p => 
    `${p.referenceNumber}`.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-primary/20 text-primary border-primary/30';
      case 'viewed': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'accepted': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'declined': return 'bg-red-500/20 text-red-700 border-red-500/30';
      case 'expired': return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
      default: return 'bg-secondary/20 text-secondary-foreground border-secondary/30';
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Proposals</h1>
          <p className="text-muted-foreground mt-1 text-lg">Track client engagement and deal status.</p>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="py-4 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search proposals..." 
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
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-center">Views</th>
                  <th className="px-6 py-4 font-medium">Last Viewed</th>
                  <th className="px-6 py-4 font-medium">Expires</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading proposals...</td></tr>
                ) : filteredProposals?.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No proposals found.</td></tr>
                ) : filteredProposals?.map((proposal) => (
                  <tr key={proposal.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-foreground">
                      <Link href={`/proposals/${proposal.id}`} className="hover:text-primary transition-colors">
                        {proposal.referenceNumber}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-1 font-normal">
                        Generated {new Date(proposal.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={`capitalize ${getStatusColor(proposal.status)}`}>
                        {proposal.status.replace('_', ' ')}
                      </Badge>
                      {proposal.ownerAction && (
                        <div className="text-xs text-muted-foreground mt-1.5 capitalize flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                          Action: {proposal.ownerAction.replace('_', ' ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-medium">{proposal.totalViews || 0}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{proposal.uniqueViews || 0} Unique</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {proposal.lastViewedAt ? new Date(proposal.lastViewedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {proposal.expiresAt ? new Date(proposal.expiresAt).toLocaleDateString() : '-'}
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
                            <Link href={`/proposals/${proposal.id}`}>Manage</Link>
                          </DropdownMenuItem>
                          {proposal.shareUrl && (
                            <DropdownMenuItem asChild>
                              <a href={proposal.shareUrl} target="_blank" rel="noreferrer"><Globe className="mr-2 h-4 w-4"/> View Public Link</a>
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
