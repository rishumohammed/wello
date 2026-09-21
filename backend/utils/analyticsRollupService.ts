// backend/utils/analyticsRollupService.ts
import { getDb } from './authService'

export interface DailyRollupParams {
  date?: string // YYYY-MM-DD
}

/**
 * Generates or updates idempotent daily rollups for all dimensional slices on a given date.
 */
export async function buildDailyRollup(targetDateStr?: string): Promise<{ date: string; rowsComputed: number }> {
  const db = getDb()
  const dateStr = targetDateStr || new Date().toISOString().split('T')[0]
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`)
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`)

  // 1. Gather all unique dimensions observed in events / users on or before this date
  const countriesQuery = await db('analytics_events')
    .whereBetween('timestamp', [startOfDay, endOfDay])
    .whereNotNull('country')
    .distinct('country')
    .pluck('country')

  const userCountries = await db('users')
    .where('created_at', '<=', endOfDay)
    .whereNotNull('country')
    .distinct('country')
    .pluck('country')

  const uniqueCountries = Array.from(new Set(['ALL', ...countriesQuery, ...userCountries])).filter(Boolean)

  const activeCategories = await db('categories').where({ is_active: 1 }).pluck('slug')
  const uniqueCategories = ['ALL', ...activeCategories]
  const platforms = ['ALL', 'pwa', 'browser', 'mobile']

  // Pre-fetch raw aggregates for the day to avoid N^3 separate full table queries
  // 1. Users cumulative up to end of target day
  const cumulativeUsers = await db('users')
    .where('created_at', '<=', endOfDay)
    .select('id', 'country', 'role', 'created_at')

  const newUsersDay = cumulativeUsers.filter(
    (u: any) => u.created_at >= startOfDay && u.created_at <= endOfDay && u.role !== 'admin'
  )

  // 2. Events on day
  const eventsDay = await db('analytics_events')
    .whereBetween('timestamp', [startOfDay, endOfDay])
    .where({ is_bot: 0, is_internal: 0 })
    .select('id', 'user_id', 'country', 'is_pwa', 'device_type', 'name')

  // 3. Work sessions on day
  const sessionsDay = await db('work_sessions')
    .whereBetween('started_at', [startOfDay, endOfDay])
    .whereNull('deleted_at')
    .select('id', 'user_id', 'duration_seconds', 'payment_type')

  // 4. Payments on day
  const paymentsDay = await db('payments')
    .whereBetween('paid_date', [dateStr, dateStr])
    .whereNull('deleted_at')
    .select('id', 'user_id', 'amount')

  // 5. Invoices on day
  const invoicesDay = await db('invoices')
    .whereNull('deleted_at')
    .select('id', 'user_id', 'status', 'created_at', 'base_total', 'amount_paid')

  // 6. Emails on day
  const emailsDay = await db('email_logs')
    .whereBetween('created_at', [startOfDay, endOfDay])
    .select('id', 'status')

  // Build slices to compute: Global ALL/ALL/ALL + By Country + By Platform + By Category
  const slices: Array<{ country: string; category: string; platform: string }> = [
    { country: 'ALL', category: 'ALL', platform: 'ALL' },
  ]

  for (const c of uniqueCountries) {
    if (c !== 'ALL') slices.push({ country: c, category: 'ALL', platform: 'ALL' })
  }
  for (const p of platforms) {
    if (p !== 'ALL') slices.push({ country: 'ALL', category: 'ALL', platform: p })
  }
  for (const cat of uniqueCategories) {
    if (cat !== 'ALL') slices.push({ country: 'ALL', category: cat, platform: 'ALL' })
  }

  const rollupRows: any[] = []

  for (const slice of slices) {
    // Filter matching users
    const matchedUsers = cumulativeUsers.filter((u: any) => {
      if (u.role === 'admin') return false
      if (slice.country !== 'ALL' && (u.country || '').toUpperCase() !== slice.country.toUpperCase()) return false
      return true
    })
    const totalUsersCount = matchedUsers.length

    const matchedNewSignups = newUsersDay.filter((u: any) => {
      if (slice.country !== 'ALL' && (u.country || '').toUpperCase() !== slice.country.toUpperCase()) return false
      return true
    }).length

    // Filter matching events
    const matchedEvents = eventsDay.filter((e: any) => {
      if (slice.country !== 'ALL' && (e.country || '').toUpperCase() !== slice.country.toUpperCase()) return false
      if (slice.platform === 'pwa' && !e.is_pwa) return false
      if (slice.platform === 'browser' && (e.is_pwa || e.device_type === 'mobile')) return false
      if (slice.platform === 'mobile' && e.device_type !== 'mobile' && !e.is_pwa) return false
      return true
    })

    // Active users: unique user IDs from events, sessions, and payments
    const activeUserSet = new Set<number>()
    matchedEvents.forEach((e: any) => {
      if (e.user_id) activeUserSet.add(e.user_id)
    })
    sessionsDay.forEach((s: any) => {
      if (s.user_id) activeUserSet.add(s.user_id)
    })
    paymentsDay.forEach((p: any) => {
      if (p.user_id) activeUserSet.add(p.user_id)
    })

    const activeUsersCount = activeUserSet.size
    const eventsCount = matchedEvents.length

    // Sessions metrics
    let hoursTracked = 0
    let unpaidHoursTracked = 0
    let unpaidSessionsCount = 0

    sessionsDay.forEach((s: any) => {
      const hours = (s.duration_seconds || 0) / 3600
      hoursTracked += hours
      if (s.payment_type === 'unpaid') {
        unpaidHoursTracked += hours
        unpaidSessionsCount++
      }
    })

    const unpaidSharePercent = hoursTracked > 0 ? (unpaidHoursTracked / hoursTracked) * 100 : 0

    // Payments metrics
    let revenueTrackedUsd = 0
    paymentsDay.forEach((p: any) => {
      revenueTrackedUsd += Number(p.amount) || 0
    })

    // Invoices metrics
    let invoicesCreated = 0
    let invoicesPaid = 0
    let invoicesOverdue = 0
    let invoicesPaidAmount = 0
    const invoiceStatusMap: Record<string, number> = { draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0 }

    invoicesDay.forEach((inv: any) => {
      const createdDate = inv.created_at ? new Date(inv.created_at).toISOString().split('T')[0] : ''
      if (createdDate === dateStr) {
        invoicesCreated++
      }
      const st = (inv.status || 'draft').toLowerCase()
      invoiceStatusMap[st] = (invoiceStatusMap[st] || 0) + 1

      if (st === 'paid') {
        invoicesPaid++
        invoicesPaidAmount += Number(inv.amount_paid || inv.base_total || 0)
      } else if (st === 'overdue') {
        invoicesOverdue++
      }
    })

    // Emails metrics
    let emailsSent = 0
    let emailsDelivered = 0
    let emailsOpened = 0
    let emailsFailed = 0

    emailsDay.forEach((m: any) => {
      emailsSent++
      if (m.status === 'sent') emailsDelivered++
      else if (m.status === 'failed') emailsFailed++
      else if (m.status === 'opened') emailsOpened++
    })

    const errorsCount = matchedEvents.filter((e: any) => e.name === 'error_shown').length

    rollupRows.push({
      rollup_date: dateStr,
      country: slice.country,
      category: slice.category,
      platform: slice.platform,
      total_users: totalUsersCount,
      active_users: activeUsersCount,
      new_signups: matchedNewSignups,
      events_count: eventsCount,
      hours_tracked: Number(hoursTracked.toFixed(2)),
      revenue_tracked_usd: Number(revenueTrackedUsd.toFixed(2)),
      unpaid_sessions_count: unpaidSessionsCount,
      unpaid_hours_tracked: Number(unpaidHoursTracked.toFixed(2)),
      unpaid_share_percent: Number(unpaidSharePercent.toFixed(2)),
      invoices_created_count: invoicesCreated,
      invoices_paid_count: invoicesPaid,
      invoices_overdue_count: invoicesOverdue,
      invoices_paid_amount_usd: Number(invoicesPaidAmount.toFixed(2)),
      invoices_by_status: JSON.stringify(invoiceStatusMap),
      emails_sent: emailsSent,
      emails_delivered: emailsDelivered,
      emails_opened: emailsOpened,
      emails_failed: emailsFailed,
      errors_count: errorsCount,
      created_at: new Date(),
      updated_at: new Date(),
    })
  }

  // Idempotently upsert rollups
  for (const row of rollupRows) {
    await db('analytics_daily_rollups')
      .insert(row)
      .onConflict(['rollup_date', 'country', 'category', 'platform'])
      .merge({
        total_users: row.total_users,
        active_users: row.active_users,
        new_signups: row.new_signups,
        events_count: row.events_count,
        hours_tracked: row.hours_tracked,
        revenue_tracked_usd: row.revenue_tracked_usd,
        unpaid_sessions_count: row.unpaid_sessions_count,
        unpaid_hours_tracked: row.unpaid_hours_tracked,
        unpaid_share_percent: row.unpaid_share_percent,
        invoices_created_count: row.invoices_created_count,
        invoices_paid_count: row.invoices_paid_count,
        invoices_overdue_count: row.invoices_overdue_count,
        invoices_paid_amount_usd: row.invoices_paid_amount_usd,
        invoices_by_status: row.invoices_by_status,
        emails_sent: row.emails_sent,
        emails_delivered: row.emails_delivered,
        emails_opened: row.emails_opened,
        emails_failed: row.emails_failed,
        errors_count: row.errors_count,
        updated_at: new Date(),
      })
  }

  return { date: dateStr, rowsComputed: rollupRows.length }
}

