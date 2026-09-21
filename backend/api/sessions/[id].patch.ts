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
  if (data.startedAt !== undefined) updates.started_at = new Date(data.startedAt)
  if (data.endedAt !== undefined) updates.ended_at = new Date(data.endedAt)

  if (data.durationSeconds !== undefined) {
    updates.duration_seconds = data.durationSeconds
  } else if (data.durationMinutes !== undefined) {
    updates.duration_seconds = Math.round(data.durationMinutes * 60)
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
    notes: updated.notes,
    startedAt: updated.started_at,
    endedAt: updated.ended_at,
    durationSeconds: updated.duration_seconds,
    durationMinutes: Math.round((updated.duration_seconds || 0) / 60),
    pausedSeconds: updated.paused_seconds,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  })
})
