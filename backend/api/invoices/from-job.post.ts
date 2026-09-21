// backend/api/invoices/from-job.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import crypto from 'crypto'
import { requireAddon } from '../../utils/addonService'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getNextInvoiceNumber } from '../../utils/invoiceSequenceService'

const fromJobSchema = z.object({
  jobId: z.union([z.string(), z.number()]).optional(),
  projectId: z.number().optional(),
  jobName: z.string().min(1, 'Job name is required.'),
  jobDescription: z.string().optional(),
  clientName: z.string().optional(),
  clientContact: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  quoteAmount: z.number().optional(),
  hoursWorked: z.number().optional(),
  rate: z.number().optional(),
  currency: z.string().length(3).optional().default('USD'),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const body = await readBody(event)
  const parseResult = fromJobSchema.safeParse(body)
  if (!parseResult.success) {
    const formatted = formatZodError(parseResult.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parseResult.data
  const db = getDb()

  const currency = (data.currency || 'USD').toUpperCase().slice(0, 3)
  const rate = data.rate || 100
  const hours = data.hoursWorked || 1
  const subtotal = data.quoteAmount !== undefined && data.quoteAmount > 0 ? data.quoteAmount : (hours * rate)
  const total = subtotal

  const publicToken = crypto.randomBytes(32).toString('hex')
  const defaultDueDate = new Date(Date.now() + 14 * 86400000)
  const defaultInvDate = new Date()

  let createdInvoice: any = null

  await db.transaction(async (trx) => {
    const seq = await getNextInvoiceNumber(user.id, undefined, trx)

    const [newId] = await trx('invoices').insert({
      user_id: user.id,
      project_id: data.projectId || (typeof data.jobId === 'number' ? data.jobId : null),
      invoice_number: seq.invoiceNumber,
      invoice_date: defaultInvDate,
      due_date: defaultDueDate,
      payment_terms: 'net_14',
      customer_name: data.clientName || 'Valued Client',
      customer_email: data.customerEmail || null,
      customer_contact: data.clientContact || null,
      service_description: `Invoice for ${data.jobName}`,
      currency,
      base_currency: (user.base_currency || 'USD').toUpperCase().slice(0, 3),
      fx_rate: 1.0,
      seller_name: user.business_name || user.name,
      seller_email: user.business_email || user.email,
      seller_address: user.business_address,
      sellerTaxId: user.tax_id,
      subtotal,
      discount: 0,
      tax_percent: 0,
      tax_amount: 0,
      total,
      base_total: total,
      amount_paid: 0,
      balance_due: total,
      notes: `Generated from completed Wello project: ${data.jobName}. Thank you for your business!`,
      status: 'draft',
      public_token: publicToken,
      pdf_template: 'modern_clean',
      created_at: new Date(),
      updated_at: new Date(),
    })

    await trx('invoice_items').insert({
      invoice_id: newId,
      description: `${data.jobName} - Completed Services`,
      quantity: hours,
      unit_price: data.quoteAmount ? Math.round((data.quoteAmount / (hours || 1)) * 10000) / 10000 : rate,
      amount: subtotal,
      display_order: 1,
      created_at: new Date(),
    })

    createdInvoice = await trx('invoices').where({ id: newId }).first()
  })

  return sendSuccess(
    event,
    {
      message: `Invoice ${createdInvoice.invoice_number} created from job "${data.jobName}".`,
      invoice: {
        id: createdInvoice.id,
        invoiceNumber: createdInvoice.invoice_number,
        total: Number(createdInvoice.total),
        balanceDue: Number(createdInvoice.balance_due),
        status: createdInvoice.status,
      },
    },
    undefined,
    201
  )
})
