// server/api/admin/users/[id].get.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'users.view')
  const rawId = getRouterParam(event, 'id')
  const userId = Number(rawId)

  if (!userId || isNaN(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid user ID required.' })
  }

  const db = getDb()
  const user = await db('users')
    .leftJoin('admin_users', 'users.id', 'admin_users.user_id')
    .where('users.id', userId)
    .whereNull('users.deleted_at')
    .select(
      'users.id',
      'users.name',
      'users.email',
      'users.avatar_initials as avatarInitials',
      'users.base_currency as currencyCode',
      'users.timezone',
      'users.country as countryCode',
      'users.role',
      'users.status',
      'admin_users.role_key as adminRole',
      'users.created_at as createdAt',
      'users.updated_at as lastLoginAt'
    )
    .first()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  }

  // Non-financial activity aggregates
  const [clientsCount] = await db('clients').where({ user_id: userId }).whereNull('deleted_at').count('id as count')
  const [projectsCount] = await db('projects').where({ user_id: userId }).whereNull('deleted_at').count('id as count')
  const [sessionsCount] = await db('work_sessions').where({ user_id: userId }).whereNull('deleted_at').count('id as count')

  return {
    success: true,
    user: {
      ...user,
      activitySummary: {
        clientsCount: Number(clientsCount?.count || 0),
        projectsCount: Number(projectsCount?.count || 0),
        sessionsCount: Number(sessionsCount?.count || 0),
      },
    },
  }
})
