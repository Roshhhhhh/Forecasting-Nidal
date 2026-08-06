import { useListUsers, useCreateUser, useUpdateUser, useListRoles } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, UserPlus, ShieldAlert, Edit2, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { usePermission } from "@/hooks/usePermission";
import { useGetMe } from "@workspace/api-client-react";
import { DataTable, ColumnDef } from "@/components/DataTable";

type InviteFormValues = {
  name: string;
  email: string;
  password: string;
  roleId: string;
  phone: string;
};

type EditFormValues = {
  name: string;
  roleId: string;
  phone: string;
  isActive: boolean;
};

export default function UsersList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isLoading: isMeLoading } = useGetMe();
  const canViewUsers   = usePermission("users.view");
  const canCreateUsers = usePermission("users.create");
  const canEditUsers   = usePermission("users.edit");
  const canManageRoles = usePermission("roles.manage");

  useEffect(() => {
    if (!isMeLoading && !canViewUsers) {
      setLocation("/dashboard");
    }
  }, [isMeLoading, canViewUsers, setLocation]);

  const { data: users, isLoading } = useListUsers();
  const { data: roles } = useListRoles();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [search,       setSearch]      = useState("");
  const [inviteOpen,   setInviteOpen]  = useState(false);
  const [editUser,     setEditUser]    = useState<NonNullable<typeof users>[number] | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const filteredUsers = users?.filter(u =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  );

  const inviteForm = useForm<InviteFormValues>({
    defaultValues: { name: "", email: "", password: "", roleId: "", phone: "" },
  });

  async function handleInvite(vals: InviteFormValues) {
    try {
      await createUser.mutateAsync({
        data: {
          name:   vals.name.trim(),
          email:  vals.email.trim(),
          password: vals.password,
          roleId: parseInt(vals.roleId),
          phone:  vals.phone.trim() || undefined,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created", description: `${vals.name} can now log in.` });
      setInviteOpen(false);
      inviteForm.reset();
    } catch (e: any) {
      toast({ title: "Failed to create user", description: e?.data?.error ?? "Unknown error", variant: "destructive" });
    }
  }

  const editForm = useForm<EditFormValues>({
    defaultValues: { name: "", roleId: "", phone: "", isActive: true },
  });

  function openEdit(user: NonNullable<typeof users>[number]) {
    setEditUser(user);
    editForm.reset({
      name:     user.name ?? "",
      roleId:   (user as any).roleId?.toString() ?? "",
      phone:    (user as any).phone ?? "",
      isActive: user.isActive ?? true,
    });
  }

  async function handleEdit(vals: EditFormValues) {
    if (!editUser) return;
    try {
      await updateUser.mutateAsync({
        id: editUser.id,
        data: {
          name:     vals.name?.trim(),
          roleId:   vals.roleId ? parseInt(vals.roleId) : undefined,
          phone:    (vals.phone?.trim() || undefined) as any,
          isActive: vals.isActive,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
      setEditUser(null);
    } catch (e: any) {
      toast({ title: "Failed to update user", description: e?.data?.error ?? "Unknown error", variant: "destructive" });
    }
  }

  function getRoleColor(roleId: number | null | undefined) {
    if (!roleId || !roles) return "#6B7280";
    return roles.find(r => r.id === roleId)?.color ?? "#6B7280";
  }

  function getRoleLabel(user: NonNullable<typeof users>[number]) {
    const anyUser = user as any;
    if (anyUser.roleLabel) return anyUser.roleLabel;
    return user.role?.replace(/_/g, " ") ?? "—";
  }

  type UserRow = NonNullable<typeof users>[number];

  const userColumns = useMemo<ColumnDef<UserRow>[]>(() => [
    {
      key: "name",
      label: "Name",
      description: "Full name and email address",
      render: (u) => (
        <div>
          <div className="font-medium text-foreground">{u.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{u.email}</div>
        </div>
      ),
      exportValue: (u) => u.name ?? "",
      minWidth: "min-w-[160px]",
    },
    {
      key: "email",
      label: "Email Address",
      description: "Login email",
      defaultVisible: false,
      render: (u) => <span className="text-sm text-muted-foreground">{u.email}</span>,
      exportValue: (u) => u.email,
    },
    {
      key: "role",
      label: "Role",
      description: "Assigned permissions role",
      render: (u) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getRoleColor((u as any).roleId) }} />
          <span className="capitalize text-sm">{getRoleLabel(u)}</span>
          {u.role === "super_admin" && <ShieldAlert className="h-4 w-4 text-red-500" />}
        </div>
      ),
      exportValue: (u) => getRoleLabel(u),
    },
    {
      key: "status",
      label: "Status",
      description: "Active or inactive account",
      render: (u) => u.isActive ? (
        <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20">Active</Badge>
      ) : (
        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
      ),
      exportValue: (u) => u.isActive ? "Active" : "Inactive",
    },
    {
      key: "lastLogin",
      label: "Last Login",
      description: "Date of most recent login",
      render: (u) => (
        <span className="text-sm text-muted-foreground">
          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never"}
        </span>
      ),
      exportValue: (u) => u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "Never",
    },
    {
      key: "created",
      label: "Created",
      description: "Account creation date",
      defaultVisible: false,
      render: (u) => (
        <span className="text-sm text-muted-foreground">
          {(u as any).createdAt ? new Date((u as any).createdAt).toLocaleDateString() : "—"}
        </span>
      ),
      exportValue: (u) => (u as any).createdAt ? new Date((u as any).createdAt).toLocaleDateString() : "",
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [roles]);

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage platform access and roles.</p>
        </div>
        <div className="flex gap-3">
          {canManageRoles && (
            <Button variant="outline" className="h-10 px-4 gap-2" asChild>
              <Link href="/admin/roles">
                <ShieldCheck className="h-4 w-4" />
                Manage Roles
              </Link>
            </Button>
          )}
          {canCreateUsers && (
            <Button className="h-10 px-6" onClick={() => { inviteForm.reset(); setShowPassword(false); setInviteOpen(true); }}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          )}
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="py-4 border-b border-border bg-muted/20">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            id="users"
            columns={userColumns}
            data={filteredUsers}
            isLoading={isLoading}
            rowKey={u => u.id}
            exportFileName="Users"
            emptyState={<p className="text-sm">No users found.</p>}
            actions={canEditUsers ? (user) => (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(user)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            ) : undefined}
          />
        </CardContent>
      </Card>

      {/* ── Invite dialog ── */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Invite New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={inviteForm.handleSubmit(handleInvite)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input placeholder="Jane Smith" {...inviteForm.register("name", { required: true })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input type="email" placeholder="jane@royalholidayhomes.ae" {...inviteForm.register("email", { required: true })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Password <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    className="pr-10"
                    {...inviteForm.register("password", { required: true, minLength: 8 })}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Role <span className="text-destructive">*</span></Label>
                <Controller
                  control={inviteForm.control}
                  name="roleId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {roles?.map(r => (
                          <SelectItem key={r.id} value={r.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                              {r.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="+971 50 000 0000" {...inviteForm.register("phone")} />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createUser.isPending} className="gap-2">
                {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Full Name</Label>
                <Input {...editForm.register("name")} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Controller
                  control={editForm.control}
                  name="roleId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      <SelectContent>
                        {roles?.map(r => (
                          <SelectItem key={r.id} value={r.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                              {r.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input placeholder="+971 50 000 0000" {...editForm.register("phone")} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Status</Label>
                <Controller
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <Select value={field.value ? "active" : "inactive"} onValueChange={v => field.onChange(v === "active")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" disabled={updateUser.isPending} className="gap-2">
                {updateUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
