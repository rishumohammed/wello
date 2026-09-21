// backend/api/sessions/index.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'
import { logAnalyticsEvent } from '../../utils/analyticsService'

import { classifyUnpaidReason } from '../../utils/metricsEngine'

const createSessionSchema = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  incomeSourceId: z.number().int().positive().nullable().optional(),
  title: z.string().min(1).max(255).optional().default('Work session'),
  type: z.enum(['meeting', 'call', 'discussion', 'planning', 'proposal', 'travel', 'commute', 'production', 'revision', 'delivery', 'other']).optional().default('production'),
  paymentType: z.enum(['paid', 'unpaid', 'intentional_unpaid']).optional().default('paid'),
  unpaidReason: z.string().nullable().optional(),
  unpaidCategory: z.enum(['unpaid_client', 'intentional_unpaid']).nullable().optional(),
  notes: z.string().nullable().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  durationMinutes: z.number().min(1).max(99999).optional(),
  durationMin: z.number().min(1).max(99999).optional(),
  durationSeconds: z.number().min(1).max(5999999).optional(),
  allowOverlap: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const path = getRequestPath(event)
  const idempotencyKey = getIdempotencyKey(event)

  if (idempotencyKey) {
    const cached = await checkIdempotency(user.id, idempotencyKey, path)
    if (cached.exists) {
      return sendSuccess(event, cached.body, undefined, cached.status)
    }
  }

  const body = await readBody(event)
  const parsed = createSessionSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  if (!data.projectId && !data.incomeSourceId) {
    return sendError(event, 400, 'MISSING_TARGET', 'Either a project or an income source must be specified.')
  }

  // Verify project belongs to user if provided
  if (data.projectId) {
    const project = await db('projects')
      .where({ id: data.projectId, user_id: user.id })
      .whereNull('deleted_at')
      .first()

    if (!project) {
      return sendError(event, 400, 'INVALID_PROJECT', 'Specified project does not exist or does not belong to you.')
    }
  }

  // Verify income source belongs to user if provided
  if (data.incomeSourceId) {
    const source = await db('income_sources')
      .where({ id: data.incomeSourceId, user_id: user.id })
      .first()

    if (!source) {
      return sendError(event, 400, 'INVALID_INCOME_SOURCE', 'Specified income source does not exist or does not belong to you.')
    }
  }

  const now = new Date()
  let startedAt: Date
  let endedAt: Date
  let durationSeconds = 0

  if (data.durationSeconds) {
    durationSeconds = data.durationSeconds
  } else if (data.durationMinutes) {
    durationSeconds = Math.round(data.durationMinutes * 60)
  } else if (data.durationMin) {
    durationSeconds = Math.round(data.durationMin * 60)
  }

  if (data.startedAt && data.endedAt) {
    startedAt = new Date(data.startedAt)
    endedAt = new Date(data.endedAt)
    if (!durationSeconds) {
      durationSeconds = Math.max(60, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
    }
  } else if (data.startedAt && !data.endedAt) {
    startedAt = new Date(data.startedAt)
    durationSeconds = durationSeconds || 3600
    endedAt = new Date(startedAt.getTime() + durationSeconds * 1000)
  } else if (!data.startedAt && data.endedAt) {
    endedAt = new Date(data.endedAt)
    durationSeconds = durationSeconds || 3600
    startedAt = new Date(endedAt.getTime() - durationSeconds * 1000)
  } else {
    durationSeconds = durationSeconds || 3600
    endedAt = now
    startedAt = new Date(now.getTime() - durationSeconds * 1000)
  }

  // Validate dates: end must be after start
  if (endedAt.getTime() <= startedAt.getTime()) {
    return sendError(event, 400, 'INVALID_DATE_RANGE', 'Session end time must be after the start time.')
  }

  // Future tolerance validation: max 5 minutes ahead of server clock
  const maxFutureAllowed = now.getTime() + 5 * 60 * 1000
  if (startedAt.getTime() > maxFutureAllowed) {
    return sendError(event, 400, 'FUTURE_TIMESTAMP_NOT_ALLOWED', 'Session start time cannot be in the future.')
  }
  if (endedAt.getTime() > maxFutureAllowed) {
    return sendError(event, 400, 'FUTURE_TIMESTAMP_NOT_ALLOWED', 'Session end time cannot be in the future.')
  }

  // Overlap detection: Check if interval [startedAt, endedAt] overlaps with any existing non-deleted session
  const overlappingSessions = await db('work_sessions')
    .leftJoin('projects', 'work_sessions.project_id', 'projects.id')
    .where('work_sessions.user_id', user.id)
    .whereNull('work_sessions.deleted_at')
    .whereNotNull('work_sessions.ended_at')
    .where('work_sessions.started_at', '<', endedAt)
    .where('work_sessions.ended_at', '>', startedAt)
    .select(
      'work_sessions.id',
      'work_sessions.title',
      'work_sessions.started_at',
      'work_sessions.ended_at',
      'work_sessions.duration_seconds',
      'projects.name as project_name'
    )

  let isOverlapping = overlappingSessions.length > 0
  if (isOverlapping && !data.allowOverlap) {
    return sendError(
      event,
      409,
      'SESSION_OVERLAP_DETECTED',
      `This session overlaps with ${overlappingSessions.length} existing logged session(s). Please confirm if you wish to allow overlap.`,
      {
        overlappingSessions: overlappingSessions.map((s: any) => ({
          id: s.id,
          title: s.title,
          projectName: s.project_name || 'Project',
          startedAt: s.started_at,
          endedAt: s.ended_at,
          durationMinutes: Math.round(Number(s.duration_seconds || 0) / 60),
        })),
      }
    )
  }

  const unpaidReason = data.paymentType !== 'paid' ? data.unpaidReason || 'client_friction' : null
  const unpaidCategory = data.paymentType !== 'paid' ? (data.unpaidCategory || classifyUnpaidReason(unpaidReason)) : null

  const [sessionId] = await db('work_sessions').insert({
    user_id: user.id,
    project_id: data.projectId || null,
    income_source_id: data.incomeSourceId || null,
    title: data.title,
    type: data.type,
    payment_type: data.paymentType,
    unpaid_reason: unpaidReason,
    unpaid_category: unpaidCategory,
    notes: data.notes || null,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    paused_seconds: 0,
    is_overlapping: isOverlapping,
    is_flagged_forgotten: false,
    created_at: now,
    updated_at: now,
  })

  const newSession = await db('work_sessions').where({ id: sessionId }).first()

  const responseData = {
    id: newSession.id,
    projectId: newSession.project_id,
    incomeSourceId: newSession.income_source_id,
    title: newSession.title,
    type: newSession.type,
    paymentType: newSession.payment_type,
    unpaidReason: newSession.unpaid_reason,
    unpaidCategory: newSession.unpaid_category,
    notes: newSession.notes,
    startedAt: newSession.started_at,
    endedAt: newSession.ended_at,
    durationSeconds: newSession.duration_seconds,
    durationMinutes: Math.round((newSession.duration_seconds || 0) / 60),
    pausedSeconds: newSession.paused_seconds,
    isOverlapping: Boolean(newSession.is_overlapping),
    isFlaggedForgotten: Boolean(newSession.is_flagged_forgotten),
    createdAt: newSession.created_at,
    updatedAt: newSession.updated_at,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, responseData)
  }

  // Emit trusted analytics event
  await logAnalyticsEvent(user.id, 'session_logged', {
    session_id: newSession.id,
    duration_minutes: responseData.durationMinutes,
    payment_type: data.paymentType,
    unpaid_category: data.unpaidCategory,
  })

  return sendSuccess(event, responseData, undefined, 201)
})
