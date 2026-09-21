// backend/api/timer/start.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const startTimerSchema = z.object({
  projectId: z.number().int().positive('Project ID is required'),
  title: z.string().min(1).max(255).optional().default('Work session'),
  type: z.enum(['meeting', 'call', 'discussion', 'planning', 'proposal', 'travel', 'production', 'revision', 'delivery', 'other']).optional().default('production'),
  paymentType: z.enum(['paid', 'unpaid', 'intentional_unpaid']).optional().default('paid'),
  unpaidReason: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  forceSwitch: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const parsed = startTimerSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()

  // Verify project belongs to user
  const project = await db('projects')
    .where({ id: data.projectId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!project) {
    return sendError(event, 400, 'INVALID_PROJECT', 'Specified project does not exist or does not belong to you.')
  }

  // Check for currently running active timer
  const existingActive = await db('work_sessions')
    .where({ user_id: user.id })
    .whereNull('ended_at')
    .whereNull('deleted_at')

  if (existingActive.length > 0 && !data.forceSwitch) {
    const active = existingActive[0]
    const activeProj = await db('projects').where({ id: active.project_id }).first()
    const activePause = await db('work_session_pauses')
      .where({ work_session_id: active.id })
      .whereNull('resumed_at')
      .first()

    const startedTime = new Date(active.started_at).getTime()
    const pausedSec = Number(active.paused_seconds || 0)
    let elapsed = 0
    if (activePause) {
      elapsed = Math.max(0, Math.floor((new Date(activePause.paused_at).getTime() - startedTime) / 1000) - pausedSec)
    } else {
      elapsed = Math.max(0, Math.floor((now.getTime() - startedTime) / 1000) - pausedSec)
    }

    return sendError(
      event,
      409,
      'ACTIVE_TIMER_EXISTS',
      `You already have an active timer running on "${activeProj?.name || 'another project'}". Please stop or switch the active timer.`,
      {
        activeTimer: {
          id: active.id,
          projectId: active.project_id,
          projectName: activeProj?.name || 'Project',
          title: active.title,
          elapsedSeconds: elapsed,
          isPaused: Boolean(activePause),
          startedAt: active.started_at,
        },
      }
    )
  }

  // If forceSwitch is true, cleanly stop and finalize previous active timer(s)
  for (const prev of existingActive) {
    const openPause = await db('work_session_pauses')
      .where({ work_session_id: prev.id })
      .whereNull('resumed_at')
      .first()

    let addPausedSec = 0
    if (openPause) {
      const pauseDuration = Math.max(0, Math.floor((now.getTime() - new Date(openPause.paused_at).getTime()) / 1000))
      await db('work_session_pauses').where({ id: openPause.id }).update({
        resumed_at: now,
        pause_duration_seconds: pauseDuration,
      })
      addPausedSec = pauseDuration
    }

    const totalPaused = Number(prev.paused_seconds || 0) + addPausedSec
    const startedMs = new Date(prev.started_at).getTime()
    const rawDur = Math.max(0, Math.floor((now.getTime() - startedMs) / 1000) - totalPaused)

    await db('work_sessions')
      .where({ id: prev.id })
      .update({
        ended_at: now,
        duration_seconds: rawDur,
        paused_seconds: totalPaused,
        last_activity_at: now,
        updated_at: now,
      })
  }

  // Create new active session
  const [newSessionId] = await db('work_sessions').insert({
    user_id: user.id,
    project_id: data.projectId,
    title: data.title,
    type: data.type,
    payment_type: data.paymentType,
    unpaid_reason: data.paymentType !== 'paid' ? data.unpaidReason || 'client_work' : null,
    notes: data.notes || null,
    started_at: now,
    ended_at: null,
    duration_seconds: 0,
    paused_seconds: 0,
    is_overlapping: false,
    is_flagged_forgotten: false,
    last_activity_at: now,
    created_at: now,
    updated_at: now,
  })

  return sendSuccess(
    event,
    {
      active: true,
      timer: {
        id: newSessionId,
        projectId: project.id,
        project: { id: project.id, name: project.name, currency: project.currency },
        title: data.title,
        type: data.type,
        paymentType: data.paymentType,
        unpaidReason: data.paymentType !== 'paid' ? data.unpaidReason || 'client_work' : null,
        notes: data.notes || null,
        startedAt: now.toISOString(),
        isPaused: false,
        pausedAt: null,
        elapsedSeconds: 0,
        elapsedMinutes: 0,
      },
    },
    undefined,
    201
  )
})
