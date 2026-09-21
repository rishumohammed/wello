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

const verifyOtpSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  identifier: z.string().optional(),
  code: z.string().optional(),
  otp: z.string().optional(),
  name: z.string().optional().default(''),
  serviceCategory: z.string().optional().default(''),
  targetHourly: z.number().or(z.string()).optional(),
  currencyCode: z.string().length(3).optional().default('USD'),
  timezone: z.string().optional().default('UTC'),
  countryCode: z.string().length(2).optional(),
  defaultCountry: z.string().optional().default('US'),
})

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

  // 2. Fetch or create user in MySQL users table
  const dbUser = await getOrCreateDbUser(normalized, name || verification.name || undefined, {
    currency: data.currencyCode,
    timezone: data.timezone,
    country: data.countryCode,
  })

  // 3. Create persistent session in auth_sessions table
  const userAgent = getHeader(event, 'user-agent') || ''
  const ipAddress = getHeader(event, 'x-forwarded-for') || (event.node?.req?.socket?.remoteAddress) || ''

  const session = await createDbSession(dbUser.id, {
    userAgent,
    ipAddress,
  })

  // 4. Set HttpOnly session cookie
  setCookie(event, SESSION_COOKIE_NAME, session.token, getSessionCookieOptions())

  // 5. Retrieve full authenticated user with resolved admin role & permissions
  const authUser = await getAuthenticatedUserByToken(session.token)

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
