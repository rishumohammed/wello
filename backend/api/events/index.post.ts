// backend/api/events/index.post.ts
import { defineEventHandler, readBody, getRequestHeaders, getRequestIP, getHeader, setResponseStatus, createError } from 'h3'
import { ingestEvents, mergeAnonymousIdToUser } from '../../utils/analyticsIngestService'
import { getOptionalUser } from '../../utils/authGuard'
import { requireRateLimit } from '../../utils/rateLimiter'

const MAX_BATCH_EVENTS = 50

export default defineEventHandler(async (event) => {
  try {
    // Distributed rate limit on event ingestion: 120 req/min per IP
    await requireRateLimit(event, {
      keyPrefix: 'events_ingest',
      limit: 120,
      windowSeconds: 60,
      keyByIpOnly: true,
      customErrorMessage: 'Analytics event ingestion throttled. Maximum 120 batch requests per minute allowed.',
    })

    const body = await readBody(event)
    const rawEvents = body?.events || body

    // Enforce max batch size limit of 50 events
    if (Array.isArray(rawEvents) && rawEvents.length > MAX_BATCH_EVENTS) {
      setResponseStatus(event, 400)
      return {
        success: false,
        error: `Payload batch limit exceeded. Maximum ${MAX_BATCH_EVENTS} events per request permitted.`,
      }
    }

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

    const result = await ingestEvents(rawEvents, {
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
    setResponseStatus(event, err.statusCode || 400)
    return {
      success: false,
      error: err.message || err.statusMessage || 'Invalid event payload format',
    }
  }
})

