// backend/api/tax-rates/index.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const createTaxRateSchema = z.object({
  name: z.string().min(1, 'Tax name is required').max(100),
  percentage: z.number().min(0, 'Percentage cannot be negative').max(100),
  isInclusive: z.boolean().optional().default(false),
  isCompound: z.boolean().optional().default(false),
  isDefault: z.boolean().optional().default(false),
  isReverseCharge: z.boolean().optional().default(false),
  isZeroRated: z.boolean().optional().default(false),
  description: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  const parsed = createTaxRateSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()

  if (data.isDefault) {
    // Unset other defaults for this user
    await db('tax_rates')
      .where({ user_id: user.id })
      .update({ is_default: false, updated_at: now })
  }

  const [id] = await db('tax_rates').insert({
    user_id: user.id,
    name: data.name.trim(),
    percentage: data.percentage,
    is_inclusive: data.isInclusive,
    is_compound: data.isCompound,
    is_default: data.isDefault,
    is_reverse_charge: data.isReverseCharge,
    is_zero_rated: data.isZeroRated,
    description: data.description || null,
    created_at: now,
    updated_at: now,
  })

  const newTax = await db('tax_rates').where({ id }).first()

  return sendSuccess(event, {
    taxRate: {
      id: newTax.id,
      name: newTax.name,
      percentage: Number(newTax.percentage),
      isInclusive: Boolean(newTax.is_inclusive),
      isCompound: Boolean(newTax.is_compound),
      isDefault: Boolean(newTax.is_default),
      isReverseCharge: Boolean(newTax.is_reverse_charge),
      isZeroRated: Boolean(newTax.is_zero_rated),
      description: newTax.description,
      createdAt: newTax.created_at,
    }
  }, 'Tax rate created successfully', 201)
})
