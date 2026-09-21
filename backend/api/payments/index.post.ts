// backend/api/payments/index.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'
import { logAnalyticsEvent } from '../../utils/analyticsService'

const createPaymentSchema = z.object({
  projectId: z.number().int().positive().nullable().optional(),
  incomeSourceId: z.number().int().positive().nullable().optional(),
  invoiceId: z.number().int().positive().nullable().optional(),
  clientId: z.number().int().positive().nullable().optional(),
  amount: z.number().positive('Payment amount must be greater than zero').max(999999999),
  currency: z.string().length(3).toUpperCase().optional(),
  paidDate: z.string().optional(),
  status: z.enum(['expected', 'received', 'overdue', 'cancelled', 'paid']).optional().default('received'),
  isExpected: z.boolean().optional(),
  notes: z.string().nullable().optional(),
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
  const parsed = createPaymentSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  if (!data.projectId && !data.incomeSourceId && !data.invoiceId) {
    return sendError(event, 400, 'MISSING_TARGET', 'Either a project, income source, or invoice must be specified.')
  }

  let project: any = null
  let incomeSource: any = null
  let invoice: any = null

  if (data.invoiceId) {
    invoice = await db('invoices')
      .where({ id: data.invoiceId, user_id: user.id })
      .whereNull('deleted_at')
      .first()

    if (!invoice) {
      return sendError(event, 400, 'INVALID_INVOICE', 'Specified invoice does not exist or does not belong to you.')
    }
  }

  if (data.projectId) {
    project = await db('projects')
      .where({ id: data.projectId, user_id: user.id })
      .whereNull('deleted_at')
      .first()

    if (!project) {
      return sendError(event, 400, 'INVALID_PROJECT', 'Specified project does not exist or does not belong to you.')
    }
  }

  if (data.incomeSourceId) {
    incomeSource = await db('income_sources')
      .where({ id: data.incomeSourceId, user_id: user.id })
      .first()

    if (!incomeSource) {
      return sendError(event, 400, 'INVALID_INCOME_SOURCE', 'Specified income source does not exist or does not belong to you.')
    }
  }

  const now = new Date()
  const paidDate = data.paidDate || now.toISOString().slice(0, 10)
  const currency = data.currency || invoice?.currency || project?.currency || incomeSource?.currency || user.base_currency || 'USD'
  const clientId = data.clientId || invoice?.client_id || project?.client_id || null

  const isExp = data.isExpected !== undefined ? data.isExpected : (data.status === 'expected')
  const status = data.status || (isExp ? 'expected' : 'received')

  const [paymentId] = await db('payments').insert({
    user_id: user.id,
    project_id: data.projectId || invoice?.project_id || null,
    income_source_id: data.incomeSourceId || null,
    invoice_id: invoice?.id || null,
    client_id: clientId,
    amount: data.amount,
    currency,
    paid_date: paidDate,
    is_expected: isExp,
    status: status === 'received' ? 'paid' : status,
    notes: data.notes || null,
    created_at: now,
    updated_at: now,
  })

  // If linked to an invoice, update invoice amount_paid and balance_due
  if (invoice && !isExp) {
    const currentPaid = Number(invoice.amount_paid || 0)
    const newPaid = Math.round((currentPaid + Number(data.amount)) * 10000) / 10000
    const invTotal = Number(invoice.total)
    const newBalance = Math.max(0, Math.round((invTotal - newPaid) * 10000) / 10000)

    let nextStatus = invoice.status
    let paidAt = invoice.paid_at
    if (newBalance === 0) {
      nextStatus = 'paid'
      paidAt = now
    } else if (newPaid > 0) {
      nextStatus = 'partially_paid'
    }

    await db('invoices')
      .where({ id: invoice.id })
      .update({
        amount_paid: newPaid,
        balance_due: newBalance,
        status: nextStatus,
        paid_at: paidAt,
        is_immutable: true,
        updated_at: now,
      })
  }

  const newPayment = await db('payments').where({ id: paymentId }).first()

  const responseData = {
    id: newPayment.id,
    projectId: newPayment.project_id,
    incomeSourceId: newPayment.income_source_id,
    projectName: project?.name || null,
    incomeSourceName: incomeSource?.name || null,
    clientId: newPayment.client_id,
    amount: Number(newPayment.amount),
    currency: newPayment.currency,
    paidDate: newPayment.paid_date,
    isExpected: Boolean(newPayment.is_expected),
    status: newPayment.status,
    notes: newPayment.notes,
    createdAt: newPayment.created_at,
    updatedAt: newPayment.updated_at,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, responseData)
  }

  // Emit trusted analytics event
  await logAnalyticsEvent(user.id, 'payment_logged', {
    payment_id: newPayment.id,
    currency: newPayment.currency,
    amount: Number(newPayment.amount),
    has_invoice: Boolean(data.invoiceId),
  })

  return sendSuccess(event, responseData, undefined, 201)
})
