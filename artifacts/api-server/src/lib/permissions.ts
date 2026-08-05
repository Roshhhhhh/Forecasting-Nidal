/** All permission keys in the system. */
export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW:          "dashboard.view",
  // Owners
  OWNERS_VIEW:             "owners.view",
  OWNERS_CREATE:           "owners.create",
  OWNERS_EDIT:             "owners.edit",
  OWNERS_DELETE:           "owners.delete",
  // Properties
  PROPERTIES_VIEW:         "properties.view",
  PROPERTIES_CREATE:       "properties.create",
  PROPERTIES_EDIT:         "properties.edit",
  PROPERTIES_DELETE:       "properties.delete",
  // Forecasts
  FORECASTS_VIEW:          "forecasts.view",
  FORECASTS_CREATE:        "forecasts.create",
  FORECASTS_EDIT:          "forecasts.edit",
  // Proposals
  PROPOSALS_VIEW:          "proposals.view",
  PROPOSALS_PUBLISH:       "proposals.publish",
  // Referees
  REFEREES_VIEW:           "referees.view",
  REFEREES_CREATE:         "referees.create",
  REFEREES_EDIT:           "referees.edit",
  REFEREES_DELETE:         "referees.delete",
  // Market data
  MARKET_VIEW:             "market.view",
  // Users
  USERS_VIEW:              "users.view",
  USERS_CREATE:            "users.create",
  USERS_EDIT:              "users.edit",
  // Commissions
  COMMISSIONS_VIEW:        "commissions.view",
  COMMISSIONS_EDIT:        "commissions.edit",
  // Roles (only super-admins)
  ROLES_MANAGE:            "roles.manage",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as string[];

/** Default permission sets for the 5 built-in roles. */
export const BUILT_IN_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter(p => p !== PERMISSIONS.ROLES_MANAGE),
  revenue_manager: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.OWNERS_VIEW,
    PERMISSIONS.PROPERTIES_VIEW,
    PERMISSIONS.FORECASTS_VIEW, PERMISSIONS.FORECASTS_CREATE, PERMISSIONS.FORECASTS_EDIT,
    PERMISSIONS.PROPOSALS_VIEW, PERMISSIONS.PROPOSALS_PUBLISH,
    PERMISSIONS.REFEREES_VIEW,
    PERMISSIONS.MARKET_VIEW,
    PERMISSIONS.COMMISSIONS_VIEW, PERMISSIONS.COMMISSIONS_EDIT,
  ],
  sales: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.OWNERS_VIEW, PERMISSIONS.OWNERS_CREATE, PERMISSIONS.OWNERS_EDIT,
    PERMISSIONS.PROPERTIES_VIEW, PERMISSIONS.PROPERTIES_CREATE, PERMISSIONS.PROPERTIES_EDIT,
    PERMISSIONS.FORECASTS_VIEW, PERMISSIONS.FORECASTS_CREATE,
    PERMISSIONS.PROPOSALS_VIEW,
    PERMISSIONS.REFEREES_VIEW,
  ],
  read_only: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.OWNERS_VIEW,
    PERMISSIONS.PROPERTIES_VIEW,
    PERMISSIONS.FORECASTS_VIEW,
    PERMISSIONS.PROPOSALS_VIEW,
    PERMISSIONS.REFEREES_VIEW,
    PERMISSIONS.MARKET_VIEW,
  ],
};

/** Permissions grouped for the UI matrix. */
export const PERMISSION_GROUPS = [
  {
    group: "Dashboard",
    permissions: [
      { key: PERMISSIONS.DASHBOARD_VIEW, label: "View Dashboard" },
    ],
  },
  {
    group: "Owners",
    permissions: [
      { key: PERMISSIONS.OWNERS_VIEW,   label: "View" },
      { key: PERMISSIONS.OWNERS_CREATE, label: "Create" },
      { key: PERMISSIONS.OWNERS_EDIT,   label: "Edit" },
      { key: PERMISSIONS.OWNERS_DELETE, label: "Delete" },
    ],
  },
  {
    group: "Properties",
    permissions: [
      { key: PERMISSIONS.PROPERTIES_VIEW,   label: "View" },
      { key: PERMISSIONS.PROPERTIES_CREATE, label: "Create" },
      { key: PERMISSIONS.PROPERTIES_EDIT,   label: "Edit" },
      { key: PERMISSIONS.PROPERTIES_DELETE, label: "Delete" },
    ],
  },
  {
    group: "Forecasts",
    permissions: [
      { key: PERMISSIONS.FORECASTS_VIEW,   label: "View" },
      { key: PERMISSIONS.FORECASTS_CREATE, label: "Create" },
      { key: PERMISSIONS.FORECASTS_EDIT,   label: "Edit" },
    ],
  },
  {
    group: "Proposals",
    permissions: [
      { key: PERMISSIONS.PROPOSALS_VIEW,    label: "View" },
      { key: PERMISSIONS.PROPOSALS_PUBLISH, label: "Publish / Share" },
    ],
  },
  {
    group: "Referees & Commissions",
    permissions: [
      { key: PERMISSIONS.REFEREES_VIEW,    label: "View Referees" },
      { key: PERMISSIONS.REFEREES_CREATE,  label: "Add Referees" },
      { key: PERMISSIONS.REFEREES_EDIT,    label: "Edit Referees" },
      { key: PERMISSIONS.REFEREES_DELETE,  label: "Delete Referees" },
      { key: PERMISSIONS.COMMISSIONS_VIEW, label: "View Commissions" },
      { key: PERMISSIONS.COMMISSIONS_EDIT, label: "Edit Commissions" },
    ],
  },
  {
    group: "Market Data",
    permissions: [
      { key: PERMISSIONS.MARKET_VIEW, label: "View Market Data" },
    ],
  },
  {
    group: "User Management",
    permissions: [
      { key: PERMISSIONS.USERS_VIEW,   label: "View Users" },
      { key: PERMISSIONS.USERS_CREATE, label: "Invite Users" },
      { key: PERMISSIONS.USERS_EDIT,   label: "Edit Users" },
    ],
  },
  {
    group: "Role Management",
    permissions: [
      { key: PERMISSIONS.ROLES_MANAGE, label: "Manage Roles & Permissions" },
    ],
  },
];
