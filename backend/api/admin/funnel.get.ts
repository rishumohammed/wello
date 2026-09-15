// server/api/admin/funnel.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { getFunnelMetrics } from '../../utils/analyticsEngine'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const startDate = query?.startDate as string | undefined
  const endDate = query?.endDate as string | undefined

  const metrics = getFunnelMetrics(startDate, endDate)

  const initialCount = metrics[0]?.count || 0
  const finalCount = metrics[metrics.length - 1]?.count || 0
  const overallConversion = initialCount > 0 ? Number(((finalCount / initialCount) * 100).toFixed(1)) : 0

  return {
    success: true,
    funnel: metrics,
    summary: {
      totalStarted: initialCount,
      totalCompleted: finalCount,
      overallConversionRate: overallConversion,
      overallDropOffRate: Number((100 - overallConversion).toFixed(1)),
    },
  }
})
