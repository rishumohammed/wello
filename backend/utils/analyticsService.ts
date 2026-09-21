// backend/utils/analyticsService.ts
import { getDb } from './authService'
import { sanitizeProperties } from './analyticsIngestService'

export interface ServerEventOptions {
  anonymousId?: string
  sessionId?: string
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
  isEssential?: boolean
}

/**
 * Server-side trusted analytics emitter.
 * Respects user consent (analytics_consent = false), sanitizes properties,
 * buckets financial figures, and writes to analytics_events.
 */
export async function logAnalyticsEvent(
  userId: number | null,
  eventName: string,
  properties: Record<string, any> = {},
  isEssential: boolean = false,
  options: ServerEventOptions = {}
): Promise<boolean> {
  const db = getDb()
  const now = new Date()
  let isInternal = false

  if (userId) {
    const user = await db('users')
      .where({ id: userId })
      .select('analytics_consent', 'role', 'status')
      .first()

    if (user) {
      if (user.role === 'admin') {
        isInternal = true
      }
      // If user has explicitly opted out of telemetry and event is not strictly essential, drop
      if (!isEssential && !options.isEssential && (user.analytics_consent === 0 || user.analytics_consent === false)) {
        return false
      }
    }
  }

  try {
    const sanitizedProps = sanitizeProperties(properties)

    await db('analytics_events').insert({
      user_id: userId,
      name: eventName.slice(0, 100),
      event_name: eventName.slice(0, 100), // legacy backwards compatibility
      timestamp: now,
      created_at: now,
      anonymous_id: options.anonymousId || null,
      session_id: options.sessionId || null,
      properties: JSON.stringify(sanitizedProps),
      metadata: JSON.stringify(sanitizedProps), // legacy backwards compatibility
      country: options.country ? options.country.slice(0, 3).toUpperCase() : null,
      timezone: options.timezone || null,
      device_type: options.deviceType || 'server',
      os: options.os || 'server',
      browser: options.browser || 'server',
      app_version: options.appVersion || '1.0.0',
      is_pwa: options.isPwa ? 1 : 0,
      referrer: options.referrer ? options.referrer.slice(0, 255) : null,
      utm_source: options.utmSource ? options.utmSource.slice(0, 100) : null,
      utm_medium: options.utmMedium ? options.utmMedium.slice(0, 100) : null,
      utm_campaign: options.utmCampaign ? options.utmCampaign.slice(0, 100) : null,
      is_bot: 0,
      is_internal: isInternal ? 1 : 0,
    })
    return true
  } catch (err) {
    console.error(`[Analytics Emitter] Failed to log event ${eventName}:`, err)
    return false
  }
}

/**
 * Convenience helper to log events with explicit option object.
 */
export async function trackEvent(
  eventName: string,
  userId: number | null,
  properties: Record<string, any> = {},
  options: ServerEventOptions = {}
): Promise<boolean> {
  return logAnalyticsEvent(userId, eventName, properties, options.isEssential || false, options)
}
