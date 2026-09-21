// backend/api/invoices/status.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireAddon } from '../../utils/addonService'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const statusSchema = z.object({
  id: z.union([z.string(), z.number()]),
  status: z.enum([
    'draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void',
    'DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'
  ]),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const body = await readBody(event)
  const parseResult = statusSchema.safeParse(body)
  if (!parseResult.success) {
    const formatted = formatZodError(parseResult.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { id, status } = parseResult.data
  const statusLower = status.toLowerCase()

  if (statusLower === 'overdue') {
    return sendError(
      event,
      400,
      'INVALID_STATUS_TRANSITION',
      'OVERDUE status cannot be set manually. It is automatically derived from the invoice due date and payments schedule.'
    )
  }

  const db = getDb()

  const invoice = await db('invoices')
    .where({ id: Number(id), user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!invoice) {
    return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
  }

  const updates: any = {
    status: statusLower,
    updated_at: new Date(),
  }

  if (statusLower === 'sent' && !invoice.sent_at) {
    updates.sent_at = new Date()
    updates.is_immutable = true
  }

  if (statusLower === 'paid') {
    updates.paid_at = invoice.paid_at || new Date()
    updates.amount_paid = invoice.total
    updates.balance_due = 0.0000
    updates.is_immutable = true
  }

  await db('invoices').where({ id: invoice.id }).update(updates)
  const updated = await db('invoices').where({ id: invoice.id }).first()

  return sendSuccess(event, {
    message: `Invoice ${updated.invoice_number} status updated to ${statusLower}.`,
    invoice: {
      id: updated.id,
      invoiceNumber: updated.invoice_number,
      status: updated.status,
      amountPaid: Number(updated.amount_paid),
      balanceDue: Number(updated.balance_due),
    },
  })
})
