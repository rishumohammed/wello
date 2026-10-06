// backend/api/auth/sessions/index.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { getDb, hashSessionToken } from '../../../utils/authService'
import { sendMaskedSuccess } from '../../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const currentToken = event.context.sessionToken || ''
  const currentTokenHash = currentToken ? hashSessionToken(currentToken) : ''
  const db = getDb()
  const now = new Date()

  const sessions = await db('auth_sessions')
    .where({ user_id: user.id })
    .whereNull('revoked_at')
    .where('expires_at', '>', now)
    .orderBy('last_seen_at', 'desc')
    .select(
      'id',
      'token_hash',
      'user_agent',
      'ip_address',
      'device_info',
      'created_at',
      'last_seen_at',
      'expires_at',
      'is_impersonation'
    )

  const formattedSessions = sessions.map((s: any) => ({
    id: s.id,
    userAgent: s.user_agent,
    ipAddress: s.ip_address,
    deviceInfo: s.device_info,
    createdAt: s.created_at,
    lastSeenAt: s.last_seen_at,
    expiresAt: s.expires_at,
    isImpersonation: Boolean(s.is_impersonation),
    isCurrent: s.token_hash === currentTokenHash,
  }))

  return sendMaskedSuccess(event, user, {
    sessions: formattedSessions,
    total: formattedSessions.length,
  })
})
