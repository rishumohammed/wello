// server/api/admin/users/status.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { getAllUsers } from '../../../utils/authConfig'
import { recordAuditLog } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = body?.userId
  const email = (body?.email || '').trim().toLowerCase()
  const newStatus = body?.status
  const adminEmail = body?.adminEmail || 'admin@wello.com'

  const validStatuses = ['REGISTERED', 'EMAIL_PENDING', 'VERIFICATION_PENDING', 'VERIFIED', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED']

  if (!validStatuses.includes(newStatus)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    })
  }

  const users = getAllUsers()
  const user = users.find(u => u.id === userId || u.email.toLowerCase() === email)

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User account not found.',
    })
  }

  const prevStatus = user.status || 'ACTIVE'
  user.status = newStatus

  // Record Immutable Audit Log
  recordAuditLog({
    adminEmail,
    action: `USER_STATUS_${newStatus}`,
    module: 'Users',
    target: `${user.name} (${user.email})`,
    prevValue: prevStatus,
    newValue: newStatus,
  })

  return {
    success: true,
    message: `Updated status for ${user.name} to ${newStatus}.`,
    user,
  }
})
