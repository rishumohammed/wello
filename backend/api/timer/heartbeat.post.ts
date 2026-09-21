// backend/api/timer/heartbeat.post.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()
  const now = new Date()

  const activeSession = await db('work_sessions')
    .where({ user_id: user.id })
    .whereNull('ended_at')
    .whereNull('deleted_at')
    .orderBy('started_at', 'desc')
    .first()

  if (!activeSession) {
    return sendSuccess(event, {
      active: false,
      message: 'No active timer running.',
    })
  }

  await db('work_sessions').where({ id: activeSession.id }).update({
    last_activity_at: now,
    updated_at: now,
  })

  return sendSuccess(event, {
    active: true,
    timerId: activeSession.id,
    lastActivityAt: now.toISOString(),
  })
})
