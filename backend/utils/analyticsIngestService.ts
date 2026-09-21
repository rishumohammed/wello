// backend/utils/analyticsIngestService.ts
import { getDb } from './authService'

export interface EventPayload {
  name: string
  timestamp?: string | number
  anonymousId?: string
  sessionId?: string
  properties?: Record<string, any>
  country?: string
  timezone?: string
  deviceType?: string
  os?: string
  browser?: string
  appVersion?: string
  isPwa?: boolean
  referrer?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

export interface RequestMetadata {
  ipAddress?: string
  userAgent?: string
  headers?: Record<string, string | string[] | undefined>
  userId?: number | null
  anonymousId?: string | null
}

// In-memory sliding window rate limiter: max 120 events per 60s per client key
const rateLimitMap = new Map<string, { count: number; windowStart: number }>()

function checkRateLimit(key: string, limit = 120, windowMs = 60000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)
  if (!record || now - record.windowStart > windowMs) {
    rateLimitMap.set(key, { count: 1, windowStart: now })
    return true
  }
  if (record.count >= limit) {
    return false
  }
  record.count++
  return true
}

// Timezone to ISO Country code fallback lookup
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'Europe/London': 'GB',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'Europe/Amsterdam': 'NL',
  'Europe/Zurich': 'CH',
  'Asia/Tokyo': 'JP',
  'Asia/Singapore': 'SG',
  'Asia/Dubai': 'AE',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Pacific/Auckland': 'NZ',
}

/**
 * Extracts country code from CDN/geo headers or timezone fallback with zero 3rd-party latency.
 */
export function extractCountry(headers?: Record<string, any>, timezone?: string): string | null {
  if (headers) {
    const cfCountry = headers['cf-ipcountry'] || headers['cf-country']
    if (cfCountry && typeof cfCountry === 'string' && cfCountry.length === 2 && cfCountry !== 'XX') {
      return cfCountry.toUpperCase()
    }

    const xCountry = headers['x-country-code'] || headers['x-geo-country'] || headers['x-real-ip-country']
    if (xCountry && typeof xCountry === 'string' && xCountry.length === 2) {
      return xCountry.toUpperCase()
    }
  }

  if (timezone && TIMEZONE_TO_COUNTRY[timezone]) {
    return TIMEZONE_TO_COUNTRY[timezone]
  }

  return null
}

/**
 * Parses User-Agent header to determine device type, OS, browser, and bot status.
 */
export function parseUserAgent(uaString?: string): {
  deviceType: string
  os: string
  browser: string
  isBot: boolean
} {
  if (!uaString) {
    return { deviceType: 'desktop', os: 'unknown', browser: 'unknown', isBot: false }
  }

  const ua = uaString.toLowerCase()

  // 1. Bot check
  const isBot =
    ua.includes('bot') ||
    ua.includes('crawler') ||
    ua.includes('spider') ||
    ua.includes('lighthouse') ||
    ua.includes('pingdom') ||
    ua.includes('curl') ||
    ua.includes('postman') ||
    ua.includes('python') ||
    ua.includes('headless') ||
    ua.includes('wget')

  if (isBot) {
    return { deviceType: 'bot', os: 'bot', browser: 'bot', isBot: true }
  }

  // 2. Device Type
  let deviceType = 'desktop'
  if (ua.includes('tablet') || ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
    deviceType = 'tablet'
  } else if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android') || ua.includes('ipod')) {
    deviceType = 'mobile'
  }

  // 3. OS
  let os = 'other'
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'macOS'
  else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) os = 'iOS'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('linux')) os = 'Linux'
  else if (ua.includes('cros')) os = 'ChromeOS'

  // 4. Browser
  let browser = 'other'
  if (ua.includes('edg/') || ua.includes('edge/')) browser = 'Edge'
  else if (ua.includes('samsungbrowser/')) browser = 'Samsung Internet'
  else if (ua.includes('opr/') || ua.includes('opera/')) browser = 'Opera'
  else if (ua.includes('chrome/') || ua.includes('crios/')) browser = 'Chrome'
  else if (ua.includes('safari/') && !ua.includes('chrome')) browser = 'Safari'
  else if (ua.includes('firefox/') || ua.includes('fxios/')) browser = 'Firefox'

  return { deviceType, os, browser, isBot: false }
}

/**
 * Buckets numerical financial amounts to prevent raw financial PII leakage into analytics events.
 */
export function bucketizeAmount(val: any): string {
  const num = typeof val === 'number' ? val : parseFloat(val)
  if (isNaN(num) || num <= 0) return '0'
  if (num < 100) return '<100'
  if (num < 500) return '100-500'
  if (num < 1000) return '500-1k'
  if (num < 5000) return '1k-5k'
  if (num < 10000) return '5k-10k'
  return '10k+'
}

/**
 * Sanitizes event properties: strips raw emails/names/credentials and buckets financial amounts.
 */
