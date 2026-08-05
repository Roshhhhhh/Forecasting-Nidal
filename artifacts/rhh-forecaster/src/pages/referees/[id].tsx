import { useGetReferee, useGetRefereeCommission, useListRefereeCommissionPayments, useRecordRefereeCommissionPayment } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, UserCheck, Phone, Mail, Users, RefreshCw, Home, TrendingUp, DollarSign, PlusCircle, CheckCircle2, Clock } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetRefereeCommissionQueryKey, getListRefereeCommissionPaymentsQueryKey } from "@workspace/api-client-react";

function fmtAED(val: number) {
  return val.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(val: string) {
  return new Date(val).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });
}

function RecordPaymentDialog({ refereeId }: { refereeId: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useRecordRefereeCommissionPayment();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = parseInt(amount, 10);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    try {
      await mutateAsync({
        id: refereeId,
        data: {
          amountPaid: parsed,
          paidAt: new Date(date).toISOString(),
          notes: notes.trim() || undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetRefereeCommissionQueryKey(refereeId) });
      await queryClient.invalidateQueries({ queryKey: getListRefereeCommissionPaymentsQueryKey(refereeId) });
      setOpen(false);
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
      setNotes("");
    } catch {
      setError("Failed to record payment. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <PlusCircle className="h-4 w-4" /> Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Record Commission Payment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount">Amount (AED)</Label>
            <Input
              id="payment-amount"
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-date">Payment Date</Label>
            <Input
              id="payment-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Textarea
              id="payment-notes"
              placeholder="Bank transfer reference, cheque number, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isPending ? "Saving..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RefereeDetail() {
  const { id } = useParams<{ id: string }>();
  const refereeId = parseInt(id || "0", 10);
  const { data: referee, isLoading } = useGetReferee(refereeId);
  const { data: commission, isLoading: commissionLoading } = useGetRefereeCommission(refereeId);
  const { data: payments, isLoading: paymentsLoading } = useListRefereeCommissionPayments(refereeId);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!referee) return <div className="p-8 text-center text-red-500">Referee not found.</div>;

  const owners = (referee as any).referredOwners ?? [];

  const layoutFees = [
    { label: "Studio", value: referee.referralFeeStudio },
    { label: "1 Bedroom", value: referee.referralFee1br },
    { label: "2 Bedrooms", value: referee.referralFee2br },
    { label: "3 Bedrooms", value: referee.referralFee3br },
    { label: "4+ Bedrooms", value: referee.referralFee4brPlus },
  ];

  // Build a lookup from ownerId → commission breakdown
  const commissionMap = new Map<number, NonNullable<typeof commission>["ownerBreakdowns"][number]>();
  commission?.ownerBreakdowns.forEach((b) => commissionMap.set(b.ownerId, b));

  return (
    <div className="p-8 max-w-[900px] mx-auto space-y-6">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
        <Link href="/referees" className="hover:text-foreground transition-colors">Referees</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{referee.refereeCode}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-3xl font-serif font-bold text-foreground">{referee.name}</h1>
            <Badge variant="outline" className="font-mono bg-primary/5 border-primary/30 text-primary">
              {referee.refereeCode}
            </Badge>
            {referee.isRecurringEnabled && (
              <Badge variant="outline" className="gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
                <RefreshCw className="h-3 w-3" /> Recurring
              </Badge>
            )}
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

      {/* Contact + stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

      {/* Commission Summary — only shown when recurring enabled */}
      {referee.isRecurringEnabled && (
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
          <CardHeader className="bg-emerald-50 border-b border-emerald-200 py-3 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="font-serif text-base flex items-center gap-2 text-emerald-800">
                <DollarSign className="h-4 w-4" />
                Commission Summary
              </CardTitle>
              <RecordPaymentDialog refereeId={refereeId} />
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {commissionLoading ? (
              <div className="text-sm text-muted-foreground">Calculating commission...</div>
            ) : commission ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="rounded-lg bg-white border border-emerald-100 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Gross Revenue</p>
                  <p className="text-xl font-bold text-foreground">{fmtAED(commission.totalGrossRevenue)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">AED (all forecasts)</p>
                </div>
                <div className="rounded-lg bg-white border border-emerald-100 p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Owed</p>
                  <p className="text-xl font-bold text-emerald-700">{fmtAED(commission.totalCommissionOwed)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">AED</p>
                </div>
                <div className="rounded-lg bg-white border border-emerald-100 p-4">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Total Paid
                  </p>
                  <p className="text-xl font-bold text-emerald-600">{fmtAED(commission.totalPaid)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">AED</p>
                </div>
                <div className={`rounded-lg border p-4 ${commission.outstandingBalance > 0 ? "bg-amber-50 border-amber-300" : "bg-emerald-100 border-emerald-300"}`}>
                  <p className={`text-xs mb-1 flex items-center justify-center gap-1 font-medium ${commission.outstandingBalance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    <Clock className="h-3 w-3" /> Outstanding
                  </p>
                  <p className={`text-xl font-bold ${commission.outstandingBalance > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                    {fmtAED(commission.outstandingBalance)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">AED</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Payment History — only when recurring enabled */}
      {referee.isRecurringEnabled && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
            <CardTitle className="font-serif text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Payment History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paymentsLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Loading payments...</div>
            ) : !payments || payments.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="text-sm">No payments recorded yet.</p>
                <p className="text-xs mt-1">Use "Record Payment" to log a settlement.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium text-emerald-700">Amount (AED)</th>
                    <th className="px-4 py-3 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(p.paidAt)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {fmtAED(p.amountPaid)} <span className="text-xs font-normal">AED</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.notes ?? <span className="text-muted-foreground/40">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-800">Total Paid</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-800">
                      {fmtAED(payments.reduce((s, p) => s + p.amountPaid, 0))} <span className="text-sm font-normal">AED</span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* One-time referral fees */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="bg-muted/20 border-b border-border py-3 px-5">
          <CardTitle className="font-serif text-base flex items-center gap-2">
            <Home className="h-4 w-4 text-primary" />
            One-Time Referral Fees
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-5 gap-3 text-center">
            {layoutFees.map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="text-lg font-bold text-foreground">{Number(value).toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">AED</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recurring commission */}
      {referee.isRecurringEnabled && (
        <Card className="border-emerald-200 bg-emerald-50/50 shadow-sm">
          <CardHeader className="bg-emerald-50 border-b border-emerald-200 py-3 px-5">
            <CardTitle className="font-serif text-base flex items-center gap-2 text-emerald-800">
              <RefreshCw className="h-4 w-4" />
              Recurring Commission Programme — Active
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              {[
                { pm: "20%", agent: "4%", rhh: "16%" },
                { pm: "19%", agent: "3%", rhh: "16%" },
                { pm: "18%", agent: "2%", rhh: "16%" },
                { pm: "17%", agent: "1%", rhh: "16%" },
                { pm: "≤16%", agent: "0%", rhh: "≥15%*" },
              ].map(row => (
                <div key={row.pm} className="bg-white rounded-lg p-2.5 border border-emerald-100">
                  <p className="font-semibold text-emerald-900">PM: {row.pm}</p>
                  <p className="text-emerald-700 mt-1">Agent: <span className="font-bold">{row.agent}</span></p>
                  <p className="text-slate-500">RHH: {row.rhh}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-emerald-700 mt-3">
              * Company minimum is 15% PM — the programme never reduces RHH below this floor.
            </p>
          </CardContent>
        </Card>
      )}

      {referee.notes && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
            <p className="text-sm text-muted-foreground">{referee.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Referred owners table */}
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
                  {referee.isRecurringEnabled && (
                    <>
                      <th className="px-4 py-3 text-right font-medium">Net Owner Income</th>
                      <th className="px-4 py-3 text-right font-medium">Commission %</th>
                      <th className="px-4 py-3 text-right font-medium text-emerald-700">Commission (AED)</th>
                    </>
                  )}
                  <th className="px-4 py-3 text-left font-medium">Added</th>
                  <th className="px-4 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {owners.map((owner: any) => {
                  const breakdown = commissionMap.get(owner.id);
                  return (
                    <tr key={owner.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{owner.firstName} {owner.lastName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{owner.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{owner.phone ?? "—"}</td>
                      {referee.isRecurringEnabled && (
                        <>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            {breakdown && breakdown.netOwnerIncome > 0
                              ? <span>{fmtAED(breakdown.netOwnerIncome)} <span className="text-xs">AED</span></span>
                              : <span className="text-muted-foreground/50">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {breakdown && breakdown.commissionPercent > 0
                              ? <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">{breakdown.commissionPercent}%</Badge>
                              : <span className="text-muted-foreground/50 text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                            {breakdown && breakdown.commissionAmount > 0
                              ? <span>{fmtAED(breakdown.commissionAmount)} <span className="text-xs font-normal">AED</span></span>
                              : <span className="text-muted-foreground/50 text-xs font-normal">No forecast</span>}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(owner.createdAt).toLocaleDateString("en-AE")}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/owners/${owner.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs">View</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {referee.isRecurringEnabled && commission && commission.totalCommissionOwed > 0 && (
                <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-emerald-800">
                      <TrendingUp className="h-4 w-4 inline mr-1" />
                      Total Commission Owed
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-800 text-base">
                      {fmtAED(commission.totalCommissionOwed)} <span className="text-sm font-normal">AED</span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
