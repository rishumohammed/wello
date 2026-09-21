// backend/api/invoices/[id]/send.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireAddon } from '../../../utils/addonService'
import { getDb } from '../../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'
import { renderEmailTemplate, dispatchEmailWithLog } from '../../../utils/emailEngine'
import { formatPdfCurrency } from '../../../utils/pdfGenerator'

const sendInvoiceSchema = z.object({
  recipientEmail: z.string().email().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const idStr = event.context.params?.id
  if (!idStr) {
    return sendError(event, 400, 'MISSING_ID', 'Invoice ID is required.')
  }

  const body = await readBody(event).catch(() => ({}))
  const parsed = sendInvoiceSchema.safeParse(body || {})
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const db = getDb()
  const invoice = await db('invoices')
    .where({ id: Number(idStr), user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!invoice) {
    return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
  }

  const recipient = parsed.data.recipientEmail || invoice.customer_email
  if (!recipient) {
    return sendError(event, 400, 'MISSING_RECIPIENT', 'Recipient email address is required to send invoice.')
  }

  const totalFormatted = formatPdfCurrency(Number(invoice.total), invoice.currency)
  const viewLink = `${process.env.APP_URL || 'http://localhost:3000'}/invoice/${invoice.public_token}`

  // Render email
  const rendered = renderEmailTemplate('invoice_dispatch', {
    customer_name: invoice.customer_name || 'Valued Client',
    seller_name: invoice.seller_name || user.business_name || user.name,
    invoice_number: invoice.invoice_number,
    total_amount: totalFormatted,
    due_date: new Date(invoice.due_date).toISOString().slice(0, 10),
    view_link: viewLink,
  })

  // Dispatch via Resend (with dev fallback)
  await dispatchEmailWithLog({
    to: recipient,
    subject: parsed.data.subject || rendered.subject,
    html: rendered.html,
    templateKey: 'invoice_dispatch',
  })

  // Update invoice status to 'sent' if currently 'draft'
  const nextStatus = invoice.status === 'draft' ? 'sent' : invoice.status
  await db('invoices')
    .where({ id: invoice.id })
    .update({
      customer_email: recipient,
      status: nextStatus,
      sent_at: invoice.sent_at || new Date(),
      is_immutable: true,
      updated_at: new Date(),
    })

  return sendSuccess(event, {
    message: `Invoice ${invoice.invoice_number} sent successfully to ${recipient}.`,
    invoiceNumber: invoice.invoice_number,
    recipient,
    publicUrl: viewLink,
    status: nextStatus,
  })
})
