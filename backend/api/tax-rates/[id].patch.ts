// backend/api/tax-rates/[id].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const updateTaxRateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  percentage: z.number().min(0).max(100).optional(),
  isInclusive: z.boolean().optional(),
  isCompound: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isReverseCharge: z.boolean().optional(),
  isZeroRated: z.boolean().optional(),
  description: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) return sendError(event, 400, 'BAD_REQUEST', 'Tax rate ID is required')

  const existing = await getDb()('tax_rates')
    .where({ id, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) return sendError(event, 404, 'NOT_FOUND', 'Tax rate not found')

  const body = await readBody(event)
  const parsed = updateTaxRateSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()

  if (data.isDefault) {
    await db('tax_rates')
      .where({ user_id: user.id })
      .update({ is_default: false, updated_at: now })
  }

  const updates: Record<string, any> = { updated_at: now }
  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.percentage !== undefined) updates.percentage = data.percentage
  if (data.isInclusive !== undefined) updates.is_inclusive = data.isInclusive
  if (data.isCompound !== undefined) updates.is_compound = data.isCompound
  if (data.isDefault !== undefined) updates.is_default = data.isDefault
  if (data.isReverseCharge !== undefined) updates.is_reverse_charge = data.isReverseCharge
  if (data.isZeroRated !== undefined) updates.is_zero_rated = data.isZeroRated
  if (data.description !== undefined) updates.description = data.description

  await db('tax_rates').where({ id, user_id: user.id }).update(updates)
  const updated = await db('tax_rates').where({ id }).first()

  return sendSuccess(event, {
    taxRate: {
      id: updated.id,
      name: updated.name,
      percentage: Number(updated.percentage),
      isInclusive: Boolean(updated.is_inclusive),
      isCompound: Boolean(updated.is_compound),
      isDefault: Boolean(updated.is_default),
      isReverseCharge: Boolean(updated.is_reverse_charge),
      isZeroRated: Boolean(updated.is_zero_rated),
      description: updated.description,
      createdAt: updated.created_at,
    }
  }, 'Tax rate updated successfully')
})
