// backend/api/expenses/[id].delete.ts
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
  const existing = await db('project_expenses')
    .where({ id: expenseId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'EXPENSE_NOT_FOUND', 'Expense not found or already deleted.')
  }

  const now = new Date()
  await db('project_expenses')
    .where({ id: expenseId, user_id: user.id })
    .update({
      deleted_at: now,
      updated_at: now,
    })

  return sendSuccess(event, {
    id: expenseId,
    deleted: true,
    message: 'Expense soft-deleted successfully.',
    deletedAt: now.toISOString(),
  })
})
