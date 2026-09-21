// server/api/admin/store/addons.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getAvailableAddons, getStoreAnalytics } from '../../../utils/storeEngine'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.manage')

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
