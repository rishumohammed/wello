// server/api/invoices/status.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { updateInvoiceStatus, getInvoiceById } from '../../utils/invoiceStore'

const statusSchema = z.object({
  id: z.string().min(1, 'Invoice ID is required.'),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'], {
    errorMap: () => ({ message: 'Status must be one of DRAFT, SENT, PAID, OVERDUE, CANCELLED.' }),
  }),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const parseResult = statusSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors[0]?.message || 'Invoice ID and status are required.',
    })
  }

  const { id, status } = parseResult.data

  const existing = getInvoiceById(id)
  if (!existing || (existing.userId !== String(user.id) && user.role !== 'admin')) {
    throw createError({ statusCode: 404, statusMessage: 'Invoice not found.' })
  }

  const updated = updateInvoiceStatus(id, status)

  return {
    success: true,
    message: `Invoice ${updated?.invoiceNumber || id} status updated to ${status}.`,
    invoice: updated,
  }
})
