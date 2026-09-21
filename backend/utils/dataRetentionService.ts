// backend/utils/dataRetentionService.ts
import { getDb } from './authService'

/**
 * Resets all tracking and work data for a user while preserving account credentials,
 * earning persona, settings, and free addon entitlements.
 */
export async function resetUserWorkData(userId: number): Promise<{ purgedCounts: Record<string, number> }> {
  const db = getDb()
  const counts: Record<string, number> = {}

  await db.transaction(async (trx) => {
    // 1. Invoices and related
    const userInvoices = await trx('invoices').where({ user_id: userId }).select('id')
    const invoiceIds = userInvoices.map((i: any) => i.id)

    if (invoiceIds.length > 0) {
      counts.invoice_taxes = await trx('invoice_taxes').whereIn('invoice_id', invoiceIds).del()
      counts.invoice_items = await trx('invoice_items').whereIn('invoice_id', invoiceIds).del()
    }

    const userCreditNotes = await trx('credit_notes').where({ user_id: userId }).select('id')
    const creditNoteIds = userCreditNotes.map((c: any) => c.id)
    if (creditNoteIds.length > 0) {
      counts.credit_note_items = await trx('credit_note_items').whereIn('credit_note_id', creditNoteIds).del()
    }
    counts.credit_notes = await trx('credit_notes').where({ user_id: userId }).del()
    counts.invoices = await trx('invoices').where({ user_id: userId }).del()
    counts.invoice_sequences = await trx('invoice_sequences').where({ user_id: userId }).del()
    counts.recurring_invoice_profiles = await trx('recurring_invoice_profiles').where({ user_id: userId }).del()

    // 2. Work sessions
    const userSessions = await trx('work_sessions').where({ user_id: userId }).select('id')
    const sessionIds = userSessions.map((s: any) => s.id)
    if (sessionIds.length > 0) {
      counts.work_session_pauses = await trx('work_session_pauses').whereIn('work_session_id', sessionIds).del()
    }
    counts.work_session_edits = await trx('work_session_edits').where({ user_id: userId }).del()
    counts.work_sessions = await trx('work_sessions').where({ user_id: userId }).del()

    // 3. Payments and expenses
    counts.payments = await trx('payments').where({ user_id: userId }).del()
    counts.project_expenses = await trx('project_expenses').where({ user_id: userId }).del()
    counts.income_sources = await trx('income_sources').where({ user_id: userId }).del()
    counts.overhead_expenses = await trx('overhead_expenses').where({ user_id: userId }).del()

    // 4. Projects and Quotes
    counts.project_quotes = await trx('project_quotes').where({ user_id: userId }).del()
    counts.projects = await trx('projects').where({ user_id: userId }).del()

    // 5. Clients & Tax Rates
    counts.clients = await trx('clients').where({ user_id: userId }).del()
    counts.tax_rates = await trx('tax_rates').where({ user_id: userId }).del()
    counts.category_requests = await trx('category_requests').where({ user_id: userId }).del()
  })

  return { purgedCounts: counts }
}

/**
 * Permanently and irreversibly erases a user and all associated data across all 25+ tables.
 */
export async function permanentlyEraseUser(userId: number): Promise<{ success: boolean; tablesCleaned: number }> {
  const db = getDb()
  let tablesCleaned = 0

  await db.transaction(async (trx) => {
    // Child tables linked via foreign keys
    const userInvoices = await trx('invoices').where({ user_id: userId }).select('id')
    const invoiceIds = userInvoices.map((i: any) => i.id)
    if (invoiceIds.length > 0) {
      await trx('invoice_taxes').whereIn('invoice_id', invoiceIds).del()
      await trx('invoice_items').whereIn('invoice_id', invoiceIds).del()
    }

    const userCreditNotes = await trx('credit_notes').where({ user_id: userId }).select('id')
    const creditNoteIds = userCreditNotes.map((c: any) => c.id)
    if (creditNoteIds.length > 0) {
      await trx('credit_note_items').whereIn('credit_note_id', creditNoteIds).del()
    }

    const userSessions = await trx('work_sessions').where({ user_id: userId }).select('id')
    const sessionIds = userSessions.map((s: any) => s.id)
    if (sessionIds.length > 0) {
      await trx('work_session_pauses').whereIn('work_session_id', sessionIds).del()
    }

    // List of all tables containing user_id
    const userTiedTables = [
      'analytics_events',
      'analytics_anonymous_mappings',
      'analytics_user_summaries',
      'web_push_subscriptions',
      'auth_sessions',
      'fair_use_logs',
      'idempotency_keys',
      'scheduled_jobs_log',
      'user_feedback',
      'user_addons',
      'notification_preferences',
      'notifications',
      'work_session_edits',
      'work_sessions',
      'payments',
      'project_expenses',
      'credit_notes',
      'invoices',
      'invoice_sequences',
      'recurring_invoice_profiles',
      'project_quotes',
      'projects',
      'clients',
      'income_sources',
      'overhead_expenses',
      'tax_rates',
      'category_requests',
      'admin_users',
    ]

    for (const table of userTiedTables) {
      try {
        const hasTable = await trx.schema.hasTable(table)
        if (hasTable) {
          await trx(table).where({ user_id: userId }).del()
          tablesCleaned++
        }
      } catch (err) {
        console.warn(`[Erasure] Note on table ${table}:`, err)
      }
    }

    // Finally delete the root user record
    await trx('users').where({ id: userId }).del()
    tablesCleaned++
  })

  return { success: true, tablesCleaned }
}

