// backend/api/sessions/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, decodeCursor, encodeCursor } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = getDb()

  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
  const projectId = query.projectId ? Number(query.projectId) : null
  const paymentType = typeof query.paymentType === 'string' && ['paid', 'unpaid', 'intentional_unpaid'].includes(query.paymentType) ? query.paymentType : null
  const type = typeof query.type === 'string' && query.type.trim() ? query.type.trim() : null
  const startDate = typeof query.startDate === 'string' && query.startDate.trim() ? query.startDate.trim() : null
  const endDate = typeof query.endDate === 'string' && query.endDate.trim() ? query.endDate.trim() : null
  const sort = typeof query.sort === 'string' && ['started_at', 'created_at', 'duration_seconds'].includes(query.sort) ? query.sort : 'started_at'
  const order = typeof query.order === 'string' && query.order.toLowerCase() === 'asc' ? 'asc' : 'desc'
  const cursor = decodeCursor(query.cursor as string)

  let baseQuery = db('work_sessions')
    .where({ user_id: user.id })
    .whereNotNull('ended_at') // only completed sessions in standard list
    .whereNull('deleted_at')

  if (projectId) baseQuery = baseQuery.where({ project_id: projectId })
  if (paymentType) baseQuery = baseQuery.where({ payment_type: paymentType })
  if (type) baseQuery = baseQuery.where({ type })
  if (startDate) baseQuery = baseQuery.where('started_at', '>=', `${startDate} 00:00:00`)
  if (endDate) baseQuery = baseQuery.where('started_at', '<=', `${endDate} 23:59:59.999`)

  const [countResult] = await baseQuery.clone().count('id as count')
  const total = Number(countResult?.count || 0)

  let listQuery = baseQuery.clone()

  if (cursor) {
    if (order === 'desc') {
      listQuery = listQuery.where((builder) => {
        builder.where(sort, '<', cursor.val).orWhere((b2) => {
          b2.where(sort, '=', cursor.val).andWhere('id', '<', cursor.id)
        })
      })
    } else {
      listQuery = listQuery.where((builder) => {
        builder.where(sort, '>', cursor.val).orWhere((b2) => {
          b2.where(sort, '=', cursor.val).andWhere('id', '>', cursor.id)
        })
      })
    }
  }

  const sessions = await listQuery
    .orderBy([
      { column: sort, order },
      { column: 'id', order },
    ])
    .limit(limit + 1)

  const hasMore = sessions.length > limit
  const items = hasMore ? sessions.slice(0, limit) : sessions

  // Attach project names
  const projectIds = [...new Set(items.map((s) => s.project_id))]
  let projectsMap: Record<number, { id: number; name: string; currency: string }> = {}
  if (projectIds.length > 0) {
    const projs = await db('projects').whereIn('id', projectIds).select('id', 'name', 'currency')
    projs.forEach((p) => {
      projectsMap[p.id] = { id: p.id, name: p.name, currency: p.currency }
    })
  }

  const formattedSessions = items.map((s) => ({
    id: s.id,
    projectId: s.project_id,
    project: projectsMap[s.project_id] || null,
    title: s.title,
    type: s.type,
    paymentType: s.payment_type,
    unpaidReason: s.unpaid_reason,
    notes: s.notes,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    durationSeconds: s.duration_seconds,
    durationMinutes: Math.round((s.duration_seconds || 0) / 60),
    pausedSeconds: s.paused_seconds,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
  }))

  const lastItem = items[items.length - 1]
  const nextCursor = hasMore && lastItem ? encodeCursor(lastItem[sort], lastItem.id) : null

  return sendSuccess(event, formattedSessions, {
    limit,
    nextCursor,
    hasMore,
    total,
  })
})
