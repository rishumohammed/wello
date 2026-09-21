// backend/api/overhead-expenses/index.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'

const createOverheadSchema = z.object({
  incomeSourceId: z.number().int().positive().nullable().optional(),
  category: z.enum(['commute', 'tools', 'tool', 'phone_internet', 'software', 'equipment', 'uniforms', 'uniform', 'licences', 'license', 'workspace', 'other']).default('other'),
  name: z.string().min(1, 'Name is required').max(100),
  amount: z.number().positive('Amount must be greater than zero').max(999999999),
  currency: z.string().length(3).toUpperCase().optional(),
  expenseDate: z.string().optional(),
  frequency: z.enum(['one_off', 'daily', 'weekly', 'monthly', 'annual', 'yearly']).default('one_off'),
  allocationRule: z.enum(['none', 'per_hour_worked', 'per_period', 'per_source']).default('per_source'),
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
  const parsed = createOverheadSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  if (data.incomeSourceId) {
    const source = await db('income_sources')
      .where({ id: data.incomeSourceId, user_id: user.id })
      .whereNull('deleted_at')
      .first()
    if (!source) {
      return sendError(event, 400, 'INVALID_INCOME_SOURCE', 'Income source not found or does not belong to user')
    }
  }

  const now = new Date()
  const expenseDate = data.expenseDate || now.toISOString().slice(0, 10)
  const userBaseCurrency = (user as any).base_currency || (user as any).baseCurrency || 'USD'
  const currency = (data.currency || userBaseCurrency).toUpperCase()

  const [id] = await db('overhead_expenses').insert({
    user_id: user.id,
    income_source_id: data.incomeSourceId || null,
    category: data.category,
    description: data.name.trim(),
    amount: data.amount,
    currency,
    expense_date: expenseDate,
    is_recurring: data.frequency !== 'one_off',
    recurring_period: data.frequency,
    allocation_rule: data.allocationRule,
    notes: data.notes ? data.notes.trim() : null,
    created_at: now,
    updated_at: now,
  })

  const row = await db('overhead_expenses')
    .leftJoin('income_sources', 'overhead_expenses.income_source_id', 'income_sources.id')
    .where('overhead_expenses.id', id)
    .select('overhead_expenses.*', 'income_sources.name as income_source_name')
    .first()

  const result = {
    id: row.id,
    userId: row.user_id,
    incomeSourceId: row.income_source_id,
    incomeSourceName: row.income_source_name || null,
    category: row.category,
    name: row.description,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    expenseDate: row.expense_date,
    frequency: row.recurring_period || (row.is_recurring ? 'monthly' : 'one_off'),
    allocationRule: row.allocation_rule || 'none',
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, result)
  }

  return sendSuccess(event, result, undefined, 201)
})
