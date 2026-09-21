// backend/api/timer/resume.post.ts
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
    return sendError(event, 404, 'NO_ACTIVE_TIMER', 'No active timer found to resume.')
  }

  // Find open pause
  const openPause = await db('work_session_pauses')
    .where({ work_session_id: activeSession.id })
    .whereNull('resumed_at')
    .orderBy('paused_at', 'desc')
    .first()

  if (!openPause) {
    return sendSuccess(event, {
      message: 'Timer is already running.',
      timerId: activeSession.id,
      isPaused: false,
    })
  }

  const pauseDurationSec = Math.max(0, Math.floor((now.getTime() - new Date(openPause.paused_at).getTime()) / 1000))

  await db('work_session_pauses').where({ id: openPause.id }).update({
    resumed_at: now,
    pause_duration_seconds: pauseDurationSec,
  })

  const newTotalPaused = Number(activeSession.paused_seconds || 0) + pauseDurationSec

  await db('work_sessions').where({ id: activeSession.id }).update({
    paused_seconds: newTotalPaused,
    updated_at: now,
  })

  const startedMs = new Date(activeSession.started_at).getTime()
  const elapsedSec = Math.max(0, Math.floor((now.getTime() - startedMs) / 1000) - newTotalPaused)

  return sendSuccess(event, {
    message: 'Timer resumed successfully.',
    timerId: activeSession.id,
    isPaused: false,
    elapsedSeconds: elapsedSec,
  })
})
