// server/api/admin/users/status.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/db'
import { revokeAllSessionsForUser } from '../../../utils/authService'
import { recordAuditLog } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'users.manage')
  const body = await readBody(event)
  const userId = body?.userId
  const email = (body?.email || '').trim().toLowerCase()
  const newStatus = body?.status

  const validStatuses = ['REGISTERED', 'EMAIL_PENDING', 'VERIFICATION_PENDING', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED']

  if (!validStatuses.includes(newStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    })
  }

  const db = getDb()
  let userQuery = db('users').whereNull('deleted_at')
  if (userId) {
    userQuery = userQuery.where('id', Number(userId))
  } else if (email) {
    userQuery = userQuery.where('email', email)
  } else {
    throw createError({ statusCode: 400, statusMessage: 'User ID or email is required.' })
  }

  const targetUser = await userQuery.first()
  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'User account not found.' })
  }

  // 1. Protection: Admin cannot suspend/block or deactivate their own account
  if (Number(targetUser.id) === Number(admin.id)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Security Policy Violation: You cannot alter the status of your own account.',
    })
  }

  // 2. Protection: Prevent disabling/suspending the last active SUPER_ADMIN
  if (['SUSPENDED', 'BLOCKED', 'INACTIVE'].includes(newStatus)) {
    const adminRecord = await db('admin_users').where({ user_id: targetUser.id, is_active: true }).first()
    if (adminRecord && adminRecord.role_key === 'SUPER_ADMIN') {
      const [{ count }] = await db('admin_users')
        .where({ role_key: 'SUPER_ADMIN', is_active: true })
        .whereNot('user_id', targetUser.id)
        .count('id as count')

      if (Number(count) === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Security Policy Violation: Cannot suspend or deactivate the last active SUPER_ADMIN.',
        })
      }
    }
  }

  const prevStatus = targetUser.status || 'ACTIVE'

  // Update in database
  await db('users')
    .where({ id: targetUser.id })
    .update({
      status: newStatus,
      updated_at: db.fn.now(3),
    })

  // If suspended or blocked, immediately invalidate all user sessions
  if (['SUSPENDED', 'BLOCKED', 'INACTIVE'].includes(newStatus)) {
    await revokeAllSessionsForUser(targetUser.id)
  }

  // Record Immutable Audit Log
  recordAuditLog({
    adminEmail: admin.email,
    action: `USER_STATUS_${newStatus}`,
    module: 'Users',
    target: `${targetUser.name} (${targetUser.email})`,
    prevValue: prevStatus,
    newValue: newStatus,
  })

  return {
    success: true,
    message: `Updated status for ${targetUser.name} to ${newStatus}.`,
    user: {
      ...targetUser,
      status: newStatus,
    },
  }
})
