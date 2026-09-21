// server/api/invoices/[id].delete.ts
import { defineEventHandler, createError } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { deleteInvoice, getInvoiceById } from '../../utils/invoiceStore'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = event.context.params?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Invoice ID is required.' })
  }

  const existing = getInvoiceById(id)
  if (!existing || (existing.userId !== String(user.id) && user.role !== 'admin')) {
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found.' })
  }

  deleteInvoice(id)

  return {
    success: true,
    message: `Invoice ${existing.invoiceNumber} deleted successfully.`,
  }
})
