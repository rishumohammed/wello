// backend/api/projects/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, decodeCursor, encodeCursor } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = getDb()

  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
  const status = typeof query.status === 'string' && query.status.trim() ? query.status.trim() : null
  const clientId = query.clientId ? Number(query.clientId) : null
  const isJob = query.isJob !== undefined ? query.isJob === 'true' || query.isJob === true : null
  const q = typeof query.q === 'string' ? query.q.trim() : null
  const sort = typeof query.sort === 'string' && ['created_at', 'updated_at', 'name', 'quote_amount'].includes(query.sort) ? query.sort : 'updated_at'
  const order = typeof query.order === 'string' && query.order.toLowerCase() === 'asc' ? 'asc' : 'desc'
  const cursor = decodeCursor(query.cursor as string)

  let baseQuery = db('projects')
    .where({ user_id: user.id })
    .whereNull('deleted_at')

  if (status) {
    baseQuery = baseQuery.where({ status })
  }
  if (clientId) {
    baseQuery = baseQuery.where({ client_id: clientId })
  }
  if (isJob !== null) {
    baseQuery = baseQuery.where({ is_job: isJob })
  }
  if (q) {
    baseQuery = baseQuery.where((builder) => {
      builder.whereILike('name', `%${q}%`).orWhereILike('description', `%${q}%`)
    })
  }

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

  const projects = await listQuery
    .orderBy([
      { column: sort, order },
      { column: 'id', order },
    ])
    .limit(limit + 1)

  const hasMore = projects.length > limit
  const items = hasMore ? projects.slice(0, limit) : projects

  const projectIds = items.map((p) => p.id)
  const clientIds = [...new Set(items.map((p) => p.client_id).filter(Boolean))]

  // Fetch client details
  let clientsMap: Record<number, any> = {}
  if (clientIds.length > 0) {
    const clients = await db('clients').whereIn('id', clientIds)
    clients.forEach((c) => {
      clientsMap[c.id] = { id: c.id, name: c.name, company: c.company, email: c.email }
    })
  }

  // Aggregate metrics per project: sessions (time), payments (revenue), expenses
  let metricsMap: Record<number, { totalMinutes: number; paidMinutes: number; unpaidMinutes: number; revenue: number; expenses: number }> = {}

  if (projectIds.length > 0) {
    // 1. Sessions time
    const sessionAggs = await db('work_sessions')
      .whereIn('project_id', projectIds)
      .where({ user_id: user.id })
      .whereNull('deleted_at')
      .select('project_id')
      .select(db.raw('COALESCE(SUM(duration_seconds), 0) as total_sec'))
      .select(db.raw("COALESCE(SUM(CASE WHEN payment_type = 'paid' THEN duration_seconds ELSE 0 END), 0) as paid_sec"))
      .select(db.raw("COALESCE(SUM(CASE WHEN payment_type IN ('unpaid', 'intentional_unpaid') THEN duration_seconds ELSE 0 END), 0) as unpaid_sec"))
      .groupBy('project_id')

    sessionAggs.forEach((s: any) => {
      metricsMap[s.project_id] = {
        totalMinutes: Math.round(Number(s.total_sec || 0) / 60),
        paidMinutes: Math.round(Number(s.paid_sec || 0) / 60),
        unpaidMinutes: Math.round(Number(s.unpaid_sec || 0) / 60),
        revenue: 0,
        expenses: 0,
      }
    })

    // 2. Payments revenue
    const paymentAggs = await db('payments')
      .whereIn('project_id', projectIds)
      .where({ user_id: user.id })
      .whereNull('deleted_at')
      .select('project_id')
      .select(db.raw('COALESCE(SUM(amount), 0) as total_revenue'))
      .groupBy('project_id')

    paymentAggs.forEach((p: any) => {
      if (!metricsMap[p.project_id]) {
        metricsMap[p.project_id] = { totalMinutes: 0, paidMinutes: 0, unpaidMinutes: 0, revenue: 0, expenses: 0 }
      }
      metricsMap[p.project_id].revenue = Number(p.total_revenue || 0)
    })

    // 3. Project expenses
    const expenseAggs = await db('project_expenses')
      .whereIn('project_id', projectIds)
      .where({ user_id: user.id })
      .whereNull('deleted_at')
      .select('project_id')
      .select(db.raw('COALESCE(SUM(amount), 0) as total_expenses'))
      .groupBy('project_id')

    expenseAggs.forEach((e: any) => {
      if (!metricsMap[e.project_id]) {
        metricsMap[e.project_id] = { totalMinutes: 0, paidMinutes: 0, unpaidMinutes: 0, revenue: 0, expenses: 0 }
      }
      metricsMap[e.project_id].expenses = Number(e.total_expenses || 0)
    })
  }

  const formattedProjects = items.map((p) => {
    const met = metricsMap[p.id] || { totalMinutes: 0, paidMinutes: 0, unpaidMinutes: 0, revenue: 0, expenses: 0 }
    const totalHours = met.totalMinutes / 60
    const netIncome = met.revenue - met.expenses
    const effectiveHourlyValue = totalHours > 0 ? Math.round(netIncome / totalHours) : 0

    return {
      id: p.id,
      clientId: p.client_id,
      client: p.client_id ? clientsMap[p.client_id] || null : null,
      categoryId: p.category_id,
      serviceCategory: p.service_category || 'General',
      name: p.name,
      description: p.description,
      status: p.status,
      isJob: Boolean(p.is_job),
      currency: p.currency || 'USD',
      quoteAmount: p.quote_amount !== null ? Number(p.quote_amount) : null,
      quoteDate: p.quote_date,
      quoteEstHours: p.quote_est_hours !== null ? Number(p.quote_est_hours) : null,
      quoteNotes: p.quote_notes,
      quoteStatus: p.quote_status,
      metrics: {
        totalMinutes: met.totalMinutes,
        paidMinutes: met.paidMinutes,
        unpaidMinutes: met.unpaidMinutes,
        revenue: met.revenue,
        expenses: met.expenses,
        netIncome,
        effectiveHourlyValue,
      },
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }
  })

  const lastItem = items[items.length - 1]
  const nextCursor = hasMore && lastItem ? encodeCursor(lastItem[sort], lastItem.id) : null

  return sendSuccess(event, formattedProjects, {
    limit,
    nextCursor,
    hasMore,
    total,
  })
})
