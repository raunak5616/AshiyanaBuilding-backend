/**
 * auth.constants.js
 *
 * Seed data used exactly once, during the v1 bootstrap transaction:
 *  - DEFAULT_PERMISSIONS: the full system-wide permission catalog.
 *    Covers modules not yet implemented (products, inventory, sales, etc.)
 *    intentionally — RBAC readiness is established now so those modules
 *    can plug straight into an existing permission set later without a
 *    migration.
 *  - DEFAULT_ROLES: the 5 system-default roles and which permission keys
 *    each one is granted.
 *
 * NAMING CONVENTION (permanent contract — see RBAC Design Document §6):
 *   <module>:read                — view-only access
 *   <module>:create               — create new records
 *   <module>:update                — edit existing records
 *   <module>:delete                — remove records
 *   <module>:<specialized-action>  — reserved for actions that carry a
 *                                     distinct trust level from ordinary
 *                                     CRUD (e.g. sales:refund, purchases:approve)
 *
 * 'manage' is retired as a pattern (see RBAC Design Document v2, item 1) —
 * every module now uses explicit create/update/delete instead of a single
 * bundled key, so an Owner can grant/withhold delete independently of
 * create/update.
 *
 * If a future module introduces a permission key not listed here, add it
 * to DEFAULT_PERMISSIONS following the convention above, and grant it to
 * the relevant DEFAULT_ROLES entries — this file is the single source of
 * truth for the RBAC catalog.
 */

export const DEFAULT_PERMISSIONS = [
  // ---- Users & Roles ----
  { key: 'users:read', module: 'users', description: 'View staff accounts' },
  { key: 'users:create', module: 'users', description: 'Create staff accounts' },
  { key: 'users:update', module: 'users', description: 'Edit staff account profile fields, deactivate/reactivate' },
  // Reserved for a future Archive/Delete feature — no route in v1 checks
  // this key (User Management v1 only supports deactivate/reactivate, never
  // a hard delete). Intentionally unused today, not dead code to remove.
  { key: 'users:delete', module: 'users', description: 'Remove staff accounts' },
  { key: 'users:assign_role', module: 'users', description: 'Change a staff account\'s assigned role' },
  { key: 'users:reset_password', module: 'users', description: 'Reset a staff account\'s password' },
  { key: 'roles:create', module: 'users', description: 'Create custom roles' },
  { key: 'roles:update', module: 'users', description: 'Edit role permissions' },
  { key: 'roles:delete', module: 'users', description: 'Delete custom (non-default) roles' },

  // ---- Products & Categories ----
  { key: 'products:read', module: 'products', description: 'View product catalog' },
  { key: 'products:create', module: 'products', description: 'Create products & categories' },
  { key: 'products:update', module: 'products', description: 'Edit products & categories' },
  { key: 'products:delete', module: 'products', description: 'Delete products & categories' },

  // ---- Inventory ----
  // Intentionally NOT split into create/update/delete — stock levels change
  // only through domain-specific actions (sales, purchases, manual
  // adjustment), never via generic CRUD. This is a deliberate design
  // decision preserved from the original catalog, not an oversight.
  { key: 'inventory:read', module: 'inventory', description: 'View stock levels' },
  { key: 'inventory:adjust', module: 'inventory', description: 'Perform manual stock adjustments' },

  // ---- Suppliers & Purchases ----
  { key: 'suppliers:read', module: 'suppliers', description: 'View supplier records' },
  { key: 'suppliers:create', module: 'suppliers', description: 'Create supplier records' },
  { key: 'suppliers:update', module: 'suppliers', description: 'Edit supplier records' },
  { key: 'suppliers:delete', module: 'suppliers', description: 'Delete supplier records' },
  { key: 'purchases:read', module: 'purchases', description: 'View purchase orders' },
  { key: 'purchases:create', module: 'purchases', description: 'Create purchase orders' },
  { key: 'purchases:approve', module: 'purchases', description: 'Approve purchase orders' },

  // ---- Customers ----
  { key: 'customers:read', module: 'customers', description: 'View customer records' },
  { key: 'customers:create', module: 'customers', description: 'Create customer records' },
  { key: 'customers:update', module: 'customers', description: 'Edit customer records' },
  { key: 'customers:delete', module: 'customers', description: 'Delete customer records' },

  // ---- Sales / POS ----
  { key: 'sales:create', module: 'sales', description: 'Create sales/invoices at POS' },
  { key: 'sales:read', module: 'sales', description: 'View sales history' },
  { key: 'sales:refund', module: 'sales', description: 'Process refunds/returns' },

  // ---- Payments ----
  { key: 'payments:create', module: 'payments', description: 'Record new payments' },
  { key: 'payments:update', module: 'payments', description: 'Edit payment records' },
  { key: 'payments:delete', module: 'payments', description: 'Delete payment records' },

  // ---- Expenses ----
  { key: 'expenses:read', module: 'expenses', description: 'View shop expenses' },
  { key: 'expenses:create', module: 'expenses', description: 'Record shop expenses' },
  { key: 'expenses:update', module: 'expenses', description: 'Edit expense records' },
  { key: 'expenses:delete', module: 'expenses', description: 'Delete expense records' },

  // ---- Reports ----
  { key: 'reports:view', module: 'reports', description: 'View business reports' },

  // ---- Dashboard ----
  { key: 'dashboard:read', module: 'dashboard', description: 'View business dashboard metrics' },

  // ---- Settings ----
  // Note: SystemSettings is a singleton per shop (created once at bootstrap).
  // settings:create/delete are retained for naming-convention consistency
  // (see file header) even though only settings:update is expected to see
  // practical use in v1 — no endpoint creates or deletes a settings document.
  { key: 'settings:read', module: 'settings', description: 'View shop-wide settings' },
  { key: 'settings:create', module: 'settings', description: 'Create shop settings (bootstrap-only in v1)' },
  { key: 'settings:update', module: 'settings', description: 'Modify shop-wide settings' },
  { key: 'settings:delete', module: 'settings', description: 'Delete shop settings (no v1 use case)' },
];

