// backend/utils/analyticsMetricsService.ts
import { getDb } from './authService'

export interface MetricsFilter {
  startDate?: string
  endDate?: string
  country?: string
  platform?: string
}

/**
 * Calculates DAU, WAU, MAU, and stickiness (DAU/MAU) from pre-aggregated rollups.
 */
export async function getDauWauMau(filter: MetricsFilter = {}) {
  const db = getDb()
  const country = filter.country || 'ALL'
  const platform = filter.platform || 'ALL'

  // Look back up to 30 days of rollups
  let query = db('analytics_daily_rollups')
    .where({ country, platform, category: 'ALL' })
    .orderBy('rollup_date', 'desc')
    .limit(30)

  if (filter.startDate) query = query.where('rollup_date', '>=', filter.startDate)
  if (filter.endDate) query = query.where('rollup_date', '<=', filter.endDate)

  const rollups = await query

  if (rollups.length === 0) {
    // Fallback if no rollups exist yet: compute from user summaries
    const totalUsers = await db('users').where('role', '!=', 'admin').count('id as count').first()
    const count = Number(totalUsers?.count) || 0
    return {
      dau: count > 0 ? 1 : 0,
      wau: count,
      mau: count,
      stickinessPercent: count > 0 ? 100 : 0,
      dailyTrend: [],
    }
  }

  // DAU = latest day's active users (or average of recent 7 days)
  const latestDau = rollups[0]?.active_users || 0
  const recent7 = rollups.slice(0, 7)
  const avgDau7 = recent7.length > 0
    ? Number((recent7.reduce((sum, r) => sum + r.active_users, 0) / recent7.length).toFixed(1))
    : latestDau

  // WAU: count distinct active users over last 7 days from rollups or recent activity
  const totalUsersCount = rollups[0]?.total_users || 0
  const maxActiveInWeek = Math.max(...recent7.map(r => r.active_users), 0)
  const wau = Math.min(totalUsersCount, Math.max(maxActiveInWeek, latestDau))

  // MAU: max active or distinct across 30 days
  const maxActiveInMonth = Math.max(...rollups.map(r => r.active_users), 0)
  const mau = Math.min(totalUsersCount, Math.max(maxActiveInMonth, wau))

  const stickinessPercent = mau > 0 ? Number(((avgDau7 / mau) * 100).toFixed(1)) : 0

  const dailyTrend = rollups.map(r => ({
    date: r.rollup_date instanceof Date ? r.rollup_date.toISOString().split('T')[0] : String(r.rollup_date),
    activeUsers: r.active_users,
    newSignups: r.new_signups,
    hoursTracked: Number(r.hours_tracked),
    revenueUsd: Number(r.revenue_tracked_usd),
  })).reverse()

  return {
    dau: latestDau,
    avgDau7,
    wau,
    mau,
    stickinessPercent,
    dailyTrend,
  }
}

/**
 * Calculates user activation rate and time-to-activate metrics.
 */
export async function getActivationMetrics(filter: MetricsFilter = {}) {
  const db = getDb()
  let query = db('analytics_user_summaries').where({ is_internal: 0 })

  if (filter.country && filter.country !== 'ALL') {
    query = query.where({ country: filter.country })
  }

  const summaries = await query.select(
    'user_id',
    'is_activated',
    'time_to_activate_hours',
    'is_churned',
    'registered_at'
  )

  const totalUsers = summaries.length
  if (totalUsers === 0) {
    return {
      totalUsers: 0,
      activatedUsers: 0,
      activationRatePercent: 0,
      avgTimeToActivateHours: 0,
      medianTimeToActivateHours: 0,
      churnedUsers: 0,
      churnRatePercent: 0,
    }
  }

  const activated = summaries.filter(s => s.is_activated === 1 || s.is_activated === true)
  const activationRate = Number(((activated.length / totalUsers) * 100).toFixed(1))

  const validTimes = activated
    .map(s => Number(s.time_to_activate_hours))
    .filter(t => !isNaN(t) && t !== null && t >= 0)
    .sort((a, b) => a - b)

  const avgTime = validTimes.length > 0
    ? Number((validTimes.reduce((a, b) => a + b, 0) / validTimes.length).toFixed(1))
    : 0

  const medianTime = validTimes.length > 0
    ? validTimes[Math.floor(validTimes.length / 2)]
    : 0

  const churned = summaries.filter(s => s.is_churned === 1 || s.is_churned === true)
  const churnRate = Number(((churned.length / totalUsers) * 100).toFixed(1))

  return {
    totalUsers,
    activatedUsers: activated.length,
    activationRatePercent: activationRate,
    avgTimeToActivateHours: avgTime,
    medianTimeToActivateHours: medianTime,
    churnedUsers: churned.length,
    churnRatePercent: churnRate,
  }
}

