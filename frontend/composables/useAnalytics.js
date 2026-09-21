// frontend/composables/useAnalytics.js
import { trackEvent, flushEvents, getAnonymousId, getSessionId, hasAnalyticsConsent, setAnalyticsConsent } from '../utils/analyticsClient'

export function useAnalytics() {
  return {
    track: trackEvent,
    flush: flushEvents,
    getAnonymousId,
    getSessionId,
    hasConsent: hasAnalyticsConsent,
    setConsent: setAnalyticsConsent,
  }
}
