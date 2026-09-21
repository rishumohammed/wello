// server/api/admin/audit-logs.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getAuditLogs } from '../../utils/auditStore'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'audit_logs.view')

  const query = getQuery(event)
  const moduleFilter = query?.module as string | undefined

  const logs = getAuditLogs(200, moduleFilter)

  return {
    success: true,
    logs,
  }
})
