// backend/api/clients/[id].delete.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const clientId = Number(idParam)

  if (!clientId || isNaN(clientId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid client ID parameter.')
  }

  const db = getDb()
  const existing = await db('clients')
    .where({ id: clientId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'CLIENT_NOT_FOUND', 'Client not found or already archived.')
  }

  const now = new Date()
  await db('clients')
    .where({ id: clientId, user_id: user.id })
    .update({
      deleted_at: now,
      updated_at: now,
    })

  return sendSuccess(event, {
    id: clientId,
    archived: true,
    message: 'Client archived successfully. Associated financial and project history is preserved.',
    deletedAt: now.toISOString(),
  })
})
