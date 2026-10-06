// backend/api/admin/analytics/tools/scheduled-reports.delete.ts
import { defineEventHandler, getQuery, createError } from 'h3'
import { requirePermission, extractClientIp } from '../../../../utils/authGuard'
import { deleteScheduledReport } from '../../../../utils/analyticsAdminService'
import { recordAuditLog } from '../../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'analytics.manage')
  const query = getQuery(event)
  const id = Number(query?.id)

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid report id is required' })
  }

  const result = await deleteScheduledReport(admin.id, id)

  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: 'ADMIN_SCHEDULED_REPORT_DELETED',
    module: 'Analytics',
    permissionUsed: 'analytics.manage',
    target: `Scheduled Report #${id}`,
    reason: (query?.reason as string) || 'Deleted scheduled report',
    ipAddress: extractClientIp(event),
  })

  return result
})

