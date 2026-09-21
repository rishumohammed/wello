// backend/api/clients/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, decodeCursor, encodeCursor } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = getDb()

  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100)
  const q = typeof query.q === 'string' ? query.q.trim() : null
  const country = typeof query.country === 'string' ? query.country.trim().toUpperCase() : null
  const sort = typeof query.sort === 'string' && ['created_at', 'updated_at', 'name'].includes(query.sort) ? query.sort : 'created_at'
  const order = typeof query.order === 'string' && query.order.toLowerCase() === 'asc' ? 'asc' : 'desc'
  const cursor = decodeCursor(query.cursor as string)

  let baseQuery = db('clients')
    .where({ user_id: user.id })
    .whereNull('deleted_at')

  if (q) {
    baseQuery = baseQuery.where((builder) => {
      builder
        .whereILike('name', `%${q}%`)
        .orWhereILike('company', `%${q}%`)
        .orWhereILike('email', `%${q}%`)
    })
  }

  if (country) {
    baseQuery = baseQuery.where({ country })
  }

  // Count total matching
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

  const rows = await listQuery
    .orderBy([
      { column: sort, order },
      { column: 'id', order },
    ])
    .limit(limit + 1)

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows

  // Calculate project counts for each client
  const clientIds = items.map((c) => c.id)
  let projectCountsMap: Record<number, { totalProjects: number; activeProjects: number }> = {}

  if (clientIds.length > 0) {
    const projectStats = await db('projects')
      .whereIn('client_id', clientIds)
      .where({ user_id: user.id })
      .whereNull('deleted_at')
      .select('client_id')
      .select(db.raw('COUNT(id) as total_projects'))
      .select(db.raw("SUM(CASE WHEN status IN ('in_progress', 'approved') THEN 1 ELSE 0 END) as active_projects"))
      .groupBy('client_id')

    projectStats.forEach((p: any) => {
      projectCountsMap[p.client_id] = {
        totalProjects: Number(p.total_projects || 0),
        activeProjects: Number(p.active_projects || 0),
      }
    })
  }

  const formattedClients = items.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone_e164,
    company: c.company,
    country: c.country,
    notes: c.notes,
    totalProjects: projectCountsMap[c.id]?.totalProjects || 0,
    activeProjects: projectCountsMap[c.id]?.activeProjects || 0,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }))

  const lastItem = items[items.length - 1]
  const nextCursor = hasMore && lastItem ? encodeCursor(lastItem[sort], lastItem.id) : null

  return sendSuccess(event, formattedClients, {
    limit,
    nextCursor,
    hasMore,
    total,
  })
})
