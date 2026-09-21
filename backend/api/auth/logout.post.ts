// server/api/auth/logout.post.ts
import { defineEventHandler, deleteCookie } from 'h3'
import { extractSessionToken, SESSION_COOKIE_NAME } from '../../utils/authGuard'
import { revokeSessionByToken } from '../../utils/authService'

export default defineEventHandler(async (event) => {
  const token = extractSessionToken(event)

  if (token) {
    await revokeSessionByToken(token)
  }

  // Clear cookie
  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: '/',
  })

  return {
    success: true,
    message: 'Signed out successfully.',
  }
})
