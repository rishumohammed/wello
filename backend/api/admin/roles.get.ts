// server/api/admin/roles.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'admins.manage')
  const db = getDb()

  const admins = await db('admin_users')
    .join('users', 'admin_users.user_id', 'users.id')
    .select(
      'admin_users.id',
      'users.id as userId',
      'users.name',
      'users.email',
      'admin_users.role_key as roleKey',
      'admin_users.is_active as isActive',
      'admin_users.created_at as createdAt',
      'users.updated_at as lastLoginAt'
    )
    .orderBy('admin_users.created_at', 'asc')

  const roles = await db('admin_roles').select('*')
  const permissions = await db('admin_permissions').select('*')

  return {
    success: true,
    admins,
    roles,
    permissions,
  }
})
