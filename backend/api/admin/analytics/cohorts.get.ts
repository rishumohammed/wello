// backend/api/admin/analytics/cohorts.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getCohortMatrix } from '../../../utils/analyticsMetricsService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')

  const query = getQuery(event)
  const cohortType = (query?.type === 'monthly' ? 'monthly' : 'weekly') as 'weekly' | 'monthly'

  const matrix = await getCohortMatrix(cohortType)
  return {
    success: true,
    cohortType,
    cohorts: matrix,
  }
})
