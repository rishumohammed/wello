// backend/api/admin/analytics/security.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getSecuritySignals } from '../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')
  return await getSecuritySignals()
})
