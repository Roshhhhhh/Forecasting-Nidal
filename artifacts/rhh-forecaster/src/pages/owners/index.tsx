import { useListOwners } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Search, Mail, Phone, X, Building2, User, Eye, Users } from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { usePermission } from "@/hooks/usePermission";
import { DataTable, ColumnDef } from "@/components/DataTable";
import { SmartReport } from "@/components/SmartReport";
import { PageTabs } from "@/components/PageTabs";

const LEAD_SOURCE_OPTIONS = [
  { value: "all",          label: "All Sources" },
  { value: "referral",     label: "Referral" },
  { value: "cold_call",    label: "Cold Call" },
  { value: "walk_in",      label: "Walk-in" },
  { value: "social_media", label: "Social Media" },
  { value: "event",        label: "Event" },
  { value: "other",        label: "Other" },
];

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

type OwnerRow = NonNullable<ReturnType<typeof useListOwners>["data"]>[number];

const OWNER_COLUMNS: ColumnDef<OwnerRow>[] = [
  {
    key: "name",
    label: "Name / Company",
    description: "Owner or company name with link to profile",
    render: (o) => (
      <Link href={`/owners/${o.id}`} className="block">
        <div className="font-medium text-foreground hover:text-primary transition-colors">
          {o.ownerType === "company" && o.companyName ? o.companyName : `${o.firstName} ${o.lastName}`}
        </div>
        {o.ownerType === "company" && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Contact: {o.firstName} {o.lastName}
          </div>
        )}
      </Link>
    ),
    exportValue: (o) => o.ownerType === "company" && o.companyName ? o.companyName : `${o.firstName} ${o.lastName}`,
    minWidth: "min-w-[160px]",
  },
  {
    key: "email",
    label: "Email",
    description: "Contact email address",
    render: (o) => o.email ? (
      <a href={`mailto:${o.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:underline text-sm">
        <Mail className="h-3 w-3 shrink-0" />{o.email}
      </a>
    ) : <span className="text-muted-foreground">—</span>,
    exportValue: (o) => o.email ?? "",
  },
  {
    key: "phone",
    label: "Phone",
    description: "Contact phone number",
    render: (o) => o.phone ? (
      <a href={`tel:${o.phone}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm">
        <Phone className="h-3 w-3 shrink-0" />{o.phone}
      </a>
    ) : <span className="text-muted-foreground">—</span>,
    exportValue: (o) => o.phone ?? "",
  },
  {
    key: "type",
    label: "Type",
    description: "Individual or company owner",
    render: (o) => (
      <Badge variant="outline" className="capitalize bg-background text-muted-foreground">{o.ownerType}</Badge>
    ),
    exportValue: (o) => o.ownerType,
  },
  {
    key: "clientStatus",
    label: "Client Status",
    description: "New lead or existing client",
    render: (o) => o.isExistingClient ? (
      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Client</Badge>
    ) : (
      <Badge variant="outline" className="bg-background text-muted-foreground">New Lead</Badge>
    ),
    exportValue: (o) => o.isExistingClient ? "Existing Client" : "New Lead",
  },
  {
    key: "leadSource",
    label: "Lead Source",
    description: "Acquisition channel",
    render: (o) => o.leadSource && o.leadSource !== "other" ? (
      <span className="text-xs capitalize text-muted-foreground">{o.leadSource.replace(/_/g, " ")}</span>
    ) : <span className="text-muted-foreground">—</span>,
    exportValue: (o) => o.leadSource?.replace(/_/g, " ") ?? "",
  },
  {
    key: "added",
    label: "Added",
    description: "Date the owner was added",
    render: (o) => <span className="text-muted-foreground text-sm">{new Date(o.createdAt).toLocaleDateString()}</span>,
    exportValue: (o) => new Date(o.createdAt).toLocaleDateString(),
  },
];

