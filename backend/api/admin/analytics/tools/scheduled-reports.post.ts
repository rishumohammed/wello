// backend/api/admin/analytics/tools/scheduled-reports.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requirePermission, extractClientIp } from '../../../../utils/authGuard'
import { createScheduledReport } from '../../../../utils/analyticsAdminService'
import { getDb } from '../../../../utils/db'
import { recordAuditLog } from '../../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'analytics.manage')
  const body = await readBody(event)

  if (!body?.reportName || !Array.isArray(body?.recipientEmails) || body.recipientEmails.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Report name and recipient emails are required' })
  }

  if (body.recipientEmails.length > 10) {
    throw createError({ statusCode: 400, statusMessage: 'Maximum 10 recipient emails allowed for scheduled reports' })
  }

  const db = getDb()
  const cleanEmails = body.recipientEmails.map((e: string) => String(e).trim().toLowerCase()).filter(Boolean)

  // Validate that all recipients are active administrators
  for (const email of cleanEmails) {
    const adminUser = await db('admin_users')
      .where({ email, is_active: true })
      .first()

    if (!adminUser) {
      // Fallback check in users table with role = 'admin'
      const user = await db('users')
        .where({ email, role: 'admin' })
        .whereNull('deleted_at')
        .first()

      if (!user) {
        throw createError({
          statusCode: 400,
          statusMessage: `Recipient '${email}' is not an active platform administrator. Scheduled analytics reports can only be delivered to verified admins.`,
        })
      }
    }
  }

  const result = await createScheduledReport(admin.id, {
    reportName: String(body.reportName).trim(),
    frequency: body.frequency || 'weekly',
    recipientEmails: cleanEmails,
    sections: Array.isArray(body.sections) ? body.sections : ['overview'],
  })

  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: 'ADMIN_SCHEDULED_REPORT_CREATED',
    module: 'Analytics',
    permissionUsed: 'analytics.manage',
    target: `Report "${body.reportName}" (${cleanEmails.join(', ')})`,
    reason: body?.reason || 'Created automated scheduled analytics report',
    ipAddress: extractClientIp(event),
  })

  return result
})