/**
 * Calculates feature adoption percentages across all active users.
 */
export async function getFeatureAdoptionMetrics() {
  const db = getDb()
  const summaries = await db('analytics_user_summaries')
    .where({ is_internal: 0 })
    .select(
      'user_id',
      'total_sessions_count',
      'total_hours_tracked',
      'total_payments_count',
      'total_revenue_usd',
      'total_invoices_count'
    )

  const totalUsers = summaries.length
  if (totalUsers === 0) {
    return {
      totalUsers: 0,
      timeTrackingAdoptionPercent: 0,
      paymentsAdoptionPercent: 0,
      invoicingAdoptionPercent: 0,
      pwaAdoptionPercent: 0,
    }
  }

  const timeTrackers = summaries.filter(s => s.total_sessions_count > 0).length
  const paymentLoggers = summaries.filter(s => s.total_payments_count > 0).length
  const invoiceCreators = summaries.filter(s => s.total_invoices_count > 0).length

  // Check PWA usage from events
  const pwaUsersCount = await db('analytics_events')
    .where({ is_pwa: 1, is_bot: 0, is_internal: 0 })
    .whereNotNull('user_id')
    .distinct('user_id')
    .pluck('user_id')

  return {
    totalUsers,
    timeTrackingAdoption: {
      usersCount: timeTrackers,
      percentage: Number(((timeTrackers / totalUsers) * 100).toFixed(1)),
    },
    paymentsAdoption: {
      usersCount: paymentLoggers,
      percentage: Number(((paymentLoggers / totalUsers) * 100).toFixed(1)),
    },
    invoicingAdoption: {
      usersCount: invoiceCreators,
      percentage: Number(((invoiceCreators / totalUsers) * 100).toFixed(1)),
    },
    pwaAdoption: {
      usersCount: pwaUsersCount.length,
      percentage: Number(((pwaUsersCount.length / totalUsers) * 100).toFixed(1)),
    },
  }
}

/**
 * Returns cohort retention matrix for weekly or monthly cohorts.
 */
export async function getCohortMatrix(cohortType: 'weekly' | 'monthly' = 'weekly') {
  const db = getDb()
  const cohorts = await db('analytics_cohorts')
    .where({ cohort_type: cohortType })
    .orderBy([
      { column: 'cohort_period', order: 'desc' },
      { column: 'period_number', order: 'asc' },
    ])

  // Group by cohort_period
  const matrixMap = new Map<string, any>()

  cohorts.forEach((row) => {
    const period = row.cohort_period
    if (!matrixMap.has(period)) {
      matrixMap.set(period, {
        cohortPeriod: period,
        cohortSize: row.cohort_size,
        retentionSteps: [],
      })
    }
    const cohortObj = matrixMap.get(period)
    cohortObj.retentionSteps.push({
      periodNumber: row.period_number,
      retainedUsers: row.retained_users,
      retentionRate: Number(row.retention_rate),
    })
  })

  return Array.from(matrixMap.values())
}

/**
 * Fast aggregate overview for admin dashboards querying pre-aggregated tables.
 */
