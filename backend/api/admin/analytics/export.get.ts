// backend/api/admin/analytics/export.get.ts
import { defineEventHandler, getQuery, setHeader, createError } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import {
  AdminAnalyticsFilter,
  convertToCsv,
  getAdminOverview,
  getAcquisitionFunnel,
  getRetentionHeatmap,
  getEngagementAdoption,
  getWorkValueInsights,
  getCategoryTaxonomyMetrics,
  getInvoicingIntelligence,
  getAddonStoreAnalytics,
  getGeographyDevices,
  getMessagingAnalytics,
  getSecuritySignals,
  getSystemHealthObservability,
  getOperationsBacklog,
} from '../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')

  const query = getQuery(event)
  const section = (query?.section as string) || 'overview'
  const format = (query?.format as string) === 'json' ? 'json' : 'csv'

  const filter: AdminAnalyticsFilter = {
    range: (query?.range as string) || '30d',
    startDate: query?.startDate as string,
    endDate: query?.endDate as string,
    compare: query?.compare === 'true' || query?.compare === true,
    granularity: query?.granularity as 'day' | 'week' | 'month',
    country: query?.country as string,
    category: query?.category as string,
    platform: query?.platform as string,
    utmSource: query?.utmSource as string,
    addonKey: query?.addonKey as string,
    timezone: (query?.timezone as string) || 'UTC',
  }

  let data: any
  let exportRows: any[] = []

  switch (section) {
    case 'overview': {
      data = await getAdminOverview(filter)
      exportRows = data.dailyTrends || []
      break
    }
    case 'funnel': {
      data = await getAcquisitionFunnel(filter)
      exportRows = data.steps || []
      break
    }
    case 'retention': {
      data = await getRetentionHeatmap(filter)
      exportRows = data.cohorts || []
      break
    }
    case 'engagement': {
      data = await getEngagementAdoption(filter)
      exportRows = data.moduleAdoption || []
      break
    }
    case 'work-value': {
      data = await getWorkValueInsights(filter)
      exportRows = data.ratesByCategory || []
      break
    }
    case 'categories': {
      data = await getCategoryTaxonomyMetrics()
      exportRows = data.categories || []
      break
    }
    case 'invoicing': {
      data = await getInvoicingIntelligence(filter)
      exportRows = data.topCountries || []
      break
    }
    case 'addons': {
      data = await getAddonStoreAnalytics()
      exportRows = data.addons || []
      break
    }
    case 'geography': {
      data = await getGeographyDevices(filter)
      exportRows = data.topCountries || []
      break
    }
    case 'messaging': {
      data = await getMessagingAnalytics()
      exportRows = data.emailLogs || []
      break
    }
    case 'security': {
      data = await getSecuritySignals()
      exportRows = data.suspiciousIps || []
      break
    }
    case 'system-health': {
      data = await getSystemHealthObservability()
      exportRows = data.routes || []
      break
    }
    case 'operations': {
      data = await getOperationsBacklog()
      exportRows = [data]
      break
    }
    default: {
      data = await getAdminOverview(filter)
      exportRows = data.dailyTrends || []
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

  if (format === 'json') {
    setHeader(event, 'Content-Type', 'application/json')
    setHeader(event, 'Content-Disposition', `attachment; filename="analytics_${section}_${timestamp}.json"`)
    return {
      section,
      exportedAt: new Date().toISOString(),
      filter,
      data,
    }
  }

  // Format as CSV
  const csvContent = convertToCsv(exportRows.length > 0 ? exportRows : [{ section, exportedAt: new Date().toISOString(), status: 'no_rows' }])
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="analytics_${section}_${timestamp}.csv"`)
  return csvContent
})
