// backend/api/admin/analytics/addons.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getAddonStoreAnalytics } from '../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')
  return await getAddonStoreAnalytics()
})
