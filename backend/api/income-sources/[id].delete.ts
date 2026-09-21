// backend/api/income-sources/[id].delete.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid income source ID')
  }

  const db = getDb()
  const existing = await db('income_sources')
    .where({ id, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'NOT_FOUND', 'Income source not found')
  }

  // Soft delete income source
  await db('income_sources')
    .where({ id })
    .update({
      deleted_at: new Date(),
      is_active: false,
      updated_at: new Date(),
    })

  return sendSuccess(event, { id, deleted: true, message: 'Income source deleted successfully' })
})
