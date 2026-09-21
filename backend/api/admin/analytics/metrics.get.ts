// backend/api/admin/analytics/metrics.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import {
  getDauWauMau,
  getActivationMetrics,
  getFeatureAdoptionMetrics,
} from '../../../utils/analyticsMetricsService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')

  const query = getQuery(event)
  const filter = {
    startDate: query?.startDate as string | undefined,
    endDate: query?.endDate as string | undefined,
    country: query?.country as string | undefined,
    platform: query?.platform as string | undefined,
  }

  const [dauWauMau, activation, adoption] = await Promise.all([
    getDauWauMau(filter),
    getActivationMetrics(filter),
    getFeatureAdoptionMetrics(),
  ])

  return {
    success: true,
    activity: dauWauMau,
    activation,
    adoption,
  }
})