/**
 * Initiates self-service account deletion with a 14-day grace period.
 */
export async function requestAccountDeletion(userId: number, gracePeriodDays: number = 14) {
  const db = getDb()
  const scheduledDate = new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000)

  await db('users')
    .where({ id: userId })
    .update({
      status: 'pending_deletion',
      scheduled_deletion_at: scheduledDate,
      deletion_grace_period_days: gracePeriodDays,
      updated_at: new Date(),
    })

  return {
    success: true,
    status: 'pending_deletion',
    scheduledDeletionAt: scheduledDate.toISOString(),
    gracePeriodDays,
  }
}

/**
 * Cancels a pending account deletion within the grace period and restores active status.
 */
export async function cancelAccountDeletion(userId: number) {
  const db = getDb()

  await db('users')
    .where({ id: userId })
    .update({
      status: 'active',
      scheduled_deletion_at: null,
      updated_at: new Date(),
    })

  return {
    success: true,
    status: 'active',
    scheduledDeletionAt: null,
    message: 'Account deletion cancelled successfully. Your account is fully restored.',
  }
}

/**
 * Executes all automated data retention pruning rules across the system.
 */
export async function runDataRetentionPurge(): Promise<Record<string, number>> {
  const db = getDb()
  const now = new Date()
  const summary: Record<string, number> = {}

  // 1. Expired OTP Codes (> 24 hours)
  try {
    const otpCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const count = await db('otp_codes').where('created_at', '<', otpCutoff).del()
    summary.expired_otps = count
  } catch {
    summary.expired_otps = 0
  }

  // 2. Revoked/Expired Auth Sessions (> 30 days)
  try {
    const sessionCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const count = await db('auth_sessions')
      .whereNotNull('revoked_at')
      .orWhere('expires_at', '<', sessionCutoff)
      .del()
    summary.revoked_sessions = count
  } catch {
    summary.revoked_sessions = 0
  }

  // 3. Raw Analytics Events (> 13 months / 395 days)
  try {
    const analyticsCutoff = new Date(now.getTime() - 395 * 24 * 60 * 60 * 1000)
    const count = await db('analytics_events')
      .where('created_at', '<', analyticsCutoff)
      .orWhere('timestamp', '<', analyticsCutoff)
      .del()
    summary.raw_analytics_events = count
  } catch {
    summary.raw_analytics_events = 0
  }

  // 4. Outbound Email Logs (> 90 days)
  try {
    const emailCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const count = await db('email_logs').where('created_at', '<', emailCutoff).del()
    summary.email_logs = count
  } catch {
    summary.email_logs = 0
  }

  // 5. Fair-Use Sliding Window Logs (> 30 days)
  try {
    const fairUseCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const count = await db('fair_use_logs')
      .where('updated_at', '<', fairUseCutoff)
      .orWhere('window_start', '<', fairUseCutoff)
      .del()
    summary.fair_use_logs = count
  } catch {
    summary.fair_use_logs = 0
  }

  // 6. Expired Account Deletions (scheduled_deletion_at <= now)
  try {
    const pendingUsers = await db('users')
      .whereNotNull('scheduled_deletion_at')
      .where('scheduled_deletion_at', '<=', now)
      .select('id')

    let accountsPurged = 0
    for (const u of pendingUsers) {
      await permanentlyEraseUser(u.id)
      accountsPurged++
    }
    summary.expired_accounts_purged = accountsPurged
  } catch {
    summary.expired_accounts_purged = 0
  }

  // Update policies metadata
  try {
    for (const [key, count] of Object.entries(summary)) {
      await db('data_retention_policies')
        .where({ policy_key: key })
        .update({
          last_run_at: now,
          records_purged_total: db.raw('records_purged_total + ?', [count]),
          updated_at: now,
        })
    }
  } catch {
    // Policy table update fallback
  }

  return summary
}
