// server/api/admin/audit-logs.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { getAuditLogs } from '../../utils/auditStore'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const moduleFilter = query?.module as string | undefined

  const logs = getAuditLogs(200, moduleFilter)

  return {
    success: true,
    logs,
  }
})
