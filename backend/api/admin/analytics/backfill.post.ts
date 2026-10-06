// backend/api/admin/analytics/backfill.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requirePermission, requireStepUpOtp, extractClientIp } from '../../../utils/authGuard'
import { requireRateLimit } from '../../../utils/rateLimiter'
import { runHistoricalAnalyticsBackfill } from '../../../utils/analyticsBackfillService'
import { recordAuditLog } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'analytics.manage')
  await requireStepUpOtp(event, 'analytics_backfill')

  await requireRateLimit(event, {
    keyPrefix: 'admin_analytics_backfill',
    limit: 5,
    windowSeconds: 60,
  })

  const body = await readBody(event).catch(() => ({}))
  const days = Number(body?.days) || 30

  const result = await runHistoricalAnalyticsBackfill(days)

  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: 'ADMIN_ANALYTICS_BACKFILL',
    module: 'Analytics',
    permissionUsed: 'analytics.manage',
    target: `Backfill (${days} days)`,
    reason: body?.reason || `Manual backfill for past ${days} days`,
    ipAddress: extractClientIp(event),
    newValue: JSON.stringify(result),
  })

  return {
    success: true,
    message: `Analytics backfilled successfully for past ${days} days.`,
    ...result,
  }
})

