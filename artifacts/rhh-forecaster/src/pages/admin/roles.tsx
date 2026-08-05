import { useState } from "react";
import { useListRoles, useCreateRole, useUpdateRole, useDeleteRole } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ShieldCheck, Lock, Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";

// ── Permission matrix definition (mirrors server-side constants) ──────────────
const PERMISSION_GROUPS = [
  {
    group: "Dashboard",
    permissions: [{ key: "dashboard.view", label: "View Dashboard" }],
  },
  {
    group: "Owners",
    permissions: [
      { key: "owners.view",   label: "View" },
      { key: "owners.create", label: "Create" },
      { key: "owners.edit",   label: "Edit" },
      { key: "owners.delete", label: "Delete" },
    ],
  },
  {
    group: "Properties",
    permissions: [
      { key: "properties.view",   label: "View" },
      { key: "properties.create", label: "Create" },
      { key: "properties.edit",   label: "Edit" },
      { key: "properties.delete", label: "Delete" },
    ],
  },
  {
    group: "Forecasts",
    permissions: [
      { key: "forecasts.view",   label: "View" },
      { key: "forecasts.create", label: "Create" },
      { key: "forecasts.edit",   label: "Edit" },
    ],
  },
  {
    group: "Proposals",
    permissions: [
      { key: "proposals.view",    label: "View" },
      { key: "proposals.publish", label: "Publish / Share" },
    ],
  },
  {
    group: "Referees & Commissions",
    permissions: [
      { key: "referees.view",    label: "View Referees" },
      { key: "referees.create",  label: "Add Referees" },
      { key: "referees.edit",    label: "Edit Referees" },
      { key: "referees.delete",  label: "Delete Referees" },
      { key: "commissions.view", label: "View Commissions" },
      { key: "commissions.edit", label: "Edit Commissions" },
    ],
  },
  {
    group: "Market Data",
    permissions: [{ key: "market.view", label: "View Market Data" }],
  },
  {
    group: "User Management",
    permissions: [
      { key: "users.view",   label: "View Users" },
      { key: "users.create", label: "Invite Users" },
      { key: "users.edit",   label: "Edit Users" },
    ],
  },
  {
    group: "Role Management",
    permissions: [{ key: "roles.manage", label: "Manage Roles & Permissions" }],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

// ── Types ─────────────────────────────────────────────────────────────────────
type RoleFormValues = {
  name: string;
  label: string;
  description: string;
  color: string;
  permissions: string[];
};

const PRESET_COLORS = [
  "#DC2626", "#EA580C", "#D97706", "#16A34A",
  "#2563EB", "#7C3AED", "#9333EA", "#DB2777",
  "#0891B2", "#6B7280",
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function RolesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: roles, isLoading } = useListRoles();
  const createRole  = useCreateRole();
  const updateRole  = useUpdateRole();
  const deleteRole  = useDeleteRole();

  const [createOpen,  setCreateOpen]  = useState(false);
  const [editRole,    setEditRole]    = useState<NonNullable<typeof roles>[number] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NonNullable<typeof roles>[number] | null>(null);
  const [expandedId,  setExpandedId]  = useState<number | null>(null);

  // ── Create form ──
  const createForm = useForm<RoleFormValues>({
    defaultValues: { name: "", label: "", description: "", color: "#2563EB", permissions: [] },
  });

  async function handleCreate(vals: RoleFormValues) {
    try {
      await createRole.mutateAsync({ data: { ...vals } });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: "Role created" });
      setCreateOpen(false);
      createForm.reset();
    } catch (e: any) {
      toast({ title: "Failed", description: e?.data?.error ?? "Unknown error", variant: "destructive" });
    }
  }

  // ── Edit form ──
  const editForm = useForm<RoleFormValues>({
    defaultValues: { name: "", label: "", description: "", color: "#6B7280", permissions: [] },
  });

  function openEdit(role: NonNullable<typeof roles>[number]) {
    setEditRole(role);
    editForm.reset({
      name:        role.name,
      label:       role.label,
      description: role.description ?? "",
      color:       role.color,
      permissions: role.permissions,
    });
  }

  async function handleEdit(vals: RoleFormValues) {
    if (!editRole) return;
    try {
      await updateRole.mutateAsync({
        id: editRole.id,
        data: { label: vals.label, description: vals.description, color: vals.color, permissions: vals.permissions },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: "Role updated" });
      setEditRole(null);
    } catch (e: any) {
      toast({ title: "Failed", description: e?.data?.error ?? "Unknown error", variant: "destructive" });
    }
  }

  async function handleDelete(role: NonNullable<typeof roles>[number]) {
    try {
      await deleteRole.mutateAsync({ id: role.id });
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({ title: "Role deleted" });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Cannot delete", description: e?.data?.error ?? "Unknown error", variant: "destructive" });
    }
  }

  return (
    <div className="p-8 max-w-[1100px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1 text-lg">Define what each role can see and do.</p>
        </div>
        <Button className="h-10 px-6" onClick={() => { createForm.reset(); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          New Role
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading roles…</div>
      ) : (
        <div className="space-y-3">
          {roles?.map(role => (
            <Card key={role.id} className="border-border/50 shadow-sm">
              <CardHeader className="py-4 px-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: role.color }} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{role.label}</span>
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{role.name}</code>
                        {role.isBuiltIn && (
                          <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" />Built-in
                          </Badge>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{role.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      {role.permissions.length} / {ALL_PERMISSIONS.length}
                    </Badge>
                    <Button
                      variant="ghost" size="sm"
                      className="h-8 text-xs"
                      onClick={() => setExpandedId(expandedId === role.id ? null : role.id)}
                    >
                      {expandedId === role.id ? "Hide" : "View"} permissions
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(role)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!role.isBuiltIn && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(role)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {expandedId === role.id && (
                <CardContent className="pt-0 pb-5 px-6">
                  <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {PERMISSION_GROUPS.map(group => (
                      <div key={group.group}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.group}</p>
                        <div className="space-y-1">
                          {group.permissions.map(perm => (
                            <div key={perm.key} className="flex items-center gap-2 text-sm">
                              <div className={`h-1.5 w-1.5 rounded-full ${role.permissions.includes(perm.key) ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                              <span className={role.permissions.includes(perm.key) ? "text-foreground" : "text-muted-foreground/60"}>
                                {perm.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ── Create dialog ── */}
      <RoleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create New Role"
        form={createForm}
        onSubmit={handleCreate}
        isPending={createRole.isPending}
        allowNameEdit
      />

      {/* ── Edit dialog ── */}
      <RoleFormDialog
        open={!!editRole}
        onOpenChange={(o) => { if (!o) setEditRole(null); }}
        title={`Edit Role — ${editRole?.label}`}
        form={editForm}
        onSubmit={handleEdit}
        isPending={updateRole.isPending}
        isBuiltIn={editRole?.isBuiltIn}
      />

      {/* ── Delete confirmation ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.label}</strong>? Users assigned this role will need to be reassigned.
          </p>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteRole.isPending}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deleteRole.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Shared role form dialog ───────────────────────────────────────────────────
function RoleFormDialog({
  open, onOpenChange, title, form, onSubmit, isPending, allowNameEdit, isBuiltIn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  form: ReturnType<typeof useForm<RoleFormValues>>;
  onSubmit: (v: RoleFormValues) => void;
  isPending: boolean;
  allowNameEdit?: boolean;
  isBuiltIn?: boolean;
}) {
  const watchedPerms = form.watch("permissions") ?? [];

  function togglePerm(key: string) {
    const current = form.getValues("permissions") ?? [];
    if (current.includes(key)) {
      form.setValue("permissions", current.filter(p => p !== key));
    } else {
      form.setValue("permissions", [...current, key]);
    }
  }

  function toggleGroup(keys: string[]) {
    const current = form.getValues("permissions") ?? [];
    const allOn = keys.every(k => current.includes(k));
    if (allOn) {
      form.setValue("permissions", current.filter(p => !keys.includes(p)));
    } else {
      const merged = Array.from(new Set([...current, ...keys]));
      form.setValue("permissions", merged);
    }
  }

  function selectAll() { form.setValue("permissions", [...ALL_PERMISSIONS]); }
  function clearAll()  { form.setValue("permissions", []); }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-2">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            {allowNameEdit && (
              <div className="col-span-2 space-y-1.5">
                <Label>Role ID <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. vip_manager"
                  {...form.register("name", { required: true, pattern: /^[a-z0-9_]+$/ })}
                />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers and underscores only. Cannot be changed later.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Display Name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. VIP Manager" {...form.register("label", { required: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <Controller
                control={form.control}
                name="color"
                render={({ field }) => (
                  <div className="flex gap-2 flex-wrap">
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c} type="button"
                        className={`h-7 w-7 rounded-full border-2 transition-transform ${field.value === c ? "border-foreground scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                        onClick={() => field.onChange(c)}
                      />
                    ))}
                    <input type="color" value={field.value} onChange={e => field.onChange(e.target.value)}
                      className="h-7 w-7 rounded-full cursor-pointer border border-border" />
                  </div>
                )}
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Description</Label>
              <Input placeholder="What is this role for?" {...form.register("description")} />
            </div>
          </div>

          {/* Permission matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Permissions</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>Select All</Button>
                <Button type="button" variant="ghost"   size="sm" className="h-7 text-xs" onClick={clearAll}>Clear All</Button>
              </div>
            </div>
            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {PERMISSION_GROUPS.map(group => {
                const keys = group.permissions.map(p => p.key);
                const allOn  = keys.every(k => watchedPerms.includes(k));
                const someOn = keys.some(k => watchedPerms.includes(k));
                return (
                  <div key={group.group} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.group}</span>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => toggleGroup(keys)}
                      >
                        {allOn ? "Deselect all" : someOn ? "Select all" : "Select all"}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {group.permissions.map(perm => (
                        <label key={perm.key} className="flex items-center gap-2 cursor-pointer select-none">
                          <Checkbox
                            checked={watchedPerms.includes(perm.key)}
                            onCheckedChange={() => togglePerm(perm.key)}
                            disabled={isBuiltIn && perm.key === "roles.manage"}
                          />
                          <span className="text-sm">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {watchedPerms.length} of {ALL_PERMISSIONS.length} permissions enabled
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
