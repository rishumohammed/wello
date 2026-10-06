// backend/utils/schedulerEngine.ts
/**
 * Concurrency-Safe Distributed Scheduler Engine for Wello
 * Uses database-level row leasing in `scheduler_locks` and idempotent job execution logging
 * in `scheduled_jobs_log` so jobs never run twice or send duplicate notifications.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezonePlugin from 'dayjs/plugin/timezone.js'
import { getDb } from './db'
import { createNotification } from './notificationsEngine'
import { dispatchEmailWithLog, renderEmailTemplate } from './emailEngine'
import { generateReportSummary } from './reportsEngine'
import { roundToCurrencyDecimals } from './currencyUtils'
import { runDataRetentionPurge } from './dataRetentionService'
import { runAuditVerificationJob } from './auditStore'
import { syncDailyFxRates } from './fxService'
import { buildDailyRollup } from './analyticsRollupService'
import { sendSystemAlert } from './alertEngine'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

const LOCK_NAME = 'wello_global_scheduler_lock'
const LEASE_DURATION_MS = 45 * 1000 // 45-second lock lease

export interface SchedulerRunResult {
  success?: boolean
  acquiredLock: boolean
  jobsExecuted?: number
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
      const userDayOfWeek = userLocal.day()
      const targetDay = Number(user.digest_day_of_week != null ? user.digest_day_of_week : 1)
      const weekKey = `${userLocal.year()}-W${userLocal.isoWeek ? userLocal.isoWeek() : Math.ceil(userLocal.dayOfYear() / 7)}`
      const jobKey = `weekly_digest:${user.id}:${weekKey}`

      if (await isJobAlreadyExecuted(jobKey)) {
        skipped++
        continue
      }

      if (user.digest_frequency === 'weekly' && userDayOfWeek !== targetDay) {
        continue
      }

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

      const emailRes = await dispatchEmailWithLog({
        to: user.email,
        subject: `Your Weekly Value Digest: ${currency} ${report.rates.allInRate}/hr (${report.rangeLabel})`,
        html: digestHtml,
        templateKey: 'weekly_digest',
      })

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

// ─── 6. ANALYTICS SCHEDULED REPORTS SENDER ──────────────────────────────────
export async function processAnalyticsScheduledReports(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const errors: string[] = []
  let executed = 0
  let skipped = 0

  try {
    const hasTable = await db.schema.hasTable('analytics_scheduled_reports')
    if (!hasTable) return { executed: 0, skipped: 0, errors: [] }

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const reports = await db('analytics_scheduled_reports')
      .where('is_active', true)

    for (const report of reports) {
      const jobKey = `analytics_scheduled_report:${report.id}:${todayStr}`
      if (await isJobAlreadyExecuted(jobKey)) {
        skipped++
        continue
      }

      // Check frequency schedule
      const lastSent = report.last_sent_at ? new Date(report.last_sent_at) : null
      const daysSince = lastSent ? (now.getTime() - lastSent.getTime()) / (24 * 3600 * 1000) : 999
      const frequency = (report.frequency || 'weekly').toLowerCase()

      if (frequency === 'daily' && daysSince < 0.9) continue
      if (frequency === 'weekly' && daysSince < 6.9) continue
      if (frequency === 'monthly' && daysSince < 27.9) continue

      // Dispatch report to configured recipient
      const recipients = (report.recipients || '').split(',').map((r: string) => r.trim()).filter(Boolean)
      for (const email of recipients) {
        await dispatchEmailWithLog({
          to: email,
          subject: `Wello Analytics Digest: ${report.name}`,
          html: `<p>Your scheduled analytics report <strong>${report.name}</strong> (${frequency}) is ready for review.</p>`,
          templateKey: 'analytics_digest',
        })
      }

      await db('analytics_scheduled_reports').where({ id: report.id }).update({
        last_sent_at: now,
        updated_at: now,
      })

      await logJobExecution(jobKey, 'analytics_scheduled_report_sender', report.admin_user_id || null, 'success', {
        reportId: report.id,
        recipients,
      })
      executed++
    }
  } catch (err: any) {
    errors.push(err?.message || String(err))
    await sendSystemAlert({
      title: 'Scheduled Reports Dispatch Failed',
      message: err?.message || 'Error processing analytics scheduled reports',
      severity: 'error',
      module: 'scheduler',
    }).catch(() => {})
  }

  return { executed, skipped, errors }
}

// ─── 7. ANALYTICS NIGHTLY FULL ROLLUPS ──────────────────────────────────────
export async function runAnalyticsNightlyRollups(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const today = dayjs()
  const todayStr = today.format('YYYY-MM-DD')
  const jobKey = `analytics_nightly_rollups:${todayStr}`
  const errors: string[] = []
  let executed = 0

  try {
    if (await isJobAlreadyExecuted(jobKey)) {
      return { executed: 0, skipped: 1, errors: [] }
    }

    // Build rollups for today and previous 3 days for historical closure
    for (let i = 0; i <= 3; i++) {
      const targetDateStr = today.subtract(i, 'day').format('YYYY-MM-DD')
      await buildDailyRollup(targetDateStr)
      executed++
    }

    await logJobExecution(jobKey, 'analytics_nightly_rollups', null, 'success', { daysComputed: executed })
  } catch (err: any) {
    errors.push(err?.message || String(err))
    await sendSystemAlert({
      title: 'Analytics Nightly Rollups Failed',
      message: err?.message || 'Error computing daily analytics rollups',
      severity: 'error',
      module: 'scheduler',
    }).catch(() => {})
    await logJobExecution(jobKey, 'analytics_nightly_rollups', null, 'failed', { error: err?.message })
  }

  return { executed, skipped: 0, errors }
}

// ─── 8. ANALYTICS HOURLY TODAY REFRESH ──────────────────────────────────────
export async function runAnalyticsHourlyRollups(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const now = dayjs()
  const hourKey = `analytics_hourly_rollups:${now.format('YYYY-MM-DD-HH')}`
  const errors: string[] = []
  let executed = 0

  try {
    if (await isJobAlreadyExecuted(hourKey)) {
      return { executed: 0, skipped: 1, errors: [] }
    }

    const todayStr = now.format('YYYY-MM-DD')
    await buildDailyRollup(todayStr)
    executed++

    await logJobExecution(hourKey, 'analytics_hourly_rollups', null, 'success', { date: todayStr })
  } catch (err: any) {
    errors.push(err?.message || String(err))
    await sendSystemAlert({
      title: 'Analytics Hourly Rollup Failed',
      message: err?.message || 'Error refreshing today analytics rollup',
      severity: 'warning',
      module: 'scheduler',
    }).catch(() => {})
    await logJobExecution(hourKey, 'analytics_hourly_rollups', null, 'failed', { error: err?.message })
  }

  return { executed, skipped: 0, errors }
}

// ─── 9b. REQUEST METRICS 30-DAY PRUNING ─────────────────────────────────────
export async function runRequestMetricsPruning(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const cutoff = new Date(Date.now() - 30 * 86400 * 1000)
  const errors: string[] = []
  let executed = 0
  try {
    const deleted = await db('request_metrics_minute').where('minute', '<', cutoff).delete()
    executed = Number(deleted) || 0
  } catch (err: any) {
    errors.push(err?.message || String(err))
  }
  return { executed, skipped: 0, errors }
}

// ─── 10. SCHEDULED DAILY DATABASE BACKUP ────────────────────────────────────
export async function backupDatabaseDaily(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const todayStr = dayjs().format('YYYY-MM-DD')
  const jobKey = `daily_backup:${todayStr}`
  const errors: string[] = []
  let executed = 0
  let skipped = 0

  try {
    if (await isJobAlreadyExecuted(jobKey)) {
      return { executed: 0, skipped: 1, errors: [] }
    }

    const fs = await import('node:fs')
    const path = await import('node:path')
    const crypto = await import('node:crypto')
    const rootDir = path.resolve(process.cwd())
    const backupDir = path.join(rootDir, 'backups')

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = dayjs().format('YYYYMMDD_HHmmss')
    const dumpFileName = `wello_backup_${timestamp}.sql`
    const dumpFilePath = path.join(backupDir, dumpFileName)

    // Introspect and dump all tables
    const [tables] = await db.raw('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')
    const tableNames = (tables as any[]).map((row) => Object.values(row)[0])

    const writeStream = fs.createWriteStream(dumpFilePath, { encoding: 'utf8' })
    writeStream.write(`-- Wello Automated Daily Backup\n-- Timestamp: ${new Date().toISOString()}\n\nSET FOREIGN_KEY_CHECKS=0;\n\n`)

    for (const tableName of tableNames) {
      const [createRes] = await db.raw(`SHOW CREATE TABLE \`${tableName}\``)
      const createSql = (createRes as any[])[0]['Create Table']
      writeStream.write(`-- Structure for \`${tableName}\`\nDROP TABLE IF EXISTS \`${tableName}\`;\n${createSql};\n\n`)

      const rows = await db(tableName).select('*')
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]).map((k) => `\`${k}\``).join(', ')
        const batchSize = 100
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize)
          const valueTuples = batch.map((r) => {
            const vals = Object.values(r).map((v) => {
              if (v === null) return 'NULL'
              if (typeof v === 'number') return v
              if (typeof v === 'boolean') return v ? 1 : 0
              if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`
              if (typeof v === 'object') return `'${JSON.stringify(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
              return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
            })
            return `(${vals.join(', ')})`
          })
          writeStream.write(`INSERT INTO \`${tableName}\` (${cols}) VALUES \n${valueTuples.join(',\n')};\n`)
        }
        writeStream.write('\n')
      }
    }

    writeStream.write('SET FOREIGN_KEY_CHECKS=1;\n')
    await new Promise((resolve) => writeStream.end(resolve))

    // Optional AES-256-GCM encryption
    let finalPath = dumpFilePath
    let finalName = dumpFileName
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY

    if (encryptionKey) {
      const rawContent = fs.readFileSync(dumpFilePath)
      const salt = crypto.randomBytes(16)
      const key = crypto.scryptSync(encryptionKey, salt, 32)
      const iv = crypto.randomBytes(12)
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
      const encrypted = Buffer.concat([cipher.update(rawContent), cipher.final()])
      const authTag = cipher.getAuthTag()
      const packed = Buffer.concat([salt, iv, authTag, encrypted])

      const encPath = `${dumpFilePath}.enc`
      fs.writeFileSync(encPath, packed)
      fs.unlinkSync(dumpFilePath)
      finalPath = encPath
      finalName = `${dumpFileName}.enc`
    }

    // Generate SHA-256 checksum
    const fileBuffer = fs.readFileSync(finalPath)
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')
    fs.writeFileSync(`${finalPath}.sha256`, `${sha256}  ${finalName}\n`, 'utf8')

    await logJobExecution(jobKey, 'daily_database_backup', null, 'success', {
      fileName: finalName,
      sizeBytes: fileBuffer.length,
      sha256,
      encrypted: Boolean(encryptionKey),
      tablesDumped: tableNames.length,
    })
    executed++
  } catch (err: any) {
    errors.push(err?.message || String(err))
    await logJobExecution(jobKey, 'daily_database_backup', null, 'failed', { error: err?.message })
    await sendSystemAlert({
      title: 'Daily Database Backup Failed',
      message: err?.message || 'Error creating scheduled database backup snapshot',
      severity: 'error',
      module: 'backup',
    }).catch(() => {})
  }

  return { executed, skipped, errors }
}

// ─── 11. MONTHLY AUTOMATED RESTORE & DISASTER RECOVERY DRILL ────────────────
export async function databaseRestoreDrill(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const monthStr = dayjs().format('YYYY-MM')
  const jobKey = `monthly_restore_drill:${monthStr}`
  const errors: string[] = []
  let executed = 0
  let skipped = 0

  try {
    if (await isJobAlreadyExecuted(jobKey)) {
      return { executed: 0, skipped: 1, errors: [] }
    }

    const timestamp = Date.now()
    const drillDb = `wello_dr_drill_${timestamp}`

    // Create scratch database
    await db.raw(`CREATE DATABASE IF NOT EXISTS \`${drillDb}\``)

    // Introspect source schema
    const [tables] = await db.raw('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"')
    const tableNames = (tables as any[]).map((row) => Object.values(row)[0])

    // Duplicate schema and data into drillDb
    for (const tbl of tableNames) {
      const [createRes] = await db.raw(`SHOW CREATE TABLE \`${tbl}\``)
      const createSql = (createRes as any[])[0]['Create Table']
      await db.raw(`USE \`${drillDb}\``)
      await db.raw(`DROP TABLE IF EXISTS \`${tbl}\``)
      await db.raw(createSql)

      const rows = await db(tbl).select('*')
      if (rows.length > 0) {
        await db.raw(`USE \`${drillDb}\``)
        await db(tbl).insert(rows)
      }
    }

    await db.raw(`USE \`${drillDb}\``)
    const [auditRows] = await db.raw('SELECT count(*) as count FROM audit_logs')
    const [userRows] = await db.raw('SELECT count(*) as count FROM users')

    await logJobExecution(jobKey, 'monthly_restore_drill', null, 'success', {
      drillDb,
      tablesRestored: tableNames.length,
      usersVerified: (userRows as any[])[0]?.count || 0,
      auditRecordsVerified: (auditRows as any[])[0]?.count || 0,
    })
    executed++
  } catch (err: any) {
    errors.push(err?.message || String(err))
    await logJobExecution(jobKey, 'monthly_restore_drill', null, 'failed', { error: err?.message })
    await sendSystemAlert({
      title: 'Monthly Restore Drill Failed',
      message: err?.message || 'Disaster recovery restore drill failed integrity validation',
      severity: 'error',
      module: 'disaster_recovery',
    }).catch(() => {})
  } finally {
    const primaryDb = process.env.DB_NAME || 'wello'
    await db.raw(`USE \`${primaryDb}\``).catch(() => {})
  }

/**
 * Job 15: SaaS Trial Milestones & Subscription Lifecycle Checker
 * Evaluates active trials at Day 75 (15 days left), Day 87 (3 days left), and Day 90 (expiry).
 */
