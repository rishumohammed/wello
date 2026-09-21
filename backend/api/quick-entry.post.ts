// backend/api/quick-entry.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../utils/authGuard'
import { getDb } from '../utils/db'
import { sendSuccess, sendError, formatZodError } from '../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../utils/idempotency'

const quickEntrySchema = z.object({
  incomeSourceId: z.number().int().positive('Income source ID is required'),
  hours: z.number().positive('Hours must be greater than zero').max(24),
  amount: z.number().min(0).max(999999999).nullable().optional(),
  earnedAmount: z.number().min(0).max(999999999).nullable().optional(),
  isExpected: z.boolean().optional(),
  isPaid: z.boolean().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  date: z.string().optional(),
  notes: z.string().max(1000).nullable().optional(),
  title: z.string().max(255).optional(),
  type: z.string().max(50).optional().default('production'),
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
  const parsed = quickEntrySchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  const incomeSource = await db('income_sources')
    .where({ id: data.incomeSourceId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!incomeSource) {
    return sendError(event, 400, 'INVALID_INCOME_SOURCE', 'Specified income source does not exist or does not belong to you')
  }

  const dateStr = data.date || new Date().toISOString().slice(0, 10)
  const durationMinutes = Math.round(data.hours * 60)
  const durationSeconds = durationMinutes * 60

  // Derive sensible started_at and ended_at in UTC
  const sessionStart = new Date(`${dateStr}T09:00:00.000Z`)
  const sessionEnd = new Date(sessionStart.getTime() + durationSeconds * 1000)
  const now = new Date()

  const title = data.title || `${incomeSource.name} - Quick Entry`
  const finalAmount = data.amount ?? data.earnedAmount ?? null
  const isExpected = data.isExpected ?? (data.isPaid !== undefined ? !data.isPaid : false)

  let createdSession: any = null
  let createdPayment: any = null

  await db.transaction(async (trx) => {
    const [sessionId] = await trx('work_sessions').insert({
      user_id: user.id,
      project_id: null,
      income_source_id: incomeSource.id,
      title,
      type: data.type || 'production',
      payment_type: 'paid',
      unpaid_reason: null,
      unpaid_category: null,
      notes: data.notes ? data.notes.trim() : null,
      started_at: sessionStart,
      ended_at: sessionEnd,
      duration_seconds: durationSeconds,
      paused_seconds: 0,
      created_at: now,
      updated_at: now,
    })

    createdSession = await trx('work_sessions').where({ id: sessionId }).first()

    const hasAmount = finalAmount !== null && finalAmount !== undefined && finalAmount > 0
    if (hasAmount) {
      const userBaseCurrency = (user as any).base_currency || (user as any).baseCurrency || 'USD'
      const currency = data.currency || incomeSource.currency || userBaseCurrency

      const [paymentId] = await trx('payments').insert({
        user_id: user.id,
        project_id: null,
        income_source_id: incomeSource.id,
        client_id: null,
        amount: finalAmount,
        currency,
        base_amount: finalAmount,
        paid_date: dateStr,
        is_expected: isExpected,
        status: isExpected ? 'expected' : 'received',
        notes: data.notes ? data.notes.trim() : null,
        created_at: now,
        updated_at: now,
      })

      createdPayment = await trx('payments').where({ id: paymentId }).first()
    }
  })

  const result = {
    session: {
      id: createdSession.id,
      projectId: createdSession.project_id || null,
      incomeSourceId: createdSession.income_source_id,
      incomeSourceName: incomeSource.name,
      title: createdSession.title,
      type: createdSession.type,
      startedAt: createdSession.started_at,
      endedAt: createdSession.ended_at,
      durationMin: Math.round(createdSession.duration_seconds / 60),
      durationMinutes: Math.round(createdSession.duration_seconds / 60),
      durationSeconds: createdSession.duration_seconds,
      paymentType: createdSession.payment_type,
    },
    payment: createdPayment ? {
      id: createdPayment.id,
      projectId: createdPayment.project_id || null,
      incomeSourceId: createdPayment.income_source_id,
      amount: Number(createdPayment.amount),
      currency: createdPayment.currency,
      paidDate: createdPayment.paid_date,
      isExpected: Boolean(createdPayment.is_expected),
      status: createdPayment.status,
    } : null,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, result)
  }

  return sendSuccess(event, result, undefined, 201)
})
