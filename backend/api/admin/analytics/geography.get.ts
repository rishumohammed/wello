// backend/api/admin/analytics/geography.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getGeographyDevices, AdminAnalyticsFilter } from '../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')

  const query = getQuery(event)
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

  return await getGeographyDevices(filter)
})
