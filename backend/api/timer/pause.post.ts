// backend/api/timer/pause.post.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()
  const now = new Date()

  // Find active running session
  const activeSession = await db('work_sessions')
    .where({ user_id: user.id })
    .whereNull('ended_at')
    .whereNull('deleted_at')
    .orderBy('started_at', 'desc')
    .first()

  if (!activeSession) {
    return sendError(event, 404, 'NO_ACTIVE_TIMER', 'No active timer found to pause.')
  }

  // Check if already paused
  const openPause = await db('work_session_pauses')
    .where({ work_session_id: activeSession.id })
    .whereNull('resumed_at')
    .first()

  if (openPause) {
    return sendSuccess(event, {
      message: 'Timer is already paused.',
      timerId: activeSession.id,
      pausedAt: openPause.paused_at,
      isPaused: true,
    })
  }

  // Record pause start
  await db('work_session_pauses').insert({
    work_session_id: activeSession.id,
    paused_at: now,
    created_at: now,
  })

  await db('work_sessions').where({ id: activeSession.id }).update({
    last_activity_at: now,
    updated_at: now,
  })

  // Calculate elapsed up to pause time
  const startedMs = new Date(activeSession.started_at).getTime()
  const pausedSec = Number(activeSession.paused_seconds || 0)
  const elapsedSec = Math.max(0, Math.floor((now.getTime() - startedMs) / 1000) - pausedSec)

  return sendSuccess(event, {
    message: 'Timer paused successfully.',
    timerId: activeSession.id,
    isPaused: true,
    pausedAt: now.toISOString(),
    elapsedSeconds: elapsedSec,
  })
})
