// backend/api/admin/analytics/tools/scheduled-reports.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requirePermission } from '../../../../utils/authGuard'
import { createScheduledReport } from '../../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'analytics.view')
  const body = await readBody(event)

  if (!body?.reportName || !Array.isArray(body?.recipientEmails) || body.recipientEmails.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Report name and recipient emails are required' })
  }

  return await createScheduledReport(user.id, {
    reportName: body.reportName,
    frequency: body.frequency || 'weekly',
    recipientEmails: body.recipientEmails,
    sections: body.sections || ['overview'],
  })
})
