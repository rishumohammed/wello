// backend/api/expected-payments/confirm.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'

const confirmPaymentSchema = z.object({
  paymentId: z.number().int().positive().nullable().optional(),
  incomeSourceId: z.number().int().positive().nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  amount: z.number().positive('Confirmed amount must be greater than zero').max(999999999),
  currency: z.string().length(3).toUpperCase().optional(),
  paymentDate: z.string().optional(),
  paidDate: z.string().optional(),
  expectedPeriodStart: z.string().optional(),
  notes: z.string().max(1000).nullable().optional(),
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
  const parsed = confirmPaymentSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()
  const finalPaidDate = data.paymentDate || data.paidDate || now.toISOString().slice(0, 10)

  let confirmedPaymentId: number

  if (data.paymentId) {
    const existing = await db('payments')
      .where({ id: data.paymentId, user_id: user.id })
      .first()

    if (!existing) {
      return sendError(event, 404, 'NOT_FOUND', 'Payment not found')
    }

    await db('payments').where({ id: data.paymentId }).update({
      amount: data.amount,
      base_amount: data.amount,
      currency: data.currency || existing.currency,
      paid_date: finalPaidDate,
      is_expected: false,
      status: 'received',
      notes: data.notes !== undefined ? data.notes : existing.notes,
      updated_at: now,
    })

    confirmedPaymentId = data.paymentId
  } else {
    // Create new confirmed payment from recurring proposal
    if (!data.incomeSourceId && !data.projectId) {
      return sendError(event, 400, 'BAD_REQUEST', 'Either paymentId, incomeSourceId, or projectId is required')
    }

    let currency = data.currency
    if (!currency && data.incomeSourceId) {
      const src = await db('income_sources')
        .where({ id: data.incomeSourceId, user_id: user.id })
        .whereNull('deleted_at')
        .first()
      currency = src?.currency
    }

    const userBaseCurrency = (user as any).base_currency || (user as any).baseCurrency || 'USD'
    currency = (currency || userBaseCurrency).toUpperCase()

    const [newId] = await db('payments').insert({
      user_id: user.id,
      income_source_id: data.incomeSourceId || null,
      project_id: data.projectId || null,
      client_id: null,
      amount: data.amount,
      base_amount: data.amount,
      currency,
      paid_date: finalPaidDate,
      is_expected: false,
      status: 'received',
      notes: data.notes || 'Confirmed recurring payment',
      created_at: now,
      updated_at: now,
    })

    confirmedPaymentId = newId
  }

  const payment = await db('payments')
    .leftJoin('income_sources', 'payments.income_source_id', 'income_sources.id')
    .leftJoin('projects', 'payments.project_id', 'projects.id')
    .where('payments.id', confirmedPaymentId)
    .select(
      'payments.*',
      'income_sources.name as income_source_name',
      'projects.name as project_name'
    )
    .first()

  const result = {
    message: 'Expected payment confirmed and recorded successfully',
    payment: {
      id: payment.id,
      incomeSourceId: payment.income_source_id,
      incomeSourceName: payment.income_source_name || null,
      projectId: payment.project_id,
      projectName: payment.project_name || null,
      amount: Number(payment.amount),
      currency: payment.currency,
      paidDate: payment.paid_date,
      isExpected: Boolean(payment.is_expected),
      status: payment.status,
      notes: payment.notes,
      createdAt: payment.created_at,
      updatedAt: payment.updated_at,
    },
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, result)
  }

  return sendSuccess(event, result, undefined, 201)
})
