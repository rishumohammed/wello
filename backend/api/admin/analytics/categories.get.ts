// backend/api/admin/analytics/categories.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getCategoryTaxonomyMetrics } from '../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')
  return await getCategoryTaxonomyMetrics()
})
