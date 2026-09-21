// backend/api/sessions/[id].get.ts
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
  const session = await db('work_sessions')
    .where({ id: sessionId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!session) {
    return sendError(event, 404, 'SESSION_NOT_FOUND', 'Work session not found.')
  }

  const project = await db('projects').where({ id: session.project_id }).first()

  return sendSuccess(event, {
    id: session.id,
    projectId: session.project_id,
    project: project ? { id: project.id, name: project.name, currency: project.currency } : null,
    title: session.title,
    type: session.type,
    paymentType: session.payment_type,
    unpaidReason: session.unpaid_reason,
    notes: session.notes,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    durationSeconds: session.duration_seconds,
    durationMinutes: Math.round((session.duration_seconds || 0) / 60),
    pausedSeconds: session.paused_seconds,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
  })
})
