// backend/api/admin/analytics/operations.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getOperationsBacklog } from '../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')
  return await getOperationsBacklog()
})
