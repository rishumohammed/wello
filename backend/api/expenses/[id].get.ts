// backend/api/expenses/[id].get.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const expenseId = Number(idParam)

  if (!expenseId || isNaN(expenseId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid expense ID parameter.')
  }

  const db = getDb()
  const expense = await db('project_expenses')
    .where({ id: expenseId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!expense) {
    return sendError(event, 404, 'EXPENSE_NOT_FOUND', 'Expense not found.')
  }

  const project = await db('projects').where({ id: expense.project_id }).first()

  return sendSuccess(event, {
    id: expense.id,
    projectId: expense.project_id,
    projectName: project?.name || null,
    description: expense.description,
    category: expense.category,
    amount: Number(expense.amount),
    currency: expense.currency,
    expenseDate: expense.expense_date,
    createdAt: expense.created_at,
    updatedAt: expense.updated_at,
  })
})
