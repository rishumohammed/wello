// server/api/admin/users/impersonate.post.ts
import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3'
import { requirePermission, extractClientIp } from '../../../utils/authGuard'
import { getDb } from '../../../utils/db'
import { createImpersonationSession } from '../../../utils/authService'
import { recordAuditLog } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  // 1. Enforce users.impersonate permission (SUPER_ADMIN & SUPPORT only)
  const admin = await requirePermission(event, 'users.impersonate')
  const body = await readBody(event)

  const targetUserId = body?.userId ? Number(body.userId) : null
  const targetEmail = (body?.email || '').trim().toLowerCase()
  const reason = (body?.reason || '').trim()

  if (!targetUserId && !targetEmail) {
    throw createError({ statusCode: 400, statusMessage: 'Target user ID or email is required.' })
  }

  if (!reason || reason.length < 5) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid customer support / diagnostic reason (minimum 5 characters) is mandatory to start an impersonation session.',
    })
  }

  const db = getDb()
  let query = db('users').whereNull('deleted_at')
  if (targetUserId) {
    query = query.where('id', targetUserId)
  } else {
    query = query.where('email', targetEmail)
  }

  const targetUser = await query.first()
  if (!targetUser) {
    throw createError({ statusCode: 404, statusMessage: 'Target user account not found.' })
  }

  if (targetUser.role === 'admin' || targetUser.email === 'admin@wello.com') {
    throw createError({ statusCode: 400, statusMessage: 'Security Policy Violation: Cannot impersonate administrative accounts.' })
  }

  // 2. Create time-boxed, read-only session (15 minutes max)
  const { token, expiresAt } = await createImpersonationSession(
    targetUser.id,
    admin.email,
    reason,
    15
  )

  // 3. Record tamper-evident audit log
  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: 'USER_IMPERSONATION_STARTED',
    module: 'Users',
    permissionUsed: 'users.impersonate',
    target: `${targetUser.email} (ID: ${targetUser.id})`,
    reason,
    ipAddress: extractClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent') || 'Admin UI',
    newValue: `Started 15-minute read-only support impersonation session. Reason: "${reason}"`,
  })

  return {
    success: true,
    message: `Started read-only support session for ${targetUser.email}. Expires in 15 minutes.`,
    impersonationToken: token,
    expiresAt: expiresAt.toISOString(),
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      avatarInitials: targetUser.avatar_initials,
      role: targetUser.role,
    },
  }
})
