// backend/api/projects/[id].get.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const projectId = Number(idParam)

  if (!projectId || isNaN(projectId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid project ID parameter.')
  }

  const db = getDb()
  const project = await db('projects')
    .where({ id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!project) {
    return sendError(event, 404, 'PROJECT_NOT_FOUND', 'Project not found.')
  }

  // Fetch client if attached
  let client = null
  if (project.client_id) {
    client = await db('clients')
      .where({ id: project.client_id, user_id: user.id })
      .first()
  }

  // Fetch recent work sessions
  const sessions = await db('work_sessions')
    .where({ project_id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('started_at', 'desc')
    .limit(50)

  // Fetch payments
  const payments = await db('payments')
    .where({ project_id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('paid_date', 'desc')

  // Fetch expenses
  const expenses = await db('project_expenses')
    .where({ project_id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('expense_date', 'desc')

  // Fetch quotes history
  const quotes = await db('project_quotes')
    .where({ project_id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('version', 'desc')

  // Calculate project metrics
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
  const paidSeconds = sessions.filter((s) => s.payment_type === 'paid').reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
  const unpaidSeconds = sessions.filter((s) => s.payment_type !== 'paid').reduce((sum, s) => sum + (s.duration_seconds || 0), 0)

  const totalMinutes = Math.round(totalSeconds / 60)
  const paidMinutes = Math.round(paidSeconds / 60)
  const unpaidMinutes = Math.round(unpaidSeconds / 60)

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  const netIncome = totalRevenue - totalExpenses
  const totalHours = totalMinutes / 60
  const effectiveHourlyValue = totalHours > 0 ? Math.round(netIncome / totalHours) : 0

  return sendSuccess(event, {
    id: project.id,
    clientId: project.client_id,
    client: client
      ? {
          id: client.id,
          name: client.name,
          company: client.company,
          email: client.email,
          phone: client.phone_e164,
        }
      : null,
    categoryId: project.category_id,
    serviceCategory: project.service_category,
    name: project.name,
    description: project.description,
    status: project.status,
    isJob: Boolean(project.is_job),
    currency: project.currency || 'USD',
    quoteAmount: project.quote_amount !== null ? Number(project.quote_amount) : null,
    quoteDate: project.quote_date,
    quoteEstHours: project.quote_est_hours !== null ? Number(project.quote_est_hours) : null,
    quoteNotes: project.quote_notes,
    quoteStatus: project.quote_status,
    metrics: {
      totalMinutes,
      paidMinutes,
      unpaidMinutes,
      totalHours: Number(totalHours.toFixed(2)),
      revenue: totalRevenue,
      expenses: totalExpenses,
      netIncome,
      effectiveHourlyValue,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      paymentType: s.payment_type,
      unpaidReason: s.unpaid_reason,
      notes: s.notes,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      durationMinutes: Math.round((s.duration_seconds || 0) / 60),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      paidDate: p.paid_date,
      notes: p.notes,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      description: e.description,
      category: e.category,
      amount: Number(e.amount),
      currency: e.currency,
      expenseDate: e.expense_date,
    })),
    quotes: quotes.map((q) => ({
      id: q.id,
      version: q.version,
      quoteAmount: Number(q.quote_amount),
      currency: q.currency,
      estHours: q.est_hours !== null ? Number(q.est_hours) : null,
      quoteDate: q.quote_date,
      validUntil: q.valid_until,
      status: q.status,
      notes: q.notes,
      createdAt: q.created_at,
    })),
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  })
})
