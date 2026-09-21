// backend/api/admin/analytics/tools/scheduled-reports.delete.ts
import { defineEventHandler, getQuery, createError } from 'h3'
import { requirePermission } from '../../../../utils/authGuard'
import { deleteScheduledReport } from '../../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'analytics.view')
  const query = getQuery(event)
  const id = Number(query?.id)

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid report id is required' })
  }

  return await deleteScheduledReport(user.id, id)
})
