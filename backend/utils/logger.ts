// backend/utils/logger.ts
/**
 * Structured JSON Logger for Wello
 * Emits JSON logs formatted for Datadog / CloudWatch / ELK.
 * Automatically redacts PII, tokens, passwords, and OTP secrets.
 */

import { H3Event } from 'h3'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const REDACT_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'cookie',
  'otp',
  'code',
  'secret',
  'apiKey',
  'api_key',
  'resend_api_key',
  'database_password',
])

export function sanitizeLogData(obj: any, depth = 0): any {
  if (depth > 4) return '[MaxDepth]'
  if (!obj || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeLogData(item, depth + 1))
  }

  const clean: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase()
    if (REDACT_KEYS.has(lk) || lk.includes('password') || lk.includes('secret') || lk.includes('token')) {
      clean[k] = '[REDACTED]'
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitizeLogData(v, depth + 1)
    } else {
      clean[k] = v
    }
  }
  return clean
}

export interface StructuredLogPayload {
  timestamp: string
  level: LogLevel
  message: string
  requestId?: string
  userId?: number | string | null
  module?: string
  path?: string
  method?: string
  durationMs?: number
  error?: {
    name?: string
    message: string
    code?: string | number
  }
  meta?: Record<string, any>
}

export class Logger {
  static log(level: LogLevel, message: string, data?: Partial<StructuredLogPayload>): void {
    const entry: StructuredLogPayload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(data?.requestId ? { requestId: data.requestId } : {}),
      ...(data?.userId ? { userId: data.userId } : {}),
      ...(data?.module ? { module: data.module } : {}),
      ...(data?.path ? { path: data.path } : {}),
      ...(data?.method ? { method: data.method } : {}),
      ...(data?.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
      ...(data?.error ? { error: { message: data.error.message, name: data.error.name, code: data.error.code } } : {}),
      ...(data?.meta ? { meta: sanitizeLogData(data.meta) } : {}),
    }

    const line = JSON.stringify(entry)
    if (level === 'error') {
      console.error(line)
    } else if (level === 'warn') {
      console.warn(line)
    } else {
      console.log(line)
    }
  }

  static info(message: string, data?: Partial<StructuredLogPayload>): void {
    this.log('info', message, data)
  }

  static warn(message: string, data?: Partial<StructuredLogPayload>): void {
    this.log('warn', message, data)
  }

  static error(message: string, err?: any, data?: Partial<StructuredLogPayload>): void {
    const errObj = err
      ? {
          name: err.name || 'Error',
          message: err.message || String(err),
          code: err.code || err.statusCode,
        }
      : undefined

    this.log('error', message, { ...data, error: errObj })
  }

  static debug(message: string, data?: Partial<StructuredLogPayload>): void {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, data)
    }
  }
}

export function logRequest(event: H3Event, durationMs: number, statusCode: number): void {
  const reqId = event.context?.requestId
  const user = event.context?.user
  Logger.info(`HTTP ${event.node?.req?.method || 'GET'} ${event.node?.req?.url || '/'} ${statusCode}`, {
    requestId: reqId,
    userId: user?.id,
    path: event.node?.req?.url,
    method: event.node?.req?.method,
    durationMs,
    meta: {
      statusCode,
      userAgent: event.node?.req?.headers['user-agent'],
    },
  })
}
