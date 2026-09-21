// backend/api/timer/active.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()
  const now = new Date()

  // Find active running or paused work session
  const activeSession = await db('work_sessions')
    .where({ user_id: user.id })
    .whereNull('ended_at')
    .whereNull('deleted_at')
    .orderBy('started_at', 'desc')
    .first()

  if (!activeSession) {
    return sendSuccess(event, {
      active: false,
      timer: null,
    })
  }

  // Check if currently paused
  const activePause = await db('work_session_pauses')
    .where({ work_session_id: activeSession.id })
    .whereNull('resumed_at')
    .orderBy('paused_at', 'desc')
    .first()

  const isPaused = Boolean(activePause)
  const startedTime = new Date(activeSession.started_at).getTime()
  const pausedSec = Number(activeSession.paused_seconds || 0)

  let elapsedSeconds = 0
  if (isPaused && activePause) {
    const pauseTime = new Date(activePause.paused_at).getTime()
    elapsedSeconds = Math.max(0, Math.floor((pauseTime - startedTime) / 1000) - pausedSec)
  } else {
    elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedTime) / 1000) - pausedSec)
  }

  const maxTimerHours = Number(user.max_timer_hours || 8)
  const isStale = elapsedSeconds > maxTimerHours * 3600

  const project = await db('projects').where({ id: activeSession.project_id }).first()

  return sendSuccess(event, {
    active: true,
    timer: {
      id: activeSession.id,
      projectId: activeSession.project_id,
      project: project ? { id: project.id, name: project.name, currency: project.currency } : null,
      title: activeSession.title,
      type: activeSession.type,
      paymentType: activeSession.payment_type,
      unpaidReason: activeSession.unpaid_reason,
      notes: activeSession.notes,
      startedAt: activeSession.started_at,
      lastActivityAt: activeSession.last_activity_at || activeSession.started_at,
      isPaused,
      pausedAt: activePause ? activePause.paused_at : null,
      elapsedSeconds,
      elapsedMinutes: Math.floor(elapsedSeconds / 60),
      maxTimerHours,
      isStale,
      isForgotten: isStale,
      suggestedTrimSeconds: maxTimerHours * 3600,
    },
  })
})
