// backend/api/admin/analytics/rollups.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')

  const query = getQuery(event)
  const db = getDb()

  let q = db('analytics_daily_rollups').orderBy('rollup_date', 'desc')

  if (query?.country) q = q.where({ country: String(query.country) })
  if (query?.category) q = q.where({ category: String(query.category) })
  if (query?.platform) q = q.where({ platform: String(query.platform) })
  if (query?.startDate) q = q.where('rollup_date', '>=', String(query.startDate))
  if (query?.endDate) q = q.where('rollup_date', '<=', String(query.endDate))

  const limit = Math.min(100, Math.max(1, Number(query?.limit) || 30))
  q = q.limit(limit)

  const rollups = await q

  return {
    success: true,
    count: rollups.length,
    rollups: rollups.map(r => ({
      ...r,
      invoices_by_status: typeof r.invoices_by_status === 'string' ? JSON.parse(r.invoices_by_status) : r.invoices_by_status,
    })),
  }
})