export async function checkTrialMilestonesAndDunning(): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const todayStr = dayjs().format('YYYY-MM-DD')
  let executed = 0
  let skipped = 0
  const errors: string[] = []

  try {
    const now = new Date()

    // 1. Check users whose trials expired today
    const expiredUsers = await db('users')
      .whereNull('deleted_at')
      .where('is_comped', false)
      .where('trial_ends_at', '<=', now)
      .where('subscription_status', 'trialing')

    for (const u of expiredUsers) {
      const jobKey = `trial_expired:${u.id}:${todayStr}`
      if (await isJobAlreadyExecuted(jobKey)) {
        skipped++
        continue
      }

      await db('users')
        .where({ id: u.id })
        .update({
          subscription_status: 'expired',
          updated_at: db.fn.now(3),
        })

      await createNotification({
        userId: u.id,
        type: 'subscription_alert',
        title: 'Your 90-Day Free Trial Has Concluded',
        message: 'Your historical data remains safe and accessible. Subscribe to Wello to continue tracking new work and invoices.',
        actionUrl: '/settings?tab=billing',
        metadata: { userId: u.id, milestone: 'trial_expired' },
      })

      await logJobExecution(jobKey, 'saas_trial_milestones', u.id, 'success', { milestone: 'expired' })
      executed++
    }

    // 2. Check 15-day warning (between 14 and 16 days left)
    const fifteenDaysFromNow = dayjs().add(15, 'day').format('YYYY-MM-DD')
    const warning15Users = await db('users')
      .whereNull('deleted_at')
      .where('is_comped', false)
      .where('subscription_status', 'trialing')
      .whereRaw(`DATE(trial_ends_at) = ?`, [fifteenDaysFromNow])

    for (const u of warning15Users) {
      const jobKey = `trial_warning_15d:${u.id}:${fifteenDaysFromNow}`
      if (await isJobAlreadyExecuted(jobKey)) {
        skipped++
        continue
      }

      await createNotification({
        userId: u.id,
        type: 'subscription_alert',
        title: '15 Days Remaining in Your Wello Trial',
        message: 'You have 15 days left of full access to all Wello rate intelligence and invoicing tools.',
        actionUrl: '/settings?tab=billing',
        metadata: { userId: u.id, milestone: 'trial_warning_15d' },
      })

      await logJobExecution(jobKey, 'saas_trial_milestones', u.id, 'success', { milestone: 'warning_15d' })
      executed++
    }

    // 3. Check 3-day warning (between 2 and 4 days left)
    const threeDaysFromNow = dayjs().add(3, 'day').format('YYYY-MM-DD')
    const warning3Users = await db('users')
      .whereNull('deleted_at')
      .where('is_comped', false)
      .where('subscription_status', 'trialing')
      .whereRaw(`DATE(trial_ends_at) = ?`, [threeDaysFromNow])

    for (const u of warning3Users) {
      const jobKey = `trial_warning_3d:${u.id}:${threeDaysFromNow}`
      if (await isJobAlreadyExecuted(jobKey)) {
        skipped++
        continue
      }

      await createNotification({
        userId: u.id,
        type: 'subscription_alert',
        title: '3 Days Left in Your Wello Trial',
        message: 'Your 90-day trial is ending soon. Activate your monthly subscription to ensure uninterrupted rate tracking.',
        actionUrl: '/settings?tab=billing',
        metadata: { userId: u.id, milestone: 'trial_warning_3d' },
      })

      await logJobExecution(jobKey, 'saas_trial_milestones', u.id, 'success', { milestone: 'warning_3d' })
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
    // 1. Daily FX Rate Fetch
    jobResults.fxRates = await syncDailyFxRates()

    // 2. Invoices Overdue & Due Soon Reminders
    jobResults.invoiceOverdue = await checkOverdueInvoices()

    // 3. Forgotten Active Timers
    jobResults.forgottenTimers = await checkForgottenTimers()

    // 4. Quote Follow-Ups
    jobResults.quoteFollowups = await checkQuoteFollowups()

    // 5. Weekly Email Digests
    jobResults.weeklyDigests = await dispatchWeeklyDigests()

    // 6. Recurring Invoice Profiles
    jobResults.recurringInvoices = await processRecurringInvoices()

    // 7. Analytics Scheduled Reports
    jobResults.analyticsScheduledReports = await processAnalyticsScheduledReports()

    // 8. Analytics Nightly Full Rollups
    jobResults.analyticsNightlyRollups = await runAnalyticsNightlyRollups()

    // 9. Analytics Hourly Today Refresh
    jobResults.analyticsHourlyRollups = await runAnalyticsHourlyRollups()

    // 10. Request Metrics 30-Day Pruning
    jobResults.requestMetricsPruning = await runRequestMetricsPruning()

    // 11. Session, OTP & Data Retention Pruning
    try {
      const retentionSummary = await runDataRetentionPurge()
      const totalPurged = Object.values(retentionSummary).reduce((a, b) => a + b, 0)
      jobResults.dataRetention = { executed: totalPurged, skipped: 0, errors: [] }
    } catch (e: any) {
      jobResults.dataRetention = { executed: 0, skipped: 0, errors: [e?.message || 'Retention error'] }
    }

    // 12. Cryptographic Audit Chain Verification
    jobResults.auditVerification = await runAuditVerificationJob()

    // 13. Daily Scheduled Database Backup
    jobResults.databaseBackup = await backupDatabaseDaily()

    // 14. Monthly Automated Restore & DR Drill
    jobResults.databaseRestoreDrill = await databaseRestoreDrill()

    // 15. SaaS Trial Milestones & Subscription Lifecycle
    jobResults.trialMilestones = await checkTrialMilestonesAndDunning()
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


