// server/api/admin/audit-logs/verify.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { verifyAuditLogChain } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'audit_logs.view')

  const result = await verifyAuditLogChain()

  return {
    success: true,
    ...result,
  }
})
