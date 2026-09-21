// backend/utils/alertEngine.ts
/**
 * System Failure & Security Alert Dispatcher for Wello
 * Asynchronously posts critical system anomalies, backup failures, rate-limit abuses,
 * and security violations to configured alert webhooks (Slack, Discord, PagerDuty, or custom HTTP).
 */

import { logger } from './logger'
import { captureException, captureMessage } from './sentryService'

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface AlertOptions {
  title: string
  message: string
  severity?: AlertSeverity
  module?: string
  metadata?: Record<string, any>
  error?: Error | any
}

/**
 * Dispatches an alert asynchronously without blocking the event loop or throwing.
 */
export async function sendSystemAlert(options: AlertOptions): Promise<boolean> {
  const { title, message, severity = 'error', module = 'system', metadata = {}, error } = options
  const webhookUrl = process.env.ALERT_WEBHOOK_URL

  // 1. Structured Logging
  if (severity === 'critical' || severity === 'error') {
    logger.error(`[ALERT] ${title}: ${message}`, { module, metadata, error: error?.message })
  } else if (severity === 'warning') {
    logger.warn(`[ALERT] ${title}: ${message}`, { module, metadata })
  } else {
    logger.info(`[ALERT] ${title}: ${message}`, { module, metadata })
  }

  // 2. Sentry Tracking
  if (error) {
    captureException(error, { extra: { title, module, ...metadata } })
  } else if (severity === 'critical' || severity === 'error') {
    captureMessage(`[ALERT] ${title}: ${message}`, severity === 'critical' ? 'fatal' : 'error')
  }

  // 3. Webhook Delivery
  if (!webhookUrl) {
    return false
  }

  try {
    const timestamp = new Date().toISOString()
    const color = severity === 'critical' ? 0xff0000 : severity === 'error' ? 0xe67e22 : severity === 'warning' ? 0xf1c40f : 0x3498db

    // Universal payload compatible with Slack, Discord, MS Teams, and generic HTTP endpoints
    const payload = {
      username: 'Wello System Sentinel',
      content: `🚨 **[${severity.toUpperCase()}] ${title}**\n${message}`,
      embeds: [
        {
          title: `[${severity.toUpperCase()}] ${title}`,
          description: message,
          color,
          fields: [
            { name: 'Module', value: module, inline: true },
            { name: 'Timestamp', value: timestamp, inline: true },
            ...(error?.message ? [{ name: 'Error', value: String(error.message).slice(0, 1000), inline: false }] : []),
            ...(Object.keys(metadata).length > 0
              ? [{ name: 'Details', value: '```json\n' + JSON.stringify(metadata, null, 2).slice(0, 1000) + '\n```', inline: false }]
              : []),
          ],
          footer: { text: `Environment: ${process.env.NODE_ENV || 'development'}` },
          timestamp,
        },
      ],
      text: `[${severity.toUpperCase()}] ${title} - ${message}`,
      metadata: { severity, module, timestamp, ...metadata },
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })

    return res.ok
  } catch (err: any) {
    logger.warn(`Failed to dispatch alert webhook: ${err.message}`, { module: 'alertEngine' })
    return false
  }
}

/**
 * Dispatch an alert when a scheduled database backup or restore fails
 */
export async function dispatchBackupFailureAlert(operation: 'backup' | 'restore' | 'drill', error: any): Promise<void> {
  await sendSystemAlert({
    title: `Database ${operation.toUpperCase()} Failure`,
    message: `Automated database ${operation} encountered an unhandled error. Data redundancy may be at risk.`,
    severity: 'critical',
    module: 'database_backup',
    error,
  })
}

/**
 * Dispatch an alert on suspected security anomalies or audit chain tampering
 */
export async function dispatchSecurityAlert(action: string, metadata: Record<string, any>): Promise<void> {
  await sendSystemAlert({
    title: `Security Violation / Tampering: ${action}`,
    message: `A potential security or data integrity violation was detected: ${action}`,
    severity: 'critical',
    module: 'security_sentinel',
    metadata,
  })
}

/**
 * Dispatch an alert on aggressive rate limiting triggers
 */
export async function dispatchRateLimitAbuseAlert(ip: string, endpoint: string, hits: number): Promise<void> {
  await sendSystemAlert({
    title: `Aggressive Rate Limit Breach`,
    message: `IP ${ip} exceeded maximum threshold on ${endpoint} (${hits} requests).`,
    severity: 'warning',
    module: 'rate_limiter',
    metadata: { ip, endpoint, hits },
  })
}
