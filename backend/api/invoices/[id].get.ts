// server/api/invoices/[id].get.ts
import { defineEventHandler, createError } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getInvoiceById } from '../../utils/invoiceStore'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Invoice ID is required.' })
  }

  const invoice = getInvoiceById(id)
  if (!invoice || (invoice.userId !== String(user.id) && user.role !== 'admin')) {
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found.' })
  }

  return {
    success: true,
    invoice,
  }
})
