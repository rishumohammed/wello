// server/middleware/auth.ts
/**
 * Global Nitro Middleware:
 * Automatically resolves session tokens from cookies/headers and populates event.context.user.
 */

import { defineEventHandler } from 'h3'
import { extractSessionToken } from '../utils/authGuard'
import { getAuthenticatedUserByToken } from '../utils/authService'

export default defineEventHandler(async (event) => {
  const token = extractSessionToken(event)
  if (token) {
    try {
      const user = await getAuthenticatedUserByToken(token)
      if (user) {
        event.context.user = user
        event.context.sessionToken = token
      }
    } catch (err) {
      // Allow route handlers to decide if authentication is required or not
    }
  }
})
