// backend/database/migrations/20260922000019_reconcile_admin_permissions.cjs
/**
 * Migration 19: Reconcile RBAC Permissions and Role Mappings
 * - Replaces legacy jobs.manage with jobs.moderate
 * - Adds feedback.view, feedback.manage, system.view, analytics.manage, store.manage
 * - Seeds complete role-permission mappings for SUPER_ADMIN, ADMIN, SUPPORT, ANALYST, MODERATOR
 */

exports.up = async function (knex) {
  const permissions = [
    { permission_key: 'users.view', module: 'Users', name: 'View Users', description: 'View user directory and profiles' },
    { permission_key: 'users.manage', module: 'Users', name: 'Manage Users', description: 'Edit user details and roles' },
    { permission_key: 'users.suspend', module: 'Users', name: 'Suspend Users', description: 'Suspend, block, or reactivate accounts' },
    { permission_key: 'users.financial_view', module: 'Users', name: 'View User Financials', description: 'View individual user quotes, invoices, payments, and rates. Requires justification.' },
    { permission_key: 'users.impersonate', module: 'Users', name: 'Impersonate User', description: 'Time-boxed read-only support impersonation with mandatory reason logging.' },
    { permission_key: 'categories.view', module: 'Categories', name: 'View Categories', description: 'View job and service categories' },
    { permission_key: 'categories.manage', module: 'Categories', name: 'Manage Categories', description: 'Create, edit, reorder, and disable categories' },
    { permission_key: 'category_requests.manage', module: 'Categories', name: 'Manage Category Requests', description: 'Approve, reject, or merge category requests' },
    { permission_key: 'jobs.view', module: 'Jobs', name: 'View Jobs', description: 'View jobs and service listings' },
    { permission_key: 'jobs.moderate', module: 'Jobs', name: 'Moderate Jobs', description: 'Flag, review, approve, and moderate job listings' },
    { permission_key: 'analytics.view', module: 'Analytics', name: 'View Analytics', description: 'Access Analytics Center and reports' },
    { permission_key: 'analytics.export', module: 'Analytics', name: 'Export Analytics', description: 'Export platform aggregated analytics datasets' },
    { permission_key: 'analytics.manage', module: 'Analytics', name: 'Manage Analytics', description: 'Trigger manual rollups, backfills, and cache management' },
    { permission_key: 'email.manage', module: 'Communications', name: 'Manage Email', description: 'Configure Resend API, templates, and view logs' },
    { permission_key: 'audit_logs.view', module: 'Audit', name: 'View Audit Logs', description: 'View system audit logs and event trails' },
    { permission_key: 'admins.manage', module: 'Security', name: 'Manage Admins', description: 'Manage admin users and assign RBAC roles' },
    { permission_key: 'settings.manage', module: 'Settings', name: 'Manage System Settings', description: 'Configure global system parameters and retention policies' },
    { permission_key: 'store.manage', module: 'Store', name: 'Manage Addon Store', description: 'Manage addon store catalog, quotas, and incident kill-switches' },
    { permission_key: 'feedback.view', module: 'Feedback', name: 'View User Feedback', description: 'View and inspect user feedback and bug reports' },
    { permission_key: 'feedback.manage', module: 'Feedback', name: 'Manage User Feedback', description: 'Triage, tag, and resolve user feedback items' },
    { permission_key: 'system.view', module: 'System', name: 'View System Diagnostics', description: 'Inspect low-level system health and diagnostic metrics' },
  ]

  // Insert or update all permissions
  for (const p of permissions) {
    const existing = await knex('admin_permissions').where({ permission_key: p.permission_key }).first()
    if (existing) {
      await knex('admin_permissions').where({ permission_key: p.permission_key }).update(p)
    } else {
      await knex('admin_permissions').insert(p)
    }
  }

  // Remove deprecated 'jobs.manage' if present
  await knex('admin_role_permissions').where({ permission_key: 'jobs.manage' }).del()
  await knex('admin_permissions').where({ permission_key: 'jobs.manage' }).del()

  // Clean and re-seed admin_role_permissions
  await knex('admin_role_permissions').del()

  const roleMappings = {
    SUPER_ADMIN: permissions.map(p => p.permission_key),
    ADMIN: [
      'users.view', 'users.manage', 'users.suspend',
      'categories.view', 'categories.manage', 'category_requests.manage',
      'jobs.view', 'jobs.moderate',
      'analytics.view', 'analytics.export', 'analytics.manage',
      'email.manage', 'audit_logs.view', 'settings.manage', 'store.manage',
      'feedback.view', 'feedback.manage', 'system.view',
    ],
    SUPPORT: [
      'users.view', 'users.impersonate',
      'categories.view', 'category_requests.manage',
      'jobs.view', 'email.manage',
      'feedback.view', 'feedback.manage',
    ],
    ANALYST: [
      'users.view', 'categories.view', 'jobs.view',
      'analytics.view', 'analytics.export', 'audit_logs.view', 'system.view',
    ],
    MODERATOR: [
      'users.view', 'categories.view', 'categories.manage', 'category_requests.manage',
      'jobs.view', 'jobs.moderate', 'audit_logs.view', 'feedback.view',
    ],
  }

  const inserts = []
  for (const [roleKey, perms] of Object.entries(roleMappings)) {
    for (const permKey of perms) {
      inserts.push({ role_key: roleKey, permission_key: permKey })
    }
  }

  await knex('admin_role_permissions').insert(inserts)
}

exports.down = async function (knex) {
  // down migration
}
