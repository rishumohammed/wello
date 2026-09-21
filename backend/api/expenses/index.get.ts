// backend/api/expenses/index.get.ts
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
  const category = typeof query.category === 'string' && query.category.trim() ? query.category.trim() : null
  const startDate = typeof query.startDate === 'string' && query.startDate.trim() ? query.startDate.trim() : null
  const endDate = typeof query.endDate === 'string' && query.endDate.trim() ? query.endDate.trim() : null
  const sort = typeof query.sort === 'string' && ['expense_date', 'created_at', 'amount'].includes(query.sort) ? query.sort : 'expense_date'
  const order = typeof query.order === 'string' && query.order.toLowerCase() === 'asc' ? 'asc' : 'desc'
  const cursor = decodeCursor(query.cursor as string)

  let baseQuery = db('project_expenses')
    .where({ user_id: user.id })
    .whereNull('deleted_at')

  if (projectId) baseQuery = baseQuery.where({ project_id: projectId })
  if (category) baseQuery = baseQuery.where({ category })
  if (startDate) baseQuery = baseQuery.where('expense_date', '>=', startDate)
  if (endDate) baseQuery = baseQuery.where('expense_date', '<=', endDate)

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

  const expenses = await listQuery
    .orderBy([
      { column: sort, order },
      { column: 'id', order },
    ])
    .limit(limit + 1)

  const hasMore = expenses.length > limit
  const items = hasMore ? expenses.slice(0, limit) : expenses

  const projectIds = [...new Set(items.map((e) => e.project_id))]
  let projectsMap: Record<number, string> = {}
  if (projectIds.length > 0) {
    const projs = await db('projects').whereIn('id', projectIds).select('id', 'name')
    projs.forEach((p) => { projectsMap[p.id] = p.name })
  }

  const formatted = items.map((e) => ({
    id: e.id,
    projectId: e.project_id,
    projectName: projectsMap[e.project_id] || null,
    description: e.description,
    category: e.category,
    amount: Number(e.amount),
    currency: e.currency,
    expenseDate: e.expense_date,
    createdAt: e.created_at,
    updatedAt: e.updated_at,
  }))

  const lastItem = items[items.length - 1]
  const nextCursor = hasMore && lastItem ? encodeCursor(lastItem[sort], lastItem.id) : null

  return sendSuccess(event, formatted, {
    limit,
    nextCursor,
    hasMore,
    total,
  })
})
