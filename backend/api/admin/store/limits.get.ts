// backend/api/admin/store/limits.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess } from '../../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.manage')
  const db = getDb()

  const limits = await db('fair_use_limits').select('*').orderBy('id', 'asc')

  return sendSuccess(event, {
    limits: limits.map((l: any) => ({
      id: l.id,
      limitKey: l.limit_key,
      name: l.name,
      limitValue: l.limit_value,
      windowSeconds: l.window_seconds,
      unit: l.unit,
      description: l.description,
      isActive: Boolean(l.is_active),
      updatedAt: l.updated_at,
    })),
  })
})
