// server/api/invoices/index.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { createInvoice, updateInvoice } from '../../utils/invoiceStore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = body?.userId || 'u1'

  if (body?.id) {
    // Update existing invoice
    const updated = updateInvoice(body.id, body)
    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Invoice not found.' })
    }
    return {
      success: true,
      message: `Invoice ${updated.invoiceNumber} updated successfully.`,
      invoice: updated,
    }
  }

  // Create new invoice
  if (!body?.customerName) {
    throw createError({ statusCode: 400, statusMessage: 'Customer name is required.' })
  }

  const created = createInvoice({
    ...body,
    userId,
  })

  return {
    success: true,
    message: `Invoice ${created.invoiceNumber} created successfully.`,
    invoice: created,
  }
})
