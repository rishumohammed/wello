// backend/api/scheduler/run.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { requirePermission, requireStepUpOtp, extractClientIp } from '../../utils/authGuard'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { runScheduledJobs } from '../../utils/schedulerEngine'
import { recordAuditLog } from '../../utils/auditStore'

const ALLOWED_JOBS = [
  'fxRates',
  'invoiceOverdue',
  'forgottenTimers',
  'quoteFollowups',
  'weeklyDigests',
  'recurringInvoices',
  'analyticsScheduledReports',
  'analyticsNightlyRollups',
  'analyticsHourlyRollups',
  'requestMetricsPruning',
  'dataRetention',
  'auditVerification',
  'databaseBackup',
  'databaseRestoreDrill',
  'all',
] as const

const schedulerRunSchema = z.object({
  jobs: z.array(z.string()).optional(),
  reason: z.string().min(5, 'A valid execution reason (minimum 5 characters) is required.'),
  confirmMassMail: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  // 1. Enforce scheduler.manage permission (SUPER_ADMIN only)
  const admin = await requirePermission(event, 'scheduler.manage')

  // 2. Enforce Step-Up OTP
  await requireStepUpOtp(event, 'scheduler_run')

  // 3. Parse and validate body
  const body = await readBody(event).catch(() => ({}))
  const parsed = schedulerRunSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { jobs, reason, confirmMassMail } = parsed.data

  // 4. Validate job allowlist if specified
  if (jobs && jobs.length > 0) {
    const invalidJobs = jobs.filter((j) => !ALLOWED_JOBS.includes(j as any))
    if (invalidJobs.length > 0) {
      return sendError(
        event,
        400,
        'INVALID_JOB_KEYS',
        `Invalid job key(s): ${invalidJobs.join(', ')}. Allowed keys: ${ALLOWED_JOBS.join(', ')}`
      )
    }
  }

  // 5. Mass-mail confirmation safety check
  const triggersMassMail = !jobs || jobs.includes('all') || jobs.includes('weeklyDigests')
  if (triggersMassMail && !confirmMassMail) {
    return sendError(
      event,
      400,
      'MASS_MAIL_CONFIRMATION_REQUIRED',
      'Executing email digest jobs manually requires explicit confirmMassMail: true to prevent unintended mass messaging.'
    )
  }

  // 6. Execute scheduled jobs
  const result = await runScheduledJobs('manual_superadmin_trigger')

  // 7. Record tamper-evident audit log
  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: 'ADMIN_SCHEDULER_MANUAL_RUN',
    module: 'Scheduler',
    permissionUsed: 'scheduler.manage',
    target: `Scheduler Jobs (${jobs ? jobs.join(', ') : 'all'})`,
    reason,
    ipAddress: extractClientIp(event),
    newValue: JSON.stringify({
      acquiredLock: result.acquiredLock,
      jobsExecuted: result.jobsExecuted,
      durationMs: result.durationMs,
    }),
  })

  return sendSuccess(event, {
    message: result.acquiredLock
      ? 'Scheduled jobs executed successfully.'
      : 'Scheduler skipped (lock currently held by another worker).',
    ...result,
  })
})

