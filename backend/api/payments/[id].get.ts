// backend/api/payments/[id].get.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const paymentId = Number(idParam)

  if (!paymentId || isNaN(paymentId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid payment ID parameter.')
  }

  const db = getDb()
  const payment = await db('payments')
    .where({ id: paymentId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!payment) {
    return sendError(event, 404, 'PAYMENT_NOT_FOUND', 'Payment not found.')
  }

  const project = await db('projects').where({ id: payment.project_id }).first()
  let client = null
  if (payment.client_id) {
    client = await db('clients').where({ id: payment.client_id }).first()
  }

  return sendSuccess(event, {
    id: payment.id,
    projectId: payment.project_id,
    projectName: project?.name || null,
    clientId: payment.client_id,
    clientName: client?.name || null,
    amount: Number(payment.amount),
    currency: payment.currency,
    paidDate: payment.paid_date,
    notes: payment.notes,
    createdAt: payment.created_at,
    updatedAt: payment.updated_at,
  })
})
