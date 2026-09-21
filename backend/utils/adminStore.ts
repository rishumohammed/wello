// server/utils/adminStore.ts
// Server-side Role-Based Access Control (RBAC) & Admin User Store

export type AdminRoleKey = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'SUPPORT' | 'ANALYST'

export interface AdminRole {
  roleKey: AdminRoleKey
  name: string
  description: string
  permissions: string[]
}

export interface AdminPermission {
  key: string
  module: string
  name: string
  description: string
}

export interface AdminUserRecord {
  id: string
  name: string
  email: string
  roleKey: AdminRoleKey
  isActive: boolean
  createdAt: string
  lastLoginAt: string
}

export const ALL_PERMISSIONS: AdminPermission[] = [
  { key: 'users.view', module: 'Users', name: 'View Users', description: 'View user directory and profiles' },
  { key: 'users.manage', module: 'Users', name: 'Manage Users', description: 'Edit user details and roles' },
  { key: 'users.suspend', module: 'Users', name: 'Suspend Users', description: 'Suspend, block, or reactivate accounts' },
  { key: 'users.financial_view', module: 'Users', name: 'View User Financials', description: 'View individual user quotes, invoices, payments, and rates. Requires a business justification reason.' },
  { key: 'users.impersonate', module: 'Users', name: 'Impersonate User', description: 'Time-boxed read-only support impersonation with mandatory reason logging.' },
  { key: 'categories.view', module: 'Categories', name: 'View Categories', description: 'View job and service categories' },
  { key: 'categories.manage', module: 'Categories', name: 'Manage Categories', description: 'Create, edit, reorder, and disable categories' },
  { key: 'category_requests.manage', module: 'Categories', name: 'Manage Category Requests', description: 'Approve, reject, or merge category requests' },
  { key: 'jobs.view', module: 'Jobs', name: 'View Jobs', description: 'View job listings and insights' },
  { key: 'jobs.manage', module: 'Jobs', name: 'Manage Jobs', description: 'Moderate or update job listings and resolve flags' },
  { key: 'analytics.view', module: 'Analytics', name: 'View Analytics', description: 'Access Analytics Center and aggregate reports' },
  { key: 'analytics.export', module: 'Analytics', name: 'Export Analytics', description: 'Export platform aggregated analytics datasets' },
  { key: 'store.manage', module: 'Store', name: 'Manage Store Addons', description: 'Configure addons, persona defaults, and limits' },
  { key: 'email.manage', module: 'Communications', name: 'Manage Email', description: 'Configure Resend API, templates, and view delivery logs' },
  { key: 'audit_logs.view', module: 'Audit', name: 'View Audit Logs', description: 'View immutable audit logs and verify cryptographic chain' },
  { key: 'admins.manage', module: 'Security', name: 'Manage Admins', description: 'Manage admin users and assign RBAC roles' },
  { key: 'settings.manage', module: 'Settings', name: 'Manage System Settings', description: 'Configure global system parameters and IP allowlist' },
]

export const ROLE_DEFINITIONS: Record<AdminRoleKey, AdminRole> = {
  SUPER_ADMIN: {
    roleKey: 'SUPER_ADMIN',
    name: 'Super Administrator',
    description: 'Full unmitigated access to all administrative modules, security controls, admin management, and personal financial data.',
    permissions: ALL_PERMISSIONS.map(p => p.key),
  },
  ADMIN: {
    roleKey: 'ADMIN',
    name: 'Platform Administrator',
    description: 'Full access to user management, categories, jobs insights, analytics, store management, and email dispatches.',
    permissions: ALL_PERMISSIONS.filter(p => p.key !== 'admins.manage' && p.key !== 'users.financial_view').map(p => p.key),
  },
  MODERATOR: {
    roleKey: 'MODERATOR',
    name: 'Content & Job Moderator',
    description: 'Access to view users, moderate jobs, manage categories, and handle category requests.',
    permissions: ['users.view', 'categories.view', 'categories.manage', 'category_requests.manage', 'jobs.view', 'jobs.manage', 'audit_logs.view'],
  },
  SUPPORT: {
    roleKey: 'SUPPORT',
    name: 'Support Specialist',
    description: 'Access to view users, view jobs, handle category requests, inspect email logs, and start time-boxed read-only impersonation.',
    permissions: ['users.view', 'categories.view', 'category_requests.manage', 'jobs.view', 'email.manage', 'users.impersonate'],
  },
  ANALYST: {
    roleKey: 'ANALYST',
    name: 'Data & Growth Analyst',
    description: 'Read-only access to Analytics Center, aggregate funnels, cohorts, reports, and audit logs. Strictly cannot view individual user financial records.',
    permissions: ['users.view', 'categories.view', 'jobs.view', 'analytics.view', 'analytics.export', 'audit_logs.view'],
  },
}

// In-memory persistent admin accounts store
const adminUserStore = new Map<string, AdminUserRecord>()

// Seed initial super admin
adminUserStore.set('admin@wello.com', {
  id: 'adm_1',
  name: 'System Admin',
  email: 'admin@wello.com',
  roleKey: 'SUPER_ADMIN',
  isActive: true,
  createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  lastLoginAt: new Date().toISOString(),
})

export function getAdminUser(email: string): AdminUserRecord | null {
  const normalized = email.toLowerCase().trim()
  return adminUserStore.get(normalized) || null
}

export function getAllAdminUsers(): AdminUserRecord[] {
  return Array.from(adminUserStore.values())
}

export function getAdminPermissions(email: string): string[] {
  const admin = getAdminUser(email)
  if (!admin || !admin.isActive) return []
  const roleDef = ROLE_DEFINITIONS[admin.roleKey]
  return roleDef ? roleDef.permissions : []
}

export function checkAdminPermission(email: string, requiredPermission: string): boolean {
  if (!email) return false
  const permissions = getAdminPermissions(email)
  // SUPER_ADMIN or matching permission
  return permissions.includes(requiredPermission)
}

export function updateAdminRole(email: string, roleKey: AdminRoleKey): AdminUserRecord | null {
  const admin = getAdminUser(email)
  if (!admin) return null
  admin.roleKey = roleKey
  adminUserStore.set(admin.email, admin)
  return admin
}

export function createAdminUser(payload: { name: string; email: string; roleKey: AdminRoleKey }): AdminUserRecord {
  const normalized = payload.email.toLowerCase().trim()
  const record: AdminUserRecord = {
    id: 'adm_' + Math.random().toString(36).slice(2, 9),
    name: payload.name.trim(),
    email: normalized,
    roleKey: payload.roleKey || 'ADMIN',
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  }
  adminUserStore.set(normalized, record)
  return record
}
