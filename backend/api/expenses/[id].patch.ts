// backend/api/expenses/[id].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const updateExpenseSchema = z.object({
  projectId: z.number().int().positive().optional(),
  description: z.string().min(1).max(255).optional(),
  amount: z.number().positive().max(999999999).optional(),
  category: z.string().max(50).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  expenseDate: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const expenseId = Number(idParam)

  if (!expenseId || isNaN(expenseId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid expense ID parameter.')
  }

  const db = getDb()
  const existing = await db('project_expenses')
    .where({ id: expenseId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'EXPENSE_NOT_FOUND', 'Expense not found.')
  }

  const body = await readBody(event)
  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data

  if (data.projectId) {
    const project = await db('projects')
      .where({ id: data.projectId, user_id: user.id })
      .whereNull('deleted_at')
      .first()
    if (!project) {
      return sendError(event, 400, 'INVALID_PROJECT', 'Specified project does not exist or does not belong to you.')
    }
  }

  const now = new Date()
  const updates: Record<string, any> = {
    updated_at: now,
  }

  if (data.projectId !== undefined) updates.project_id = data.projectId
  if (data.description !== undefined) updates.description = data.description.trim()
  if (data.amount !== undefined) updates.amount = data.amount
  if (data.category !== undefined) updates.category = data.category
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.expenseDate !== undefined) updates.expense_date = data.expenseDate

  await db('project_expenses')
    .where({ id: expenseId, user_id: user.id })
    .update(updates)

  const updated = await db('project_expenses').where({ id: expenseId }).first()

  return sendSuccess(event, {
    id: updated.id,
    projectId: updated.project_id,
    description: updated.description,
    category: updated.category,
    amount: Number(updated.amount),
    currency: updated.currency,
    expenseDate: updated.expense_date,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  })
})
