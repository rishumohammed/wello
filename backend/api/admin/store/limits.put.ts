// backend/api/admin/store/limits.put.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'
import { recordAuditLog } from '../../../utils/auditStore'

const updateLimitSchema = z.object({
  id: z.number().optional(),
  limitKey: z.string().min(1),
  name: z.string().optional(),
  limitValue: z.number().min(1),
  windowSeconds: z.number().min(0).optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'store.manage')
  const body = await readBody(event).catch(() => ({}))
  const parsed = updateLimitSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()

  const existing = await db('fair_use_limits').where({ limit_key: data.limitKey }).first()
  if (!existing) {
    return sendError(event, 404, 'LIMIT_NOT_FOUND', `Limit key '${data.limitKey}' not found.`)
  }

  await db('fair_use_limits').where({ limit_key: data.limitKey }).update({
    name: data.name !== undefined ? data.name : existing.name,
    limit_value: data.limitValue,
    window_seconds: data.windowSeconds !== undefined ? data.windowSeconds : existing.window_seconds,
    unit: data.unit !== undefined ? data.unit : existing.unit,
    description: data.description !== undefined ? data.description : existing.description,
    is_active: data.isActive !== undefined ? Boolean(data.isActive) : existing.is_active,
    updated_at: now,
  })

  recordAuditLog({
    adminEmail: admin.email,
    action: 'FAIR_USE_LIMIT_UPDATED',
    module: 'Fair Use Protection',
    target: data.limitKey,
    newValue: `LimitValue: ${data.limitValue}, Active: ${data.isActive !== undefined ? data.isActive : existing.is_active}`,
  })

  const updated = await db('fair_use_limits').where({ limit_key: data.limitKey }).first()
  return sendSuccess(event, {
    message: `Fair-use limit '${data.limitKey}' updated successfully.`,
    limit: updated,
  })
})
