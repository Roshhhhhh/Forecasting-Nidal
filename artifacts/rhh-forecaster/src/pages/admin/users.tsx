import { useListUsers, useCreateUser, useUpdateUser } from "@workspace/api-client-react";
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
import { Search, UserPlus, ShieldAlert, Edit2, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type UserFormValues = {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
};

const ROLES = [
  { value: "super_admin",      label: "Super Admin" },
  { value: "revenue_manager",  label: "Revenue Manager" },
  { value: "sales",            label: "Sales" },
  { value: "admin",            label: "Admin" },
];

export default function UsersList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: users, isLoading } = useListUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<NonNullable<typeof users>[number] | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const filteredUsers = users?.filter(u =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  );

  // ── Invite form ──
  const inviteForm = useForm<UserFormValues>({
    defaultValues: { name: "", email: "", password: "", role: "sales", phone: "" },
  });

  async function handleInvite(vals: UserFormValues) {
    try {
      await createUser.mutateAsync({
        data: {
          name: vals.name.trim(),
          email: vals.email.trim(),
          password: vals.password,
          role: vals.role as any,
          phone: vals.phone.trim() || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created", description: `${vals.name} can now log in.` });
      setInviteOpen(false);
      inviteForm.reset();
    } catch (e: any) {
      toast({ title: "Failed to create user", description: e?.data?.error ?? "Unknown error", variant: "destructive" });
    }
  }

  // ── Edit form ──
  const editForm = useForm<Partial<UserFormValues> & { isActive: boolean }>({
    defaultValues: { name: "", email: "", role: "sales", phone: "", isActive: true },
  });

  function openEdit(user: NonNullable<typeof users>[number]) {
    setEditUser(user);
    editForm.reset({
      name: user.name ?? "",
      email: user.email ?? "",
      role: user.role ?? "sales",
      phone: (user as any).phone ?? "",
      isActive: user.isActive ?? true,
    });
  }

  async function handleEdit(vals: Partial<UserFormValues> & { isActive: boolean }) {
    if (!editUser) return;
    try {
      await updateUser.mutateAsync({
        id: editUser.id,
        data: {
          name: vals.name?.trim(),
          role: vals.role as any,
          phone: (vals.phone?.trim() || undefined) as any,
          isActive: vals.isActive,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
      setEditUser(null);
    } catch (e: any) {
      toast({ title: "Failed to update user", description: e?.data?.error ?? "Unknown error", variant: "destructive" });
    }
  }

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage platform access and roles.</p>
        </div>
        <Button className="h-10 px-6" onClick={() => { inviteForm.reset(); setShowPassword(false); setInviteOpen(true); }}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Last Login</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Loading users...</td></tr>
                ) : filteredUsers?.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No users found.</td></tr>
                ) : filteredUsers?.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{user.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="capitalize bg-background text-muted-foreground">
                        {user.role?.replace(/_/g, " ")}
                      </Badge>
                      {user.role === "super_admin" && <ShieldAlert className="inline-block ml-2 h-4 w-4 text-primary" />}
                    </td>
                    <td className="px-6 py-4">
                      {user.isActive ? (
                        <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(user)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
              <div className="col-span-2 space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...editForm.register("email")} />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Controller
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
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