export default function OwnersList() {
  const { data: owners, isLoading } = useListOwners();
  const canCreateOwner    = usePermission("owners.create");
  const canCreateProperty = usePermission("properties.create");

  const [search, setSearch]         = useState("");
  const [ownerType, setOwnerType]   = useState("all");
  const [clientStatus, setClientStatus] = useState("all");
  const [leadSource, setLeadSource] = useState("all");

  // ── SmartReport metrics ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const all = owners ?? [];
    return [
      { icon: <Users className="h-4 w-4" />, label: "Total Owners",      value: all.length },
      { icon: <User  className="h-4 w-4" />, label: "Individual",         value: all.filter(o => o.ownerType === "individual").length },
      { icon: <Building2 className="h-4 w-4" />, label: "Company",        value: all.filter(o => o.ownerType === "company").length },
      { icon: <Plus  className="h-4 w-4" />, label: "New Leads",          value: all.filter(o => !o.isExistingClient).length },
      {                                        label: "Existing Clients",  value: all.filter(o => o.isExistingClient).length,
        color: "green" as const,
      },
    ];
  }, [owners]);

  // ── Status tabs ───────────────────────────────────────────────────────────
  const statusTabs = useMemo(() => [
    { value: "all",      label: "All Owners",       count: owners?.length ?? 0 },
    { value: "lead",     label: "New Leads",         count: owners?.filter(o => !o.isExistingClient).length ?? 0 },
    { value: "existing", label: "Existing Clients",  count: owners?.filter(o => o.isExistingClient).length ?? 0 },
  ], [owners]);

  // ── Filters ───────────────────────────────────────────────────────────────
  const activeFilterCount = useMemo(() => [
    ownerType !== "all",
    leadSource !== "all",
  ].filter(Boolean).length, [ownerType, leadSource]);

  const filteredOwners = useMemo(() => owners?.filter(o => {
    if (search) {
      const q = search.toLowerCase();
      if (!`${o.firstName} ${o.lastName} ${o.companyName || ""} ${o.email} ${o.phone || ""}`.toLowerCase().includes(q)) return false;
    }
    if (ownerType !== "all" && o.ownerType !== ownerType) return false;
    if (clientStatus === "lead"     && o.isExistingClient)  return false;
    if (clientStatus === "existing" && !o.isExistingClient) return false;
    if (leadSource !== "all" && o.leadSource !== leadSource) return false;
    return true;
  }), [owners, search, ownerType, clientStatus, leadSource]);

  function clearAll() {
    setSearch(""); setOwnerType("all"); setLeadSource("all");
  }

  const activeChips: { label: string; clear: () => void }[] = [];
  if (ownerType !== "all") activeChips.push({ label: ownerType === "company" ? "Company" : "Individual", clear: () => setOwnerType("all") });
  if (leadSource !== "all") activeChips.push({ label: LEAD_SOURCE_OPTIONS.find(l => l.value === leadSource)?.label ?? leadSource, clear: () => setLeadSource("all") });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">Property Owners</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your client relationships and leads.</p>
        </div>
        {canCreateOwner && (
          <Link href="/owners/new" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Owner
          </Link>
        )}
      </div>

      {/* SmartReport */}
      <SmartReport metrics={metrics} />

      {/* Main card */}
      <Card className="border-border/50 shadow-sm">
        {/* Nav Tabs */}
        <PageTabs tabs={statusTabs} value={clientStatus} onChange={setClientStatus} />

        {/* Filter bar */}
        <div className="p-4 border-b border-border space-y-3 bg-muted/20">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, company, email, or phone..."
                className="pl-9 bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {(activeFilterCount > 0 || search) && (
              <Button variant="ghost" size="sm" className="h-10 text-muted-foreground hover:text-foreground gap-1.5" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear filters
              </Button>
            )}
          </div>

          {/* Type chips */}
          <div className="flex gap-2 flex-wrap">
            <Chip active={ownerType === "all"} onClick={() => setOwnerType("all")}>All Types</Chip>
            <Chip active={ownerType === "individual"} onClick={() => setOwnerType("individual")}>
              <User className="h-3 w-3 inline mr-1" />Individual
            </Chip>
            <Chip active={ownerType === "company"} onClick={() => setOwnerType("company")}>
              <Building2 className="h-3 w-3 inline mr-1" />Company
            </Chip>
          </div>

          {/* Source chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs text-muted-foreground self-center shrink-0">Source:</span>
            {LEAD_SOURCE_OPTIONS.map(opt => (
              <Chip key={opt.value} active={leadSource === opt.value} onClick={() => setLeadSource(opt.value)}>
                {opt.label}
              </Chip>
            ))}
          </div>

          {/* Active filter chips */}
          {activeChips.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {activeChips.map(({ label, clear }) => (
                <button
                  key={label}
                  onClick={clear}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {label} <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Record count */}
        <div className="px-6 py-2.5 border-b border-border/50 bg-muted/10">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredOwners?.length ?? 0}</span> of{" "}
            <span className="font-semibold text-foreground">{owners?.length ?? 0}</span> owners
          </p>
        </div>

        <CardContent className="p-0">
          <DataTable
            id="owners"
            columns={OWNER_COLUMNS}
            data={filteredOwners}
            isLoading={isLoading}
            rowKey={o => o.id}
            exportFileName="Property Owners"
            emptyState={
              <div>
                <User className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium text-foreground">No owners match your filters</p>
                <p className="text-sm mt-1">Try adjusting your search or clearing some filters.</p>
                {(activeFilterCount > 0 || search) && (
                  <Button variant="link" className="mt-2 text-primary" onClick={clearAll}>Clear all filters</Button>
                )}
              </div>
            }
            actions={owner => (
              <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/owners/${owner.id}`}>
                  <button
                    className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="View Profile"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </Link>
                {canCreateProperty && (
                  <Link href={`/properties/new?ownerId=${owner.id}`}>
                    <button
                      className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                      title="Add Property"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </Link>
                )}
              </div>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
}
