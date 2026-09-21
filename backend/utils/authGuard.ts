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
    const path = event.path || event.node?.req?.url || ''

    // Allow GET / HEAD requests, and specific exit/logout endpoints
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
    const isExempt = path.includes('/api/auth/impersonate/exit') || path.includes('/api/auth/logout')

    if (isMutation && !isExempt) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Read-only impersonation mode: mutations are strictly prohibited.',
      })
    }
  }

  return user
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
  'users.read': ['users.view', 'users.manage', 'users.read'],
  'users.view': ['users.view', 'users.manage', 'users.read'],
  'users.write': ['users.manage', 'users.suspend', 'users.write'],
  'users.manage': ['users.manage', 'users.write'],
  'users.suspend': ['users.suspend', 'users.manage', 'users.write'],
  'users.financial_view': ['users.financial_view'],
  'users.impersonate': ['users.impersonate'],
  'analytics.read': ['analytics.view', 'analytics.read'],
  'analytics.view': ['analytics.view', 'analytics.read'],
  'analytics.export': ['analytics.export', 'analytics.view'],
  'jobs.view': ['jobs.view', 'jobs.manage'],
  'jobs.manage': ['jobs.manage'],
  'logs.read': ['audit_logs.view', 'logs.read'],
  'audit_logs.view': ['audit_logs.view', 'logs.read'],
  'roles.read': ['admins.manage', 'roles.read', 'roles.write'],
  'roles.write': ['admins.manage', 'roles.write'],
  'admins.manage': ['admins.manage', 'roles.write'],
  'categories.manage': ['categories.manage'],
  'categories.read': ['categories.view', 'categories.manage', 'categories.read'],
  'categories.view': ['categories.view', 'categories.manage', 'categories.read'],
  'category_requests.manage': ['category_requests.manage', 'categories.manage'],
  'settings.manage': ['settings.manage'],
  'email.manage': ['email.manage'],
  'store.manage': ['store.manage', 'settings.manage'],
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
