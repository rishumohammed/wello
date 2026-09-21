// backend/api/admin/analytics/backfill.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { runHistoricalAnalyticsBackfill } from '../../../utils/analyticsBackfillService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')

  const body = await readBody(event).catch(() => ({}))
  const days = Number(body?.days) || 30

  const result = await runHistoricalAnalyticsBackfill(days)

  return {
    success: true,
    message: `Analytics backfilled successfully for past ${days} days.`,
    ...result,
  }
})
