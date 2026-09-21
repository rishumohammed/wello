// backend/api/metrics/summary.get.ts
// Unified Authoritative Metrics Summary API Endpoint

import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess } from '../../utils/apiResponse'
import {
  computeUnifiedMetricsSummary,
  SessionData,
  PaymentData,
  ExpenseData,
  ProjectData,
  OverheadData,
  IncomeSourceData,
} from '../../utils/metricsEngine'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = getDb()

  const range = (String(query.range || '30d').toLowerCase()) as any
  const fromStr = query.from ? String(query.from) : undefined
  const toStr = query.to ? String(query.to) : undefined
  const timezone = query.tz ? String(query.tz) : (user.timezone || 'UTC')
  const baseCurrency = (query.currency ? String(query.currency) : (user.base_currency || 'USD')).toUpperCase().slice(0, 3)
  const targetHourly = user.target_hourly ? Number(user.target_hourly) : 100
  const headlinePreference = (user.headline_rate_metric as any) || 'client_work'
  const includeOverhead = query.includeOverhead !== undefined
    ? (query.includeOverhead === 'true' || query.includeOverhead === true)
    : (user.include_overhead_in_metrics !== 0 && user.include_overhead_in_metrics !== false)

  // Fetch user data from DB
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

  const rawOverheads = await db('overhead_expenses')
    .where({ user_id: user.id })
    .orderBy('expense_date', 'asc')

  const rawIncomeSources = await db('income_sources')
    .where({ user_id: user.id })
    .orderBy('created_at', 'asc')

  // Map to Engine Types
  const sessions: SessionData[] = rawSessions.map(s => ({
    id: s.id,
    projectId: s.project_id,
    incomeSourceId: s.income_source_id,
    clientId: s.client_id,
    type: s.type,
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
    incomeSourceId: p.income_source_id,
    amount: Number(p.amount),
    currency: p.currency,
    baseAmount: p.base_amount !== null ? Number(p.base_amount) : Number(p.amount),
    paymentDate: p.paid_date,
    status: p.status,
    isExpected: Boolean(p.is_expected),
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

  const overheads: OverheadData[] = rawOverheads.map(o => ({
    id: o.id,
    incomeSourceId: o.income_source_id,
    category: o.category,
    name: o.description || o.name || 'Overhead',
    amount: Number(o.amount),
    currency: o.currency,
    baseAmount: o.base_amount !== null ? Number(o.base_amount) : Number(o.amount),
    expenseDate: o.expense_date,
    frequency: o.recurring_period || (o.is_recurring ? 'monthly' : 'one_off'),
    allocationRule: o.allocation_rule || 'none',
  }))

  const incomeSources: IncomeSourceData[] = rawIncomeSources.map(src => ({
    id: src.id,
    userId: src.user_id,
    type: src.type,
    name: src.name,
    currency: src.currency,
    payFrequency: src.pay_frequency || src.frequency || 'monthly',
    expectedAmount: src.expected_amount !== null ? Number(src.expected_amount) : null,
    expectedHoursPerPeriod: src.expected_hours_per_period !== null ? Number(src.expected_hours_per_period) : null,
    status: src.is_active ? 'active' : 'archived',
    isArchived: !src.is_active,
    notes: src.notes,
    createdAt: src.created_at,
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

  // Compute Active Summary
  const summary = computeUnifiedMetricsSummary(
    sessions,
    payments,
    expenses,
    projects,
    overheads,
    incomeSources,
    {
      range,
      from: fromStr,
      to: toStr,
      timezone,
      baseCurrency,
      targetHourly,
      headlinePreference,
      includeOverhead,
    }
  )

  // Compute Today Snapshot
  const todaySummary = computeUnifiedMetricsSummary(
    sessions,
    payments,
    expenses,
    projects,
    overheads,
    incomeSources,
    {
      range: 'today',
      timezone,
      baseCurrency,
      targetHourly,
      headlinePreference,
      includeOverhead,
    }
  )

  // Compute 7d, 30d, 90d, YTD baselines for rolling comparison
  const summary7d = computeUnifiedMetricsSummary(sessions, payments, expenses, projects, overheads, incomeSources, { range: '7d', timezone, baseCurrency, targetHourly, headlinePreference, includeOverhead })
  const summary30d = computeUnifiedMetricsSummary(sessions, payments, expenses, projects, overheads, incomeSources, { range: '30d', timezone, baseCurrency, targetHourly, headlinePreference, includeOverhead })
  const summary90d = computeUnifiedMetricsSummary(sessions, payments, expenses, projects, overheads, incomeSources, { range: '90d', timezone, baseCurrency, targetHourly, headlinePreference, includeOverhead })
  const summaryYtd = computeUnifiedMetricsSummary(sessions, payments, expenses, projects, overheads, incomeSources, { range: 'ytd', timezone, baseCurrency, targetHourly, headlinePreference, includeOverhead })

  return sendSuccess(event, {
    summary,
    today: todaySummary,
    salariedCommuteAnalysis: summary.salariedCommuteAnalysis,
    multiEmployerComparison: summary.multiEmployerComparison,
    rolling: {
      '7d': summary7d,
      '30d': summary30d,
      '90d': summary90d,
      'ytd': summaryYtd,
    },
    meta: {
      timezone,
      baseCurrency,
      targetHourly,
      headlinePreference,
      includeOverhead,
    }
  })
})
