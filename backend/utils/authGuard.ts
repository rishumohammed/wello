// server/utils/authGuard.ts
/**
 * Authentication and Authorization Guards for Nitro / H3 Handlers
 * Enforces authenticated user, admin, fine-grained RBAC permissions,
 * read-only impersonation enforcement, and IP allowlisting.
 */

import { H3Event, createError, getCookie, getHeader, getRequestHeader, getMethod } from 'h3'
import { getAuthenticatedUserByToken, AuthenticatedUser } from './authService'

export const SESSION_COOKIE_NAME = 'wello_session'

export function getSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 86400, // 30 days for regular users
  }
}

/**
 * Extracts client IP address from request headers or socket
 */
export function extractClientIp(event: H3Event): string {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = getRequestHeader(event, 'x-real-ip') || getRequestHeader(event, 'cf-connecting-ip')
  if (realIp) return realIp.trim()

  return event.node?.req?.socket?.remoteAddress || '127.0.0.1'
}

/**
 * Extracts session token from incoming request event via cookie or Authorization header.
 */
export function extractSessionToken(event: H3Event): string | null {
  // 1. Check HTTP-only cookie
  const cookieToken = getCookie(event, SESSION_COOKIE_NAME)
  if (cookieToken) return cookieToken

  // 2. Check Authorization Bearer header
  const authHeader = getHeader(event, 'authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim()
  }

  // 3. Check custom header x-session-token
  const customHeader = getHeader(event, 'x-session-token')
  if (customHeader) return customHeader.trim()

  return null
}

/**
 * Verifies optional IP allowlist for admin routes
 */
export function checkAdminIpAllowlist(event: H3Event): void {
  const allowlistConfig = (process.env.ADMIN_IP_ALLOWLIST || '').trim()
  if (!allowlistConfig) return

  const clientIp = extractClientIp(event)
  const allowedIps = allowlistConfig.split(',').map(s => s.trim().toLowerCase())

  const isAllowed = allowedIps.some(ip => {
    if (ip === clientIp || ip === '127.0.0.1' && (clientIp === '::1' || clientIp === '::ffff:127.0.0.1')) return true
    if (clientIp.startsWith(ip)) return true
    return false
  })

  if (!isAllowed) {
    throw createError({
      statusCode: 403,
      statusMessage: `Access denied. Admin access restricted from IP: ${clientIp}`,
    })
  }
}

/**
 * Ensures request is authenticated with an active user account.
 * Throws 401 if unauthenticated, 403 if account is suspended or if mutating during impersonation.
 */
export async function requireUser(event: H3Event): Promise<AuthenticatedUser> {
  let user: AuthenticatedUser | null = null

  if (event.context.user) {
    user = event.context.user as AuthenticatedUser
  } else {
    const token = extractSessionToken(event)
    if (!token) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentication required. Please sign in.',
      })
    }

    user = await getAuthenticatedUserByToken(token)
    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid or expired session. Please sign in again.',
      })
    }

    event.context.user = user
    event.context.sessionToken = token
  }

  if (user.status === 'SUSPENDED' || user.status === 'BLOCKED' || user.status === 'INACTIVE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Account is suspended or inactive.',
    })
  }

  // ─── Enforce Read-Only Impersonation Mode ──────────────────────────────────
  if (user.isImpersonation) {
    const method = (event.method || getMethod(event) || 'GET').toUpperCase()
    const rawPath = event.path || event.node?.req?.url || ''
    const cleanPath = rawPath.split('?')[0].toLowerCase()

    // 1. Strict empty allow-list for non-GET: only exit and single-session logout are allowed
    const isExempt = cleanPath === '/api/auth/impersonate/exit' || cleanPath === '/api/auth/logout'
    if (method !== 'GET' && method !== 'HEAD' && !isExempt) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Read-only impersonation mode: mutations are strictly prohibited.',
      })
    }

    // 2. Block export and document downloading during impersonation
    if (cleanPath.includes('/api/export') || cleanPath.includes('/pdf') || cleanPath.includes('/reports/export')) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Export and document downloading is disabled during impersonation sessions.',
      })
    }

    // 3. Record audit entry for every request made during impersonation
    try {
      const { recordAuditLog } = await import('./auditStore')
      recordAuditLog({
        adminEmail: user.impersonatorEmail || 'support@wello.com',
        actorId: user.impersonationAdminId || undefined,
        action: 'IMPERSONATION_REQUEST',
        module: 'Impersonation',
        permissionUsed: 'users.impersonate',
        target: `${user.email} -> ${method} ${cleanPath}`,
        ipAddress: extractClientIp(event),
        userAgent: getRequestHeader(event, 'user-agent') || 'Impersonation Session',
      }).catch(() => {})
    } catch (_) {}
  }

  return user
}

/**
 * Checks whether financial numbers should be masked for the given user context
 */
export function shouldMaskFinancials(user?: AuthenticatedUser | null): boolean {
  if (!user) return false
  return Boolean(user.isImpersonation && !user.hasImpersonationFinancialView)
}

/**
 * Returns authenticated user if session token is valid, or null if unauthenticated.
 */
export async function getOptionalUser(event: H3Event): Promise<AuthenticatedUser | null> {
  if (event.context.user) return event.context.user as AuthenticatedUser
  const token = extractSessionToken(event)
  if (!token) return null
  return await getAuthenticatedUserByToken(token)
}

/**
 * Ensures request is made by an administrator.
 * Throws 401 if unauthenticated, 403 if authenticated user is not an admin.
 */
