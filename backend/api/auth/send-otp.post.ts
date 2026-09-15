// server/api/auth/send-otp.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import {
  createOtp,
  generateOtpEmailHtml,
  sendEmailViaResend,
  logAuthEvent,
  getResendConfig,
} from '../../utils/authConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = (body?.email || '').trim().toLowerCase()
  const type = body?.type === 'register' ? 'register' : 'login'
  const name = body?.name ? body.name.trim() : ''

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide a valid email address.',
    })
  }

  // Generate 6-digit OTP
  const otpRecord = createOtp(email, type, name)
  const config = getResendConfig()

  // Format email
  const subject = `Your Wello Verification Code: ${otpRecord.code}`
  const html = generateOtpEmailHtml(otpRecord.code, name || email.split('@')[0])

  let emailSent = false
  let emailError: string | null = null
  let providerResponse: any = null

  if (config.apiKey) {
    // Attempt dispatch via Resend REST API
    const resendResult = await sendEmailViaResend({
      to: email,
      subject,
      html,
    })

    emailSent = resendResult.success
    providerResponse = resendResult.data
    if (!resendResult.success) {
      emailError = resendResult.error || 'Failed to dispatch email via Resend.'
    }
  } else {
    emailError = 'Resend API Key is not set in Admin Panel. Operating in local sandbox mode.'
  }

  // Log the event
  logAuthEvent({
    type: 'send_otp',
    email,
    status: emailSent ? 'success' : (config.devMode ? 'pending' : 'failed'),
    details: emailSent
      ? `OTP ${otpRecord.code} sent via Resend API to ${email}`
      : `OTP generated in dev sandbox: ${otpRecord.code}. (${emailError})`,
    providerResponse,
  })

  return {
    success: true,
    message: emailSent
      ? `Verification code sent to ${email}. Please check your inbox.`
      : (config.devMode
        ? `Verification code generated! (Dev Sandbox: ${otpRecord.code})`
        : `Verification code generated for ${email}.`),
    email,
    expiresInMinutes: config.otpExpiryMinutes,
    emailSent,
    devOtp: config.devMode ? otpRecord.code : undefined,
    emailNotice: emailError,
  }
})
