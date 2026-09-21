// backend/api/sessions/[id].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

import { classifyUnpaidReason } from '../../utils/metricsEngine'

const updateSessionSchema = z.object({
  projectId: z.number().int().positive().optional(),
  title: z.string().min(1).max(255).optional(),
  type: z.enum(['meeting', 'call', 'discussion', 'planning', 'proposal', 'travel', 'production', 'revision', 'delivery', 'other']).optional(),
  paymentType: z.enum(['paid', 'unpaid', 'intentional_unpaid']).optional(),
  unpaidReason: z.string().nullable().optional(),
  unpaidCategory: z.enum(['unpaid_client', 'intentional_unpaid']).nullable().optional(),
  notes: z.string().nullable().optional(),
  startedAt: z.string().optional(),
  endedAt: z.string().optional(),
  durationMinutes: z.number().min(1).max(99999).optional(),
  durationSeconds: z.number().min(1).max(5999999).optional(),
  allowOverlap: z.boolean().optional().default(false),
})

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
    return sendError(event, 404, 'SESSION_NOT_FOUND', 'Work session not found.')
  }

  const body = await readBody(event)
  const parsed = updateSessionSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data

  if (data.projectId) {
    const project = await db('projects')
      .where({ id: data.projectId, user_id: user.id })
      .whereNull('deleted_at')
      .first()
    if (!project) {
      return sendError(event, 400, 'INVALID_PROJECT', 'Specified project does not exist or does not belong to you.')
    }
  }

  const now = new Date()
  let effectiveStartedAt = data.startedAt ? new Date(data.startedAt) : new Date(existing.started_at)
  let effectiveEndedAt = data.endedAt ? new Date(data.endedAt) : (existing.ended_at ? new Date(existing.ended_at) : now)

  if (data.durationSeconds !== undefined) {
    if (!data.endedAt && data.startedAt) {
      effectiveEndedAt = new Date(effectiveStartedAt.getTime() + data.durationSeconds * 1000)
    }
  } else if (data.durationMinutes !== undefined) {
    if (!data.endedAt && data.startedAt) {
      effectiveEndedAt = new Date(effectiveStartedAt.getTime() + data.durationMinutes * 60 * 1000)
    }
  }

  // Validate dates: end must be after start
  if (effectiveEndedAt.getTime() <= effectiveStartedAt.getTime()) {
    return sendError(event, 400, 'INVALID_DATE_RANGE', 'Session end time must be after the start time.')
  }

  // Future tolerance validation: max 5 minutes ahead of server clock
  const maxFutureAllowed = now.getTime() + 5 * 60 * 1000
  if (data.startedAt && effectiveStartedAt.getTime() > maxFutureAllowed) {
    return sendError(event, 400, 'FUTURE_TIMESTAMP_NOT_ALLOWED', 'Session start time cannot be in the future.')
  }
  if (data.endedAt && effectiveEndedAt.getTime() > maxFutureAllowed) {
    return sendError(event, 400, 'FUTURE_TIMESTAMP_NOT_ALLOWED', 'Session end time cannot be in the future.')
  }

  // Overlap detection if timestamps or duration changed
  let isOverlapping = Boolean(existing.is_overlapping)
  if (data.startedAt !== undefined || data.endedAt !== undefined || data.durationSeconds !== undefined || data.durationMinutes !== undefined) {
    const overlappingSessions = await db('work_sessions')
      .leftJoin('projects', 'work_sessions.project_id', 'projects.id')
      .where('work_sessions.user_id', user.id)
      .where('work_sessions.id', '!=', sessionId)
      .whereNull('work_sessions.deleted_at')
      .whereNotNull('work_sessions.ended_at')
      .where('work_sessions.started_at', '<', effectiveEndedAt)
      .where('work_sessions.ended_at', '>', effectiveStartedAt)
      .select(
        'work_sessions.id',
        'work_sessions.title',
        'work_sessions.started_at',
        'work_sessions.ended_at',
        'work_sessions.duration_seconds',
        'projects.name as project_name'
      )

    isOverlapping = overlappingSessions.length > 0
    if (isOverlapping && !data.allowOverlap) {
      return sendError(
        event,
        409,
        'SESSION_OVERLAP_DETECTED',
        `This updated session overlaps with ${overlappingSessions.length} existing logged session(s). Please confirm if you wish to allow overlap.`,
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
  }

  const updates: Record<string, any> = {
    updated_at: now,
  }

  if (data.projectId !== undefined) updates.project_id = data.projectId
  if (data.title !== undefined) updates.title = data.title.trim()
  if (data.type !== undefined) updates.type = data.type
  if (data.paymentType !== undefined) {
    updates.payment_type = data.paymentType
    if (data.paymentType === 'paid') {
      updates.unpaid_reason = null
      updates.unpaid_category = null
    } else {
      const reason = data.unpaidReason !== undefined ? data.unpaidReason : existing.unpaid_reason
      updates.unpaid_reason = reason
      updates.unpaid_category = data.unpaidCategory || classifyUnpaidReason(reason)
    }
  } else if (data.unpaidReason !== undefined) {
    updates.unpaid_reason = data.unpaidReason
    if (existing.payment_type !== 'paid') {
      updates.unpaid_category = data.unpaidCategory || classifyUnpaidReason(data.unpaidReason)
    }
  } else if (data.unpaidCategory !== undefined) {
    updates.unpaid_category = data.unpaidCategory
  }
  if (data.notes !== undefined) updates.notes = data.notes
  if (data.startedAt !== undefined) updates.started_at = effectiveStartedAt
  if (data.endedAt !== undefined) updates.ended_at = effectiveEndedAt
  updates.is_overlapping = isOverlapping

  if (data.durationSeconds !== undefined) {
    updates.duration_seconds = data.durationSeconds
  } else if (data.durationMinutes !== undefined) {
    updates.duration_seconds = Math.round(data.durationMinutes * 60)
  } else if (data.startedAt !== undefined || data.endedAt !== undefined) {
    updates.duration_seconds = Math.max(60, Math.round((effectiveEndedAt.getTime() - effectiveStartedAt.getTime()) / 1000) - Number(existing.paused_seconds || 0))
  }

  // Calculate audit log diff
  const oldValues: Record<string, any> = {}
  const newValues: Record<string, any> = {}
  const changedFieldNames: string[] = []

  for (const [key, val] of Object.entries(updates)) {
    if (key === 'updated_at') continue
    const oldVal = existing[key]
    const isDifferent = String(oldVal) !== String(val)
    if (isDifferent) {
      oldValues[key] = oldVal
      newValues[key] = val
      changedFieldNames.push(key)
    }
  }

  if (changedFieldNames.length > 0) {
    const summary = `Edited ${changedFieldNames.join(', ')}`
    await db('work_session_edits').insert({
      work_session_id: sessionId,
      user_id: existing.user_id,
      editor_user_id: user.id,
      change_summary: summary.slice(0, 255),
      old_values: JSON.stringify(oldValues),
      new_values: JSON.stringify(newValues),
      created_at: now,
    })
  }

  await db('work_sessions')
    .where({ id: sessionId, user_id: user.id })
    .update(updates)

  const updated = await db('work_sessions').where({ id: sessionId }).first()

  return sendSuccess(event, {
    id: updated.id,
    projectId: updated.project_id,
    title: updated.title,
    type: updated.type,
    paymentType: updated.payment_type,
    unpaidReason: updated.unpaid_reason,
    unpaidCategory: updated.unpaid_category,
    notes: updated.notes,
    startedAt: updated.started_at,
    endedAt: updated.ended_at,
    durationSeconds: updated.duration_seconds,
    durationMinutes: Math.round((updated.duration_seconds || 0) / 60),
    pausedSeconds: updated.paused_seconds,
    isOverlapping: Boolean(updated.is_overlapping),
    isFlaggedForgotten: Boolean(updated.is_flagged_forgotten),
    rawDurationSeconds: updated.raw_duration_seconds,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  })
})
