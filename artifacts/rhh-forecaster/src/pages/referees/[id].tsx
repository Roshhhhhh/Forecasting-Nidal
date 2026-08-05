import { useGetReferee } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserCheck, Phone, Mail, Building, Users, Calendar } from "lucide-react";

export default function RefereeDetail() {
  const { id } = useParams<{ id: string }>();
  const refereeId = parseInt(id || "0", 10);
  const { data: referee, isLoading } = useGetReferee(refereeId);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!referee) return <div className="p-8 text-center text-red-500">Referee not found.</div>;

  const owners = (referee as any).referredOwners ?? [];

  return (
    <div className="p-8 max-w-[900px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
        <Link href="/referees" className="hover:text-foreground transition-colors">Referees</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{referee.refereeCode}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-serif font-bold text-foreground">{referee.name}</h1>
            <Badge variant="outline" className="font-mono bg-primary/5 border-primary/30 text-primary">
              {referee.refereeCode}
            </Badge>
            {!referee.isActive && <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>}
          </div>
          {referee.companyName && <p className="text-muted-foreground">{referee.companyName}</p>}
        </div>
        <Link href="/referees">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{referee.commissionPercent}%</div>
            <p className="text-xs text-muted-foreground mt-1">Commission Rate</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{owners.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Referred Owners</p>
          </CardContent>
        </Card>
        {referee.phone && (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium truncate">{referee.phone}</p>
              </div>
            </CardContent>
          </Card>
        )}
        {referee.email && (
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium truncate">{referee.email}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {referee.notes && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm text-muted-foreground">{referee.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Referred Owners ({owners.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {owners.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <UserCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p>No referred owners yet.</p>
              <p className="text-sm mt-1">When you assign this referee to an owner, they'll appear here.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Owner</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Phone</th>
                  <th className="px-4 py-3 text-left font-medium">Added</th>
                  <th className="px-4 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {owners.map((owner: any) => (
                  <tr key={owner.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{owner.firstName} {owner.lastName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{owner.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{owner.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(owner.createdAt).toLocaleDateString("en-AE")}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/owners/${owner.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs">View</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
