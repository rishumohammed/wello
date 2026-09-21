// server/api/auth/send-otp.post.ts
import { z } from 'zod'
import { defineEventHandler, readBody, createError } from 'h3'
import {
  normalizeIdentifier,
  checkOtpRateLimit,
  createDbOtp,
  isDevAuthAllowed,
} from '../../utils/authService'
import {
  generateOtpEmailHtml,
  sendEmailViaResend,
  getResendConfig,
} from '../../utils/authConfig'
import { sendSmsViaProvider, formatOtpSmsBody } from '../../utils/smsEngine'

const sendOtpSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  identifier: z.string().optional(),
  type: z.enum(['login', 'register']).optional().default('login'),
  name: z.string().optional().default(''),
  defaultCountry: z.string().optional().default('US'),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parseResult = sendOtpSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors[0]?.message || 'Please provide a valid email or phone number.',
    })
  }

  const { email, phone, identifier: rawId, type, name: rawName, defaultCountry } = parseResult.data
  const inputTarget = rawId || phone || email || ''
  if (!inputTarget.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide an email address or phone number.',
    })
  }

  const normalized = normalizeIdentifier(inputTarget, defaultCountry)
  const name = rawName.trim()

  // 1. Enforce database-backed rate limit (3 / 10m, 10 / 1hr)
  const rateLimit = await checkOtpRateLimit(normalized.value)
  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: rateLimit.message || 'Too many verification code requests. Please try again later.',
    })
  }

  // 2. Generate cryptographically random 6-digit code & store HMAC in database
  const expiryMinutes = 10
  const otpRecord = await createDbOtp(normalized.value, type, name, expiryMinutes)

  let dispatchSent = false
  let dispatchError: string | null = null

  if (normalized.type === 'phone') {
    // SMS dispatch via Twilio / sandbox engine
    const smsBody = formatOtpSmsBody(otpRecord.code, expiryMinutes)
    const smsResult = await sendSmsViaProvider({
      to: normalized.value,
      body: smsBody,
    })
    dispatchSent = smsResult.success
    if (!smsResult.success) {
      dispatchError = smsResult.error || 'Failed to dispatch SMS.'
    }
  } else {
    // Email dispatch via Resend REST API / sandbox
    const emailConfig = getResendConfig()
    const subject = `Your Wello Verification Code: ${otpRecord.code}`
    const html = generateOtpEmailHtml(otpRecord.code, name || normalized.value.split('@')[0])

    if (emailConfig.apiKey) {
      const emailResult = await sendEmailViaResend({
        to: normalized.value,
        subject,
        html,
      })
      dispatchSent = emailResult.success
      if (!emailResult.success) {
        dispatchError = emailResult.error || 'Failed to dispatch email via Resend.'
      }
    } else {
      dispatchError = 'Email provider in sandbox mode.'
    }
  }

  const devAllowed = isDevAuthAllowed()

  return {
    success: true,
    message: normalized.type === 'phone'
      ? `Verification code sent to ${normalized.value}.`
      : `Verification code sent to ${normalized.value}. Please check your inbox.`,
    identifier: normalized.value,
    type: normalized.type,
    expiresInMinutes: expiryMinutes,
    dispatched: dispatchSent,
    devOtp: devAllowed ? otpRecord.code : undefined,
    notice: dispatchError,
  }
})