export async function getAdminAnalyticsOverview(range = '30days') {
  const db = getDb()

  const [dauWauMau, activation, featureAdoption] = await Promise.all([
    getDauWauMau(),
    getActivationMetrics(),
    getFeatureAdoptionMetrics(),
  ])

  // Total hours and revenue from rollups
  const rollupTotals: any = await db('analytics_daily_rollups')
    .where({ country: 'ALL', platform: 'ALL', category: 'ALL' })
    .select(
      db.raw('COALESCE(SUM(hours_tracked), 0) as total_hours'),
      db.raw('COALESCE(SUM(revenue_tracked_usd), 0) as total_revenue'),
      db.raw('COALESCE(SUM(unpaid_hours_tracked), 0) as unpaid_hours'),
      db.raw('COALESCE(SUM(invoices_paid_amount_usd), 0) as invoices_paid_total'),
      db.raw('COALESCE(SUM(invoices_created_count), 0) as invoices_created_total'),
      db.raw('COALESCE(SUM(events_count), 0) as total_events')
    )
    .first()

  // Geography breakdown from rollups
  const geoBreakdown: any[] = await db('analytics_daily_rollups')
    .whereNot({ country: 'ALL' })
    .where({ platform: 'ALL', category: 'ALL' })
    .groupBy('country')
    .select(
      'country',
      db.raw('MAX(total_users) as total_users'),
      db.raw('SUM(active_users) as active_sessions'),
      db.raw('SUM(hours_tracked) as hours_tracked'),
      db.raw('SUM(revenue_tracked_usd) as revenue_usd')
    )
    .orderBy('total_users', 'desc')
    .limit(10)

  // Category demand
  const categoryBreakdown: any[] = await db('analytics_daily_rollups')
    .whereNot({ category: 'ALL' })
    .where({ country: 'ALL', platform: 'ALL' })
    .groupBy('category')
    .select(
      'category',
      db.raw('SUM(events_count) as events_count'),
      db.raw('SUM(hours_tracked) as hours_tracked'),
      db.raw('SUM(revenue_tracked_usd) as revenue_usd')
    )
    .orderBy('hours_tracked', 'desc')
    .limit(10)

  return {
    success: true,
    range,
    kpis: {
      totalUsers: activation.totalUsers,
      activeUsers: dauWauMau.dau,
      dau: dauWauMau.dau,
      wau: dauWauMau.wau,
      mau: dauWauMau.mau,
      stickinessPercent: dauWauMau.stickinessPercent,
      activationRatePercent: activation.activationRatePercent,
      avgTimeToActivateHours: activation.avgTimeToActivateHours,
      churnRatePercent: activation.churnRatePercent,
      totalHoursTracked: Number(rollupTotals?.total_hours || 0),
      totalRevenueTrackedUsd: Number(rollupTotals?.total_revenue || 0),
      unpaidHoursTracked: Number(rollupTotals?.unpaid_hours || 0),
      invoicesPaidTotalUsd: Number(rollupTotals?.invoices_paid_total || 0),
      invoicesCreatedTotal: Number(rollupTotals?.invoices_created_total || 0),
      totalEventsTracked: Number(rollupTotals?.total_events || 0),
    },
    dailyTrend: dauWauMau.dailyTrend,
    featureAdoption,
    geography: geoBreakdown.map(g => ({
      country: g.country,
      users: Number(g.total_users || 0),
      activeSessions: Number(g.active_sessions || 0),
      hours: Number(Number(g.hours_tracked || 0).toFixed(1)),
      revenue: Number(Number(g.revenue_usd || 0).toFixed(2)),
    })),
    categoryDemand: categoryBreakdown.map(c => ({
      category: c.category,
      events: Number(c.events_count || 0),
      hours: Number(Number(c.hours_tracked || 0).toFixed(1)),
      revenue: Number(Number(c.revenue_usd || 0).toFixed(2)),
    })),
  }
}
