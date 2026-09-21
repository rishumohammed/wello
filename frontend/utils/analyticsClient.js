// frontend/utils/analyticsClient.js
/**
 * Client-Side Analytics Engine for Wello
 * Features:
 * - Persistent anonymous_id generation
 * - Per-session session_id management
 * - UTM parameter capture and attribution
 * - PWA vs Browser environment detection
 * - Client-side user consent check
 * - In-memory event batching & keepalive/sendBeacon flushing
 */

const STORAGE_ANON_ID = 'wello_anon_id'
const STORAGE_SESSION_ID = 'wello_session_id'
const STORAGE_UTM_PARAMS = 'wello_utm_params'
const STORAGE_CONSENT = 'wello_analytics_consent'

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getAnonymousId() {
  if (typeof window === 'undefined') return 'server'
  try {
    let anonId = localStorage.getItem(STORAGE_ANON_ID)
    if (!anonId) {
      anonId = 'anon_' + generateUUID()
      localStorage.setItem(STORAGE_ANON_ID, anonId)
    }
    return anonId
  } catch {
    return 'anon_guest'
  }
}

export function getSessionId() {
  if (typeof window === 'undefined') return 'server'
  try {
    let sessId = sessionStorage.getItem(STORAGE_SESSION_ID)
    if (!sessId) {
      sessId = 'sess_' + generateUUID()
      sessionStorage.setItem(STORAGE_SESSION_ID, sessId)
    }
    return sessId
  } catch {
    return 'sess_fallback'
  }
}

export function captureUtmParams() {
  if (typeof window === 'undefined') return {}
  try {
    const params = new URLSearchParams(window.location.search)
    const utmSource = params.get('utm_source')
    const utmMedium = params.get('utm_medium')
    const utmCampaign = params.get('utm_campaign')

    if (utmSource || utmMedium || utmCampaign) {
      const utmObj = {
        utmSource: utmSource || undefined,
        utmMedium: utmMedium || undefined,
        utmCampaign: utmCampaign || undefined,
      }
      sessionStorage.setItem(STORAGE_UTM_PARAMS, JSON.stringify(utmObj))
      return utmObj
    }

    const saved = sessionStorage.getItem(STORAGE_UTM_PARAMS)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

export function isPwaMode() {
  if (typeof window === 'undefined') return false
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isNavStandalone = (window.navigator as any).standalone === true
  return isStandalone || isNavStandalone
}

export function hasAnalyticsConsent() {
  if (typeof window === 'undefined') return true
  try {
    const consent = localStorage.getItem(STORAGE_CONSENT)
    return consent !== 'false' && consent !== '0'
  } catch {
    return true
  }
}

export function setAnalyticsConsent(enabled: boolean) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_CONSENT, enabled ? 'true' : 'false')
  } catch {}
}

// In-memory event buffer for batching
let eventQueue: any[] = []
let flushTimer: any = null

export async function flushEvents() {
  if (eventQueue.length === 0 || typeof window === 'undefined') return

  const batch = [...eventQueue]
  eventQueue = []

  try {
    const payload = {
      anonymousId: getAnonymousId(),
      events: batch,
    }

    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch (err) {
    console.warn('[Analytics Client] Failed to flush events batch:', err)
  }
}

export function trackEvent(name: string, properties: Record<string, any> = {}, isEssential: boolean = false) {
  if (typeof window === 'undefined') return

  // Check consent gate
  if (!hasAnalyticsConsent() && !isEssential) {
    return
  }

  const utm = captureUtmParams()
  const timezone = Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || 'UTC'

  const eventRecord = {
    name,
    timestamp: new Date().toISOString(),
    anonymousId: getAnonymousId(),
    sessionId: getSessionId(),
    timezone,
    isPwa: isPwaMode(),
    referrer: document.referrer || undefined,
    utmSource: utm.utmSource,
    utmMedium: utm.utmMedium,
    utmCampaign: utm.utmCampaign,
    properties,
  }

  eventQueue.push(eventRecord)

  if (eventQueue.length >= 10) {
    flushEvents()
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null
      flushEvents()
    }, 4000)
  }
}

// Window lifecycle listeners
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushEvents()
    }
  })
  window.addEventListener('pagehide', () => {
    flushEvents()
  })
}

export default {
  track: trackEvent,
  flush: flushEvents,
  getAnonymousId,
  getSessionId,
  hasConsent: hasAnalyticsConsent,
  setConsent: setAnalyticsConsent,
}