/**
 * Maps each default role's slug to the permission keys it is granted.
 * 'owner' is intentionally granted every key in DEFAULT_PERMISSIONS
 * programmatically (see auth.service.js) rather than listed by hand here,
 * so the owner role can never accidentally drift out of sync as new
 * permissions are added.
 *
 * Migration note: every role below that previously held an `X:manage` key
 * is granted the equivalent full set of `X:create` + `X:update` + `X:delete`
 * — this preserves each role's exact prior effective permissions. Whether
 * any role's scope (e.g. Cashier holding customers:delete/payments:delete)
 * should be narrowed is a policy question for the shop Owner via the future
 * User Management module, not something this rename decided.
 */
export const DEFAULT_ROLES = [
  {
    name: 'Owner',
    slug: 'owner',
    description: 'Full system access. Exactly one Owner account exists.',
    permissionKeys: null, // resolved to ALL permission keys at seed time
  },
  {
    name: 'Manager',
    slug: 'manager',
    description: 'Day-to-day shop operations, excluding user/role management.',
    permissionKeys: [
      'products:read',
      'products:create',
      'products:update',
      'products:delete',
      'inventory:read',
      'inventory:adjust',
      'suppliers:read',
      'suppliers:create',
      'suppliers:update',
      'suppliers:delete',
      'purchases:read',
      'purchases:create',
      'purchases:approve',
      'customers:read',
      'customers:create',
      'customers:update',
      'customers:delete',
      'sales:create',
      'sales:read',
      'sales:refund',
      'payments:create',
      'payments:update',
      'payments:delete',
      'expenses:read',
      'expenses:create',
      'expenses:update',
      'expenses:delete',
      'reports:view',
      'dashboard:read',
      'settings:read',
      'settings:update',
    ],
  },
  {
    name: 'Cashier',
    slug: 'cashier',
    description: 'Point-of-sale operations and customer lookup.',
    permissionKeys: [
      'products:read',
      'inventory:read',
      'customers:read',
      'customers:create',
      'customers:update',
      'customers:delete',
      'sales:create',
      'sales:read',
      'payments:create',
      'payments:update',
      'payments:delete',
    ],
  },
  {
    name: 'Inventory Staff',
    slug: 'inventory_staff',
    description: 'Manages stock levels and purchase intake.',
    permissionKeys: [
      'products:read',
      'products:create',
      'products:update',
      'products:delete',
      'inventory:read',
      'inventory:adjust',
      'suppliers:read',
      'suppliers:create',
      'suppliers:update',
      'suppliers:delete',
      'purchases:read',
      'purchases:create',
    ],
  },
  {
    name: 'Delivery Staff',
    slug: 'delivery_staff',
    description: 'Views assigned sales/orders for fulfillment purposes.',
    permissionKeys: ['sales:read', 'customers:read'],
  },
];
