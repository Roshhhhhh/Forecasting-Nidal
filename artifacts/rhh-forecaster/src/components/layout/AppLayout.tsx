import { FC, ReactNode, useEffect, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LayoutDashboard, Users, Home, TrendingUp, LineChart, FileText, Settings, ShieldAlert, LogOut, UserCheck, ShieldCheck, LayoutGrid, Bell, Eye, CheckCircle, Send, X, ClipboardList, Trophy, MapPin } from "lucide-react";
import { useLogout, useGetMe, useListProposals } from "@workspace/api-client-react";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";

const NAV_ITEMS = [
  { label: "Dashboard",        href: "/dashboard",          icon: LayoutDashboard },
  { label: "Pipeline",         href: "/pipeline",           icon: LayoutGrid },
  { label: "Owners",           href: "/owners",             icon: Users },
  { label: "Properties",       href: "/properties",         icon: Home },
  { label: "Forecasts",        href: "/forecasts",          icon: TrendingUp },
  { label: "Market Data",      href: "/market",             icon: LineChart },
  { label: "Proposals",        href: "/proposals",          icon: FileText },
  { label: "Referees",         href: "/referees",           icon: UserCheck },
  { label: "Forecast Requests",href: "/forecast-requests",  icon: ClipboardList },
];

const STORAGE_KEY = "rhh_notif_last_seen";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const EVENT_META: Record<string, { icon: FC<any>; label: string; color: string; bg: string }> = {
  view:            { icon: Eye,           label: "Proposal viewed",         color: "#2563eb", bg: "#eff6ff" },
  accept:          { icon: CheckCircle,   label: "Proposal accepted",       color: "#16a34a", bg: "#f0fdf4" },
  submit:          { icon: Send,          label: "Proposal sent",           color: "#c9a84c", bg: "#fefce8" },
  forecast_request:{ icon: ClipboardList, label: "New forecast request",    color: "#7c3aed", bg: "#f5f3ff" },
};

function getEventMeta(type: string) {
  return EVENT_META[type] ?? { icon: Bell, label: type, color: "#888", bg: "#f5f5f5" };
}

// ── Notification Bell ──────────────────────────────────────────────────────────
const NotificationBell: FC = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(() => {
    try { return parseInt(localStorage.getItem(STORAGE_KEY) ?? "0", 10) || 0; } catch { return 0; }
  });
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => n.id > lastSeen).length;

  const handleOpen = () => {
    setOpen((o) => !o);
  };

  const markAllRead = () => {
    if (!notifications.length) return;
    const maxId = Math.max(...notifications.map((n) => n.id));
    setLastSeen(maxId);
    try { localStorage.setItem(STORAGE_KEY, String(maxId)); } catch { /* */ }
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        style={{
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 36, height: 36,
          borderRadius: 8,
          border: "1px solid hsl(var(--border))",
          background: open ? "hsl(var(--accent))" : "transparent",
          cursor: "pointer",
          color: "hsl(var(--foreground))",
          transition: "background 0.15s",
        }}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4,
            minWidth: 16, height: 16, borderRadius: 8,
            background: "#ef4444",
            color: "#fff",
            fontSize: 10, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px",
            lineHeight: 1,
            border: "2px solid hsl(var(--background))",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            maxHeight: 480,
            borderRadius: 12,
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--background))",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 16px 12px",
            borderBottom: "1px solid hsl(var(--border))",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={14} style={{ color: "#c9a84c" }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  background: "#ef4444", color: "#fff",
                  borderRadius: 10, padding: "1px 6px",
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ fontSize: 11, color: "#c9a84c", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex" }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center", color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
                <Bell size={24} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                <p style={{ margin: 0 }}>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = getEventMeta(n.eventType);
                const isUnread = n.id > lastSeen;
                const IconComp = meta.icon;
                return (
                  <a
                    key={n.id}
                    href={n.eventType === "forecast_request" ? `/forecast-requests` : `/proposals/${n.proposalId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      if (n.id > lastSeen) {
                        const newMax = Math.max(lastSeen, n.id);
                        setLastSeen(newMax);
                        try { localStorage.setItem(STORAGE_KEY, String(newMax)); } catch { /* */ }
                      }
                      setOpen(false);
                      window.location.href = n.eventType === "forecast_request" ? `/forecast-requests` : `/proposals/${n.proposalId}`;
                    }}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "12px 16px",
                      borderBottom: "1px solid hsl(var(--border))",
                      background: isUnread ? "hsl(var(--accent)/0.5)" : "transparent",
                      textDecoration: "none",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: meta.bg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <IconComp size={14} style={{ color: meta.color }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: isUnread ? 700 : 600, color: "hsl(var(--foreground))" }}>
                          {meta.label}
                        </span>
                        <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginTop: 2, display: "flex", gap: 6 }}>
                        <span style={{ fontWeight: 600, color: "#c9a84c" }}>{n.referenceNumber}</span>
                        {n.ownerName && <span>· {n.ownerName}</span>}
                      </div>
                    </div>
                    {isUnread && (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444", flexShrink: 0, marginTop: 4 }} />
                    )}
                  </a>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
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
            {(user?.role === "super_admin" || user?.role === "revenue_manager") && (
              <>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.startsWith("/analytics/leaderboard")}>
                    <Link href="/analytics/leaderboard" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent">
                      <Trophy className="h-4 w-4" />
                      <span>Leaderboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.startsWith("/analytics/areas")}>
                    <Link href="/analytics/areas" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-sidebar-accent">
                      <MapPin className="h-4 w-4" />
                      <span>Area Intelligence</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </>
            )}
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

// ── Layout ─────────────────────────────────────────────────────────────────────
export const AppLayout: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full bg-background">
        <AppSidebar />
        <ProposalViewWatcher />
        <main className="flex-1 overflow-auto flex flex-col min-w-0">
          {/* Persistent top bar — mobile + desktop */}
          <header
            className="flex items-center justify-between px-3 md:px-5 py-2 border-b border-border bg-background sticky top-0 z-20 shrink-0"
            style={{ minHeight: 48 }}
          >
            {/* Left: hamburger (mobile) + logo (mobile only) */}
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 shrink-0" />
              <img src="/rhh-logo.png" alt="Royal Holiday Homes" className="h-7 w-auto md:hidden" />
            </div>
            {/* Right: notification bell */}
            <NotificationBell />
          </header>

          <div className="flex-1 w-full mx-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};
