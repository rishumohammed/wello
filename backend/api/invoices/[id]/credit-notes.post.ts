// backend/api/invoices/[id]/credit-notes.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import crypto from 'node:crypto'
import { requireAddon } from '../../../utils/addonService'
import { getDb } from '../../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'
import { getNextCreditNoteNumber } from '../../../utils/invoiceSequenceService'

const creditNoteSchema = z.object({
  amount: z.number().positive().optional(),
  reason: z.string().min(1, 'Reason for credit note is required.'),
  notes: z.string().nullable().optional(),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().optional().default(1),
    unitPrice: z.number().optional(),
    rate: z.number().optional(),
    amount: z.number().optional(),
  })).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const idStr = event.context.params?.id
  if (!idStr) {
    return sendError(event, 400, 'MISSING_ID', 'Invoice ID is required.')
  }

  const body = await readBody(event)
  const parsed = creditNoteSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  let resultCreditNote: any = null

  await db.transaction(async (trx) => {
    const invoice = await trx('invoices')
      .where({ id: Number(idStr), user_id: user.id })
      .whereNull('deleted_at')
      .forUpdate()
      .first()

    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND')
    }

    const currentBalance = Number(invoice.balance_due !== null ? invoice.balance_due : invoice.total)
    let creditAmount = data.amount !== undefined ? Number(data.amount) : undefined
    if (creditAmount === undefined && data.items && data.items.length > 0) {
      creditAmount = data.items.reduce((s, it) => {
        const qty = Number(it.quantity || 1)
        const pr = Number(it.unitPrice !== undefined ? it.unitPrice : (it.rate !== undefined ? it.rate : 0))
        const amt = it.amount !== undefined ? Number(it.amount) : qty * pr
        return s + amt
      }, 0)
    }
    if (creditAmount === undefined) {
      creditAmount = currentBalance
    }

    if (creditAmount > currentBalance) {
      throw new Error('CREDIT_AMOUNT_EXCEEDS_BALANCE')
    }

    const seq = await getNextCreditNoteNumber(user.id, trx)
    const publicToken = crypto.randomBytes(32).toString('hex')

    const [creditNoteId] = await trx('credit_notes').insert({
      user_id: user.id,
      invoice_id: invoice.id,
      credit_note_number: seq.creditNoteNumber,
      credit_note_date: new Date(),
      currency: invoice.currency,
      subtotal: creditAmount,
      tax_amount: 0.0000,
      total: creditAmount,
      reason: data.reason,
      notes: data.notes || null,
      public_token: publicToken,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const rawItems = data.items && data.items.length > 0 ? data.items : [
      { description: `Credit Adjustment: ${data.reason}`, quantity: 1, unitPrice: creditAmount, amount: creditAmount }
    ]

    await trx('credit_note_items').insert(
      rawItems.map((it) => ({
        credit_note_id: creditNoteId,
        description: it.description,
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unitPrice || creditAmount),
        amount: Number(it.amount || creditAmount),
        created_at: new Date(),
      }))
    )

    // Adjust invoice balance due
    const newBalanceDue = Math.max(0, Math.round((currentBalance - creditAmount) * 10000) / 10000)
    let newStatus = invoice.status
    if (newBalanceDue === 0 && Number(invoice.amount_paid || 0) === 0) {
      newStatus = 'void'
    }

    await trx('invoices')
      .where({ id: invoice.id })
      .update({
        balance_due: newBalanceDue,
        status: newStatus,
        updated_at: new Date(),
      })

    resultCreditNote = await trx('credit_notes').where({ id: creditNoteId }).first()
  }).catch((err) => {
    if (err.message === 'INVOICE_NOT_FOUND') {
      return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
    }
    if (err.message === 'CREDIT_AMOUNT_EXCEEDS_BALANCE') {
      return sendError(event, 400, 'CREDIT_EXCEEDS_BALANCE', 'Credit note amount cannot exceed the invoice balance due.')
    }
    throw err
  })

  if (resultCreditNote) {
    const db = getDb()
    const updatedInvoice = await db('invoices').where({ id: Number(idStr) }).first()

    return sendSuccess(
      event,
      {
        message: `Credit note ${resultCreditNote.credit_note_number} created successfully.`,
        creditNote: {
          id: resultCreditNote.id,
          creditNoteNumber: resultCreditNote.credit_note_number,
          total: Number(resultCreditNote.total),
          reason: resultCreditNote.reason,
          publicToken: resultCreditNote.public_token,
        },
        invoice: {
          id: updatedInvoice?.id,
          invoiceNumber: updatedInvoice?.invoice_number,
          total: Number(updatedInvoice?.total),
          amountPaid: Number(updatedInvoice?.amount_paid || 0),
          balanceDue: Number(updatedInvoice?.balance_due),
          status: updatedInvoice?.status,
        },
      },
      undefined,
      201
    )
  }
})
