// backend/api/income-sources/[id].get.ts
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
  const source = await db('income_sources')
    .where({ id, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!source) {
    return sendError(event, 404, 'NOT_FOUND', 'Income source not found')
  }

  return sendSuccess(event, {
    id: source.id,
    userId: source.user_id,
    type: source.type,
    name: source.name,
    currency: source.currency,
    payFrequency: source.pay_frequency || source.frequency,
    expectedAmount: source.expected_amount !== null ? Number(source.expected_amount) : null,
    expectedHoursPerPeriod: source.expected_hours_per_period !== null ? Number(source.expected_hours_per_period) : null,
    isActive: Boolean(source.is_active),
    notes: source.notes,
    createdAt: source.created_at,
    updatedAt: source.updated_at,
  })
})
