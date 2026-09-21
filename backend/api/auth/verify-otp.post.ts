// server/api/auth/verify-otp.post.ts
import { z } from 'zod'
import { defineEventHandler, readBody, createError, setCookie, getHeader } from 'h3'
import {
  normalizeIdentifier,
  verifyDbOtp,
  getOrCreateDbUser,
  createDbSession,
  getAuthenticatedUserByToken,
} from '../../utils/authService'
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
} from '../../utils/authGuard'
import { logAnalyticsEvent } from '../../utils/analyticsService'

import { requireRateLimit, resetRateLimit } from '../../utils/rateLimiter'

const verifyOtpSchema = z.object({
  email: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  identifier: z.string().max(255).optional(),
  code: z.string().max(20).optional(),
  otp: z.string().max(20).optional(),
  name: z.string().max(100).optional().default(''),
  serviceCategory: z.string().max(100).optional().default(''),
  targetHourly: z.number().or(z.string()).optional(),
  currencyCode: z.string().length(3).optional().default('USD'),
  timezone: z.string().max(50).optional().default('UTC'),
  countryCode: z.string().max(2).optional(),
  defaultCountry: z.string().max(10).optional().default('US'),
}).strict()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parseResult = verifyOtpSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors[0]?.message || 'Verification code and identifier are required.',
    })
  }

  const data = parseResult.data
  const inputTarget = data.identifier || data.phone || data.email || ''
  const code = (data.otp || data.code || '').trim()
  const name = data.name.trim()
  const defaultCountry = data.defaultCountry || 'US'

  if (!inputTarget.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide an email address or phone number.',
    })
  }

  if (!code) {
    throw createError({
      statusCode: 400,
      statusMessage: '6-digit verification code is required.',
    })
  }

  const normalized = normalizeIdentifier(inputTarget, defaultCountry)

  // Enforce distributed rate limit on verification attempts (10 attempts / 10m)
  await requireRateLimit(event, {
    keyPrefix: 'auth_verify_otp',
    limit: 10,
    windowSeconds: 600,
    identifier: normalized.value,
    customErrorMessage: 'Too many invalid verification attempts. Please wait before retrying.',
  })

  // 1. Verify code against MySQL otp_codes table
  let verification = await verifyDbOtp(normalized.value, code, 'login')
  if (!verification.valid) {
    // Retry with 'register' purpose in case it was requested as register
    const regVerification = await verifyDbOtp(normalized.value, code, 'register')
    if (regVerification.valid) {
      verification = regVerification
    }
  }

  if (!verification.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: verification.error || 'Invalid or expired verification code.',
    })
  }

  // Clear rate limits on successful authentication
  await resetRateLimit(`rl:auth_verify_otp:${normalized.value.toLowerCase()}`)
  await resetRateLimit(`rl:auth_send_otp:${normalized.value.toLowerCase()}`)

  // 2. Fetch or create user in MySQL users table
  const dbUser = await getOrCreateDbUser(normalized, name || verification.name || undefined, {
    currency: data.currencyCode,
    timezone: data.timezone,
    country: data.countryCode,
  })

  // 3. Create persistent session in auth_sessions table
  const userAgent = getHeader(event, 'user-agent') || ''
  const ipAddress = getHeader(event, 'x-forwarded-for') || (event.node?.req?.socket?.remoteAddress) || ''

  const isAdminUser = dbUser.role === 'admin' || dbUser.email === 'admin@wello.com'
  const session = await createDbSession(dbUser.id, {
    userAgent,
    ipAddress,
    isAdmin: isAdminUser,
  })

  // 4. Set HttpOnly session cookie
  setCookie(event, SESSION_COOKIE_NAME, session.token, getSessionCookieOptions())

  // Log analytics event
  await logAnalyticsEvent(dbUser.id, 'otp_verified', {
    auth_type: normalized.type,
    country: data.countryCode || dbUser.country,
  }, false, {
    country: data.countryCode || dbUser.country || undefined,
    timezone: data.timezone || dbUser.timezone || undefined,
  })

  // 5. Retrieve full authenticated user with resolved admin role & permissions
  const authUser = await getAuthenticatedUserByToken(session.token)

  // 6. If administrator, record audit log and trigger login security alert
  if (authUser?.role === 'admin' || authUser?.adminRole) {
    await recordAuditLog({
      adminEmail: authUser.email,
      actorId: authUser.id,
      action: 'ADMIN_LOGIN',
      module: 'Security',
      permissionUsed: 'audit_logs.view',
      target: authUser.email,
      ipAddress,
      userAgent,
      newValue: `Admin sign-in successful (Role: ${authUser.adminRole || 'ADMIN'}). Session valid for 4 hours.`,
    })

    pushAdminNotification({
      type: 'SECURITY_ALERT',
      title: 'Administrator Sign-In Detected',
      message: `Admin ${authUser.email} logged in from IP ${ipAddress || '127.0.0.1'}.`,
    })
  }

  return {
    success: true,
    message: 'Authentication successful',
    token: session.token,
    user: {
      id: authUser?.id || dbUser.id,
      name: authUser?.name || dbUser.name,
      email: authUser?.email || dbUser.email,
      phone: authUser?.phone_e164 || dbUser.phone_e164,
      avatarInitials: authUser?.avatar_initials || dbUser.avatar_initials,
      targetHourly: authUser?.target_hourly || dbUser.target_hourly,
      currencyCode: authUser?.base_currency || dbUser.base_currency,
      timezone: authUser?.timezone || dbUser.timezone,
      countryCode: authUser?.country || dbUser.country,
      role: authUser?.role || dbUser.role,
      adminRole: authUser?.adminRole,
      adminPermissions: authUser?.adminPermissions || [],
      status: authUser?.status || dbUser.status,
    },
  }
})
