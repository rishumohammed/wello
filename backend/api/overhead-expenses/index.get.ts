// backend/api/overhead-expenses/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = getDb()

  const category = typeof query.category === 'string' && query.category.trim() ? query.category.trim() : null
  const incomeSourceId = query.incomeSourceId ? Number(query.incomeSourceId) : null

  let q = db('overhead_expenses')
    .leftJoin('income_sources', 'overhead_expenses.income_source_id', 'income_sources.id')
    .where('overhead_expenses.user_id', user.id)
    .whereNull('overhead_expenses.deleted_at')
    .select('overhead_expenses.*', 'income_sources.name as income_source_name')

  if (category) {
    q = q.where('overhead_expenses.category', category)
  }
  if (incomeSourceId) {
    q = q.where('overhead_expenses.income_source_id', incomeSourceId)
  }

  q = q.orderBy('overhead_expenses.expense_date', 'desc').orderBy('overhead_expenses.created_at', 'desc')

  const rows = await q

  const items = rows.map(row => ({
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
  }))

  return sendSuccess(event, items)
})
