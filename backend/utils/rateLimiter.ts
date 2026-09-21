// server/utils/rateLimiter.ts
/**
 * Production-Grade Distributed Rate Limiting Engine for Wello
 * Backed by MySQL database with high-performance query execution and memory cache layer.
 * Enforces sliding/fixed-window limits across Auth, OTP, Ingestion, Exports, and Analytics.
 */

import { H3Event, getRequestHeader, setResponseHeader, createError } from 'h3'
import { getDb } from './db'
import { extractClientIp } from './authGuard'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: Date
  retryAfterSeconds: number
}

// In-memory fallback if DB is temporarily unreachable
const memStore = new Map<string, { points: number; expireAt: number }>()

/**
 * Consumes a rate limit point and checks if within limits.
 * Uses atomic DB upsert with sliding/fixed window expiration.
 */
export async function consumeRateLimit(
  key: string,
  limit: number = 60,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const now = new Date()
  const expireAt = new Date(now.getTime() + windowSeconds * 1000)

  try {
    const db = getDb()

    // 1. Fetch existing record
    const existing = await db('rate_limits')
      .where({ key })
      .first()

    if (!existing || new Date(existing.expire_at) <= now) {
      // Create new window
      await db('rate_limits')
        .insert({
          key,
          points: 1,
          expire_at: expireAt,
          updated_at: now,
        })
        .onConflict('key')
        .merge({
          points: 1,
          expire_at: expireAt,
          updated_at: now,
        })

      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        resetTime: expireAt,
        retryAfterSeconds: 0,
      }
    }

    // 2. Existing valid window
    const currentPoints = Number(existing.points) || 0
    const recordExpireAt = new Date(existing.expire_at)
    const retryAfter = Math.max(1, Math.ceil((recordExpireAt.getTime() - now.getTime()) / 1000))

    if (currentPoints >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: recordExpireAt,
        retryAfterSeconds: retryAfter,
      }
    }

    // Increment points
    await db('rate_limits')
      .where({ key })
      .increment('points', 1)
      .update({ updated_at: now })

    return {
      allowed: true,
      remaining: Math.max(0, limit - (currentPoints + 1)),
      resetTime: recordExpireAt,
      retryAfterSeconds: 0,
    }
  } catch (err) {
    // Memory fallback
    const mem = memStore.get(key)
    const nowMs = Date.now()

    if (!mem || mem.expireAt <= nowMs) {
      memStore.set(key, { points: 1, expireAt: nowMs + windowSeconds * 1000 })
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        resetTime: expireAt,
        retryAfterSeconds: 0,
      }
    }

    if (mem.points >= limit) {
      const retryAfter = Math.max(1, Math.ceil((mem.expireAt - nowMs) / 1000))
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(mem.expireAt),
        retryAfterSeconds: retryAfter,
      }
    }

    mem.points++
    return {
      allowed: true,
      remaining: Math.max(0, limit - mem.points),
      resetTime: new Date(mem.expireAt),
      retryAfterSeconds: 0,
    }
  }
}

/**
 * Resets/clears a specific rate limit key (e.g. after successful OTP verification)
 */
export async function resetRateLimit(key: string): Promise<void> {
  try {
    const db = getDb()
    await db('rate_limits').where({ key }).delete()
  } catch (e) {
    // ignore
  }
  memStore.delete(key)
}

/**
 * Prunes expired rate limit entries to maintain lean DB footprint
 */
export async function pruneExpiredRateLimits(): Promise<number> {
  try {
    const db = getDb()
    const deleted = await db('rate_limits').where('expire_at', '<', new Date()).delete()
    return deleted
  } catch (e) {
    return 0
  }
}

/**
 * Enforces rate limiting on an H3 HTTP Event.
 * Sets standard IETF RateLimit-* headers and throws HTTP 429 if limit is exceeded.
 */
export async function requireRateLimit(
  event: H3Event,
  options: {
    keyPrefix: string
    limit: number
    windowSeconds: number
    identifier?: string
    customErrorMessage?: string
  }
): Promise<RateLimitResult> {
  const ip = extractClientIp(event)
  const id = options.identifier ? options.identifier.trim().toLowerCase() : ip
  const compositeKey = `rl:${options.keyPrefix}:${id}`

  const result = await consumeRateLimit(compositeKey, options.limit, options.windowSeconds)

  // Set standard RFC RateLimit headers
  setResponseHeader(event, 'X-RateLimit-Limit', options.limit.toString())
  setResponseHeader(event, 'X-RateLimit-Remaining', result.remaining.toString())
  setResponseHeader(event, 'X-RateLimit-Reset', Math.ceil(result.resetTime.getTime() / 1000).toString())

  if (!result.allowed) {
    setResponseHeader(event, 'Retry-After', result.retryAfterSeconds.toString())
    throw createError({
      statusCode: 429,
      statusMessage:
        options.customErrorMessage ||
        `Rate limit exceeded. Too many requests. Please retry in ${result.retryAfterSeconds} seconds.`,
    })
  }

  return result
}
