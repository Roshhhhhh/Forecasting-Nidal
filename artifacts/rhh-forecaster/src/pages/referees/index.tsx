import { useState, useMemo } from "react";
import {
  useListReferees, useCreateReferee, useUpdateReferee, useDeleteReferee, useGetMe, getListRefereesQueryKey,
} from "@workspace/api-client-react";
import { usePermission } from "@/hooks/usePermission";
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, UserCheck, Phone, Mail, Building, Users, Loader2, Pencil,
  RefreshCw, Home, TrendingUp, Search, X, Trash2,
} from "lucide-react";
import { SmartReport } from "@/components/SmartReport";
import { useToast } from "@/hooks/use-toast";
import { getApiErrorMessage } from "@/lib/api-error";
import { DataTable, ColumnDef } from "@/components/DataTable";

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
  referralFeeStudio: 1500, referralFee1br: 2000, referralFee2br: 2500,
  referralFee3br: 3000, referralFee4brPlus: 3500, isRecurringEnabled: false,
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap select-none
        ${active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
        }`}
    >
      {children}
    </button>
  );
}

export default function RefereesList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const canCreateReferee = usePermission("referees.create");
  const canEditReferee   = usePermission("referees.edit");
  const { data: me } = useGetMe();
  const isSuperAdmin = (me as any)?.role === "super_admin";
  const { data: referees, isLoading } = useListReferees();
  const createReferee = useCreateReferee();
  const updateReferee = useUpdateReferee();
  const deleteReferee = useDeleteReferee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "owed_desc">("default");

  const [search, setSearch]               = useState("");
  const [activeFilter, setActiveFilter]   = useState("all");
  const [recurringFilter, setRecurringFilter] = useState("all");

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
      name: referee.name, phone: referee.phone ?? "", email: referee.email ?? "",
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
      queryClient.invalidateQueries({ queryKey: getListRefereesQueryKey() });
      setDialogOpen(false);
    } catch (error) {
      toast({ title: "Failed to save referee", description: getApiErrorMessage(error), variant: "destructive" });
    }
  }

  async function handleDeactivate(referee: any) {
    const label = referee.name || "this referee";
    if (!confirm(`Deactivate ${label}? They will be hidden from active lists but their commission history is preserved.`)) return;
    try {
      await deleteReferee.mutateAsync({ id: referee.id });
      queryClient.invalidateQueries({ queryKey: getListRefereesQueryKey() });
      toast({ title: "Referee deactivated", description: `${label} has been marked inactive.` });
    } catch (err: any) {
      toast({ title: "Failed to deactivate referee", description: err?.message ?? "Unknown error", variant: "destructive" });
    }
  }

  const isPending = createReferee.isPending || updateReferee.isPending;

  const activeFilterCount = useMemo(() => [
    activeFilter !== "all", recurringFilter !== "all",
  ].filter(Boolean).length, [activeFilter, recurringFilter]);

  const filteredReferees = useMemo(() => {
    let list = referees ?? [];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        `${r.name} ${r.email || ""} ${r.phone || ""} ${(r as any).companyName || ""} ${r.refereeCode}`.toLowerCase().includes(q)
      );
    }
    if (activeFilter === "active") list = list.filter(r => r.isActive);
    if (activeFilter === "inactive") list = list.filter(r => !r.isActive);
    if (recurringFilter === "recurring") list = list.filter(r => r.isRecurringEnabled);
    if (recurringFilter === "one-time") list = list.filter(r => !r.isRecurringEnabled);
    if (sortBy === "owed_desc") list = [...list].sort((a, b) => ((b as any).totalCommissionOwed ?? 0) - ((a as any).totalCommissionOwed ?? 0));
    return list;
  }, [referees, search, activeFilter, recurringFilter, sortBy]);

  const totalCommissionLiability = referees?.reduce((sum, r) => sum + ((r as any).totalCommissionOwed ?? 0), 0) ?? 0;

  function clearAll() { setSearch(""); setActiveFilter("all"); setRecurringFilter("all"); }

  type RefereeRow = (typeof filteredReferees)[number];

  const refereeColumns = useMemo<ColumnDef<RefereeRow>[]>(() => [
    {
      key: "name",
      label: "Referee",
      description: "Full name and company",
      render: (r: any) => (
        <div>
          <div className="font-semibold text-foreground">{r.name}</div>
          {r.companyName && <div className="text-xs text-muted-foreground mt-0.5">{r.companyName}</div>}
        </div>
      ),
      exportValue: (r: any) => r.name,
      minWidth: "min-w-[140px]",
    },
    {
      key: "code",
      label: "Code",
      description: "Unique referee identifier",
      render: (r: any) => (
        <Badge variant="outline" className="font-mono text-xs bg-primary/5 border-primary/30 text-primary">
          {r.refereeCode}
        </Badge>
      ),
      exportValue: (r: any) => r.refereeCode,
    },
    {
      key: "email",
      label: "Email",
      render: (r: any) => r.email ? (
        <a href={`mailto:${r.email}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Mail className="h-3 w-3 shrink-0" />{r.email}
        </a>
      ) : <span className="text-muted-foreground">—</span>,
      exportValue: (r: any) => r.email ?? "",
    },
    {
      key: "phone",
      label: "Phone",
      render: (r: any) => r.phone ? (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Phone className="h-3 w-3 shrink-0" />{r.phone}
        </span>
      ) : <span className="text-muted-foreground">—</span>,
      exportValue: (r: any) => r.phone ?? "",
    },
    {
      key: "studio",
      label: "Studio",
      description: "One-time referral fee for Studio",
      render: (r: any) => <span className="text-sm tabular-nums">{Number(r.referralFeeStudio).toLocaleString()} AED</span>,
      exportValue: (r: any) => r.referralFeeStudio,
    },
    {
      key: "onebr",
      label: "1 BR",
      description: "One-time referral fee for 1-bedroom",
      render: (r: any) => <span className="text-sm tabular-nums">{Number(r.referralFee1br).toLocaleString()} AED</span>,
      exportValue: (r: any) => r.referralFee1br,
    },
    {
      key: "twobr",
      label: "2 BR",
      description: "One-time referral fee for 2-bedroom",
      render: (r: any) => <span className="text-sm tabular-nums">{Number(r.referralFee2br).toLocaleString()} AED</span>,
      exportValue: (r: any) => r.referralFee2br,
    },
    {
      key: "threebr",
      label: "3 BR",
      description: "One-time referral fee for 3-bedroom",
      render: (r: any) => <span className="text-sm tabular-nums">{Number(r.referralFee3br).toLocaleString()} AED</span>,
      exportValue: (r: any) => r.referralFee3br,
    },
    {
      key: "fourbr",
      label: "4+ BR",
      description: "One-time referral fee for 4+ bedrooms",
      render: (r: any) => <span className="text-sm tabular-nums">{Number(r.referralFee4brPlus).toLocaleString()} AED</span>,
      exportValue: (r: any) => r.referralFee4brPlus,
    },
    {
      key: "totalLeads",
      label: "Referred Owners",
      description: "Number of owners referred",
      render: (r: any) => <span className="text-sm font-medium">{(r as any).referredCount ?? 0}</span>,
      exportValue: (r: any) => (r as any).referredCount ?? 0,
    },
    {
      key: "programme",
      label: "Programme",
      description: "One-time or recurring commission",
      render: (r: any) => r.isRecurringEnabled ? (
        <Badge variant="outline" className="text-xs gap-1 text-emerald-700 border-emerald-300 bg-emerald-50">
          <RefreshCw className="h-2.5 w-2.5" /> Recurring
        </Badge>
      ) : (
        <Badge variant="outline" className="text-xs text-muted-foreground">One-Time</Badge>
      ),
      exportValue: (r: any) => r.isRecurringEnabled ? "Recurring" : "One-Time",
    },
    {
      key: "totalOwed",
      label: "Total Owed",
      description: "Total recurring commission owed to date",
      defaultVisible: false,
      render: (r: any) => ((r as any).totalCommissionOwed ?? 0) > 0 ? (
        <span className="text-sm font-semibold text-emerald-700">
          {Number((r as any).totalCommissionOwed).toLocaleString("en-AE")} AED
        </span>
      ) : <span className="text-muted-foreground">—</span>,
      exportValue: (r: any) => (r as any).totalCommissionOwed ?? 0,
    },
    {
      key: "status",
      label: "Status",
      description: "Active or inactive referee",
      render: (r: any) => r.isActive ? (
        <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Active</Badge>
      ) : (
        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
      ),
      exportValue: (r: any) => r.isActive ? "Active" : "Inactive",
    },
  ], []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Referees</h1>
          <p className="text-muted-foreground mt-1">
            Track partners entitled to referral fees and recurring commission on owner introductions.
          </p>
        </div>
        {canCreateReferee && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Referee
          </Button>
        )}
      </div>

      <SmartReport metrics={[
        { icon: <UserCheck  className="h-4 w-4" />, label: "Total Referees",          value: referees?.length ?? 0 },
        { icon: <Users      className="h-4 w-4" />, label: "Active Referees",          value: referees?.filter(r => r.isActive).length ?? 0, color: "green" as const },
        { icon: <RefreshCw  className="h-4 w-4" />, label: "Recurring Programme",      value: referees?.filter(r => r.isRecurringEnabled).length ?? 0 },
        { icon: <Home       className="h-4 w-4" />, label: "Total Referred Owners",    value: referees?.reduce((sum, r) => sum + ((r as any).referredCount ?? 0), 0) ?? 0 },
        { icon: <TrendingUp className="h-4 w-4" />, label: "Total Commission Owed",
          value: totalCommissionLiability > 0 ? `${totalCommissionLiability.toLocaleString("en-AE")} AED` : "—",
          color: totalCommissionLiability > 0 ? "amber" as const : "default" as const,
        },
      ]} />

      {/* Filter bar + DataTable */}
      <Card className="border-border/50 shadow-sm">
        <div className="p-4 border-b border-border space-y-3 bg-muted/20">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or referee code..."
                className="pl-9 bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-44 h-10 text-sm bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Date Added</SelectItem>
                <SelectItem value="owed_desc">Total Owed (highest first)</SelectItem>
              </SelectContent>
            </Select>
            {(activeFilterCount > 0 || search) && (
              <Button variant="ghost" size="sm" className="h-10 text-muted-foreground hover:text-foreground gap-1.5" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear all
              </Button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <Chip active={activeFilter === "all"} onClick={() => setActiveFilter("all")}>All Referees</Chip>
            <Chip active={activeFilter === "active"} onClick={() => setActiveFilter("active")}>Active</Chip>
            <Chip active={activeFilter === "inactive"} onClick={() => setActiveFilter("inactive")}>Inactive</Chip>
            <div className="w-px bg-border mx-1 self-stretch" />
            <Chip active={recurringFilter === "all"} onClick={() => setRecurringFilter("all")}>Any Programme</Chip>
            <Chip active={recurringFilter === "recurring"} onClick={() => setRecurringFilter("recurring")}>
              <RefreshCw className="h-3 w-3 inline mr-1 text-emerald-600" />Recurring
            </Chip>
            <Chip active={recurringFilter === "one-time"} onClick={() => setRecurringFilter("one-time")}>One-Time Fee</Chip>
          </div>

          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredReferees.length}</span> of{" "}
            <span className="font-semibold text-foreground">{referees?.length ?? 0}</span> referees
          </p>
        </div>

        <CardContent className="p-0">
          <DataTable
            id="referees"
            columns={refereeColumns}
            data={filteredReferees}
            isLoading={isLoading}
            rowKey={(r: any) => r.id}
            exportFileName="Referees"
            emptyState={
              <div>
                <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="font-medium text-foreground">No referees match your filters</p>
                {(activeFilterCount > 0 || search) ? (
                  <Button variant="link" className="mt-2 text-primary" onClick={clearAll}>Clear all filters</Button>
                ) : canCreateReferee && (
                  <Button className="mt-4 gap-2" onClick={openCreate}><Plus className="h-4 w-4" /> Add Referee</Button>
                )}
              </div>
            }
            actions={(referee: any) => (
              <div className="flex items-center justify-end gap-2">
                {canEditReferee && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openEdit(referee)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="outline" size="sm" className="text-xs gap-1" asChild>
                  <Link href={`/referees/${referee.id}`}>
                    <Users className="h-3 w-3" /> Owners
                  </Link>
                </Button>
                {isSuperAdmin && referee.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Deactivate referee (super admin)"
                    onClick={() => handleDeactivate(referee)}
                    disabled={deleteReferee.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          />
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{editingId ? "Edit Referee" : "Add New Referee"}</DialogTitle>
            {!editingId && (
              <p className="text-sm text-muted-foreground mt-1">
                A unique Referee ID (e.g. <span className="font-mono font-medium">REF-001</span>) will be automatically generated.
              </p>
            )}
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label>Full Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. Ahmed Al-Mansoori" {...form.register("name", { required: true })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">One-Time Referral Fees (AED)</Label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                {([
                  { label: "Studio", field: "referralFeeStudio" },
                  { label: "1 Bedroom", field: "referralFee1br" },
                  { label: "2 Bedrooms", field: "referralFee2br" },
                  { label: "3 Bedrooms", field: "referralFee3br" },
                  { label: "4+ Bedrooms", field: "referralFee4brPlus" },
                ] as const).map(({ label, field }) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="relative">
                      <Input type="number" min="0" step="100" {...form.register(field, { valueAsNumber: true })} className="pr-12 text-sm" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">AED</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-emerald-600" />
                    <Label className="text-sm font-semibold">Recurring Commission Programme</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">Agent earns a share of the PM commission they help close.</p>
                </div>
                <Switch checked={isRecurring} onCheckedChange={(val) => form.setValue("isRecurringEnabled", val)} />
              </div>
              {isRecurring && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2 text-xs">
                  <p className="font-semibold text-emerald-800">Recurring tier structure:</p>
                  <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
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
                  <p className="text-emerald-700 text-[10px] mt-1">* Company minimum is 15% PM — the programme never reduces RHH below this floor.</p>
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
