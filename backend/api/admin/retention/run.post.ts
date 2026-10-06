import { defineEventHandler, readBody, createError, getRequestHeader } from 'h3'
import { requirePermission, requireStepUpOtp, extractClientIp } from '../../../utils/authGuard'
import { runDataRetentionPurge } from '../../../utils/dataRetentionService'
import { recordAuditLog } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  // 1. Permission check: settings.manage (SUPER_ADMIN only)
  const admin = await requirePermission(event, 'settings.manage')

  // 2. Step-up OTP validation
  await requireStepUpOtp(event, 'retention')

  const body = await readBody(event).catch(() => ({}))
  const reason = (body?.reason || '').trim()

  if (!reason || reason.length < 5) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid business justification reason (minimum 5 characters) is required to execute data retention purge.',
    })
  }

  // 3. Execute data retention purge
  const summary = await runDataRetentionPurge()

  // 4. Record tamper-evident audit log
  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: 'DATA_RETENTION_PURGE_TRIGGERED',
    module: 'Settings',
    permissionUsed: 'settings.manage',
    target: 'System Data Retention',
    reason,
    ipAddress: extractClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent') || 'Admin UI',
    newValue: JSON.stringify(summary),
  })

  return {
    success: true,
    message: 'Data retention cleanup executed successfully.',
    data: {
      summary,
    },
    summary,
  }
})
