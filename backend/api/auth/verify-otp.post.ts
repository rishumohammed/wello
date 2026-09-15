// server/api/auth/verify-otp.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import {
  verifyOtpCode,
  getOrCreateUser,
  logAuthEvent,
} from '../../utils/authConfig'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const email = (body?.email || '').trim().toLowerCase()
  const code = (body?.otp || body?.code || '').toString().trim()
  const name = (body?.name || '').trim()
  const serviceCategory = (body?.serviceCategory || '').trim()
  const targetHourly = Number(body?.targetHourly) || 350

  if (!email || !code) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email and 6-digit verification code are required.',
    })
  }

  const verification = verifyOtpCode(email, code)

  if (!verification.valid) {
    logAuthEvent({
      type: 'verify_failed',
      email,
      status: 'failed',
      details: `Failed OTP attempt for ${email}: ${verification.error}`,
    })

    throw createError({
      statusCode: 400,
      statusMessage: verification.error || 'Invalid verification code.',
    })
  }

  // OTP is valid -> get or create user
  const user = getOrCreateUser(email, name || verification.record?.name, serviceCategory)
  if (targetHourly && targetHourly > 0) {
    user.targetHourly = targetHourly
  }

  // Create simple auth session token
  const token = 'wello_tk_' + Math.random().toString(36).slice(2) + Date.now().toString(36)

  logAuthEvent({
    type: verification.record?.type === 'register' ? 'register_success' : 'login_success',
    email,
    status: 'success',
    details: `User ${user.name} (${email}) authenticated successfully.`,
  })

  return {
    success: true,
    message: 'Authentication successful',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarInitials: user.avatarInitials,
      targetHourly: user.targetHourly,
      role: user.role,
      serviceCategory: user.serviceCategory,
    },
  }
})