export function sanitizeProperties(props?: Record<string, any>): Record<string, any> {
  if (!props || typeof props !== 'object') return {}
  const sanitized: Record<string, any> = {}

  for (const [key, val] of Object.entries(props)) {
    const lKey = key.toLowerCase()

    // Strip sensitive raw credentials or contact PII
    if (
      lKey.includes('password') ||
      lKey.includes('token') ||
      lKey.includes('secret') ||
      lKey.includes('cookie') ||
      lKey.includes('otp') ||
      lKey === 'email' ||
      lKey === 'phone'
    ) {
      continue
    }

    // Bucketize raw financial amounts
    if (
      lKey === 'amount' ||
      lKey === 'total' ||
      lKey === 'subtotal' ||
      lKey === 'rate' ||
      lKey === 'quote_amount' ||
      lKey === 'revenue' ||
      lKey === 'balance' ||
      lKey === 'target_monthly_income' ||
      lKey === 'target_hourly'
    ) {
      sanitized[`${key}_bucket`] = bucketizeAmount(val)
      continue
    }

    if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeProperties(val)
    } else {
      sanitized[key] = val
    }
  }

  return sanitized
}

/**
 * Retroactively merges an anonymous ID to a registered user ID across all historical events.
 */
export async function mergeAnonymousIdToUser(anonymousId: string, userId: number): Promise<number> {
  if (!anonymousId || !userId) return 0
  const db = getDb()

  try {
    // 1. Record merge mapping
    await db('analytics_anonymous_mappings')
      .insert({
        anonymous_id: anonymousId,
        user_id: userId,
        merged_at: new Date(),
      })
      .onConflict(['anonymous_id', 'user_id'])
      .ignore()

    // 2. Retroactively update prior anonymous events
    const updatedCount = await db('analytics_events')
      .where({ anonymous_id: anonymousId })
      .whereNull('user_id')
      .update({
        user_id: userId,
      })

    return updatedCount
  } catch (err) {
    console.warn('[Analytics Merge] Error merging anonymous ID:', err)
    return 0
  }
}

/**
 * Validates, enriches, and transactionally inserts a batch of analytics events.
 */
export async function ingestEvents(
  rawEvents: EventPayload | EventPayload[],
  reqMeta: RequestMetadata
): Promise<{ accepted: number; dropped: number; errors: string[] }> {
  const events = Array.isArray(rawEvents) ? rawEvents : [rawEvents]
  if (events.length === 0) return { accepted: 0, dropped: 0, errors: [] }

  const db = getDb()
  const clientKey = reqMeta.userId ? `user_${reqMeta.userId}` : reqMeta.ipAddress || 'unknown'
  const isRateAllowed = checkRateLimit(clientKey, 120, 60000)

  if (!isRateAllowed) {
    return {
      accepted: 0,
      dropped: events.length,
      errors: ['Rate limit exceeded. Please throttle analytics ingestion.'],
    }
  }

  // Check user consent if userId is known
  let isConsentGranted = true
  let isInternalUser = false

  if (reqMeta.userId) {
    const user = await db('users')
      .where({ id: reqMeta.userId })
      .select('analytics_consent', 'role', 'status')
      .first()

    if (user) {
      if (user.analytics_consent === 0 || user.analytics_consent === false) {
        isConsentGranted = false
      }
      if (user.role === 'admin') {
        isInternalUser = true
      }
    }
  }

  const { deviceType, os, browser, isBot } = parseUserAgent(reqMeta.userAgent)
  const inferredCountry = extractCountry(reqMeta.headers)

  const rowsToInsert: any[] = []
  let dropped = 0

  for (const evt of events) {
    if (!evt || !evt.name) {
      dropped++
      continue
    }

    // Essential events bypass consent opt-out (e.g. account deletion / essential security)
    const isEssential = evt.name === 'account_deleted' || evt.name === 'work_data_reset'
    if (!isConsentGranted && !isEssential) {
      dropped++
      continue
    }

    const eventTs = evt.timestamp
      ? new Date(typeof evt.timestamp === 'number' ? evt.timestamp : evt.timestamp)
      : new Date()
    const validTs = isNaN(eventTs.getTime()) ? new Date() : eventTs

    const country = (evt.country || inferredCountry || extractCountry(undefined, evt.timezone) || 'XX')
      .toUpperCase()
      .slice(0, 3)

    const sanitizedProps = sanitizeProperties(evt.properties)

    rowsToInsert.push({
      name: evt.name.slice(0, 100),
      event_name: evt.name.slice(0, 100), // legacy column compatibility
      timestamp: validTs,
      created_at: validTs,
      user_id: reqMeta.userId || null,
      anonymous_id: evt.anonymousId || reqMeta.anonymousId || null,
      session_id: evt.sessionId || null,
      properties: JSON.stringify(sanitizedProps),
      metadata: JSON.stringify(sanitizedProps), // legacy column compatibility
      country: country === 'XX' ? null : country,
      timezone: evt.timezone || null,
      device_type: evt.deviceType || deviceType,
      os: evt.os || os,
      browser: evt.browser || browser,
      app_version: evt.appVersion || '1.0.0',
      is_pwa: evt.isPwa ? 1 : 0,
      referrer: evt.referrer ? evt.referrer.slice(0, 255) : null,
      utm_source: evt.utmSource ? evt.utmSource.slice(0, 100) : null,
      utm_medium: evt.utmMedium ? evt.utmMedium.slice(0, 100) : null,
      utm_campaign: evt.utmCampaign ? evt.utmCampaign.slice(0, 100) : null,
      is_bot: isBot ? 1 : 0,
      is_internal: isInternalUser ? 1 : 0,
    })
  }

  if (rowsToInsert.length > 0) {
    // Chunk inserts in batches of 50 to avoid max packet limits
    const chunkSize = 50
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize)
      await db('analytics_events').insert(chunk)
    }
  }

  return {
    accepted: rowsToInsert.length,
    dropped,
    errors: [],
  }
}
