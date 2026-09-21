// backend/api/payments/index.get.ts
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
  const clientId = query.clientId ? Number(query.clientId) : null
  const startDate = typeof query.startDate === 'string' && query.startDate.trim() ? query.startDate.trim() : null
  const endDate = typeof query.endDate === 'string' && query.endDate.trim() ? query.endDate.trim() : null
  const sort = typeof query.sort === 'string' && ['paid_date', 'created_at', 'amount'].includes(query.sort) ? query.sort : 'paid_date'
  const order = typeof query.order === 'string' && query.order.toLowerCase() === 'asc' ? 'asc' : 'desc'
  const cursor = decodeCursor(query.cursor as string)

  let baseQuery = db('payments')
    .where({ user_id: user.id })
    .whereNull('deleted_at')

  if (projectId) baseQuery = baseQuery.where({ project_id: projectId })
  if (clientId) baseQuery = baseQuery.where({ client_id: clientId })
  if (startDate) baseQuery = baseQuery.where('paid_date', '>=', startDate)
  if (endDate) baseQuery = baseQuery.where('paid_date', '<=', endDate)

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

  const payments = await listQuery
    .orderBy([
      { column: sort, order },
      { column: 'id', order },
    ])
    .limit(limit + 1)

  const hasMore = payments.length > limit
  const items = hasMore ? payments.slice(0, limit) : payments

  // Attach project & client names
  const projectIds = [...new Set(items.map((p) => p.project_id))]
  const clientIds = [...new Set(items.map((p) => p.client_id).filter(Boolean))]

  let projectsMap: Record<number, string> = {}
  let clientsMap: Record<number, string> = {}

  if (projectIds.length > 0) {
    const projs = await db('projects').whereIn('id', projectIds).select('id', 'name')
    projs.forEach((p) => { projectsMap[p.id] = p.name })
  }
  if (clientIds.length > 0) {
    const cls = await db('clients').whereIn('id', clientIds).select('id', 'name')
    cls.forEach((c) => { clientsMap[c.id] = c.name })
  }

  const formattedPayments = items.map((p) => ({
    id: p.id,
    projectId: p.project_id,
    projectName: projectsMap[p.project_id] || null,
    clientId: p.client_id,
    clientName: p.client_id ? clientsMap[p.client_id] || null : null,
    amount: Number(p.amount),
    currency: p.currency,
    paidDate: p.paid_date,
    notes: p.notes,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }))

  const lastItem = items[items.length - 1]
  const nextCursor = hasMore && lastItem ? encodeCursor(lastItem[sort], lastItem.id) : null

  return sendSuccess(event, formattedPayments, {
    limit,
    nextCursor,
    hasMore,
    total,
  })
})
