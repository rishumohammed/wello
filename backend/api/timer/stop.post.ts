// backend/api/timer/stop.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const stopTimerSchema = z.object({
  notes: z.string().nullable().optional(),
  title: z.string().min(1).max(255).optional(),
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

  // Close open pause if paused
  const openPause = await db('work_session_pauses')
    .where({ work_session_id: activeSession.id })
    .whereNull('resumed_at')
    .first()

  let additionalPausedSec = 0
  if (openPause) {
    const pauseDur = Math.max(0, Math.floor((now.getTime() - new Date(openPause.paused_at).getTime()) / 1000))
    await db('work_session_pauses').where({ id: openPause.id }).update({
      resumed_at: now,
      pause_duration_seconds: pauseDur,
    })
    additionalPausedSec = pauseDur
  }

  const totalPaused = Number(activeSession.paused_seconds || 0) + additionalPausedSec
  const startedMs = new Date(activeSession.started_at).getTime()
  const durationSeconds = Math.max(0, Math.floor((now.getTime() - startedMs) / 1000) - totalPaused)

  const updates: Record<string, any> = {
    ended_at: now,
    duration_seconds: durationSeconds,
    paused_seconds: totalPaused,
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
      createdAt: completedSession.created_at,
      updatedAt: completedSession.updated_at,
    },
  })
})
