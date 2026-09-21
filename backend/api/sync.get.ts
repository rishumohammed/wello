// backend/api/sync.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../utils/authGuard'
import { getDb } from '../utils/authService'
import { sendSuccess, sendError } from '../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const db = getDb()

  const serverTime = new Date()
  let sinceDate: Date | null = null

  if (query.since && typeof query.since === 'string' && query.since.trim()) {
    const rawSince = query.since.trim()
    if (!isNaN(Number(rawSince))) {
      // Milliseconds or seconds timestamp
      const ms = Number(rawSince) > 1e11 ? Number(rawSince) : Number(rawSince) * 1000
      sinceDate = new Date(ms)
    } else {
      const parsed = new Date(rawSince)
      if (!isNaN(parsed.getTime())) {
        sinceDate = parsed
      }
    }
  }

  // 1. Clients
  let clientsQuery = db('clients').where({ user_id: user.id })
  let clientTombstones: number[] = []
  if (sinceDate) {
    const updated = await clientsQuery.clone().where('updated_at', '>', sinceDate).whereNull('deleted_at')
    const tombRows = await db('clients')
      .where({ user_id: user.id })
      .where((b) => b.where('deleted_at', '>', sinceDate).orWhere((b2) => b2.whereNotNull('deleted_at').andWhere('updated_at', '>', sinceDate)))
      .select('id')
    clientTombstones = tombRows.map((r) => r.id)
    clientsQuery = clientsQuery.where('updated_at', '>', sinceDate).whereNull('deleted_at')
  } else {
    clientsQuery = clientsQuery.whereNull('deleted_at')
  }
  const clientRecords = await clientsQuery

  // 2. Projects
  let projectsQuery = db('projects').where({ user_id: user.id })
  let projectTombstones: number[] = []
  if (sinceDate) {
    const tombRows = await db('projects')
      .where({ user_id: user.id })
      .where((b) => b.where('deleted_at', '>', sinceDate).orWhere((b2) => b2.whereNotNull('deleted_at').andWhere('updated_at', '>', sinceDate)))
      .select('id')
    projectTombstones = tombRows.map((r) => r.id)
    projectsQuery = projectsQuery.where('updated_at', '>', sinceDate).whereNull('deleted_at')
  } else {
    projectsQuery = projectsQuery.whereNull('deleted_at')
  }
  const projectRecords = await projectsQuery

  // 3. Project Quotes
  let quotesQuery = db('project_quotes').where({ user_id: user.id })
  let quoteTombstones: number[] = []
  if (sinceDate) {
    const tombRows = await db('project_quotes')
      .where({ user_id: user.id })
      .where((b) => b.where('deleted_at', '>', sinceDate).orWhere((b2) => b2.whereNotNull('deleted_at').andWhere('updated_at', '>', sinceDate)))
      .select('id')
    quoteTombstones = tombRows.map((r) => r.id)
    quotesQuery = quotesQuery.where('updated_at', '>', sinceDate).whereNull('deleted_at')
  } else {
    quotesQuery = quotesQuery.whereNull('deleted_at')
  }
  const quoteRecords = await quotesQuery

  // 4. Work Sessions
  let sessionsQuery = db('work_sessions').where({ user_id: user.id })
  let sessionTombstones: number[] = []
  if (sinceDate) {
    const tombRows = await db('work_sessions')
      .where({ user_id: user.id })
      .where((b) => b.where('deleted_at', '>', sinceDate).orWhere((b2) => b2.whereNotNull('deleted_at').andWhere('updated_at', '>', sinceDate)))
      .select('id')
    sessionTombstones = tombRows.map((r) => r.id)
    sessionsQuery = sessionsQuery.where('updated_at', '>', sinceDate).whereNull('deleted_at')
  } else {
    sessionsQuery = sessionsQuery.whereNull('deleted_at')
  }
  const sessionRecords = await sessionsQuery

  // 5. Payments
  let paymentsQuery = db('payments').where({ user_id: user.id })
  let paymentTombstones: number[] = []
  if (sinceDate) {
    const tombRows = await db('payments')
      .where({ user_id: user.id })
      .where((b) => b.where('deleted_at', '>', sinceDate).orWhere((b2) => b2.whereNotNull('deleted_at').andWhere('updated_at', '>', sinceDate)))
      .select('id')
    paymentTombstones = tombRows.map((r) => r.id)
    paymentsQuery = paymentsQuery.where('updated_at', '>', sinceDate).whereNull('deleted_at')
  } else {
    paymentsQuery = paymentsQuery.whereNull('deleted_at')
  }
  const paymentRecords = await paymentsQuery

  // 6. Project Expenses
  let expensesQuery = db('project_expenses').where({ user_id: user.id })
  let expenseTombstones: number[] = []
  if (sinceDate) {
    const tombRows = await db('project_expenses')
      .where({ user_id: user.id })
      .where((b) => b.where('deleted_at', '>', sinceDate).orWhere((b2) => b2.whereNotNull('deleted_at').andWhere('updated_at', '>', sinceDate)))
      .select('id')
    expenseTombstones = tombRows.map((r) => r.id)
    expensesQuery = expensesQuery.where('updated_at', '>', sinceDate).whereNull('deleted_at')
  } else {
    expensesQuery = expensesQuery.whereNull('deleted_at')
  }
  const expenseRecords = await expensesQuery

  // 7. Invoices
  let invoicesQuery = db('invoices').where({ user_id: user.id })
  let invoiceTombstones: number[] = []
  if (sinceDate) {
    const tombRows = await db('invoices')
      .where({ user_id: user.id })
      .where((b) => b.where('deleted_at', '>', sinceDate).orWhere((b2) => b2.whereNotNull('deleted_at').andWhere('updated_at', '>', sinceDate)))
      .select('id')
    invoiceTombstones = tombRows.map((r) => r.id)
    invoicesQuery = invoicesQuery.where('updated_at', '>', sinceDate).whereNull('deleted_at')
  } else {
    invoicesQuery = invoicesQuery.whereNull('deleted_at')
  }
  const invoiceRecords = await invoicesQuery

  // 8. Income Sources
  let incomeSourcesQuery = db('income_sources').where({ user_id: user.id })
  if (sinceDate) {
    incomeSourcesQuery = incomeSourcesQuery.where('updated_at', '>', sinceDate)
  }
  const incomeSourceRecords = await incomeSourcesQuery

  // 9. Overhead Expenses
  let overheadsQuery = db('overhead_expenses').where({ user_id: user.id })
  if (sinceDate) {
    overheadsQuery = overheadsQuery.where('updated_at', '>', sinceDate)
  }
  const overheadRecords = await overheadsQuery

  // 10. Categories (Master lookup)
  let categoriesQuery = db('categories').where({ is_active: true })
  if (sinceDate) {
    categoriesQuery = categoriesQuery.where('updated_at', '>', sinceDate)
  }
  const categoryRecords = await categoriesQuery

    const userProfileObj = {
      earningPersona: user.earning_persona || 'freelancer_projects',
      includeOverheadInMetrics: user.include_overhead_in_metrics !== 0 && user.include_overhead_in_metrics !== false,
    }

    const incomeSourcesMapped = incomeSourceRecords.map((src) => ({
      id: src.id,
      type: src.type,
      name: src.name,
      currency: src.currency,
      payFrequency: src.pay_frequency || src.frequency,
      expectedAmount: src.expected_amount !== null ? Number(src.expected_amount) : null,
      expectedHoursPerPeriod: src.expected_hours_per_period !== null ? Number(src.expected_hours_per_period) : null,
      status: src.is_active ? 'active' : 'archived',
      isActive: Boolean(src.is_active),
      isArchived: !src.is_active,
      notes: src.notes,
      createdAt: src.created_at,
      updatedAt: src.updated_at,
    }))

    const overheadsMapped = overheadRecords.map((o) => ({
      id: o.id,
      incomeSourceId: o.income_source_id,
      category: o.category,
      name: o.description || o.name || 'Overhead',
      description: o.description || o.name || 'Overhead',
      amount: Number(o.amount),
      currency: o.currency,
      baseAmount: o.base_amount !== null ? Number(o.base_amount) : Number(o.amount),
      expenseDate: o.expense_date,
      frequency: o.recurring_period || (o.is_recurring ? 'monthly' : 'one_off'),
      allocationRule: o.allocation_rule || 'none',
      notes: o.notes,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    }))

    return sendSuccess(event, {
      serverTime: serverTime.toISOString(),
      since: sinceDate ? sinceDate.toISOString() : null,
      isInitialSync: !sinceDate,
      user: userProfileObj,
      userProfile: userProfileObj,
      clients: {
        records: clientRecords.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone_e164,
          company: c.company,
          country: c.country,
          notes: c.notes,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        })),
        tombstones: clientTombstones,
      },
      projects: {
        records: projectRecords.map((p) => ({
          id: p.id,
          clientId: p.client_id,
          name: p.name,
          description: p.description,
          status: p.status,
          currency: p.currency,
          isJob: Boolean(p.is_job),
          serviceCategory: p.service_category,
          quoteAmount: p.quote_amount !== null ? Number(p.quote_amount) : null,
          quoteEstHours: p.quote_est_hours !== null ? Number(p.quote_est_hours) : null,
          quoteStatus: p.quote_status,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })),
        tombstones: projectTombstones,
      },
      quotes: {
        records: quoteRecords.map((q) => ({
          id: q.id,
          projectId: q.project_id,
          version: q.version,
          amount: Number(q.amount),
          currency: q.currency,
          estimatedHours: q.estimated_hours !== null ? Number(q.estimated_hours) : null,
          pricingModel: q.pricing_model,
          status: q.status,
          createdAt: q.created_at,
          updatedAt: q.updated_at,
        })),
        tombstones: quoteTombstones,
      },
      sessions: {
        records: sessionRecords.map((s) => ({
          id: s.id,
          projectId: s.project_id,
          incomeSourceId: s.income_source_id,
          title: s.title,
          type: s.type,
          paymentType: s.payment_type,
          unpaidReason: s.unpaid_reason,
          notes: s.notes,
          startedAt: s.started_at,
          endedAt: s.ended_at,
          durationSeconds: s.duration_seconds,
          pausedSeconds: s.paused_seconds,
          createdAt: s.created_at,
          updatedAt: s.updated_at,
        })),
        tombstones: sessionTombstones,
      },
      payments: {
        records: paymentRecords.map((p) => ({
          id: p.id,
          projectId: p.project_id,
          incomeSourceId: p.income_source_id,
          clientId: p.client_id,
          amount: Number(p.amount),
          currency: p.currency,
          paidDate: p.paid_date,
          isExpected: Boolean(p.is_expected),
          status: p.status || 'received',
          notes: p.notes,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        })),
        tombstones: paymentTombstones,
      },
      expenses: {
        records: expenseRecords.map((e) => ({
          id: e.id,
          projectId: e.project_id,
          description: e.description,
          category: e.category,
          amount: Number(e.amount),
          currency: e.currency,
          expenseDate: e.expense_date,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        })),
        tombstones: expenseTombstones,
      },
      incomeSources: {
        records: incomeSourcesMapped,
      },
      overheadExpenses: {
        records: overheadsMapped,
      },
      overheads: {
        records: overheadsMapped,
      },
      invoices: {
        records: invoiceRecords.map((i) => ({
          id: i.id,
          projectId: i.project_id,
          clientId: i.client_id,
          invoiceNumber: i.invoice_number,
          invoiceDate: i.invoice_date,
          dueDate: i.due_date,
          paymentTerms: i.payment_terms || 'net_14',
          customerName: i.customer_name,
          customerEmail: i.customer_email,
          subtotal: Number(i.subtotal),
          discount: Number(i.discount),
          taxMode: i.tax_mode || 'exclusive',
          taxPercent: Number(i.tax_percent),
          taxAmount: Number(i.tax_amount),
          isReverseCharge: Boolean(i.is_reverse_charge),
          total: Number(i.total),
          amountPaid: Number(i.amount_paid || 0),
          balanceDue: Number(i.balance_due !== null ? i.balance_due : Math.max(0, Number(i.total) - Number(i.amount_paid || 0))),
          currency: i.currency,
          status: i.status,
          publicToken: i.public_token,
          pdfTemplate: i.pdf_template || 'modern_clean',
          isImmutable: Boolean(i.is_immutable),
          paidAt: i.paid_at,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        })),
        tombstones: invoiceTombstones,
      },
      categories: {
        records: categoryRecords.map((c) => ({
          id: c.id,
          parentId: c.parent_id,
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          displayOrder: c.display_order,
        })),
      },
    })
})
