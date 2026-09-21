// backend/utils/analyticsBackfillService.ts
import { getDb } from './authService'
import { buildDailyRollup, recalculateCohorts, recalculateUserSummaries } from './analyticsRollupService'
import { sanitizeProperties } from './analyticsIngestService'

/**
 * Historical backfill script to reconstruct canonical analytics events,
 * daily rollups, cohort retention matrix, and user summaries from primary database records.
 */
export async function runHistoricalAnalyticsBackfill(daysToBackfill: number = 30): Promise<{
  synthesizedEvents: number
  daysRolledUp: number
  cohortsUpdated: number
  usersSummarized: number
}> {
  const db = getDb()
  let synthesizedEventsCount = 0

  // 1. Backfill User Onboarding & Registration Events
  const users = await db('users').select('id', 'name', 'email', 'status', 'role', 'country', 'timezone', 'created_at')

  for (const user of users) {
    if (user.role === 'admin') continue
    const regDate = new Date(user.created_at)

    // Check if registration_started exists
    const hasRegEvent = await db('analytics_events')
      .where({ user_id: user.id, name: 'registration_started' })
      .first()

    if (!hasRegEvent) {
      await db('analytics_events').insert({
        user_id: user.id,
        name: 'registration_started',
        event_name: 'registration_started',
        timestamp: regDate,
        created_at: regDate,
        country: user.country || 'US',
        timezone: user.timezone || 'UTC',
        properties: JSON.stringify({ source: 'backfill' }),
        is_bot: 0,
        is_internal: 0,
      })
      synthesizedEventsCount++
    }

    if (user.status === 'VERIFIED' || user.status === 'ACTIVE') {
      const hasOtpEvent = await db('analytics_events')
        .where({ user_id: user.id, name: 'otp_verified' })
        .first()

      if (!hasOtpEvent) {
        const otpDate = new Date(regDate.getTime() + 60000)
        await db('analytics_events').insert({
          user_id: user.id,
          name: 'otp_verified',
          event_name: 'otp_verified',
          timestamp: otpDate,
          created_at: otpDate,
          country: user.country || 'US',
          timezone: user.timezone || 'UTC',
          properties: JSON.stringify({ source: 'backfill' }),
          is_bot: 0,
          is_internal: 0,
        })
        synthesizedEventsCount++
      }

      const hasProfileEvent = await db('analytics_events')
        .where({ user_id: user.id, name: 'profile_completed' })
        .first()

      if (!hasProfileEvent) {
        const profDate = new Date(regDate.getTime() + 120000)
        await db('analytics_events').insert({
          user_id: user.id,
          name: 'profile_completed',
          event_name: 'profile_completed',
          timestamp: profDate,
          created_at: profDate,
          country: user.country || 'US',
          timezone: user.timezone || 'UTC',
          properties: JSON.stringify({ source: 'backfill' }),
          is_bot: 0,
          is_internal: 0,
        })
        synthesizedEventsCount++
      }
    }
  }

  // 2. Backfill Work Session Events
  const sessions = await db('work_sessions')
    .whereNull('deleted_at')
    .select('id', 'user_id', 'duration_seconds', 'payment_type', 'started_at', 'created_at')

  for (const session of sessions) {
    const sDate = new Date(session.started_at || session.created_at)
    const hasEvent = await db('analytics_events')
      .where({ user_id: session.user_id, name: 'session_logged' })
      .where('timestamp', sDate)
      .first()

    if (!hasEvent) {
      await db('analytics_events').insert({
        user_id: session.user_id,
        name: 'session_logged',
        event_name: 'session_logged',
        timestamp: sDate,
        created_at: sDate,
        properties: JSON.stringify(
          sanitizeProperties({
            session_id: session.id,
            duration_minutes: Math.round((session.duration_seconds || 0) / 60),
            payment_type: session.payment_type,
            source: 'backfill',
          })
        ),
        is_bot: 0,
        is_internal: 0,
      })
      synthesizedEventsCount++
    }
  }

  // 3. Backfill Payments Events
  const payments = await db('payments')
    .whereNull('deleted_at')
    .select('id', 'user_id', 'amount', 'currency', 'paid_date', 'created_at')

  for (const payment of payments) {
    const pDate = new Date(payment.paid_date || payment.created_at)
    const hasEvent = await db('analytics_events')
      .where({ user_id: payment.user_id, name: 'payment_logged' })
      .where('timestamp', pDate)
      .first()

    if (!hasEvent) {
      await db('analytics_events').insert({
        user_id: payment.user_id,
        name: 'payment_logged',
        event_name: 'payment_logged',
        timestamp: pDate,
        created_at: pDate,
        properties: JSON.stringify(
          sanitizeProperties({
            payment_id: payment.id,
            currency: payment.currency,
            amount: Number(payment.amount),
            source: 'backfill',
          })
        ),
        is_bot: 0,
        is_internal: 0,
      })
      synthesizedEventsCount++
    }
  }

  // 4. Backfill Invoices Events
  const invoices = await db('invoices')
    .whereNull('deleted_at')
    .select('id', 'user_id', 'status', 'base_total', 'created_at', 'sent_at')

  for (const inv of invoices) {
    const invDate = new Date(inv.created_at)
    const hasEvent = await db('analytics_events')
      .where({ user_id: inv.user_id, name: 'invoice_created' })
      .where('timestamp', invDate)
      .first()

    if (!hasEvent) {
      await db('analytics_events').insert({
        user_id: inv.user_id,
        name: 'invoice_created',
        event_name: 'invoice_created',
        timestamp: invDate,
        created_at: invDate,
        properties: JSON.stringify(
          sanitizeProperties({
            invoice_id: inv.id,
            status: inv.status,
            amount: Number(inv.base_total),
            source: 'backfill',
          })
        ),
        is_bot: 0,
        is_internal: 0,
      })
      synthesizedEventsCount++
    }
  }

  // 5. Backfill Addon Events
  const hasAddonTable = await db.schema.hasTable('user_addons')
  if (hasAddonTable) {
    const addons = await db('user_addons').select('user_id', 'addon_slug', 'created_at')
    for (const add of addons) {
      const addDate = new Date(add.created_at)
      const hasEvent = await db('analytics_events')
        .where({ user_id: add.user_id, name: 'addon_activated' })
        .where('timestamp', addDate)
        .first()

      if (!hasEvent) {
        await db('analytics_events').insert({
          user_id: add.user_id,
          name: 'addon_activated',
          event_name: 'addon_activated',
          timestamp: addDate,
          created_at: addDate,
          properties: JSON.stringify({
            addon_slug: add.addon_slug,
            source: 'backfill',
          }),
          is_bot: 0,
          is_internal: 0,
        })
        synthesizedEventsCount++
      }
    }
  }

  // 6. Build Daily Rollups for last N days
  let daysRolledUp = 0
  const now = new Date()

  for (let i = 0; i <= daysToBackfill; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dateStr = d.toISOString().split('T')[0]
    await buildDailyRollup(dateStr)
    daysRolledUp++
  }

  // 7. Recalculate Cohorts (Weekly & Monthly)
  const [weeklyRes, monthlyRes] = await Promise.all([
    recalculateCohorts('weekly'),
    recalculateCohorts('monthly'),
  ])

  // 8. Recalculate User Summaries
  const summariesRes = await recalculateUserSummaries()

  return {
    synthesizedEvents: synthesizedEventsCount,
    daysRolledUp,
    cohortsUpdated: weeklyRes.cohortsComputed + monthlyRes.cohortsComputed,
    usersSummarized: summariesRes.usersUpdated,
  }
}
