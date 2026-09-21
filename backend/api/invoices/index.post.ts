// server/api/invoices/index.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { createInvoice, updateInvoice, getInvoiceById } from '../../utils/invoiceStore'

const invoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'Item description is required.'),
  quantity: z.number().min(0, 'Quantity must be non-negative.').optional(),
  hours: z.number().min(0, 'Hours must be non-negative.').optional(),
  rate: z.number().min(0, 'Rate must be non-negative.').optional(),
  amount: z.number().optional(),
})

const invoicePostSchema = z.object({
  id: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email('Invalid customer email.').optional().or(z.literal('')),
  customerContact: z.string().optional(),
  customerAddress: z.string().optional(),
  serviceDescription: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(invoiceItemSchema).optional(),
  notes: z.string().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  currencyCode: z.string().length(3).optional().default('USD'),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const parseResult = invoicePostSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors[0]?.message || 'Invalid invoice data.',
    })
  }

  const data = parseResult.data

  if (data.id) {
    // Check ownership before update
    const existing = getInvoiceById(data.id)
    if (!existing || (existing.userId !== String(user.id) && user.role !== 'admin')) {
      throw createError({ statusCode: 404, statusMessage: 'Invoice not found.' })
    }

    const updated = updateInvoice(data.id, data)
    return {
      success: true,
      message: `Invoice ${updated?.invoiceNumber || data.id} updated successfully.`,
      invoice: updated,
    }
  }

  // Create new invoice
  if (!data.customerName || data.customerName.trim() === '') {
    throw createError({ statusCode: 400, statusMessage: 'Customer name is required.' })
  }

  const created = createInvoice({
    ...data,
    customerName: data.customerName,
    userId: String(user.id),
  })

  return {
    success: true,
    message: `Invoice ${created.invoiceNumber} created successfully.`,
    invoice: created,
  }
})
