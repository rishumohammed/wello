// backend/api/sessions/[id].delete.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const sessionId = Number(idParam)

  if (!sessionId || isNaN(sessionId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid session ID parameter.')
  }

  const db = getDb()
  const existing = await db('work_sessions')
    .where({ id: sessionId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'SESSION_NOT_FOUND', 'Work session not found or already deleted.')
  }

  const now = new Date()
  await db('work_sessions')
    .where({ id: sessionId, user_id: user.id })
    .update({
      deleted_at: now,
      updated_at: now,
    })

  return sendSuccess(event, {
    id: sessionId,
    deleted: true,
    message: 'Work session soft-deleted successfully.',
    deletedAt: now.toISOString(),
  })
})
