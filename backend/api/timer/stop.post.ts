// backend/api/timer/stop.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const stopTimerSchema = z.object({
  notes: z.string().nullable().optional(),
  title: z.string().min(1).max(255).optional(),
  trimToLastActivity: z.boolean().optional().default(false),
  trimToHours: z.number().min(0.1).max(24).optional(),
  customEndedAt: z.string().optional(),
}).optional()

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))
  const parsed = stopTimerSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data || {}
  const db = getDb()
  const now = new Date()

  const activeSession = await db('work_sessions')
    .where({ user_id: user.id })
    .whereNull('ended_at')
    .whereNull('deleted_at')
    .orderBy('started_at', 'desc')
    .first()

  if (!activeSession) {
    return sendError(event, 404, 'NO_ACTIVE_TIMER', 'No active timer found to stop.')
  }

  const startedMs = new Date(activeSession.started_at).getTime()
  let stopTimestamp = now
  let isFlaggedForgotten = false
  let rawDurationSeconds: number | null = null

  // Untrimmed raw elapsed calculation
  const openPause = await db('work_session_pauses')
    .where({ work_session_id: activeSession.id })
    .whereNull('resumed_at')
    .first()

  let additionalPausedSec = 0
  if (openPause) {
    const pauseDur = Math.max(0, Math.floor((now.getTime() - new Date(openPause.paused_at).getTime()) / 1000))
    additionalPausedSec = pauseDur
  }
  const untrimmedTotalPaused = Number(activeSession.paused_seconds || 0) + additionalPausedSec
  const untrimmedDurationSeconds = Math.max(0, Math.floor((now.getTime() - startedMs) / 1000) - untrimmedTotalPaused)

  let finalDurationSeconds = untrimmedDurationSeconds
  let finalPausedSeconds = untrimmedTotalPaused

  if (data.customEndedAt) {
    stopTimestamp = new Date(data.customEndedAt)
    if (isNaN(stopTimestamp.getTime())) stopTimestamp = now
  } else if (data.trimToLastActivity && activeSession.last_activity_at) {
    stopTimestamp = new Date(activeSession.last_activity_at)
    isFlaggedForgotten = true
    rawDurationSeconds = untrimmedDurationSeconds
  } else if (data.trimToHours) {
    isFlaggedForgotten = true
    rawDurationSeconds = untrimmedDurationSeconds
    finalDurationSeconds = Math.min(untrimmedDurationSeconds, Math.round(data.trimToHours * 3600))
  }

  // Finalize pauses up to stopTimestamp
  if (openPause) {
    const pauseStarted = new Date(openPause.paused_at).getTime()
    const pauseEndMs = Math.max(pauseStarted, stopTimestamp.getTime())
    const pauseDur = Math.max(0, Math.floor((pauseEndMs - pauseStarted) / 1000))

    await db('work_session_pauses').where({ id: openPause.id }).update({
      resumed_at: new Date(pauseEndMs),
      pause_duration_seconds: pauseDur,
    })
    finalPausedSeconds = Number(activeSession.paused_seconds || 0) + pauseDur
  }

  if (!data.trimToHours) {
    finalDurationSeconds = Math.max(0, Math.floor((stopTimestamp.getTime() - startedMs) / 1000) - finalPausedSeconds)
  }

  // Check if session exceeded user's max timer hours without manual trim
  const maxHours = Number(user.max_timer_hours || 8)
  if (finalDurationSeconds > maxHours * 3600 && !isFlaggedForgotten) {
    isFlaggedForgotten = true
  }

  const updates: Record<string, any> = {
    ended_at: stopTimestamp,
    duration_seconds: finalDurationSeconds,
    paused_seconds: finalPausedSeconds,
    is_flagged_forgotten: isFlaggedForgotten,
    raw_duration_seconds: rawDurationSeconds,
    last_activity_at: now,
    updated_at: now,
  }

  if (data.notes !== undefined) updates.notes = data.notes
  if (data.title !== undefined) updates.title = data.title

  await db('work_sessions').where({ id: activeSession.id }).update(updates)

  const completedSession = await db('work_sessions').where({ id: activeSession.id }).first()
  const project = await db('projects').where({ id: completedSession.project_id }).first()

  return sendSuccess(event, {
    message: 'Timer stopped and work session recorded successfully.',
    session: {
      id: completedSession.id,
      projectId: completedSession.project_id,
      project: project ? { id: project.id, name: project.name, currency: project.currency } : null,
      title: completedSession.title,
      type: completedSession.type,
      paymentType: completedSession.payment_type,
      unpaidReason: completedSession.unpaid_reason,
      notes: completedSession.notes,
      startedAt: completedSession.started_at,
      endedAt: completedSession.ended_at,
      durationSeconds: completedSession.duration_seconds,
      durationMinutes: Math.round((completedSession.duration_seconds || 0) / 60),
      pausedSeconds: completedSession.paused_seconds,
      isOverlapping: Boolean(completedSession.is_overlapping),
      isFlaggedForgotten: Boolean(completedSession.is_flagged_forgotten),
      rawDurationSeconds: completedSession.raw_duration_seconds,
      createdAt: completedSession.created_at,
      updatedAt: completedSession.updated_at,
    },
  })
})
