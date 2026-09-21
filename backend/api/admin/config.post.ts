// server/api/admin/config.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { updateResendConfig } from '../../utils/authConfig'
import { recordAuditLog } from '../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'settings.manage')
  const body = await readBody(event)

  const updated = updateResendConfig({
    apiKey: body?.apiKey !== undefined ? body.apiKey : undefined,
    fromEmail: body?.fromEmail,
    fromName: body?.fromName,
    otpExpiryMinutes: body?.otpExpiryMinutes,
    requireOtp: body?.requireOtp,
    devMode: body?.devMode,
  })

  let maskedKey = ''
  if (updated.apiKey) {
    if (updated.apiKey.length > 8) {
      maskedKey = updated.apiKey.slice(0, 6) + '••••••••••••' + updated.apiKey.slice(-4)
    } else {
      maskedKey = '••••••••'
    }
  }

  recordAuditLog({
    adminEmail: admin.email,
    action: 'SYSTEM_CONFIG_UPDATED',
    module: 'Settings',
    target: 'Communications & System Config',
    newValue: `From: ${updated.fromName} <${updated.fromEmail}>, Expiry: ${updated.otpExpiryMinutes}m, HasKey: ${Boolean(updated.apiKey)}`,
  })

  return {
    success: true,
    message: 'Configuration updated successfully.',
    config: {
      hasKey: Boolean(updated.apiKey),
      maskedKey,
      fromEmail: updated.fromEmail,
      fromName: updated.fromName,
      otpExpiryMinutes: updated.otpExpiryMinutes,
      requireOtp: updated.requireOtp,
      devMode: updated.devMode,
    },
  }
})
