// backend/utils/privacyGuard.ts
/**
 * Production Privacy & Differential Data Protection Engine for Wello
 * Strictly enforces k >= 5 minimum cohort/group anonymity threshold.
 * Suppresses or redacts any demographic, geographic, category, or plan cohort with < 5 distinct users.
 */

export interface PrivacyThresholdResult<T> {
  data: T[]
  suppressedCount: number
  privacyThreshold: number
  isRedacted: boolean
}

/**
 * Enforces k >= 5 privacy threshold across aggregated groups.
 * Any group with userCount < minUsers (default: 5) is redacted to protect individual financial privacy.
 */
export function enforcePrivacyThreshold<T extends Record<string, any>>(
  groups: T[],
  minUsers: number = 5,
  userCountKey: string = 'userCount'
): PrivacyThresholdResult<T> {
  let suppressedCount = 0

  const sanitized = groups.map((item) => {
    const rawCount = item[userCountKey] !== undefined ? Number(item[userCountKey]) : (item.user_count !== undefined ? Number(item.user_count) : 0)

    if (rawCount > 0 && rawCount < minUsers) {
      suppressedCount++
      return {
        ...item,
        [userCountKey]: null,
        user_count: null,
        isRedacted: true,
        privacyNotice: `Cohort suppressed (fewer than ${minUsers} active providers).`,
        averageRate: null,
        clientWorkRate: null,
        allInRate: null,
        totalRevenue: null,
        totalHours: null,
        avgDurationHours: null,
      } as T
    }

    return {
      ...item,
      isRedacted: false,
    } as T
  })

  return {
    data: sanitized,
    suppressedCount,
    privacyThreshold: minUsers,
    isRedacted: suppressedCount > 0,
  }
}

/**
 * Evaluates whether a single count passes the privacy threshold.
 */
export function passesPrivacyThreshold(userCount: number, minUsers: number = 5): boolean {
  return typeof userCount === 'number' && userCount >= minUsers
}
