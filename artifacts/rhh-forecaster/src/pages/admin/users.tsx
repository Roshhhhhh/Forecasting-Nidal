import { useListUsers } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, ShieldAlert, Edit2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export default function UsersList() {
  const { data: users, isLoading } = useListUsers();
  const [search, setSearch] = useState("");

  const filteredUsers = users?.filter(u => 
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage platform access and roles.</p>
        </div>
        <Button className="h-10 px-6">
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
                        {user.role.replace('_', ' ')}
                      </Badge>
                      {user.role === 'super_admin' && <ShieldAlert className="inline-block ml-2 h-4 w-4 text-primary" />}
                    </td>
                    <td className="px-6 py-4">
                      {user.isActive ? (
                        <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
    </div>
  );
}
