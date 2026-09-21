// backend/api/metrics/insights.get.ts
// Unified Authoritative Metrics Insights API Endpoint

import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess } from '../../utils/apiResponse'
import {
  computeIntelligenceInsights,
  SessionData,
  PaymentData,
  ExpenseData,
  ProjectData,
} from '../../utils/metricsEngine'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = getDb()

  const timezone = query.tz ? String(query.tz) : (user.timezone || 'UTC')
  const baseCurrency = (query.currency ? String(query.currency) : (user.base_currency || 'USD')).toUpperCase().slice(0, 3)
  const targetHourly = user.target_hourly ? Number(user.target_hourly) : 100

  // Fetch all user records
  const rawSessions = await db('work_sessions')
    .where({ user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('started_at', 'asc')

  const rawPayments = await db('payments')
    .where({ user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('paid_date', 'asc')

  const rawExpenses = await db('project_expenses')
    .where({ user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('expense_date', 'asc')

  const rawProjects = await db('projects')
    .where({ user_id: user.id })
    .whereNull('deleted_at')

  const rawClients = await db('clients')
    .where({ user_id: user.id })
    .whereNull('deleted_at')

  // Map to Engine Types
  const sessions: SessionData[] = rawSessions.map(s => ({
    id: s.id,
    projectId: s.project_id,
    clientId: s.client_id,
    startedAt: s.started_at,
    endedAt: s.ended_at,
    durationMin: s.duration_seconds ? Math.round(s.duration_seconds / 60) : (s.duration_minutes || 0),
    durationSeconds: s.duration_seconds,
    paymentType: s.payment_type,
    unpaidReason: s.unpaid_reason,
    unpaidCategory: s.unpaid_category,
  }))

  const payments: PaymentData[] = rawPayments.map(p => ({
    id: p.id,
    projectId: p.project_id,
    amount: Number(p.amount),
    currency: p.currency,
    baseAmount: p.base_amount !== null ? Number(p.base_amount) : Number(p.amount),
    paymentDate: p.paid_date,
    createdAt: p.created_at,
  }))

  const expenses: ExpenseData[] = rawExpenses.map(e => ({
    id: e.id,
    projectId: e.project_id,
    amount: Number(e.amount),
    currency: e.currency,
    baseAmount: e.base_amount !== null ? Number(e.base_amount) : Number(e.amount),
    expenseDate: e.expense_date,
    createdAt: e.created_at,
  }))

  const projects: ProjectData[] = rawProjects.map(p => ({
    id: p.id,
    clientId: p.client_id,
    name: p.name,
    status: p.status,
    isJob: Boolean(p.is_job),
    serviceCategory: p.service_category,
    currency: p.currency,
    quoteAmount: p.quote_amount !== null ? Number(p.quote_amount) : null,
    quoteEstHours: p.quote_est_hours !== null ? Number(p.quote_est_hours) : null,
    quoteStatus: p.quote_status,
  }))

  const clients = rawClients.map(c => ({
    id: c.id,
    name: c.name,
    company: c.company || undefined,
    currency: c.currency || undefined,
  }))

  const insights = computeIntelligenceInsights(
    sessions,
    payments,
    expenses,
    projects,
    clients,
    targetHourly,
    baseCurrency
  )

  return sendSuccess(event, {
    insights,
    meta: {
      timezone,
      baseCurrency,
      targetHourly,
    }
  })
})
