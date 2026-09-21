// server/utils/authGuard.ts
/**
 * Authentication and Authorization Guards for Nitro / H3 Handlers
 * Enforces authenticated user, admin, and fine-grained permission checks.
 */

import { H3Event, createError, getCookie, getHeader } from 'h3'
import { getAuthenticatedUserByToken, AuthenticatedUser } from './authService'

export const SESSION_COOKIE_NAME = 'wello_session'

export function getSessionCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 30 * 86400, // 30 days
  }
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
 * Ensures request is authenticated with an active user account.
 * Throws 401 if unauthenticated, 403 if account is suspended.
 */
export async function requireUser(event: H3Event): Promise<AuthenticatedUser> {
  // Check if middleware already attached user
  if (event.context.user) {
    const user = event.context.user as AuthenticatedUser
    if (user.status === 'SUSPENDED' || user.status === 'BLOCKED' || user.status === 'INACTIVE') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Account is suspended or inactive.',
      })
    }
    return user
  }

  const token = extractSessionToken(event)
  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required. Please sign in.',
    })
  }

  const user = await getAuthenticatedUserByToken(token)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired session. Please sign in again.',
    })
  }

  if (user.status === 'SUSPENDED' || user.status === 'BLOCKED' || user.status === 'INACTIVE') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Account is suspended or inactive.',
    })
  }

  // Attach to event context for downstream use
  event.context.user = user
  event.context.sessionToken = token
  return user
}

/**
 * Ensures request is made by an administrator.
 * Throws 401 if unauthenticated, 403 if authenticated user is not an admin.
 */
export async function requireAdmin(event: H3Event): Promise<AuthenticatedUser> {
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
  'analytics.read': ['analytics.view', 'analytics.read'],
  'analytics.view': ['analytics.view', 'analytics.read'],
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
  'store.manage': ['settings.manage', 'store.manage'],
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
