// backend/api/tax-rates/[id].delete.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) return sendError(event, 400, 'BAD_REQUEST', 'Tax rate ID is required')

  const db = getDb()
  const existing = await db('tax_rates')
    .where({ id, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) return sendError(event, 404, 'NOT_FOUND', 'Tax rate not found')

  // Soft delete
  await db('tax_rates')
    .where({ id, user_id: user.id })
    .update({ deleted_at: new Date(), updated_at: new Date() })

  return sendSuccess(event, { id: Number(id), deleted: true }, 'Tax rate deleted successfully')
})
