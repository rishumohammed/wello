// backend/api/invoices/recurring/index.get.ts
import { defineEventHandler } from 'h3'
import { requireAddon } from '../../../utils/addonGuard'
import { getDb } from '../../../utils/db'
import { sendSuccess } from '../../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'recurring-retainers')
  const db = getDb()

  const profiles = await db('recurring_invoice_profiles')
    .where({ user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('next_issue_date', 'asc')

  return sendSuccess(event, {
    profiles: profiles.map((p) => ({
      id: p.id,
      title: p.title,
      frequency: p.frequency,
      intervalDays: p.interval_days,
      nextIssueDate: p.next_issue_date,
      paymentTerms: p.payment_terms,
      currency: p.currency,
      subtotal: Number(p.subtotal),
      taxAmount: Number(p.tax_amount),
      total: Number(p.total),
      autoSend: Boolean(p.auto_send),
      isActive: Boolean(p.is_active),
      templateData: typeof p.template_data === 'string' ? JSON.parse(p.template_data) : p.template_data,
      createdAt: p.created_at,
    })),
  })
})
