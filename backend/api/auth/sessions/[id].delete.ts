// backend/api/auth/sessions/[id].delete.ts
import { defineEventHandler, createError } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess } from '../../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const sessionId = event.context.params?.id
  const idNum = Number(sessionId)

  if (!sessionId || isNaN(idNum) || idNum <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid session ID.',
    })
  }

  const db = getDb()
  const now = new Date()

  const session = await db('auth_sessions')
    .where({ id: idNum, user_id: user.id })
    .first()

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Session not found.',
    })
  }

  // Revoke session
  await db('auth_sessions')
    .where({ id: idNum })
    .update({ revoked_at: now })

  if (session.token_hash) {
    await db('impersonation_sessions')
      .where({ token_hash: session.token_hash })
      .whereNull('ended_at')
      .update({ ended_at: now })
  }

  return sendSuccess(event, {
    success: true,
    message: 'Session revoked successfully.',
    revokedSessionId: idNum,
  })
})
