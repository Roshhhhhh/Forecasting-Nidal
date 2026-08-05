import { useState } from "react";
import {
  useListReferees, useCreateReferee, useUpdateReferee,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Link } from "wouter";
import { Plus, UserCheck, Phone, Mail, Building, Users, Loader2, Pencil, RefreshCw, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RefereeFormValues {
  name: string;
  phone?: string;
  email?: string;
  companyName?: string;
  referralFeeStudio: number;
  referralFee1br: number;
  referralFee2br: number;
  referralFee3br: number;
  referralFee4brPlus: number;
  isRecurringEnabled: boolean;
  notes?: string;
}

const DEFAULT_FEES: Pick<RefereeFormValues, "referralFeeStudio" | "referralFee1br" | "referralFee2br" | "referralFee3br" | "referralFee4brPlus" | "isRecurringEnabled"> = {
  referralFeeStudio: 1500,
  referralFee1br: 2000,
  referralFee2br: 2500,
  referralFee3br: 3000,
  referralFee4brPlus: 3500,
  isRecurringEnabled: false,
};

export default function RefereesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: referees, isLoading } = useListReferees();
  const createReferee = useCreateReferee();
  const updateReferee = useUpdateReferee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const form = useForm<RefereeFormValues>({
    defaultValues: { name: "", ...DEFAULT_FEES },
  });

  const isRecurring = form.watch("isRecurringEnabled");

  function openCreate() {
    form.reset({ name: "", ...DEFAULT_FEES });
    setEditingId(null);
    setDialogOpen(true);
  }

  function openEdit(referee: any) {
    form.reset({
      name: referee.name,
      phone: referee.phone ?? "",
      email: referee.email ?? "",
      companyName: referee.companyName ?? "",
      referralFeeStudio: referee.referralFeeStudio ?? 1500,
      referralFee1br: referee.referralFee1br ?? 2000,
      referralFee2br: referee.referralFee2br ?? 2500,
      referralFee3br: referee.referralFee3br ?? 3000,
      referralFee4brPlus: referee.referralFee4brPlus ?? 3500,
      isRecurringEnabled: referee.isRecurringEnabled ?? false,
      notes: referee.notes ?? "",
    });
    setEditingId(referee.id);
    setDialogOpen(true);
  }

  async function onSubmit(data: RefereeFormValues) {
    try {
      if (editingId) {
        await updateReferee.mutateAsync({ id: editingId, data: data as any });
        toast({ title: "Referee updated" });
      } else {
        await createReferee.mutateAsync({ data: data as any });
        toast({ title: "Referee created", description: "A unique Referee ID has been generated." });
      }
      queryClient.invalidateQueries({ queryKey: ["listReferees"] });
      setDialogOpen(false);
    } catch {
      toast({ title: "Error", variant: "destructive", description: "Failed to save referee." });
    }
  }

  const isPending = createReferee.isPending || updateReferee.isPending;

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Referees</h1>
          <p className="text-muted-foreground mt-1">
            Track partners entitled to referral fees and recurring commission on owner introductions.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Referee
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-md"><UserCheck className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Referees</p>
              <p className="text-xl font-bold">{referees?.length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-md"><Users className="h-5 w-5 text-green-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Active Referees</p>
              <p className="text-xl font-bold">{referees?.filter(r => r.isActive).length ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-md"><Building className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Referred Owners</p>
              <p className="text-xl font-bold">
                {referees?.reduce((sum, r) => sum + ((r as any).referredCount ?? 0), 0) ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">Loading referees...</div>
      ) : !referees || referees.length === 0 ? (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="py-16 text-center">
            <UserCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium">No referees yet</p>
            <p className="text-muted-foreground text-sm mt-1 mb-4">Add your first referee to start tracking referral fees.</p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Add Referee
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {referees.map((referee: any) => (
            <Card key={referee.id} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-xs bg-primary/5 border-primary/30 text-primary">
                        {referee.refereeCode}
                      </Badge>
                      {referee.isRecurringEnabled && (
                        <Badge variant="outline" className="text-xs gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
                          <RefreshCw className="h-2.5 w-2.5" /> Recurring
                        </Badge>
                      )}
                      {!referee.isActive && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-base truncate">{referee.name}</h3>
                    {referee.companyName && (
                      <p className="text-xs text-muted-foreground truncate">{referee.companyName}</p>
                    )}
                  </div>
                  <button
                    onClick={() => openEdit(referee)}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-2"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-1.5 text-sm">
                  {referee.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{referee.phone}</span>
                    </div>
                  )}
                  {referee.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{referee.email}</span>
                    </div>
                  )}
                </div>
                {/* Referral fees summary */}
                <div className="rounded-md bg-muted/40 p-2.5 grid grid-cols-3 gap-1.5 text-center">
                  {[
                    { label: "Studio", value: referee.referralFeeStudio },
                    { label: "1 BR", value: referee.referralFee1br },
                    { label: "2 BR", value: referee.referralFee2br },
                    { label: "3 BR", value: referee.referralFee3br },
                    { label: "4+ BR", value: referee.referralFee4brPlus },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                      <p className="text-xs font-semibold text-foreground">{Number(value).toLocaleString()} AED</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Referred: </span>
                    <span className="font-semibold">{(referee as any).referredCount ?? 0} owners</span>
                  </div>
                  {referee.isRecurringEnabled && (
                    <div className="text-xs text-emerald-700 font-medium">
                      PM%−16% recurring
                    </div>
                  )}
                </div>
                <Link href={`/referees/${referee.id}`}>
                  <Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
                    <Users className="h-3.5 w-3.5" /> View Referred Owners
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {editingId ? "Edit Referee" : "Add New Referee"}
            </DialogTitle>
            {!editingId && (
              <p className="text-sm text-muted-foreground mt-1">
                A unique Referee ID (e.g. <span className="font-mono font-medium">REF-001</span>) will be automatically generated.
              </p>
            )}
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Contact info */}
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Ahmed Al-Mansoori" {...form.register("name", { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+971 50 123 4567" {...form.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="ahmed@example.com" {...form.register("email")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Company / Agency</Label>
              <Input placeholder="Al Mansoori Real Estate LLC" {...form.register("companyName")} />
            </div>

            {/* One-time referral fees */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">One-Time Referral Fees (AED)</Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                Fixed fee paid once when the referred owner signs up. Adjust per layout type.
              </p>
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                {[
                  { label: "Studio", field: "referralFeeStudio" as const },
                  { label: "1 Bedroom", field: "referralFee1br" as const },
                  { label: "2 Bedrooms", field: "referralFee2br" as const },
                  { label: "3 Bedrooms", field: "referralFee3br" as const },
                  { label: "4+ Bedrooms", field: "referralFee4brPlus" as const },
                ].map(({ label, field }) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        step="100"
                        {...form.register(field, { valueAsNumber: true })}
                        className="pr-12 text-sm"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">AED</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recurring commission programme */}
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-emerald-600" />
                    <Label className="text-sm font-semibold">Recurring Commission Programme</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Agent earns a share of the PM commission they help close.
                  </p>
                </div>
                <Switch
                  checked={isRecurring}
                  onCheckedChange={(val) => form.setValue("isRecurringEnabled", val)}
                />
              </div>

              {isRecurring && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2 text-xs">
                  <p className="font-semibold text-emerald-800">Recurring tier structure:</p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    {[
                      { pm: "20%", agent: "4%", co: "16%" },
                      { pm: "19%", agent: "3%", co: "16%" },
                      { pm: "18%", agent: "2%", co: "16%" },
                      { pm: "17%", agent: "1%", co: "16%" },
                      { pm: "≤16%", agent: "0%", co: "≥15%*" },
                    ].map(row => (
                      <div key={row.pm} className="bg-white/70 rounded p-1.5">
                        <p className="font-semibold text-emerald-900">PM: {row.pm}</p>
                        <p className="text-emerald-700">Agent: {row.agent}</p>
                        <p className="text-slate-500">RHH: {row.co}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-emerald-700 text-[10px] mt-1">
                    * Company minimum is 15% PM — the programme never reduces RHH below this floor.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Any additional context..." {...form.register("notes")} className="min-h-[70px]" />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Save Changes" : "Create Referee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
