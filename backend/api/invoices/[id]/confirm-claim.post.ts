// backend/api/invoices/[id]/confirm-claim.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireAddon } from '../../../utils/addonService'
import { getDb } from '../../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'

const confirmClaimSchema = z.object({
  claimId: z.number().or(z.string()),
  action: z.enum(['confirm', 'reject']),
  paymentDate: z.string().optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const id = event.context.params?.id
  if (!id) {
    return sendError(event, 400, 'MISSING_ID', 'Invoice ID is required.')
  }

  const body = await readBody(event)
  const parsed = confirmClaimSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { claimId, action, paymentDate, notes } = parsed.data
  const db = getDb()
  const now = new Date()

  let resultPayload: any = null

  await db.transaction(async (trx) => {
    const invoice = await trx('invoices')
      .where({ id, user_id: user.id })
      .whereNull('deleted_at')
      .forUpdate()
      .first()

    if (!invoice) {
      throw new Error('INVOICE_NOT_FOUND')
    }

    const claim = await trx('payment_claims')
      .where({ id: Number(claimId), invoice_id: invoice.id, status: 'PENDING' })
      .forUpdate()
      .first()

    if (!claim) {
      throw new Error('CLAIM_NOT_FOUND')
    }

    if (action === 'reject') {
      await trx('payment_claims')
        .where({ id: claim.id })
        .update({
          status: 'REJECTED',
          rejected_at: now,
          updated_at: now,
        })

      resultPayload = {
        message: 'Payment claim rejected.',
        claimId: claim.id,
        status: 'rejected',
      }
      return
    }

    // Confirm action: apply payment
    const claimAmount = Number(claim.amount)
    const currentPaid = Number(invoice.amount_paid || 0)
    const currentBalance = Number(invoice.balance_due !== null ? invoice.balance_due : invoice.total)
    const newTotalPaid = Math.round((currentPaid + claimAmount) * 10000) / 10000
    const newBalanceDue = Math.max(0, Math.round((currentBalance - claimAmount) * 10000) / 10000)

    const payCurrency = (invoice.currency || 'USD').toUpperCase().slice(0, 3)
    const payDate = paymentDate ? new Date(paymentDate) : now

    const [paymentId] = await trx('payments').insert({
      user_id: user.id,
      project_id: invoice.project_id || null,
      client_id: invoice.client_id || null,
      invoice_id: invoice.id,
      amount: claimAmount,
      currency: payCurrency,
      paid_date: payDate,
      is_expected: false,
      status: 'paid',
      notes: notes || `Claimed payment verified (${claim.payment_method || 'direct'}). Ref: ${claim.transaction_ref || 'N/A'}`,
      created_at: now,
      updated_at: now,
    })

    let nextStatus = invoice.status
    let paidAt = invoice.paid_at

    if (newBalanceDue === 0) {
      nextStatus = 'paid'
      paidAt = now
    } else if (newTotalPaid > 0) {
      nextStatus = 'partially_paid'
    }

    await trx('invoices')
      .where({ id: invoice.id })
      .update({
        amount_paid: newTotalPaid,
        balance_due: newBalanceDue,
        status: nextStatus,
        paid_at: paidAt,
        is_immutable: true,
        updated_at: now,
      })

    await trx('payment_claims')
      .where({ id: claim.id })
      .update({
        status: 'CONFIRMED',
        confirmed_at: now,
        updated_at: now,
      })

    resultPayload = {
      message: `Payment claim of ${claimAmount} ${payCurrency} confirmed and applied.`,
      claimId: claim.id,
      paymentId,
      status: 'confirmed',
      invoice: {
        id: invoice.id,
        status: nextStatus,
        amountPaid: newTotalPaid,
        balanceDue: newBalanceDue,
      },
    }
  }).catch((err) => {
    if (err.message === 'INVOICE_NOT_FOUND') {
      return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
    }
    if (err.message === 'CLAIM_NOT_FOUND') {
      return sendError(event, 404, 'CLAIM_NOT_FOUND', 'Pending payment claim not found.')
    }
    throw err
  })

  if (resultPayload) {
    return sendSuccess(event, resultPayload)
  }
})
