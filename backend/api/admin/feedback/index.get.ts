// backend/api/admin/feedback/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireAdmin } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = getDb()
  const query = getQuery(event)
  const status = query.status as string
  const category = query.category as string

  let q = db('user_feedback')
    .leftJoin('users', 'user_feedback.user_id', 'users.id')
    .select(
      'user_feedback.id',
      'user_feedback.user_id',
      'user_feedback.user_email',
      'users.name as user_name',
      'user_feedback.category',
      'user_feedback.subject',
      'user_feedback.message',
      'user_feedback.status',
      'user_feedback.admin_response',
      'user_feedback.created_at',
      'user_feedback.updated_at'
    )
    .orderBy('user_feedback.created_at', 'desc')

  if (status && status !== 'all') {
    q = q.where('user_feedback.status', status)
  }
  if (category && category !== 'all') {
    q = q.where('user_feedback.category', category)
  }

  const items = await q

  return {
    success: true,
    data: {
      feedback: items,
      total: items.length,
    },
    feedback: items,
  }
})
