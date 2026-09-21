// backend/api/admin/analytics/rollups/run.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '../../../../utils/authGuard'
import { buildDailyRollup, recalculateCohorts, recalculateUserSummaries } from '../../../../utils/analyticsRollupService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')

  const body = await readBody(event).catch(() => ({}))
  const targetDate = body?.date as string | undefined

  const rollupResult = await buildDailyRollup(targetDate)
  const cohortsResult = await recalculateCohorts('weekly')
  const summariesResult = await recalculateUserSummaries()

  return {
    success: true,
    rollup: rollupResult,
    cohorts: cohortsResult,
    summaries: summariesResult,
  }
})
