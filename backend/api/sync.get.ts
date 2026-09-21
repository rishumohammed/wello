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

  // 8. Categories (Master lookup)
  let categoriesQuery = db('categories').where({ is_active: true })
  if (sinceDate) {
    categoriesQuery = categoriesQuery.where('updated_at', '>', sinceDate)
  }
  const categoryRecords = await categoriesQuery

  return sendSuccess(event, {
    serverTime: serverTime.toISOString(),
    since: sinceDate ? sinceDate.toISOString() : null,
    isInitialSync: !sinceDate,
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
        categoryId: p.category_id,
        serviceCategory: p.service_category,
        name: p.name,
        description: p.description,
        status: p.status,
        isJob: Boolean(p.is_job),
        currency: p.currency,
        quoteAmount: p.quote_amount !== null ? Number(p.quote_amount) : null,
        quoteDate: p.quote_date,
        quoteEstHours: p.quote_est_hours !== null ? Number(p.quote_est_hours) : null,
        quoteNotes: p.quote_notes,
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
        quoteAmount: Number(q.quote_amount),
        currency: q.currency,
        estHours: q.est_hours !== null ? Number(q.est_hours) : null,
        quoteDate: q.quote_date,
        validUntil: q.valid_until,
        status: q.status,
        notes: q.notes,
        createdAt: q.created_at,
        updatedAt: q.updated_at,
      })),
      tombstones: quoteTombstones,
    },
    sessions: {
      records: sessionRecords.map((s) => ({
        id: s.id,
        projectId: s.project_id,
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
        clientId: p.client_id,
        amount: Number(p.amount),
        currency: p.currency,
        paidDate: p.paid_date,
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
    invoices: {
      records: invoiceRecords.map((i) => ({
        id: i.id,
        projectId: i.project_id,
        clientId: i.client_id,
        invoiceNumber: i.invoice_number,
        invoiceDate: i.invoice_date,
        dueDate: i.due_date,
        customerName: i.customer_name,
        customerEmail: i.customer_email,
        subtotal: Number(i.subtotal),
        discount: Number(i.discount),
        taxPercent: Number(i.tax_percent),
        taxAmount: Number(i.tax_amount),
        total: Number(i.total),
        currency: i.currency,
        status: i.status,
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
