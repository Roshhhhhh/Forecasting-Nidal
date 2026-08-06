import { FC, ReactNode, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarProvider } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Home, TrendingUp, LineChart, FileText, Settings, ShieldAlert, LogOut, UserCheck, ShieldCheck, LayoutGrid, Eye } from "lucide-react";
import { useLogout, useGetMe, useListProposals } from "@workspace/api-client-react";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";

const NAV_ITEMS = [
  { label: "Dashboard",  href: "/dashboard", icon: LayoutDashboard },
  { label: "Pipeline",   href: "/pipeline",  icon: LayoutGrid },
  { label: "Owners", href: "/owners", icon: Users },
  { label: "Properties", href: "/properties", icon: Home },
  { label: "Forecasts", href: "/forecasts", icon: TrendingUp },
  { label: "Market Data", href: "/market", icon: LineChart },
  { label: "Proposals", href: "/proposals", icon: FileText },
  { label: "Referees", href: "/referees", icon: UserCheck },
];

export const AppSidebar: FC = () => {
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const { data: user } = useGetMe();
  const canManageUsers = usePermission("users.view");
  const canManageRoles = usePermission("roles.manage");

  const handleLogout = async () => {
    await logout.mutateAsync();
    setLocation("/login");
  };

  return (
    <Sidebar variant="sidebar" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="py-5 px-4">
        <div className="flex items-center justify-center">
          <img
            src="/rhh-logo.png"
            alt="Royal Holiday Homes"
            className="h-10 w-auto"
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {NAV_ITEMS.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton 
                asChild
                isActive={location.startsWith(item.href)}
                className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium transition-colors"
              >
                <Link href={item.href} className="flex items-center gap-3 px-3 py-2 rounded-md">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
        
        <div className="mt-8 px-4 pb-2">
          <p className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">Management</p>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/settings"}>
                <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {canManageUsers && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/admin/users"}>
                  <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Users</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {canManageRoles && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/admin/roles"}>
                  <Link href="/admin/roles" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Roles</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col truncate">
            <span className="text-sm font-medium text-sidebar-foreground truncate">{user?.name || "Loading..."}</span>
            <span className="text-xs text-sidebar-foreground/50 capitalize truncate">{user?.role?.replace('_', ' ')}</span>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-sidebar-accent rounded-md text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors" aria-label="Log out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

/** Polls proposals every 30 s and fires a toast when any proposal receives its first view. */
const ProposalViewWatcher: FC = () => {
  const { toast } = useToast();
  const { data: me } = useGetMe();
  const prevViews = useRef<Record<number, number>>({});
  const initialized = useRef(false);

  const { data: proposals } = useListProposals({
    query: { refetchInterval: 30_000, staleTime: 25_000 } as any,
  });

  useEffect(() => {
    if (!proposals || !me) return;

    if (!initialized.current) {
      // Seed baseline on first load — don't fire toasts for already-viewed proposals
      for (const p of proposals) {
        prevViews.current[p.id] = p.totalViews ?? 0;
      }
      initialized.current = true;
      return;
    }

    for (const p of proposals) {
      const prev = prevViews.current[p.id] ?? 0;
      const current = p.totalViews ?? 0;
      if (prev === 0 && current > 0) {
        toast({
          title: "Proposal opened!",
          description: (
            <span>
              <strong>{p.referenceNumber}</strong> was just opened by the owner for the first time.{" "}
              <a
                href={`/proposals/${p.id}`}
                className="underline font-medium text-primary"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = `/proposals/${p.id}`;
                }}
              >
                View activity →
              </a>
            </span>
          ) as any,
          duration: 8000,
        });
      }
      prevViews.current[p.id] = current;
    }
  }, [proposals, me, toast]);

  return null;
};

export const AppLayout: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full bg-background">
        <AppSidebar />
        <ProposalViewWatcher />
        <main className="flex-1 overflow-auto flex flex-col">
          <div className="flex-1 w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
