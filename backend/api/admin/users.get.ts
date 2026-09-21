// server/api/admin/users.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.view')
  const db = getDb()

  const users = await db('users')
    .leftJoin('admin_users', 'users.id', 'admin_users.user_id')
    .whereNull('users.deleted_at')
    .select(
      'users.id',
      'users.name',
      'users.email',
      'users.avatar_initials as avatarInitials',
      'users.target_hourly as targetHourly',
      'users.base_currency as currencyCode',
      'users.timezone',
      'users.country as countryCode',
      'users.role',
      'users.status',
      'admin_users.role_key as adminRole',
      'users.created_at as createdAt',
      'users.updated_at as lastLoginAt'
    )
    .orderBy('users.created_at', 'desc')

  return {
    success: true,
    users,
  }
})
