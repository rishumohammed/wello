// backend/utils/fairUseService.ts
import { H3Event, createError } from 'h3'
import { getDb } from './authService'
import { requireUser } from './authGuard'

export interface FairUseLimitCheck {
  allowed: boolean
  limitKey: string
  limitValue: number
  currentCount: number
  unit: string
  resetInSeconds: number
  message?: string
}

/**
 * Check if an action by userId complies with the configured fair-use protection limit.
 */
export async function checkFairUseLimit(
  userId: number,
  limitKey: string,
  increment: number = 1
): Promise<FairUseLimitCheck> {
  const db = getDb()
  const now = new Date()

  // 1. Fetch limit definition from database
  const limitDef = await db('fair_use_limits')
    .where({ limit_key: limitKey, is_active: true })
    .first()

  if (!limitDef) {
    // If no limit configured or disabled, allow action freely
    return {
      allowed: true,
      limitKey,
      limitValue: Infinity,
      currentCount: 0,
      unit: 'unlimited',
      resetInSeconds: 0,
    }
  }

  const windowSeconds = limitDef.window_seconds || 86400
  if (windowSeconds <= 0) {
    // Static limit (e.g. file size, row count check passed as increment)
    const allowed = increment <= limitDef.limit_value
    return {
      allowed,
      limitKey,
      limitValue: limitDef.limit_value,
      currentCount: increment,
      unit: limitDef.unit,
      resetInSeconds: 0,
      message: allowed ? undefined : `Exceeds maximum allowable ${limitDef.name} (${limitDef.limit_value} ${limitDef.unit}).`,
    }
  }

  // Time-windowed limit (e.g. per hour, per day)
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * (windowSeconds * 1000))
  const resetInSeconds = Math.max(1, Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000))

  const existing = await db('fair_use_logs')
    .where({
      user_id: userId,
      limit_key: limitKey,
      window_start: windowStart,
    })
    .first()

  const currentCount = (existing?.current_count || 0) + increment

  if (currentCount > limitDef.limit_value) {
    return {
      allowed: false,
      limitKey,
      limitValue: limitDef.limit_value,
      currentCount: existing?.current_count || 0,
      unit: limitDef.unit,
      resetInSeconds,
      message: `Safety limit reached: You have reached the fair-use protection threshold of ${limitDef.limit_value} ${limitDef.unit}. This safety limit resets in ${Math.ceil(resetInSeconds / 60)} minute(s).`,
    }
  }

  // Record usage in database
  if (existing) {
    await db('fair_use_logs')
      .where({ id: existing.id })
      .update({
        current_count: currentCount,
        updated_at: now,
      })
  } else {
    await db('fair_use_logs').insert({
      user_id: userId,
      limit_key: limitKey,
      window_start: windowStart,
      current_count: currentCount,
      updated_at: now,
    })
  }

  return {
    allowed: true,
    limitKey,
    limitValue: limitDef.limit_value,
    currentCount,
    unit: limitDef.unit,
    resetInSeconds,
  }
}

/**
 * Route guard enforcing fair-use limit. Throws 429 FAIR_USE_LIMIT_EXCEEDED if exceeded.
 */
export async function requireFairUseLimit(
  event: H3Event,
  limitKey: string,
  increment: number = 1
): Promise<FairUseLimitCheck> {
  const user = await requireUser(event)
  
  // Admins bypass fair-use rate limits
  if (user.role === 'admin' || user.adminRole) {
    return {
      allowed: true,
      limitKey,
      limitValue: Infinity,
      currentCount: 0,
      unit: 'unlimited',
      resetInSeconds: 0,
    }
  }

  const check = await checkFairUseLimit(user.id, limitKey, increment)
  if (!check.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: check.message || `Fair-use safety limit reached for ${limitKey}.`,
      data: {
        code: 'FAIR_USE_LIMIT_EXCEEDED',
        limitKey: check.limitKey,
        limitValue: check.limitValue,
        unit: check.unit,
        resetInSeconds: check.resetInSeconds,
      },
    })
  }

  return check
}
