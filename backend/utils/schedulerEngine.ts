// backend/utils/schedulerEngine.ts
/**
 * Concurrency-Safe Distributed Scheduler Engine for Wello
 * Uses database-level row leasing in `scheduler_locks` and idempotent job execution logging
 * in `scheduled_jobs_log` so jobs never run twice or send duplicate notifications.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'
import { getDb } from './db'
import { createNotification } from './notificationsEngine'
import { dispatchEmailWithLog, renderEmailTemplate } from './emailEngine'
import { generateReportSummary } from './reportsEngine'
import { roundToCurrencyDecimals } from './currencyUtils'
import { runDataRetentionPurge } from './dataRetentionService'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

const LOCK_NAME = 'wello_global_scheduler_lock'
const LEASE_DURATION_MS = 45 * 1000 // 45-second lock lease

export interface SchedulerRunResult {
  acquiredLock: boolean
  executedAt: string
  jobResults: Record<string, { executed: number; skipped: number; errors: string[] }>
  durationMs: number
}

/**
 * Attempts to acquire the distributed scheduler lock.
 */
export async function acquireSchedulerLock(workerId: string = 'worker_main'): Promise<boolean> {
  const db = getDb()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LEASE_DURATION_MS)

  try {
    const existing = await db('scheduler_locks').where({ lock_name: LOCK_NAME }).first()

    if (!existing) {
      await db('scheduler_locks').insert({
        lock_name: LOCK_NAME,
        locked_by: workerId,
        locked_at: now,
        lease_expires_at: expiresAt,
      })
      return true
    }

    // Check if lease expired
    if (new Date(existing.lease_expires_at) < now) {
      const updated = await db('scheduler_locks')
        .where({ lock_name: LOCK_NAME })
        .where('lease_expires_at', '<', now)
        .update({
          locked_by: workerId,
          locked_at: now,
          lease_expires_at: expiresAt,
        })
      return updated > 0
    }

    // Lock is currently held by an active lease
    return false
  } catch (err) {
    console.warn('[Scheduler Lock] Error acquiring lock:', err)
    return false
  }
}

/**
 * Releases the distributed scheduler lock.
 */
export async function releaseSchedulerLock(workerId: string = 'worker_main'): Promise<void> {
  const db = getDb()
  try {
    await db('scheduler_locks')
      .where({ lock_name: LOCK_NAME, locked_by: workerId })
      .delete()
  } catch (err) {
    console.warn('[Scheduler Lock] Error releasing lock:', err)
  }
}

/**
 * Checks if a scheduled job has already been executed for a specific key/window.
 */
export async function isJobAlreadyExecuted(jobKey: string): Promise<boolean> {
  const db = getDb()
  const existing = await db('scheduled_jobs_log')
    .where({ job_key: jobKey, status: 'success' })
    .first()
  return Boolean(existing)
}

/**
 * Logs the result of a scheduled job execution for idempotency.
 */
export async function logJobExecution(jobKey: string, jobName: string, userId: number | null, status: 'success' | 'failed' | 'skipped', summary?: any): Promise<void> {
  const db = getDb()
  try {
    await db('scheduled_jobs_log').insert({
      job_key: jobKey,
      job_name: jobName,
      user_id: userId,
      status,
      result_summary: summary ? JSON.stringify(summary) : null,
      executed_at: db.fn.now(3),
    })
  } catch (err: any) {
    // If unique constraint triggers on duplicate concurrent insert, ignore
    if (!err?.message?.includes('duplicate') && !err?.message?.includes('UNIQUE')) {
      console.warn('[Scheduler Log] Failed to log job execution:', err)
    }
  }
}

