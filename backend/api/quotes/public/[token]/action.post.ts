// backend/api/quotes/public/[token]/action.post.ts
import crypto from 'node:crypto'
import { defineEventHandler, readBody, setResponseHeader } from 'h3'
import { z } from 'zod'
import { getDb } from '../../../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../../../utils/apiResponse'
import { requireRateLimit } from '../../../../utils/rateLimiter'

const quoteActionSchema = z.object({
  action: z.enum(['accept', 'decline']),
  feedback: z.string().max(2000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const token = (event.context.params?.token || '').trim()
  if (!token) {
    return sendError(event, 404, 'NOT_FOUND', 'Quote proposal not found or link has expired.')
  }

  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')

  await requireRateLimit(event, {
    keyPrefix: 'public_quote_action',
    limit: 20,
    windowSeconds: 60,
    identifier: token,
    customErrorMessage: 'Too many requests. Please wait a moment before trying again.',
  })

  const body = await readBody(event)
  const parsed = quoteActionSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { action, feedback } = parsed.data
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const db = getDb()
  const now = new Date()

  const quote = await db('project_quotes')
    .where((builder) => {
      builder.where({ public_token_hash: tokenHash }).orWhere({ public_token: token })
    })
    .whereNull('deleted_at')
    .whereNull('public_token_revoked_at')
    .where((builder) => {
      builder.whereNull('public_token_expires_at').orWhere('public_token_expires_at', '>', now)
    })
    .first()

  if (!quote) {
    return sendError(event, 404, 'NOT_FOUND', 'Quote proposal not found or link has expired.')
  }

  // Idempotent check
  if (action === 'accept' && quote.status === 'accepted') {
    return sendSuccess(event, {
      message: 'Proposal was already accepted.',
      status: 'accepted',
      acceptedAt: quote.accepted_at || now.toISOString(),
    })
  }

  if (action === 'accept') {
    await db('project_quotes')
      .where({ id: quote.id })
      .update({
        status: 'accepted',
        accepted_at: now,
        updated_at: now,
      })

    // Update project to in_progress
    await db('projects')
      .where({ id: quote.project_id })
      .update({
        status: 'in_progress',
        quote_status: 'approved',
        updated_at: now,
      })

    return sendSuccess(event, {
      message: 'Proposal accepted successfully. The project is now approved!',
      status: 'accepted',
      acceptedAt: now.toISOString(),
    })
  } else {
    await db('project_quotes')
      .where({ id: quote.id })
      .update({
        status: 'rejected',
        rejected_at: now,
        notes: feedback ? `${quote.notes || ''}\nDecline Reason: ${feedback}`.trim() : quote.notes,
        updated_at: now,
      })

    // Update project to lost
    await db('projects')
      .where({ id: quote.project_id })
      .update({
        status: 'lost',
        quote_status: 'rejected',
        updated_at: now,
      })

    return sendSuccess(event, {
      message: 'Proposal declined.',
      status: 'rejected',
      rejectedAt: now.toISOString(),
    })
  }
})
