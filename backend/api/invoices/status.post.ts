// server/api/invoices/status.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { updateInvoiceStatus, InvoiceStatus } from '../../utils/invoiceStore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const id = body?.id
  const status = body?.status as InvoiceStatus

  if (!id || !status) {
    throw createError({ statusCode: 400, statusMessage: 'Invoice ID and status are required.' })
  }

  const validStatuses: InvoiceStatus[] = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']
  if (!validStatuses.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid status "${status}". Must be one of DRAFT, SENT, PAID, OVERDUE, CANCELLED.` })
  }

  const updated = updateInvoiceStatus(id, status)
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found.' })
  }

  return {
    success: true,
    message: `Invoice ${updated.invoiceNumber} status updated to ${updated.status}.`,
    invoice: updated,
  }
})