export async function requireAdmin(event: H3Event): Promise<AuthenticatedUser> {
  checkAdminIpAllowlist(event)
  const user = await requireUser(event)

  if (user.role !== 'admin' && !user.adminRole) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Administrator access required.',
    })
  }

  return user
}

const PERMISSION_ALIASES: Record<string, string[]> = {
  'users.read': ['users.view', 'users.manage'],
  'users.view': ['users.view', 'users.manage'],
  'users.write': ['users.manage', 'users.suspend'],
  'users.manage': ['users.manage'],
  'users.suspend': ['users.suspend', 'users.manage'],
  'users.financial_view': ['users.financial_view'],
  'users.impersonate': ['users.impersonate'],
  'analytics.read': ['analytics.view'],
  'analytics.view': ['analytics.view'],
  'analytics.export': ['analytics.export'],
  'analytics.manage': ['analytics.manage'],
  'jobs.view': ['jobs.view', 'jobs.moderate'],
  'jobs.moderate': ['jobs.moderate'],
  'jobs.manage': ['jobs.moderate'],
  'logs.read': ['audit_logs.view'],
  'audit_logs.view': ['audit_logs.view'],
  'roles.read': ['admins.manage'],
  'roles.write': ['admins.manage'],
  'admins.manage': ['admins.manage'],
  'categories.manage': ['categories.manage'],
  'categories.read': ['categories.view', 'categories.manage'],
  'categories.view': ['categories.view', 'categories.manage'],
  'category_requests.manage': ['category_requests.manage', 'categories.manage'],
  'settings.manage': ['settings.manage'],
  'scheduler.manage': ['scheduler.manage'],
  'email.manage': ['email.manage'],
  'store.manage': ['store.manage', 'settings.manage'],
  'feedback.view': ['feedback.view', 'feedback.manage'],
  'feedback.manage': ['feedback.manage'],
  'system.view': ['system.view'],
}

/**
 * Ensures request is made by an administrator with the specified permission.
 * SUPER_ADMIN role bypasses individual permission checks.
 */
export async function requirePermission(event: H3Event, permissionKey: string): Promise<AuthenticatedUser> {
  const user = await requireAdmin(event)

  if (user.adminRole === 'SUPER_ADMIN') {
    return user
  }

  const aliases = PERMISSION_ALIASES[permissionKey] || [permissionKey]
  const userPerms = user.adminPermissions || []

  const hasPerm = aliases.some(alias => userPerms.includes(alias)) || userPerms.includes(permissionKey)

  if (!hasPerm) {
    throw createError({
      statusCode: 403,
      statusMessage: `Access denied. Required permission: ${permissionKey}`,
    })
  }

  return user
}

/**
 * Ensures request provides a valid step-up action OTP for high-sensitivity administrative mutations.
 */
export async function requireStepUpOtp(event: H3Event, actionType: string = 'reauth'): Promise<AuthenticatedUser> {
  const user = await requireAdmin(event)

  const { isDevAuthAllowed } = await import('./authService')
  const isDev = isDevAuthAllowed()

  // 1. Extract OTP from headers or body
  const headerOtp = getHeader(event, 'x-admin-otp') ||
                    getHeader(event, 'x-step-up-otp') ||
                    getHeader(event, 'x-otp')

  let bodyOtp: string | null = null
  let requireOtpFlag = false
  try {
    const { readBody } = await import('h3')
    const body = await readBody(event).catch(() => ({}))
    if (body) {
      bodyOtp = body.otpCode || body.stepUpOtp || body.otp || body.reauthOtp || null
      requireOtpFlag = Boolean(body.requireOtp || body.requireStepUpOtp)
    }
  } catch (_) {}

  const code = (headerOtp || bodyOtp || '').trim()

  // In test / dev mode, allow bypass unless explicitly requested or code is provided
  if (isDev && !code && !requireOtpFlag && getHeader(event, 'x-enforce-step-up') !== 'true') {
    return user
  }

  if (!code || code.length < 6) {
    throw createError({
      statusCode: 403,
      statusMessage: `Step-up authentication required: valid 6-digit action OTP is missing or invalid for action '${actionType}'. Please request an OTP via POST /api/admin/security/request-otp`,
      data: { code: 'STEP_UP_OTP_REQUIRED', actionType, reauthRequired: true },
    })
  }

  // 2. Verify against database OTP records
  const { verifyAdminActionOtp } = await import('./authService')
  const result = await verifyAdminActionOtp(user.email, code, actionType)

  if (!result.valid) {
    // Fallback check with generic actionType if specific one didn't match
    const fallbackResult = await verifyAdminActionOtp(user.email, code, 'roles')
    if (!fallbackResult.valid) {
      throw createError({
        statusCode: 403,
        statusMessage: result.error || 'Invalid or expired step-up verification code.',
        data: { code: 'STEP_UP_OTP_INVALID', actionType, reauthRequired: true },
      })
    }
  }

  // 3. Record audit log for successful step-up authentication
  try {
    const { recordAuditLog } = await import('./auditStore')
    recordAuditLog({
      adminEmail: user.email,
      actorId: user.id,
      action: 'ADMIN_STEP_UP_VERIFIED',
      module: 'Security',
      permissionUsed: 'admins.manage',
      target: `Action: ${actionType}`,
      ipAddress: extractClientIp(event),
      userAgent: getRequestHeader(event, 'user-agent') || 'Admin UI',
    }).catch(() => {})
  } catch (_) {}

  return user
}
