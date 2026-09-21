// backend/api/admin/analytics/tools/scheduled-reports.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../../utils/authGuard'
import { getScheduledReports } from '../../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'analytics.view')
  return await getScheduledReports(user.id)
})
