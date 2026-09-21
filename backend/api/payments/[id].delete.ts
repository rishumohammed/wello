// backend/api/payments/[id].delete.ts
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
  const existing = await db('payments')
    .where({ id: paymentId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'PAYMENT_NOT_FOUND', 'Payment not found or already deleted.')
  }

  const now = new Date()
  await db('payments')
    .where({ id: paymentId, user_id: user.id })
    .update({
      deleted_at: now,
      updated_at: now,
    })

  return sendSuccess(event, {
    id: paymentId,
    deleted: true,
    message: 'Payment soft-deleted successfully.',
    deletedAt: now.toISOString(),
  })
})
