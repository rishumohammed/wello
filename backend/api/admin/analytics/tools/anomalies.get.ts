// backend/api/admin/analytics/tools/anomalies.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../../utils/authGuard'
import { getAnomalySignals } from '../../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')
  return await getAnomalySignals()
})
