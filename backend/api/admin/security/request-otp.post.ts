// server/api/admin/security/request-otp.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requireAdmin } from '../../../utils/authGuard'
import { createAdminActionOtp, isDevAuthAllowed } from '../../../utils/authService'
import { generateOtpEmailHtml, sendEmailViaResend, getResendConfig } from '../../../utils/authConfig'

export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const body = await readBody(event)
  const actionType = (body?.actionType || 'roles').trim()

  // Generate cryptographic 6-digit action OTP
  const { code, expiresAt } = await createAdminActionOtp(admin.email, actionType)

  // Dispatch via email engine
  const emailConfig = getResendConfig()
  let dispatched = false

  if (emailConfig.apiKey) {
    const subject = `[Security Alert] Re-Authentication Code for Admin Action`
    const html = generateOtpEmailHtml(code, admin.name || 'Administrator')
    const result = await sendEmailViaResend({
      to: admin.email,
      subject,
      html,
    })
    dispatched = result.success
  }

  const isDev = isDevAuthAllowed()

  return {
    success: true,
    message: `A 6-digit verification code was dispatched to ${admin.email}.`,
    actionType,
    dispatched,
    devOtp: isDev ? code : undefined,
    expiresInMinutes: 10,
  }
})