// ─── 1. INVOICE OVERDUE & DUE SOON CHECKER ──────────────────────────────────
export async function checkOverdueInvoices(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const now = new Date()
  const nowIso = now.toISOString()
  const todayStr = nowIso.slice(0, 10)
  const errors: string[] = []
  let executed = 0
  let skipped = 0

  try {
    // A. Derive Overdue Invoices
    const overdueInvoices = await db('invoices')
      .whereIn('status', ['sent', 'viewed', 'partially_paid'])
      .where('due_date', '<', todayStr)
      .whereNull('deleted_at')

    for (const inv of overdueInvoices) {
      const jobKey = `invoice_overdue:${inv.id}:${todayStr}`
      if (await isJobAlreadyExecuted(jobKey)) {
        skipped++
        continue
      }

      await db('invoices').where({ id: inv.id }).update({
        status: 'overdue',
        updated_at: db.fn.now(3),
      })

      // Notify seller/user
      await createNotification({
        userId: inv.user_id,
        type: 'invoice_overdue',
        title: `Invoice ${inv.invoice_number} is Overdue`,
        message: `Invoice ${inv.invoice_number} for ${inv.currency} ${inv.total} was due on ${inv.due_date?.slice(0, 10)}.`,
        actionUrl: `/invoicing/${inv.id}`,
        metadata: { invoiceId: inv.id, invoiceNumber: inv.invoice_number, total: inv.total, currency: inv.currency },
      })

      await logJobExecution(jobKey, 'invoice_overdue_checker', inv.user_id, 'success', { invoiceId: inv.id, status: 'overdue' })
      executed++
    }

    // B. Due Soon Reminders (due within next 3 days)
    const threeDaysLater = dayjs().add(3, 'day').format('YYYY-MM-DD')
    const dueSoonInvoices = await db('invoices')
      .whereIn('status', ['sent', 'viewed', 'partially_paid'])
      .where('due_date', '>=', todayStr)
      .where('due_date', '<=', threeDaysLater)
      .whereNull('deleted_at')

    for (const inv of dueSoonInvoices) {
      const jobKey = `invoice_due_soon:${inv.id}:${inv.due_date?.slice(0, 10)}`
      if (await isJobAlreadyExecuted(jobKey)) {
        skipped++
        continue
      }

      await createNotification({
        userId: inv.user_id,
        type: 'invoice_due_soon',
        title: `Invoice ${inv.invoice_number} Due Soon`,
        message: `Invoice ${inv.invoice_number} (${inv.currency} ${inv.balance_due || inv.total}) is due on ${inv.due_date?.slice(0, 10)}.`,
        actionUrl: `/invoicing/${inv.id}`,
        metadata: { invoiceId: inv.id, invoiceNumber: inv.invoice_number, dueDate: inv.due_date },
      })

      await logJobExecution(jobKey, 'invoice_due_soon_checker', inv.user_id, 'success', { invoiceId: inv.id })
      executed++
    }
  } catch (err: any) {
    errors.push(err?.message || String(err))
  }

  return { executed, skipped, errors }
}

// ─── 2. FORGOTTEN ACTIVE TIMER CHECKER ─────────────────────────────────────
export async function checkForgottenTimers(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const now = new Date()
  const errors: string[] = []
  let executed = 0
  let skipped = 0

  try {
    const activeTimers = await db('active_timers')
      .join('users', 'active_timers.user_id', 'users.id')
      .where('active_timers.is_paused', false)
      .select('active_timers.*', 'users.max_timer_hours', 'users.email', 'users.name')

    for (const timer of activeTimers) {
      const maxHours = Number(timer.max_timer_hours) || 8
      const maxSeconds = maxHours * 3600
      const startedMs = new Date(timer.started_at).getTime()
      const totalElapsedSec = Math.max(0, Math.floor((now.getTime() - startedMs) / 1000) - (Number(timer.total_paused_seconds) || 0))

      if (totalElapsedSec >= maxSeconds) {
        // Run once per active session instance
        const jobKey = `forgotten_timer:${timer.id}:${Math.floor(totalElapsedSec / 3600)}h`
        if (await isJobAlreadyExecuted(jobKey)) {
          skipped++
          continue
        }

        await createNotification({
          userId: timer.user_id,
          type: 'forgotten_timer',
          title: 'Active Timer Running Past Threshold',
          message: `Your active timer has been running for ${Math.round(totalElapsedSec / 3600)} hours (limit: ${maxHours}h). Don't forget to stop or trim it.`,
          actionUrl: '/work?tab=time',
          metadata: { timerId: timer.id, elapsedSeconds: totalElapsedSec, maxHours },
        })

        await logJobExecution(jobKey, 'forgotten_timer_checker', timer.user_id, 'success', { timerId: timer.id, elapsedSeconds: totalElapsedSec })
        executed++
      }
    }
  } catch (err: any) {
    errors.push(err?.message || String(err))
  }

  return { executed, skipped, errors }
}

