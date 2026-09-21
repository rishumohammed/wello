// backend/api/overhead-expenses/[id].delete.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid overhead expense ID')
  }

  const db = getDb()
  const existing = await db('overhead_expenses')
    .where({ id, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'NOT_FOUND', 'Overhead expense not found')
  }

  // Soft delete overhead expense
  await db('overhead_expenses')
    .where({ id })
    .update({
      deleted_at: new Date(),
      updated_at: new Date(),
    })

  return sendSuccess(event, { id, deleted: true, message: 'Overhead expense deleted successfully' })
})
