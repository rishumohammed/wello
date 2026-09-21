// backend/api/payments/[id].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const updatePaymentSchema = z.object({
  projectId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().nullable().optional(),
  amount: z.number().positive().max(999999999).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  paidDate: z.string().optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const paymentId = Number(idParam)

  if (!paymentId || isNaN(paymentId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid payment ID parameter.')
  }

  const db = getDb()
  const existing = await db('payments')
    .where({ id: paymentId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'PAYMENT_NOT_FOUND', 'Payment not found.')
  }

  const body = await readBody(event)
  const parsed = updatePaymentSchema.safeParse(body)
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
  if (data.clientId !== undefined) updates.client_id = data.clientId
  if (data.amount !== undefined) updates.amount = data.amount
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.paidDate !== undefined) updates.paid_date = data.paidDate
  if (data.notes !== undefined) updates.notes = data.notes

  await db('payments')
    .where({ id: paymentId, user_id: user.id })
    .update(updates)

  const updated = await db('payments').where({ id: paymentId }).first()

  return sendSuccess(event, {
    id: updated.id,
    projectId: updated.project_id,
    clientId: updated.client_id,
    amount: Number(updated.amount),
    currency: updated.currency,
    paidDate: updated.paid_date,
    notes: updated.notes,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  })
})