// ─── 3. QUOTE FOLLOW-UP CHECKER ─────────────────────────────────────────────
export async function checkQuoteFollowups(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const now = dayjs()
  const errors: string[] = []
  let executed = 0
  let skipped = 0

  try {
    const sentQuotes = await db('project_quotes')
      .join('projects', 'project_quotes.project_id', 'projects.id')
      .where('project_quotes.status', 'sent')
      .whereNull('project_quotes.deleted_at')
      .select('project_quotes.*', 'projects.name as project_name')

    for (const quote of sentQuotes) {
      const quoteAgeDays = now.diff(dayjs(quote.created_at), 'day')
      if (quoteAgeDays >= 3) {
        const jobKey = `quote_followup:${quote.id}:day${quoteAgeDays}`
        if (await isJobAlreadyExecuted(jobKey)) {
          skipped++
          continue
        }

        await createNotification({
          userId: quote.user_id,
          type: 'quote_awaiting_response',
          title: `Proposal for "${quote.project_name}" Awaiting Client Action`,
          message: `Your proposal for "${quote.project_name}" (${quote.currency} ${quote.quote_amount}) was sent ${quoteAgeDays} days ago. Consider following up with your client.`,
          actionUrl: `/work?tab=projects`,
          metadata: { quoteId: quote.id, projectId: quote.project_id, ageDays: quoteAgeDays },
        })

        await logJobExecution(jobKey, 'quote_followup_checker', quote.user_id, 'success', { quoteId: quote.id, ageDays: quoteAgeDays })
        executed++
      }
    }
  } catch (err: any) {
    errors.push(err?.message || String(err))
  }

  return { executed, skipped, errors }
}

