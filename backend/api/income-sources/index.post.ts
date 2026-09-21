// backend/api/income-sources/index.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'

const createIncomeSourceSchema = z.object({
  type: z.enum(['project', 'salary', 'hourly_wage', 'daily_wage', 'retainer', 'gig', 'other']).default('other'),
  name: z.string().min(1, 'Name is required').max(100),
  currency: z.string().length(3).toUpperCase().optional(),
  payFrequency: z.enum(['hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'per_job', 'one_off']).default('monthly'),
  expectedAmount: z.number().min(0).max(999999999).nullable().optional(),
  expectedHoursPerPeriod: z.number().min(0).max(9999).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const path = getRequestPath(event)
  const idempotencyKey = getIdempotencyKey(event)

  if (idempotencyKey) {
    const cached = await checkIdempotency(user.id, idempotencyKey, path)
    if (cached.exists) {
      return sendSuccess(event, cached.body, undefined, cached.status)
    }
  }

  const body = await readBody(event)
  const parsed = createIncomeSourceSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()
  const userBaseCurrency = (user as any).base_currency || (user as any).baseCurrency || 'USD'
  const currency = (data.currency || userBaseCurrency).toUpperCase()

  const [id] = await db('income_sources').insert({
    user_id: user.id,
    type: data.type,
    name: data.name.trim(),
    currency,
    pay_frequency: data.payFrequency,
    frequency: data.payFrequency,
    expected_amount: data.expectedAmount !== undefined ? data.expectedAmount : null,
    expected_hours_per_period: data.expectedHoursPerPeriod !== undefined ? data.expectedHoursPerPeriod : null,
    is_active: data.isActive !== undefined ? data.isActive : true,
    notes: data.notes ? data.notes.trim() : null,
    created_at: now,
    updated_at: now,
  })

  const newSource = await db('income_sources').where({ id }).first()
  const result = {
    id: newSource.id,
    userId: newSource.user_id,
    type: newSource.type,
    name: newSource.name,
    currency: newSource.currency,
    payFrequency: newSource.pay_frequency || newSource.frequency,
    expectedAmount: newSource.expected_amount !== null ? Number(newSource.expected_amount) : null,
    expectedHoursPerPeriod: newSource.expected_hours_per_period !== null ? Number(newSource.expected_hours_per_period) : null,
    isActive: Boolean(newSource.is_active),
    notes: newSource.notes,
    createdAt: newSource.created_at,
    updatedAt: newSource.updated_at,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, result)
  }

  return sendSuccess(event, result, undefined, 201)
})
