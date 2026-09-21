// server/api/admin/config.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getResendConfig } from '../../utils/authConfig'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'settings.manage')
  const config = getResendConfig()

  // Mask API key for security (e.g. re_abc123...xyz)
  let maskedKey = ''
  if (config.apiKey) {
    if (config.apiKey.length > 8) {
      maskedKey = config.apiKey.slice(0, 6) + '••••••••••••' + config.apiKey.slice(-4)
    } else {
      maskedKey = '••••••••'
    }
  }

  return {
    success: true,
    config: {
      hasKey: Boolean(config.apiKey),
      maskedKey,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      otpExpiryMinutes: config.otpExpiryMinutes,
      requireOtp: config.requireOtp,
      devMode: config.devMode,
    },
  }
})
