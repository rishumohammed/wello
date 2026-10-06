// backend/api/admin/analytics/rollups/run.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requirePermission, extractClientIp } from '../../../../utils/authGuard'
import { requireRateLimit } from '../../../../utils/rateLimiter'
import { buildDailyRollup, recalculateCohorts, recalculateUserSummaries } from '../../../../utils/analyticsRollupService'
import { recordAuditLog } from '../../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'analytics.manage')

  await requireRateLimit(event, {
    keyPrefix: 'admin_analytics_rollups',
    limit: 5,
    windowSeconds: 60,
  })

  const body = await readBody(event).catch(() => ({}))
  const targetDate = body?.date as string | undefined

  const rollupResult = await buildDailyRollup(targetDate)
  const cohortsResult = await recalculateCohorts('weekly')
  const summariesResult = await recalculateUserSummaries()

  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: 'ADMIN_ANALYTICS_ROLLUP_TRIGGERED',
    module: 'Analytics',
    permissionUsed: 'analytics.manage',
    target: targetDate || 'today',
    reason: body?.reason || 'Manual aggregation rollup trigger',
    ipAddress: extractClientIp(event),
  })

  return {
    success: true,
    rollup: rollupResult,
    cohorts: cohortsResult,
    summaries: summariesResult,
  }
})

