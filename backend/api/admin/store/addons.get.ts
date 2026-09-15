// server/api/admin/store/addons.get.ts
import { defineEventHandler, getQuery, createError } from 'h3'
import { getAvailableAddons, getStoreAnalytics } from '../../../utils/storeEngine'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const role = (query?.role as string) || 'admin'

  if (role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admin access required.' })
  }

  const addons = getAvailableAddons(true) // include drafts & archived
  const analytics = getStoreAnalytics()

  const addonsWithStats = addons.map(a => ({
    ...a,
    stats: analytics.adoptionMap[a.id] || { totalUsers: 0, activeUsers: 0, usageCount: 0 }
  }))

  return {
    success: true,
    addons: addonsWithStats,
    analytics,
  }
})
