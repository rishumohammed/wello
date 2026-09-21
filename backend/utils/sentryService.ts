// backend/utils/sentryService.ts
/**
 * Sentry-Compatible Error Tracking Hook for Wello
 * Inactive/No-op when SENTRY_DSN is not configured.
 */

import { Logger } from './logger'

export interface ErrorContext {
  requestId?: string
  userId?: number | string
  route?: string
  method?: string
  extra?: Record<string, any>
}

export class SentryTracker {
  private static isInitialized = false
  private static dsn = process.env.SENTRY_DSN || ''

  static init(): void {
    if (this.dsn && !this.isInitialized) {
      Logger.info('[Sentry] Error tracking initialized with configured DSN.')
      this.isInitialized = true
    }
  }

  static captureException(err: any, context?: ErrorContext): string {
    const errorId = `err_${Math.random().toString(36).slice(2, 11)}`

    // Log structured error
    Logger.error(err?.message || 'Captured Exception', err, {
      requestId: context?.requestId,
      userId: context?.userId,
      path: context?.route,
      method: context?.method,
      meta: { errorId, ...context?.extra },
    })

    if (this.isInitialized && this.dsn) {
      // If DSN is set, forward to Sentry API / HTTP store
      try {
        fetch(this.dsn, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: errorId,
            message: err?.message || String(err),
            timestamp: new Date().toISOString(),
            tags: { route: context?.route, method: context?.method },
            user: { id: context?.userId },
          }),
        }).catch(() => {})
      } catch (e) {
        // Safe fail
      }
    }

    return errorId
  }
}
