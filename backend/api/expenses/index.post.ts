// backend/api/expenses/index.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'

const createExpenseSchema = z.object({
  projectId: z.number().int().positive('Project ID is required'),
  description: z.string().min(1, 'Description is required').max(255),
  amount: z.number().positive('Amount must be positive').max(999999999),
  category: z.string().max(50).optional().default('General'),
  currency: z.string().length(3).toUpperCase().optional(),
  expenseDate: z.string().optional(),
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
  const parsed = createExpenseSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  const project = await db('projects')
    .where({ id: data.projectId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!project) {
    return sendError(event, 400, 'INVALID_PROJECT', 'Specified project does not exist or does not belong to you.')
  }

  const now = new Date()
  const expenseDate = data.expenseDate || now.toISOString().slice(0, 10)
  const currency = data.currency || project.currency || user.baseCurrency || 'USD'

  const [expenseId] = await db('project_expenses').insert({
    user_id: user.id,
    project_id: data.projectId,
    description: data.description.trim(),
    category: data.category || 'General',
    amount: data.amount,
    currency,
    expense_date: expenseDate,
    created_at: now,
    updated_at: now,
  })

  const newExpense = await db('project_expenses').where({ id: expenseId }).first()

  const responseData = {
    id: newExpense.id,
    projectId: newExpense.project_id,
    projectName: project.name,
    description: newExpense.description,
    category: newExpense.category,
    amount: Number(newExpense.amount),
    currency: newExpense.currency,
    expenseDate: newExpense.expense_date,
    createdAt: newExpense.created_at,
    updatedAt: newExpense.updated_at,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, responseData)
  }

  return sendSuccess(event, responseData, undefined, 201)
})
