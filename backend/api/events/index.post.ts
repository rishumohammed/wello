// backend/api/events/index.post.ts
import { defineEventHandler, readBody, getRequestHeaders, getRequestIP, getHeader, setResponseStatus } from 'h3'
import { ingestEvents, mergeAnonymousIdToUser } from '../../utils/analyticsIngestService'
import { getOptionalUser } from '../../utils/authGuard'

import { requireRateLimit } from '../../utils/rateLimiter'

export default defineEventHandler(async (event) => {
  try {
    // Distributed rate limit on event ingestion: 120 req/min
    await requireRateLimit(event, {
      keyPrefix: 'events_ingest',
      limit: 120,
      windowSeconds: 60,
    })

    const body = await readBody(event)
    const headers = getRequestHeaders(event)
    const ip = getRequestIP(event, { xForwardedFor: true }) || '127.0.0.1'
    const userAgent = getHeader(event, 'user-agent') || ''

    // Resolve optional authenticated user
    const authenticatedUser = await getOptionalUser(event)
    const userId = authenticatedUser ? authenticatedUser.id : null

    // If anonymous_id is present in query or body and we have an authenticated user, perform merge
    if (userId) {
      const anonId = body?.anonymousId || (Array.isArray(body) && body[0]?.anonymousId)
      if (anonId) {
        await mergeAnonymousIdToUser(anonId, userId)
      }
    }

    const result = await ingestEvents(body?.events || body, {
      ipAddress: ip,
      userAgent,
      headers,
      userId,
      anonymousId: body?.anonymousId || (Array.isArray(body) && body[0]?.anonymousId) || null,
    })

    if (result.errors && result.errors.length > 0 && result.accepted === 0) {
      setResponseStatus(event, 429)
      return {
        success: false,
        message: result.errors[0],
        dropped: result.dropped,
      }
    }

    return {
      success: true,
      accepted: result.accepted,
      dropped: result.dropped,
    }
  } catch (err: any) {
    console.error('[POST /api/events] Ingestion error:', err)
    setResponseStatus(event, 400)
    return {
      success: false,
      error: err.message || 'Invalid event payload format',
    }
  }
})
