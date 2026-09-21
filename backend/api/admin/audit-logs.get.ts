// server/api/admin/audit-logs.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getAuditLogs } from '../../utils/auditStore'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'audit_logs.view')

  const query = getQuery(event)
  const moduleFilter = query?.module as string | undefined
  const limit = Math.min(500, Math.max(10, Number(query?.limit) || 200))

  const logs = await getAuditLogs(limit, moduleFilter)

  return {
    success: true,
    count: logs.length,
    logs,
  }
})
