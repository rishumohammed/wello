// backend/api/invoices/public/[token]/action.post.ts
import crypto from 'node:crypto'
import { defineEventHandler, readBody, getRequestIP, setResponseHeader } from 'h3'
import { z } from 'zod'
import { getDb } from '../../../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../../../utils/apiResponse'
import { requireRateLimit } from '../../../../utils/rateLimiter'
import { createNotification } from '../../../../utils/notificationsEngine'

const paymentClaimSchema = z.object({
  amount: z.number().positive(),
  paymentMethod: z.string().min(1).max(50),
  referenceNote: z.string().max(1000).optional(),
})

export default defineEventHandler(async (event) => {
  const token = (event.context.params?.token || '').trim()
  if (!token) {
    return sendError(event, 404, 'NOT_FOUND', 'Invoice not found or link has expired.')
  }

  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')

  await requireRateLimit(event, {
    keyPrefix: 'public_invoice_claim',
    limit: 10,
    windowSeconds: 60,
    identifier: token,
    customErrorMessage: 'Too many payment claims submitted. Please wait before retrying.',
  })

  const body = await readBody(event)
  const parsed = paymentClaimSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { amount, paymentMethod, referenceNote } = parsed.data
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const db = getDb()
  const now = new Date()

  const invoice = await db('invoices')
    .where((builder) => {
      builder.where({ public_token_hash: tokenHash }).orWhere({ public_token: token })
    })
    .whereNull('deleted_at')
    .whereNull('public_token_revoked_at')
    .where((builder) => {
      builder.whereNull('public_token_expires_at').orWhere('public_token_expires_at', '>', now)
    })
    .first()

  if (!invoice) {
    return sendError(event, 404, 'NOT_FOUND', 'Invoice not found or link has expired.')
  }

  const [claimId] = await db('payment_claims').insert({
    invoice_id: invoice.id,
    amount,
    currency: invoice.currency || 'USD',
    payment_method: paymentMethod,
    transaction_ref: referenceNote || null,
    notes: referenceNote || null,
    status: 'PENDING',
    created_at: now,
    updated_at: now,
  })

  // Notify invoice owner about the pending payment claim
  try {
    await createNotification({
      userId: invoice.user_id,
      type: 'payment_claim_received',
      title: `Payment Claim on Invoice ${invoice.invoice_number}`,
      message: `A client reported paying ${invoice.currency || '$'}${amount} via ${paymentMethod}. Please verify your bank/account and confirm receipt.`,
      metadata: {
        invoiceId: invoice.id,
        claimId,
        amount,
        paymentMethod,
        referenceNote,
      },
    })
  } catch {
    // Non-blocking notification
  }

  return sendSuccess(event, {
    message: 'Payment claim submitted successfully. The invoice owner has been notified to confirm receipt.',
    claimId,
    status: 'pending_verification',
  })
})
