// backend/api/admin/retention/policies.get.ts
import { defineEventHandler } from 'h3'
import { requireAdmin } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = getDb()

  const policies = await db('data_retention_policies').orderBy('id', 'asc')

  return {
    success: true,
    data: {
      policies,
    },
    policies,
  }
})
