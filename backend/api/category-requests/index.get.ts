// backend/api/category-requests/index.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()

  const requests = await db('category_requests')
    .where({ user_id: user.id })
    .orWhere({ user_email: user.email.toLowerCase() })
    .orderBy('created_at', 'desc')

  return sendSuccess(
    event,
    requests.map((r) => ({
      id: r.id,
      requestedName: r.requested_name,
      description: r.description,
      reason: r.reason,
      status: r.status,
      adminNotes: r.admin_notes,
      requestCount: r.request_count,
      createdAt: r.created_at,
      processedAt: r.processed_at,
    }))
  )
})
