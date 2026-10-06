// backend/api/invoices/[id].patch.ts
import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAddon } from '../../utils/addonService'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { roundToCurrencyDecimals } from '../../utils/currencyUtils'
import { convertToBase } from '../../utils/fxService'
import { recordAuditLog } from '../../utils/auditStore'

const updateDraftInvoiceSchema = z.object({
  clientId: z.number().int().positive().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  currency: z.string().length(3).optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(
    z.object({
      description: z.string().min(1, 'Item description is required.'),
      quantity: z.number().positive(),
      unitPrice: z.number().min(0),
      taxRateId: z.number().nullable().optional(),
    })
  ).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const invoiceId = getRouterParam(event, 'id')
  const db = getDb()

  const invoice = await db('invoices')
    .where({ id: invoiceId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!invoice) {
    return sendError(event, 404, 'INVOICE_NOT_FOUND', `Invoice #${invoiceId} not found.`)
  }

  // Strictly enforce that only DRAFT invoices can be edited
  if (invoice.status !== 'draft') {
    return sendError(
      event,
      400,
      'CANNOT_EDIT_ISSUED_INVOICE',
      `Invoice #${invoice.invoice_number} is already in '${invoice.status}' status. Issued invoices are immutable and must be modified using credit notes.`
    )
  }

  const body = await readBody(event).catch(() => ({}))
  const parsed = updateDraftInvoiceSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const currency = (data.currency || invoice.currency || user.base_currency || 'USD').toUpperCase().trim()

  await db.transaction(async (trx) => {
    let subtotal = Number(invoice.subtotal) || 0
    let totalTax = Number(invoice.tax_amount) || 0
    let grandTotal = Number(invoice.total) || 0

    // If new line items are provided, replace them and recompute subtotal & taxes
    if (data.items && Array.isArray(data.items)) {
      await trx('invoice_items').where({ invoice_id: invoice.id }).delete()

      subtotal = 0
      let order = 1
      for (const item of data.items) {
        const itemTotal = roundToCurrencyDecimals(item.quantity * item.unitPrice, currency)
        subtotal += itemTotal

        await trx('invoice_items').insert({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          amount: itemTotal,
          display_order: order++,
          created_at: new Date(),
        })
      }

      subtotal = roundToCurrencyDecimals(subtotal, currency)
      grandTotal = roundToCurrencyDecimals(subtotal + totalTax, currency)
    }

    // Convert to base currency
    const baseConversion = await convertToBase(grandTotal, currency, user.base_currency || 'USD')

    const updates: Record<string, any> = {
      currency,
      subtotal,
      tax_amount: totalTax,
      total: grandTotal,
      base_total: baseConversion.convertedAmount,
      balance_due: grandTotal,
      updated_at: new Date(),
    }

    if (data.clientId !== undefined) updates.client_id = data.clientId
    if (data.projectId !== undefined) updates.project_id = data.projectId
    if (data.dueDate !== undefined) updates.due_date = data.dueDate ? new Date(data.dueDate) : null
    if (data.notes !== undefined) updates.notes = data.notes

    await trx('invoices').where({ id: invoice.id }).update(updates)

    await recordAuditLog({
      action: 'invoice_draft_updated',
      actorType: 'user',
      actorId: user.id,
      targetType: 'invoice',
      targetId: String(invoice.id),
      details: { invoiceNumber: invoice.invoice_number, currency, total: grandTotal },
    }).catch(() => {})
  })

  const updatedInvoice = await db('invoices').where({ id: invoice.id }).first()
  const updatedItems = await db('invoice_items').where({ invoice_id: invoice.id })

  return sendSuccess(event, {
    invoice: {
      ...updatedInvoice,
      items: updatedItems,
    },
    message: 'Draft invoice successfully updated.',
  })
})
