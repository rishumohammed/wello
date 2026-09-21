// backend/middleware/01.security.ts
/**
 * Global HTTP Security Headers, Request Tracing & Error Protection Middleware
 */

import { defineEventHandler, setResponseHeader, getRequestHeader, getRequestPath } from 'h3'
import crypto from 'node:crypto'

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
})
