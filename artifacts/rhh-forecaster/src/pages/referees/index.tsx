import { useState, useMemo } from "react";
import {
  useListReferees, useCreateReferee, useUpdateReferee, getListRefereesQueryKey,
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
  RefreshCw, Home, TrendingUp, Search, X,
} from "lucide-react";
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
  const { data: referees, isLoading } = useListReferees();
  const createReferee = useCreateReferee();
  const updateReferee = useUpdateReferee();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "owed_desc">("default");

  // Smart filter state
  const [search, setSearch]     = useState("");
  const [activeFilter, setActiveFilter] = useState("all"); // all | active | inactive
  const [recurringFilter, setRecurringFilter] = useState("all"); // all | recurring | one-time

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
    } catch {
      toast({ title: "Error", variant: "destructive", description: "Failed to save referee." });
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
        `${r.name} ${r.email || ''} ${r.phone || ''} ${(r as any).companyName || ''} ${r.refereeCode}`.toLowerCase().includes(q)
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

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
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

      {/* Stats bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-xl font-bold">{referees?.reduce((sum, r) => sum + ((r as any).referredCount ?? 0), 0) ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-md"><TrendingUp className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Total Commission Liability</p>
              <p className="text-xl font-bold text-amber-700">
                {totalCommissionLiability > 0 ? `${totalCommissionLiability.toLocaleString("en-AE")} AED` : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Smart filter bar */}
      <Card className="border-border/50 shadow-sm">
        <div className="p-4 border-b border-border space-y-3 bg-muted/20">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-lg">
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

          {/* Filter chips */}
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

          {/* Result count */}
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredReferees.length}</span> of{" "}
            <span className="font-semibold text-foreground">{referees?.length ?? 0}</span> referees
          </p>
        </div>

        {/* Grid */}
        <CardContent className="p-6">
          {isLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading referees...</div>
          ) : filteredReferees.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium text-foreground">No referees match your filters</p>
              {(activeFilterCount > 0 || search) ? (
                <Button variant="link" className="mt-2 text-primary" onClick={clearAll}>Clear all filters</Button>
              ) : canCreateReferee && (
                <Button className="mt-4 gap-2" onClick={openCreate}><Plus className="h-4 w-4" /> Add Referee</Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReferees.map((referee: any) => (
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
                      {canEditReferee && (
                        <button
                          onClick={() => openEdit(referee)}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
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
                    <div className="rounded-md bg-muted/40 p-2.5 grid grid-cols-3 gap-1.5 text-center">
                      {[
                        { label: "Studio", value: referee.referralFeeStudio },
                        { label: "1 BR",   value: referee.referralFee1br },
                        { label: "2 BR",   value: referee.referralFee2br },
                        { label: "3 BR",   value: referee.referralFee3br },
                        { label: "4+ BR",  value: referee.referralFee4brPlus },
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
                        <div className="text-xs text-emerald-700 font-medium">PM%−16% recurring</div>
                      )}
                    </div>
                    {referee.isRecurringEnabled && (
                      <div className="flex items-center justify-between rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2">
                        <span className="text-xs text-emerald-700 font-medium">Total Owed</span>
                        <span className="text-sm font-bold text-emerald-800">
                          {((referee as any).totalCommissionOwed ?? 0) > 0
                            ? `${Number((referee as any).totalCommissionOwed).toLocaleString("en-AE")} AED`
                            : "—"}
                        </span>
                      </div>
                    )}
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">One-Time Referral Fees (AED)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
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
