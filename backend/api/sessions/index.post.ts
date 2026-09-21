// backend/api/sessions/index.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'

import { classifyUnpaidReason } from '../../utils/metricsEngine'

const createSessionSchema = z.object({
  projectId: z.number().int().positive('Project ID is required'),
  title: z.string().min(1).max(255).optional().default('Work session'),
  type: z.enum(['meeting', 'call', 'discussion', 'planning', 'proposal', 'travel', 'production', 'revision', 'delivery', 'other']).optional().default('production'),
  paymentType: z.enum(['paid', 'unpaid', 'intentional_unpaid']).optional().default('paid'),
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

  // Verify project belongs to user
  const project = await db('projects')
    .where({ id: data.projectId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!project) {
    return sendError(event, 400, 'INVALID_PROJECT', 'Specified project does not exist or does not belong to you.')
  }

  const now = new Date()
  let startedAt = data.startedAt ? new Date(data.startedAt) : now
  let endedAt = data.endedAt ? new Date(data.endedAt) : now

  let durationSeconds = 0
  if (data.durationSeconds) {
    durationSeconds = data.durationSeconds
    if (!data.startedAt && data.endedAt) {
      startedAt = new Date(endedAt.getTime() - durationSeconds * 1000)
    } else if (data.startedAt && !data.endedAt) {
      endedAt = new Date(startedAt.getTime() + durationSeconds * 1000)
    }
  } else if (data.durationMinutes) {
    durationSeconds = Math.round(data.durationMinutes * 60)
    if (!data.startedAt && data.endedAt) {
      startedAt = new Date(endedAt.getTime() - durationSeconds * 1000)
    } else if (data.startedAt && !data.endedAt) {
      endedAt = new Date(startedAt.getTime() + durationSeconds * 1000)
    }
  } else {
    durationSeconds = Math.max(60, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
  }

  const unpaidReason = data.paymentType !== 'paid' ? data.unpaidReason || 'client_friction' : null
  const unpaidCategory = data.paymentType !== 'paid' ? (data.unpaidCategory || classifyUnpaidReason(unpaidReason)) : null

  const [sessionId] = await db('work_sessions').insert({
    user_id: user.id,
    project_id: data.projectId,
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
    created_at: now,
    updated_at: now,
  })

  const newSession = await db('work_sessions').where({ id: sessionId }).first()

  const responseData = {
    id: newSession.id,
    projectId: newSession.project_id,
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
    createdAt: newSession.created_at,
    updatedAt: newSession.updated_at,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, responseData)
  }

  return sendSuccess(event, responseData, undefined, 201)
})
