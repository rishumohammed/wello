// backend/api/invoices/[id]/payments.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireAddon } from '../../../utils/addonService'
import { getDb } from '../../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'

const recordPaymentSchema = z.object({
  amount: z.number().positive('Payment amount must be greater than zero.'),
  paymentDate: z.string().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const idStr = event.context.params?.id
  if (!idStr) {
    return sendError(event, 400, 'MISSING_ID', 'Invoice ID is required.')
  }

  const body = await readBody(event)
  const parsed = recordPaymentSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  let resultPayload: any = null

  await db.transaction(async (trx) => {
    const invoice = await trx('invoices')
      .where({ id: Number(idStr), user_id: user.id })
      .whereNull('deleted_at')
      .forUpdate()
      .first()

    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND')
    }

    if (invoice.status === 'cancelled' || invoice.status === 'void') {
      throw new Error('INVOICE_CANCELLED')
    }

    const payAmount = Number(data.amount)
    const currentPaid = Number(invoice.amount_paid || 0)
    const currentBalance = Number(invoice.balance_due !== null ? invoice.balance_due : invoice.total)
    const newTotalPaid = Math.round((currentPaid + payAmount) * 10000) / 10000
    const newBalanceDue = Math.max(0, Math.round((currentBalance - payAmount) * 10000) / 10000)

    const payCurrency = (data.currency || invoice.currency || 'USD').toUpperCase().slice(0, 3)
    const payDate = data.paymentDate ? new Date(data.paymentDate) : new Date()

    // 1. Insert into payments ledger
    const [paymentId] = await trx('payments').insert({
      user_id: user.id,
      project_id: invoice.project_id || null,
      client_id: invoice.client_id || null,
      invoice_id: invoice.id,
      amount: payAmount,
      currency: payCurrency,
      paid_date: payDate,
      is_expected: false,
      status: 'paid',
      notes: data.notes || `Payment recorded for Invoice ${invoice.invoice_number}`,
      created_at: new Date(),
      updated_at: new Date(),
    })

    // 2. Determine new status
    let nextStatus = invoice.status
    let paidAt = invoice.paid_at

    if (newBalanceDue === 0) {
      nextStatus = 'paid'
      paidAt = new Date()
    } else if (newTotalPaid > 0) {
      nextStatus = 'partially_paid'
    }

    // 3. Update invoice
    await trx('invoices')
      .where({ id: invoice.id })
      .update({
        amount_paid: newTotalPaid,
        balance_due: newBalanceDue,
        status: nextStatus,
        paid_at: paidAt,
        is_immutable: true,
        updated_at: new Date(),
      })

    const updatedInvoice = await trx('invoices').where({ id: invoice.id }).first()
    const paymentRecord = await trx('payments').where({ id: paymentId }).first()

    resultPayload = {
      message: `Payment of ${payAmount} ${payCurrency} recorded successfully.`,
      payment: {
        id: paymentRecord.id,
        amount: Number(paymentRecord.amount),
        currency: paymentRecord.currency,
        paidDate: paymentRecord.paid_date,
      },
      invoice: {
        id: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoice_number,
        total: Number(updatedInvoice.total),
        amountPaid: Number(updatedInvoice.amount_paid),
        balanceDue: Number(updatedInvoice.balance_due),
        status: updatedInvoice.status,
      },
    }
  }).catch((err) => {
    if (err.message === 'INVOICE_NOT_FOUND') {
      return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
    }
    if (err.message === 'INVOICE_CANCELLED') {
      return sendError(event, 400, 'INVOICE_CANCELLED', 'Cannot record payment on a cancelled or void invoice.')
    }
    throw err
  })

  if (resultPayload) {
    return sendSuccess(event, resultPayload, undefined, 201)
  }
})