// ─── 4. SCHEDULED EMAIL DIGEST DISPATCHER ───────────────────────────────────
export async function dispatchWeeklyDigests(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const nowUtc = dayjs.utc()
  const errors: string[] = []
  let executed = 0
  let skipped = 0

  try {
    const users = await db('users')
      .where('status', 'ACTIVE')
      .whereNull('deleted_at')
      .whereNull('email_unsubscribed_at')
      .whereNot('digest_frequency', 'disabled')

    for (const user of users) {
      const userTz = user.timezone || 'UTC'
      const userLocal = dayjs().tz(userTz)
      const userDayOfWeek = userLocal.day() // 0 = Sun, 1 = Mon
      const targetDay = Number(user.digest_day_of_week != null ? user.digest_day_of_week : 1)
      const weekKey = `${userLocal.year()}-W${userLocal.isoWeek ? userLocal.isoWeek() : Math.ceil(userLocal.dayOfYear() / 7)}`
      const jobKey = `weekly_digest:${user.id}:${weekKey}`

      // Check if already dispatched for this user this week
      if (await isJobAlreadyExecuted(jobKey)) {
        skipped++
        continue
      }

      // If frequency is weekly, only run on user's configured day (or if triggered manually)
      if (user.digest_frequency === 'weekly' && userDayOfWeek !== targetDay) {
        continue
      }

      // Generate Authoritative Weekly Report
      const report = await generateReportSummary({
        userId: user.id,
        range: 'weekly',
        timezone: userTz,
      })

      const targetRate = Number(user.target_hourly || 100)
      const isTargetMet = report.rates.allInRate >= targetRate
      const targetDelta = report.rates.targetDeltaPct
      const currency = user.base_currency || 'USD'

      const unsubscribeUrl = `https://wello.app/api/auth/unsubscribe?token=${user.unsubscribe_token || user.id}`

      // Render digest HTML
      const digestHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #E5E7EB; border-radius: 12px; background: #FFFFFF;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
            <div style="display: flex; align-items: center;">
              <div style="background: #6366F1; color: #fff; width: 40px; height: 40px; border-radius: 10px; font-weight: bold; font-size: 20px; line-height: 40px; text-align: center;">W</div>
              <span style="font-weight: 800; font-size: 20px; margin-left: 12px; color: #111827; letter-spacing: -0.5px;">Wello Weekly Digest</span>
            </div>
            <span style="font-size: 12px; color: #6B7280; font-weight: 500;">${report.rangeLabel}</span>
          </div>

          <p style="font-size: 15px; color: #374151; margin: 0 0 20px 0;">Hello <strong>${user.name}</strong>, here is your executive performance & true hourly value summary for the past week:</p>

          <!-- Key Stats Grid -->
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">
            <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px;">
              <div style="font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase;">All-In Real Rate</div>
              <div style="font-size: 22px; font-weight: 800; color: #111827; margin: 4px 0;">${currency} ${report.rates.allInRate}/h</div>
              <div style="font-size: 12px; color: ${isTargetMet ? '#059669' : '#DC2626'}; font-weight: 600;">Target: ${currency} ${targetRate}/h (${targetDelta >= 0 ? '+' : ''}${targetDelta}%)</div>
            </div>
            <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px;">
              <div style="font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase;">Net Income Collected</div>
              <div style="font-size: 22px; font-weight: 800; color: #059669; margin: 4px 0;">${currency} ${report.financials.collectedNetIncome}</div>
              <div style="font-size: 12px; color: #6B7280;">Gross: ${currency} ${report.financials.collectedRevenue}</div>
            </div>
          </div>

          <!-- Hours & Leakage -->
          <div style="background: #F3F4F6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <div style="font-weight: 700; font-size: 13px; color: #1F2937; margin-bottom: 8px;">Time & Unpaid Leakage Overview</div>
            <div style="font-size: 13px; color: #4B5563; line-height: 1.6;">
              • Total Time: <strong>${report.hours.totalAllHours} hrs</strong> (Paid: ${report.hours.paidHours}h, Unpaid: ${report.hours.unpaidClientHours}h)<br />
              • Unpaid Time Ratio: <strong>${report.hours.unpaidRatioPct}%</strong> of total working time
            </div>
            ${report.topLeakageReasons.length > 0 ? `
              <div style="margin-top: 10px; font-size: 12px; color: #DC2626; font-weight: 600;">
                Top Leakage: ${report.topLeakageReasons[0].label} (${report.topLeakageReasons[0].hours}h, opp. cost: ${currency} ${report.topLeakageReasons[0].estimatedOpportunityCost})
              </div>
            ` : ''}
          </div>

          <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="https://wello.app/reports" style="display: inline-block; background: #6366F1; color: #FFFFFF; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none;">View Full Interactive Report</a>
          </div>

          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0 16px 0;" />
          <p style="font-size: 11px; color: #9CA3AF; text-align: center; margin: 0;">
            You are receiving this digest based on your Wello Email Digest settings. <a href="${unsubscribeUrl}" style="color: #6366F1; text-decoration: underline;">Unsubscribe from weekly digests</a>
          </p>
        </div>
      `

      // 1. Dispatch Email via Resend
      const emailRes = await dispatchEmailWithLog({
        to: user.email,
        subject: `Your Weekly Value Digest: ${currency} ${report.rates.allInRate}/hr (${report.rangeLabel})`,
        html: digestHtml,
        templateKey: 'weekly_digest',
      })

      // 2. In-App Notification
      await createNotification({
        userId: user.id,
        type: 'weekly_leakage_alert',
        title: 'Weekly Value Digest Ready',
        message: `Your weekly digest is ready: Real rate was ${currency} ${report.rates.allInRate}/h across ${report.hours.totalAllHours} tracked hours.`,
        actionUrl: '/reports',
        metadata: { weekKey, allInRate: report.rates.allInRate, totalHours: report.hours.totalAllHours },
      })

      await logJobExecution(jobKey, 'weekly_digest_dispatcher', user.id, 'success', {
        weekKey,
        allInRate: report.rates.allInRate,
        emailSent: emailRes.success,
      })
      executed++
    }
  } catch (err: any) {
    errors.push(err?.message || String(err))
  }

  return { executed, skipped, errors }
}

// ─── 5. RECURRING INVOICE PROFILES PROCESSOR ─────────────────────────────────
export async function processRecurringInvoices(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const todayStr = dayjs().format('YYYY-MM-DD')
  const errors: string[] = []
  let executed = 0
  let skipped = 0

  try {
    const dueProfiles = await db('recurring_invoice_profiles')
      .where('is_active', true)
      .where('next_issue_date', '<=', todayStr)

    for (const prof of dueProfiles) {
      const jobKey = `recurring_invoice:${prof.id}:${prof.next_issue_date}`
      if (await isJobAlreadyExecuted(jobKey)) {
        skipped++
        continue
      }

      // Calculate next issue date based on interval
      const interval = prof.interval || 'monthly'
      let nextDate = dayjs(prof.next_issue_date)
      if (interval === 'weekly') nextDate = nextDate.add(1, 'week')
      else if (interval === 'quarterly') nextDate = nextDate.add(3, 'month')
      else if (interval === 'yearly') nextDate = nextDate.add(1, 'year')
      else nextDate = nextDate.add(1, 'month')

      await db('recurring_invoice_profiles').where({ id: prof.id }).update({
        next_issue_date: nextDate.format('YYYY-MM-DD'),
        last_generated_at: db.fn.now(3),
        updated_at: db.fn.now(3),
      })

      // Create draft invoice notification
      await createNotification({
        userId: prof.user_id,
        type: 'invoice_due_soon',
        title: `Recurring Invoice Profile Due: ${prof.profile_name}`,
        message: `Recurring retainer profile "${prof.profile_name}" was processed for ${prof.currency} ${prof.amount}.`,
        actionUrl: '/invoicing/recurring',
        metadata: { profileId: prof.id, amount: prof.amount, currency: prof.currency },
      })

      await logJobExecution(jobKey, 'recurring_invoice_generator', prof.user_id, 'success', { profileId: prof.id, nextDate: nextDate.format('YYYY-MM-DD') })
      executed++
    }
  } catch (err: any) {
    errors.push(err?.message || String(err))
  }

  return { executed, skipped, errors }
}

/**
 * Main Scheduler Entry Point
 * Executes all scheduled jobs with distributed lock protection and idempotency tracking.
 */
export async function runScheduledJobs(workerId: string = 'worker_' + Math.random().toString(36).slice(2, 8)): Promise<SchedulerRunResult> {
  const startMs = Date.now()
  const acquiredLock = await acquireSchedulerLock(workerId)

  if (!acquiredLock) {
    return {
      acquiredLock: false,
      executedAt: new Date().toISOString(),
      jobResults: {},
      durationMs: Date.now() - startMs,
    }
  }

  const jobResults: Record<string, { executed: number; skipped: number; errors: string[] }> = {}

  try {
    jobResults.invoiceOverdue = await checkOverdueInvoices()
    jobResults.forgottenTimers = await checkForgottenTimers()
    jobResults.quoteFollowups = await checkQuoteFollowups()
    jobResults.weeklyDigests = await dispatchWeeklyDigests()
    jobResults.recurringInvoices = await processRecurringInvoices()
    try {
      const retentionSummary = await runDataRetentionPurge()
      const totalPurged = Object.values(retentionSummary).reduce((a, b) => a + b, 0)
      jobResults.dataRetention = { executed: totalPurged, skipped: 0, errors: [] }
    } catch (e: any) {
      jobResults.dataRetention = { executed: 0, skipped: 0, errors: [e?.message || 'Retention error'] }
    }
  } finally {
    await releaseSchedulerLock(workerId)
  }

  const totalExecuted = Object.values(jobResults).reduce((sum, j) => sum + (j.executed || 0), 0)

  return {
    success: true,
    acquiredLock: true,
    jobsExecuted: totalExecuted,
    executedAt: new Date().toISOString(),
    jobResults,
    durationMs: Date.now() - startMs,
  }
}
