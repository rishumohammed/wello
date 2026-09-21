// server/api/admin/analytics.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getAdminAnalyticsOverview } from '../../utils/analyticsMetricsService'
import { evaluateFunnel } from '../../utils/analyticsRollupService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')

  const query = getQuery(event)
  const range = (query?.range || '30days').toString()

  const [overview, funnelData] = await Promise.all([
    getAdminAnalyticsOverview(range),
    evaluateFunnel('default_activation_funnel').catch(() => null),
  ])

  // Map to legacy funnel format for backwards compatibility
  const legacyFunnel = funnelData?.steps?.map(s => ({
    stageKey: s.stepKey,
    stageName: s.stepName,
    count: s.count,
    conversionRate: s.conversionRate,
    dropOffRate: s.dropOffRate,
  })) || []

  return {
    success: true,
    range,
    overview: {
      totalUsers: overview.kpis.totalUsers,
      activeUsers: overview.kpis.activeUsers,
      dau: overview.kpis.dau,
      wau: overview.kpis.wau,
      mau: overview.kpis.mau,
      stickinessPercent: overview.kpis.stickinessPercent,
      activationRatePercent: overview.kpis.activationRatePercent,
      avgTimeToActivateHours: overview.kpis.avgTimeToActivateHours,
      churnRatePercent: overview.kpis.churnRatePercent,
      totalHoursTracked: overview.kpis.totalHoursTracked,
      totalRevenueTrackedUsd: overview.kpis.totalRevenueTrackedUsd,
    },
    funnel: legacyFunnel,
    geography: overview.geography,
    categoryDemand: overview.categoryDemand,
    kpis: overview.kpis,
    dailyTrend: overview.dailyTrend,
    featureAdoption: overview.featureAdoption,
  }
})
