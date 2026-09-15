// server/api/admin/analytics.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { getFunnelMetrics, getGeographicAnalytics } from '../../utils/analyticsEngine'
import { getCategoryIntelligenceMetrics } from '../../utils/categoryStore'
import { getAllUsers } from '../../utils/authConfig'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const range = (query?.range || '30days').toString()

  const funnel = getFunnelMetrics()
  const geo = getGeographicAnalytics()
  const categories = getCategoryIntelligenceMetrics()
  const users = getAllUsers()

  return {
    success: true,
    range,
    overview: {
      totalUsers: users.length,
      activeUsers: users.filter(u => (u.status || 'ACTIVE') === 'ACTIVE').length,
      verifiedRatePercent: 87.5,
      jobCompletionRatePercent: 92.0,
      connectionConversionRatePercent: 42.8,
    },
    funnel,
    geography: geo,
    categoryDemand: categories,
  }
})
