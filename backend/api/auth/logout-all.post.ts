// server/api/auth/logout-all.post.ts
import { defineEventHandler, deleteCookie } from 'h3'
import { requireUser, SESSION_COOKIE_NAME } from '../../utils/authGuard'
import { revokeAllSessionsForUser } from '../../utils/authService'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const revokedCount = await revokeAllSessionsForUser(user.id)

  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: '/',
  })

  return {
    success: true,
    message: `Signed out of all devices (${revokedCount} session(s) revoked).`,
    revokedSessions: revokedCount,
  }
})
