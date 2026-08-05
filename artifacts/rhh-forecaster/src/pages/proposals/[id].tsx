import { useGetProposal, useGetProposalActivity } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Copy, Globe, ArrowLeft, Download, Ban, MessageSquare, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ProposalDetail() {
  const { id } = useParams<{ id: string }>();
  const proposalId = parseInt(id || "0", 10);
  const { toast } = useToast();

  const { data: proposal, isLoading } = useGetProposal(proposalId);
  const { data: activity, isLoading: isActivityLoading } = useGetProposalActivity(proposalId);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading proposal...</div>;
  if (!proposal) return <div className="p-8 text-center text-red-500">Proposal not found.</div>;

  const copyLink = () => {
    if (proposal.shareUrl) {
      navigator.clipboard.writeText(window.location.origin + proposal.shareUrl);
      toast({ title: "Link Copied", description: "The proposal link has been copied to clipboard." });
    }
  };

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <Link href="/proposals" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to Proposals
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
            Proposal {proposal.referenceNumber}
            <Badge variant="outline" className="uppercase bg-primary/10 text-primary border-primary/20">
              {proposal.status}
            </Badge>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Linked to Forecast{" "}
            <Link href={`/forecasts/${proposal.forecastId}`} className="text-primary hover:underline">
              #{proposal.forecastId}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          {proposal.shareUrl && (
            <Button variant="outline" onClick={copyLink} className="gap-2">
              <Copy className="h-4 w-4" /> Copy Link
            </Button>
          )}
          {proposal.shareUrl && (
            <Button asChild className="gap-2">
              <a href={proposal.shareUrl} target="_blank" rel="noreferrer">
                <Globe className="h-4 w-4" /> View Live
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="md:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="bg-muted/20 border-b border-border">
              <CardTitle className="text-base font-serif">Engagement Metrics</CardTitle>
            </CardHeader>
            <CardContent className="p-6 grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/10 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Total Views</div>
                <div className="text-3xl font-bold">{proposal.totalViews ?? 0}</div>
              </div>
              <div className="text-center p-4 bg-muted/10 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">Unique Visitors</div>
                <div className="text-3xl font-bold">{proposal.uniqueViews ?? 0}</div>
              </div>
              <div className="text-center p-4 bg-muted/10 rounded-lg">
                <div className="text-sm text-muted-foreground mb-1">PDF Downloads</div>
                <div className="text-3xl font-bold">{proposal.pdfDownloads ?? 0}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="bg-muted/20 border-b border-border">
              <CardTitle className="text-base font-serif">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isActivityLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading activity...</div>
              ) : !activity || activity.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No activity recorded yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {activity.map((event) => (
                    <div key={event.id} className="p-4 flex items-start gap-4">
                      <div className="h-8 w-8 rounded-full bg-secondary/10 flex items-center justify-center mt-0.5 shrink-0">
                        {event.eventType === "view" ? (
                          <Eye className="h-4 w-4 text-secondary" />
                        ) : event.eventType === "download" ? (
                          <Download className="h-4 w-4 text-primary" />
                        ) : (
                          <MessageSquare className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm capitalize">{event.eventType.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(event.createdAt).toLocaleString()} • {(event as any).deviceType || "Unknown Device"}
                        </div>
                        {(event as any).metadata && (
                          <div className="text-xs bg-muted/30 p-2 mt-2 rounded border border-border/50 font-mono text-muted-foreground break-all">
                            {(event as any).metadata}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-1 space-y-6">
          <Card className="border-border/50 shadow-sm h-full">
            <CardHeader className="bg-muted/20 border-b border-border">
              <CardTitle className="text-base font-serif">Link Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div>
                <div className="text-sm font-medium mb-1">Status</div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${proposal.isLinkActive ? "bg-green-500" : "bg-red-500"}`}></div>
                  <span className="text-sm text-muted-foreground">
                    {proposal.isLinkActive ? "Active and accessible" : "Revoked"}
                  </span>
                </div>
              </div>

              {proposal.expiresAt && (
                <div>
                  <div className="text-sm font-medium mb-1">Expires On</div>
                  <div className="text-sm text-muted-foreground">{new Date(proposal.expiresAt).toLocaleDateString()}</div>
                </div>
              )}

              {proposal.ownerPin && (
                <div>
                  <div className="text-sm font-medium mb-1">Access PIN</div>
                  <div className="text-sm text-muted-foreground font-mono bg-muted p-2 rounded w-fit">{proposal.ownerPin}</div>
                </div>
              )}

              <div className="pt-4 border-t border-border space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Pencil className="mr-2 h-4 w-4" /> Edit Settings
                </Button>
                {proposal.isLinkActive && (
                  <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Ban className="mr-2 h-4 w-4" /> Revoke Access
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