/**
 * Calculates ISO Week string 'YYYY-Www' for a date.
 */
function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * Calculates month string 'YYYY-MM' for a date.
 */
function getYearMonth(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * Recalculates weekly and monthly retention cohorts across all users.
 */
export async function recalculateCohorts(cohortType: 'weekly' | 'monthly' = 'weekly'): Promise<{ cohortType: string; cohortsComputed: number }> {
  const db = getDb()
  const users = await db('users')
    .where('role', '!=', 'admin')
    .select('id', 'created_at')

  if (users.length === 0) return { cohortType, cohortsComputed: 0 }

  // Load all user activities (events, sessions, payments)
  const userEvents = await db('analytics_events')
    .where({ is_bot: 0, is_internal: 0 })
    .whereNotNull('user_id')
    .select('user_id', 'timestamp')

  const userSessions = await db('work_sessions')
    .whereNull('deleted_at')
    .select('user_id', 'started_at as timestamp')

  const userPayments = await db('payments')
    .whereNull('deleted_at')
    .select('user_id', 'paid_date as timestamp')

  // Map user ID -> list of activity timestamps
  const userActivitiesMap = new Map<number, Date[]>()

  const addActivity = (uid: number, ts: any) => {
    if (!uid || !ts) return
    const d = new Date(ts)
    if (isNaN(d.getTime())) return
    const list = userActivitiesMap.get(uid) || []
    list.push(d)
    userActivitiesMap.set(uid, list)
  }

  userEvents.forEach((e: any) => addActivity(e.user_id, e.timestamp))
  userSessions.forEach((s: any) => addActivity(s.user_id, s.timestamp))
  userPayments.forEach((p: any) => addActivity(p.user_id, p.timestamp))

  // Build cohorts - focus on the most recent 12 periods
  const cohortGroups = new Map<string, Array<{ userId: number; regDate: Date }>>()

  // Only take recent users for cohort computation to maintain sub-second response
  const recentCutoff = new Date(Date.now() - 90 * 86400000)
  const cohortUsers = users.filter((u: any) => new Date(u.created_at) >= recentCutoff).slice(0, 2000)

  cohortUsers.forEach((u: any) => {
    const regDate = new Date(u.created_at)
    const periodKey = cohortType === 'weekly' ? getIsoWeek(regDate) : getYearMonth(regDate)
    const group = cohortGroups.get(periodKey) || []
    group.push({ userId: u.id, regDate })
    cohortGroups.set(periodKey, group)
  })

  const maxPeriods = cohortType === 'weekly' ? 8 : 6
  let computedCount = 0

  for (const [cohortPeriod, memberUsers] of cohortGroups.entries()) {
    const cohortSize = memberUsers.length

    for (let periodNum = 0; periodNum <= maxPeriods; periodNum++) {
      let retainedCount = 0

      if (periodNum === 0) {
        // Step 0 is always 100%
        retainedCount = cohortSize
      } else {
        for (const member of memberUsers) {
          const activities = userActivitiesMap.get(member.userId) || []
          const hasActivityInPeriod = activities.some((actDate) => {
            const diffMs = actDate.getTime() - member.regDate.getTime()
            if (diffMs < 0) return false

            if (cohortType === 'weekly') {
              const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
              return diffWeeks === periodNum
            } else {
              const monthsDiff =
                (actDate.getUTCFullYear() - member.regDate.getUTCFullYear()) * 12 +
                (actDate.getUTCMonth() - member.regDate.getUTCMonth())
              return monthsDiff === periodNum
            }
          })

          if (hasActivityInPeriod) {
            retainedCount++
          }
        }
      }

      const retentionRate = cohortSize > 0 ? Number(((retainedCount / cohortSize) * 100).toFixed(2)) : 0

      await db('analytics_cohorts')
        .insert({
          cohort_type: cohortType,
          cohort_period: cohortPeriod,
          period_number: periodNum,
          cohort_size: cohortSize,
          retained_users: retainedCount,
          retention_rate: retentionRate,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict(['cohort_type', 'cohort_period', 'period_number'])
        .merge({
          cohort_size: cohortSize,
          retained_users: retainedCount,
          retention_rate: retentionRate,
          updated_at: new Date(),
        })

      computedCount++
    }
  }

  return { cohortType, cohortsComputed: computedCount }
}

/**
 * Recalculates activation, churn, and lifecycle summaries for all users or a specific user.
 */
export async function recalculateUserSummaries(targetUserId?: number): Promise<{ usersUpdated: number }> {
  const db = getDb()
  let query = db('users').select('id', 'name', 'email', 'status', 'role', 'country', 'created_at')
  if (targetUserId) {
    query = query.where({ id: targetUserId })
  } else {
    // Process newly registered or recently active users to maintain sub-second performance
    const activeUserIds = await db('analytics_events')
      .where('timestamp', '>=', new Date(Date.now() - 7 * 86400000))
      .whereNotNull('user_id')
      .distinct('user_id')
      .pluck('user_id')
    
    query = query.where(function () {
      this.where('created_at', '>=', new Date(Date.now() - 7 * 86400000))
      if (activeUserIds.length > 0) {
        this.orWhereIn('id', activeUserIds)
      }
    }).orderBy('id', 'desc').limit(200)
  }

  const users = await query
  if (users.length === 0) return { usersUpdated: 0 }

  const now = new Date()

  for (const user of users) {
    const isInternal = user.role === 'admin'
    const registeredAt = new Date(user.created_at)

    // Events summary
    const userEvents = await db('analytics_events')
      .where({ user_id: user.id })
      .orderBy('timestamp', 'asc')
      .select('name', 'timestamp', 'country')

    const firstSeenAt = userEvents.length > 0 && userEvents[0].timestamp < registeredAt
      ? new Date(userEvents[0].timestamp)
      : registeredAt

    // Work Sessions summary
    const sessions = await db('work_sessions')
      .where({ user_id: user.id })
      .whereNull('deleted_at')
      .select('duration_seconds', 'started_at')

    const totalSessionsCount = sessions.length
    let totalHoursTracked = 0
    let firstSessionAt: Date | null = null
    let lastSessionAt: Date | null = null

    sessions.forEach((s: any) => {
      totalHoursTracked += (s.duration_seconds || 0) / 3600
      const sDate = new Date(s.started_at)
      if (!firstSessionAt || sDate < firstSessionAt) firstSessionAt = sDate
      if (!lastSessionAt || sDate > lastSessionAt) lastSessionAt = sDate
    })

    // Payments summary
    const payments = await db('payments')
      .where({ user_id: user.id })
      .whereNull('deleted_at')
      .select('amount', 'paid_date')

    const totalPaymentsCount = payments.length
    let totalRevenueUsd = 0
    let firstPaymentAt: Date | null = null
    let lastPaymentAt: Date | null = null

    payments.forEach((p: any) => {
      totalRevenueUsd += Number(p.amount) || 0
      const pDate = new Date(p.paid_date)
      if (!firstPaymentAt || pDate < firstPaymentAt) firstPaymentAt = pDate
      if (!lastPaymentAt || pDate > lastPaymentAt) lastPaymentAt = pDate
    })

    // Invoices summary
    const invoices = await db('invoices')
      .where({ user_id: user.id })
      .whereNull('deleted_at')
      .select('id', 'created_at')

    const totalInvoicesCount = invoices.length

    // Clients & Projects
    const clientsCount = await db('clients').where({ user_id: user.id }).whereNull('deleted_at').count('id as count').first()
    const projectsCount = await db('projects').where({ user_id: user.id }).whereNull('deleted_at').count('id as count').first()
    const hasCreatedEntity = (Number(clientsCount?.count) || 0) > 0 || (Number(projectsCount?.count) || 0) > 0

    // Onboarding completion
    const profileCompletedEvt = userEvents.find((e: any) =>
      ['profile_completed', 'registration_completed', 'onboarding_step_completed'].includes(e.name)
    )
    const onboardingCompletedAt = profileCompletedEvt ? new Date(profileCompletedEvt.timestamp) : null

    // First and last active timestamp
    const allActivityDates: Date[] = []
    userEvents.forEach((e: any) => allActivityDates.push(new Date(e.timestamp)))
    if (firstSessionAt) allActivityDates.push(firstSessionAt)
    if (lastSessionAt) allActivityDates.push(lastSessionAt)
    if (firstPaymentAt) allActivityDates.push(firstPaymentAt)
    if (lastPaymentAt) allActivityDates.push(lastPaymentAt)

    allActivityDates.sort((a, b) => a.getTime() - b.getTime())

    const firstActiveAt = allActivityDates.length > 0 ? allActivityDates[0] : null
    const lastActiveAt = allActivityDates.length > 0 ? allActivityDates[allActivityDates.length - 1] : null

    // Activation calculation
    // A user is activated if they have created an entity AND logged a session or payment or invoice
    const isActivated = hasCreatedEntity && (totalSessionsCount > 0 || totalPaymentsCount > 0 || totalInvoicesCount > 0)
    let timeToActivateHours: number | null = null

    if (isActivated && firstActiveAt) {
      const diffMs = Math.max(0, firstActiveAt.getTime() - registeredAt.getTime())
      timeToActivateHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2))
    }

    // Churn calculation: inactive for > 30 days and registered > 30 days ago
    const daysSinceReg = (now.getTime() - registeredAt.getTime()) / (1000 * 60 * 60 * 24)
    const daysSinceLastActive = lastActiveAt
      ? (now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
      : daysSinceReg

    const isChurned = daysSinceReg > 30 && daysSinceLastActive > 30

    // Funnel stage determination
    let currentFunnelStage = 'registration_started'
    if (user.status === 'VERIFIED' || userEvents.some((e: any) => e.name === 'otp_verified')) {
      currentFunnelStage = 'otp_verified'
    }
    if (onboardingCompletedAt) {
      currentFunnelStage = 'profile_completed'
    }
    if (hasCreatedEntity) {
      currentFunnelStage = 'first_entity'
    }
    if (totalSessionsCount > 0) {
      currentFunnelStage = 'first_timer_or_session'
    }
    if (totalPaymentsCount > 0) {
      currentFunnelStage = 'first_payment'
    }
    if (totalInvoicesCount > 0) {
      currentFunnelStage = 'first_invoice'
    }
    if (isActivated && daysSinceLastActive <= 7 && daysSinceReg >= 7) {
      currentFunnelStage = 'returned_within_7d'
    }

    const country = user.country || (userEvents.length > 0 ? userEvents[0].country : null)

    await db('analytics_user_summaries')
      .insert({
        user_id: user.id,
        first_seen_at: firstSeenAt,
        registered_at: registeredAt,
        onboarding_completed_at: onboardingCompletedAt,
        first_active_at: firstActiveAt,
        last_active_at: lastActiveAt,
        total_sessions_count: totalSessionsCount,
        total_hours_tracked: Number(totalHoursTracked.toFixed(2)),
        total_payments_count: totalPaymentsCount,
        total_revenue_usd: Number(totalRevenueUsd.toFixed(2)),
        total_invoices_count: totalInvoicesCount,
        total_events_count: userEvents.length,
        current_funnel_stage: currentFunnelStage,
        time_to_activate_hours: timeToActivateHours,
        is_activated: isActivated ? 1 : 0,
        is_churned: isChurned ? 1 : 0,
        is_internal: isInternal ? 1 : 0,
        country: country ? country.toUpperCase().slice(0, 3) : null,
        created_at: now,
        updated_at: now,
      })
      .onConflict('user_id')
      .merge({
        first_seen_at: firstSeenAt,
        registered_at: registeredAt,
        onboarding_completed_at: onboardingCompletedAt,
        first_active_at: firstActiveAt,
        last_active_at: lastActiveAt,
        total_sessions_count: totalSessionsCount,
        total_hours_tracked: Number(totalHoursTracked.toFixed(2)),
        total_payments_count: totalPaymentsCount,
        total_revenue_usd: Number(totalRevenueUsd.toFixed(2)),
        total_invoices_count: totalInvoicesCount,
        total_events_count: userEvents.length,
        current_funnel_stage: currentFunnelStage,
        time_to_activate_hours: timeToActivateHours,
        is_activated: isActivated ? 1 : 0,
        is_churned: isChurned ? 1 : 0,
        is_internal: isInternal ? 1 : 0,
        country: country ? country.toUpperCase().slice(0, 3) : null,
        updated_at: now,
      })
  }

  return { usersUpdated: users.length }
}

/**
 * Dynamically evaluates a database-configured funnel and returns drop-off / conversion metrics.
 */
export async function evaluateFunnel(
  funnelSlug: string = 'default_activation_funnel',
  options?: { startDate?: string; endDate?: string; country?: string }
): Promise<{
  funnel: any
  steps: Array<{
    stepOrder: number
    stepKey: string
    stepName: string
    count: number
    conversionRate: number
    dropOffRate: number
  }>
  summary: {
    totalStarted: number
    totalCompleted: number
    overallConversionRate: number
    overallDropOffRate: number
  }
}> {
  const db = getDb()

  const funnelDef = await db('analytics_funnel_definitions')
    .where({ slug: funnelSlug, is_active: 1 })
    .first()

  if (!funnelDef) {
    throw new Error(`Funnel definition '${funnelSlug}' not found or inactive.`)
  }

  const steps = await db('analytics_funnel_steps')
    .where({ funnel_id: funnelDef.id })
    .orderBy('step_order', 'asc')

  if (steps.length === 0) {
    return {
      funnel: funnelDef,
      steps: [],
      summary: { totalStarted: 0, totalCompleted: 0, overallConversionRate: 0, overallDropOffRate: 0 },
    }
  }

  // Query events matching step event names
  let query = db('analytics_events')
    .where({ is_bot: 0, is_internal: 0 })

  if (options?.startDate) {
    query = query.where('timestamp', '>=', new Date(options.startDate))
  }
  if (options?.endDate) {
    query = query.where('timestamp', '<=', new Date(options.endDate))
  }
  if (options?.country && options.country !== 'ALL') {
    query = query.where({ country: options.country })
  }

  const events = await query.select('name', 'user_id', 'anonymous_id')

  // Calculate unique identifiers per step
  const stepMetrics: Array<{
    stepOrder: number
    stepKey: string
    stepName: string
    count: number
    conversionRate: number
    dropOffRate: number
  }> = []

  let initialCount = 0
  let prevCount = 0

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const eventNames: string[] = typeof step.event_names === 'string'
      ? JSON.parse(step.event_names)
      : step.event_names || []

    const userSet = new Set<string>()

    events.forEach((e: any) => {
      if (eventNames.includes(e.name)) {
        const id = e.user_id ? `u_${e.user_id}` : e.anonymous_id ? `anon_${e.anonymous_id}` : null
        if (id) userSet.add(id)
      }
    })

    const count = userSet.size

    if (i === 0) {
      initialCount = count
      prevCount = count
      stepMetrics.push({
        stepOrder: step.step_order,
        stepKey: step.step_key,
        stepName: step.step_name,
        count,
        conversionRate: count > 0 ? 100 : 0,
        dropOffRate: 0,
      })
    } else {
      const conversionRate = initialCount > 0 ? Number(((count / initialCount) * 100).toFixed(1)) : 0
      const dropOffRate = prevCount > 0 ? Number((((prevCount - count) / prevCount) * 100).toFixed(1)) : 0
      prevCount = count

      stepMetrics.push({
        stepOrder: step.step_order,
        stepKey: step.step_key,
        stepName: step.step_name,
        count,
        conversionRate: Math.min(100, conversionRate),
        dropOffRate: Math.max(0, dropOffRate),
      })
    }
  }

  const finalCount = stepMetrics[stepMetrics.length - 1]?.count || 0
  const overallConversion = initialCount > 0 ? Number(((finalCount / initialCount) * 100).toFixed(1)) : 0

  return {
    funnel: {
      slug: funnelDef.slug,
      name: funnelDef.name,
      description: funnelDef.description,
      windowDays: funnelDef.window_days,
    },
    steps: stepMetrics,
    summary: {
      totalStarted: initialCount,
      totalCompleted: finalCount,
      overallConversionRate: overallConversion,
      overallDropOffRate: Number((100 - overallConversion).toFixed(1)),
    },
  }
}
