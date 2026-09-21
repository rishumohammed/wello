// server/api/auth/impersonate/exit.post.ts
import { defineEventHandler, getRequestHeader } from 'h3'
import { requireUser, extractSessionToken, extractClientIp } from '../../../utils/authGuard'
import { revokeSessionByToken } from '../../../utils/authService'
import { recordAuditLog } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const token = extractSessionToken(event)

  if (token) {
    await revokeSessionByToken(token)
  }

  if (user.isImpersonation) {
    await recordAuditLog({
      adminEmail: user.impersonatorEmail || 'support@wello.com',
      action: 'USER_IMPERSONATION_ENDED',
      module: 'Users',
      permissionUsed: 'users.impersonate',
      target: user.email,
      ipAddress: extractClientIp(event),
      userAgent: getRequestHeader(event, 'user-agent') || 'Wello Web App',
      newValue: `Ended support impersonation session for ${user.email}.`,
    })
  }

  return {
    success: true,
    message: 'Impersonation session terminated.',
  }
})
