// server/api/admin/config.post.ts
import { defineEventHandler, readBody } from 'h3'
import { updateResendConfig, logAuthEvent } from '../../utils/authConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const updated = updateResendConfig({
    apiKey: body?.apiKey !== undefined ? body.apiKey : undefined,
    fromEmail: body?.fromEmail,
    fromName: body?.fromName,
    otpExpiryMinutes: body?.otpExpiryMinutes,
    requireOtp: body?.requireOtp,
    devMode: body?.devMode,
  })

  logAuthEvent({
    type: 'send_otp',
    email: 'admin',
    status: 'success',
    details: `Admin updated Resend configuration (From: ${updated.fromName} <${updated.fromEmail}>, Expiry: ${updated.otpExpiryMinutes}m, HasKey: ${Boolean(updated.apiKey)})`,
  })

  let maskedKey = ''
  if (updated.apiKey) {
    if (updated.apiKey.length > 8) {
      maskedKey = updated.apiKey.slice(0, 6) + '••••••••••••' + updated.apiKey.slice(-4)
    } else {
      maskedKey = '••••••••'
    }
  }

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
