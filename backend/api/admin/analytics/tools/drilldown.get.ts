// backend/api/admin/analytics/tools/drilldown.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../../../utils/authGuard'
import { getUserDrilldown, AdminAnalyticsFilter } from '../../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'analytics.view')
  const query = getQuery(event)

  const segmentKey = (query?.segmentKey as string) || 'activated'
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

  return await getUserDrilldown(segmentKey, filter, user.adminRole || user.role)
})
