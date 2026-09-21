// server/api/admin/logs.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getAuthLogs } from '../../utils/authConfig'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'audit_logs.view')
  return {
    success: true,
    logs: getAuthLogs(),
  }
})
