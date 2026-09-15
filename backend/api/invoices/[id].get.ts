// server/api/invoices/[id].get.ts
import { defineEventHandler, createError } from 'h3'
import { getInvoiceById } from '../../utils/invoiceStore'

export default defineEventHandler(async (event) => {
  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Invoice ID is required.' })
  }

  const invoice = getInvoiceById(id)
  if (!invoice) {
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found.' })
  }

  return {
    success: true,
    invoice,
  }
})
