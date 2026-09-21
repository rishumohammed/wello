// backend/api/payments/index.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'

const createPaymentSchema = z.object({
  projectId: z.number().int().positive('Project ID is required'),
  clientId: z.number().int().positive().nullable().optional(),
  amount: z.number().positive('Payment amount must be greater than zero').max(999999999),
  currency: z.string().length(3).toUpperCase().optional(),
  paidDate: z.string().optional(),
  notes: z.string().nullable().optional(),
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
  const parsed = createPaymentSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  const project = await db('projects')
    .where({ id: data.projectId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!project) {
    return sendError(event, 400, 'INVALID_PROJECT', 'Specified project does not exist or does not belong to you.')
  }

  const now = new Date()
  const paidDate = data.paidDate || now.toISOString().slice(0, 10)
  const currency = data.currency || project.currency || user.baseCurrency || 'USD'
  const clientId = data.clientId || project.client_id || null

  const [paymentId] = await db('payments').insert({
    user_id: user.id,
    project_id: data.projectId,
    client_id: clientId,
    amount: data.amount,
    currency,
    paid_date: paidDate,
    notes: data.notes || null,
    created_at: now,
    updated_at: now,
  })

  const newPayment = await db('payments').where({ id: paymentId }).first()

  const responseData = {
    id: newPayment.id,
    projectId: newPayment.project_id,
    projectName: project.name,
    clientId: newPayment.client_id,
    amount: Number(newPayment.amount),
    currency: newPayment.currency,
    paidDate: newPayment.paid_date,
    notes: newPayment.notes,
    createdAt: newPayment.created_at,
    updatedAt: newPayment.updated_at,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, responseData)
  }

  return sendSuccess(event, responseData, undefined, 201)
})
