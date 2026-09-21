// backend/api/income-sources/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = getDb()

  const type = typeof query.type === 'string' && query.type.trim() ? query.type.trim() : null
  const isActive = query.isActive !== undefined ? (query.isActive === 'true' || query.isActive === true) : null

  let q = db('income_sources')
    .where({ user_id: user.id })
    .whereNull('deleted_at')

  if (type) {
    q = q.where({ type })
  }
  if (isActive !== null) {
    q = q.where({ is_active: isActive })
  }

  q = q.orderBy('is_active', 'desc').orderBy('created_at', 'desc')

  const rows = await q

  const items = rows.map(r => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    name: r.name,
    currency: r.currency,
    payFrequency: r.pay_frequency || r.frequency,
    expectedAmount: r.expected_amount !== null ? Number(r.expected_amount) : null,
    expectedHoursPerPeriod: r.expected_hours_per_period !== null ? Number(r.expected_hours_per_period) : null,
    isActive: Boolean(r.is_active),
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  return sendSuccess(event, items)
})
