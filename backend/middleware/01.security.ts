// backend/middleware/01.security.ts
/**
 * Global HTTP Security Headers, CSRF Protection, Request Tracing & Error Protection Middleware
 */

import { defineEventHandler, setResponseHeader, getRequestHeader, getRequestPath, getMethod, createError } from 'h3'
import crypto from 'node:crypto'

const ALLOWED_METHODS_SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

function getAllowedOrigins(): Set<string> {
  const list = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']
  if (process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN.split(',').forEach(o => list.push(o.trim().toLowerCase()))
  }
  if (process.env.APP_URL) {
    list.push(process.env.APP_URL.trim().toLowerCase())
  }
  return new Set(list.map(o => o.replace(/\/$/, '')))
}

export default defineEventHandler((event) => {
  // 1. Generate or propagate unique correlation Request ID
  const incomingReqId = getRequestHeader(event, 'x-request-id')
  const requestId = incomingReqId && incomingReqId.length <= 64 ? incomingReqId : `req_${crypto.randomUUID()}`
  event.context.requestId = requestId
  setResponseHeader(event, 'x-request-id', requestId)

  // 2. Defense-in-Depth Security Headers
  setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
  setResponseHeader(event, 'X-Frame-Options', 'DENY')
  setResponseHeader(event, 'X-XSS-Protection', '1; mode=block')
  setResponseHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')
  setResponseHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  setResponseHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  setResponseHeader(event, 'X-Permitted-Cross-Domain-Policies', 'none')
  setResponseHeader(event, 'Cross-Origin-Opener-Policy', 'same-origin')

  // 3. Content Security Policy (CSP)
  const isUploadRoute = getRequestPath(event).startsWith('/api/uploads')
  if (!isUploadRoute) {
    setResponseHeader(
      event,
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://api.resend.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
    )
  }

  // 4. CSRF Protection for Cookie-Authenticated State-Changing Requests
  const method = (getMethod(event) || 'GET').toUpperCase()
  if (!ALLOWED_METHODS_SAFE.has(method)) {
    const authHeader = getRequestHeader(event, 'authorization')
    const hasBearer = authHeader && authHeader.toLowerCase().startsWith('bearer ')
    const cookieHeader = getRequestHeader(event, 'cookie')

    // If request relies on cookie authentication (not Bearer authorization header)
    if (!hasBearer && cookieHeader && (cookieHeader.includes('wello_token') || cookieHeader.includes('wello_session'))) {
      const origin = getRequestHeader(event, 'origin')
      const referer = getRequestHeader(event, 'referer')

      let requestOrigin = ''
      if (origin) {
        requestOrigin = origin.trim().toLowerCase().replace(/\/$/, '')
      } else if (referer) {
        try {
          const parsed = new URL(referer)
          requestOrigin = parsed.origin.toLowerCase().replace(/\/$/, '')
        } catch {
          // invalid referer url
        }
      }

      if (requestOrigin) {
        const allowedOrigins = getAllowedOrigins()
        if (!allowedOrigins.has(requestOrigin)) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Cross-site request blocked (CSRF protection).',
            data: { code: 'CSRF_BLOCKED' },
          })
        }
      }
    }
  }

  // 5. Performance & Telemetry Latency Tracking
  const startTime = Date.now()
  if (event.node?.res) {
    event.node.res.on('finish', () => {
      const durationMs = Date.now() - startTime
      const statusCode = event.node.res.statusCode || 200
      const route = getRequestPath(event)
      import('../utils/requestMetrics').then(({ recordRequestMetric }) => {
        recordRequestMetric(method, route, statusCode, durationMs)
      }).catch(() => {})
    })
  }
})

