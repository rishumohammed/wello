// backend/api/expected-payments/index.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()

  const now = new Date()
  const currentMonthStr = now.toISOString().slice(0, 7) // e.g. "2026-09"
  const periodStart = `${currentMonthStr}-01`

  // 1. Fetch recurring income sources
  const incomeSources = await db('income_sources')
    .where({ user_id: user.id, is_active: true })
    .whereNull('deleted_at')
    .whereNotNull('expected_amount')
    .where('expected_amount', '>', 0)

  const items: any[] = []

  for (const src of incomeSources) {
    // Check if there is an existing recorded payment for this source in the current period
    const existingPayment = await db('payments')
      .where({ user_id: user.id, income_source_id: src.id })
      .whereNull('deleted_at')
      .where('paid_date', 'like', `${currentMonthStr}%`)
      .first()

    const isConfirmed = Boolean(existingPayment && existingPayment.status !== 'expected' && !existingPayment.is_expected)

    items.push({
      incomeSourceId: src.id,
      sourceName: src.name,
      sourceType: src.type,
      payFrequency: src.pay_frequency || src.frequency || 'monthly',
      amount: existingPayment ? Number(existingPayment.amount) : Number(src.expected_amount),
      currency: (existingPayment?.currency || src.currency || (user as any).base_currency || 'USD').toUpperCase(),
      expectedPeriodStart: periodStart,
      expectedHours: src.expected_hours_per_period !== null ? Number(src.expected_hours_per_period) : null,
      isConfirmed,
      paymentId: existingPayment ? existingPayment.id : null,
      notes: existingPayment?.notes || `Recurring ${src.type} payment for ${src.name}`,
    })
  }

  // 2. Also check explicit expected payments without recurring source
  const explicitExpected = await db('payments')
    .leftJoin('income_sources', 'payments.income_source_id', 'income_sources.id')
    .where('payments.user_id', user.id)
    .whereNull('payments.deleted_at')
    .where((builder) => {
      builder.where('payments.is_expected', true).orWhere('payments.status', 'expected')
    })
    .select('payments.*', 'income_sources.name as income_source_name', 'income_sources.type as income_source_type')

  for (const p of explicitExpected) {
    if (!items.some(it => it.incomeSourceId === p.income_source_id && !it.isConfirmed)) {
      items.push({
        incomeSourceId: p.income_source_id || null,
        sourceName: p.income_source_name || 'Expected Payment',
        sourceType: p.income_source_type || 'project',
        payFrequency: 'one_off',
        amount: Number(p.amount),
        currency: p.currency,
        expectedPeriodStart: p.paid_date,
        expectedHours: null,
        isConfirmed: false,
        paymentId: p.id,
        notes: p.notes,
      })
    }
  }

  return sendSuccess(event, items)
})
