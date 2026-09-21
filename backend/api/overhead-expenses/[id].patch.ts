// backend/api/overhead-expenses/[id].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const updateOverheadSchema = z.object({
  incomeSourceId: z.number().int().positive().nullable().optional(),
  category: z.enum(['commute', 'tools', 'tool', 'phone_internet', 'software', 'equipment', 'uniforms', 'uniform', 'licences', 'license', 'workspace', 'other']).optional(),
  name: z.string().min(1).max(100).optional(),
  amount: z.number().positive().max(999999999).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  expenseDate: z.string().optional(),
  frequency: z.enum(['one_off', 'daily', 'weekly', 'monthly', 'annual', 'yearly']).optional(),
  allocationRule: z.enum(['none', 'per_hour_worked', 'per_period', 'per_source']).optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid overhead expense ID')
  }

  const body = await readBody(event)
  const parsed = updateOverheadSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  const existing = await db('overhead_expenses')
    .where({ id, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'NOT_FOUND', 'Overhead expense not found')
  }

  if (data.incomeSourceId) {
    const source = await db('income_sources')
      .where({ id: data.incomeSourceId, user_id: user.id })
      .whereNull('deleted_at')
      .first()
    if (!source) {
      return sendError(event, 400, 'INVALID_INCOME_SOURCE', 'Income source not found or does not belong to user')
    }
  }

  const updates: Record<string, any> = {
    updated_at: new Date(),
  }

  if (data.incomeSourceId !== undefined) updates.income_source_id = data.incomeSourceId
  if (data.category !== undefined) updates.category = data.category
  if (data.name !== undefined) updates.description = data.name.trim()
  if (data.amount !== undefined) updates.amount = data.amount
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.expenseDate !== undefined) updates.expense_date = data.expenseDate
  if (data.frequency !== undefined) {
    updates.recurring_period = data.frequency
    updates.is_recurring = data.frequency !== 'one_off'
  }
  if (data.allocationRule !== undefined) updates.allocation_rule = data.allocationRule
  if (data.notes !== undefined) updates.notes = data.notes ? data.notes.trim() : null

  await db('overhead_expenses').where({ id }).update(updates)

  const row = await db('overhead_expenses')
    .leftJoin('income_sources', 'overhead_expenses.income_source_id', 'income_sources.id')
    .where('overhead_expenses.id', id)
    .select('overhead_expenses.*', 'income_sources.name as income_source_name')
    .first()

  return sendSuccess(event, {
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
  })
})
