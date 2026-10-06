// backend/api/quotes/public/[token].get.ts
import crypto from 'node:crypto'
import { defineEventHandler, setResponseHeader } from 'h3'
import { getDb } from '../../../utils/db'
import { sendSuccess, sendError } from '../../../utils/apiResponse'
import { requireRateLimit } from '../../../utils/rateLimiter'

export default defineEventHandler(async (event) => {
  const token = (event.context.params?.token || '').trim()
  if (!token) {
    return sendError(event, 404, 'NOT_FOUND', 'Quote proposal not found or link has expired.')
  }

  // Set privacy and anti-indexing headers
  setResponseHeader(event, 'Referrer-Policy', 'no-referrer')
  setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate')

  // Rate limit per token and IP
  await requireRateLimit(event, {
    keyPrefix: 'public_quote_view',
    limit: 60,
    windowSeconds: 60,
    identifier: token,
    customErrorMessage: 'Too many requests. Please wait a moment before refreshing the proposal.',
  })

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

  const project = await db('projects').where({ id: quote.project_id }).first()
  const client = project?.client_id ? await db('clients').where({ id: project.client_id }).first() : null
  const user = await db('users').where({ id: quote.user_id }).first()

  return sendSuccess(event, {
    quote: {
      id: quote.id,
      version: quote.version,
      quoteAmount: Number(quote.quote_amount),
      currency: quote.currency || 'USD',
      estimatedHours: quote.est_hours ? Number(quote.est_hours) : null,
      quoteDate: quote.quote_date,
      validUntil: quote.valid_until,
      status: quote.status,
      notes: quote.notes,
      projectName: project?.name || 'Project Proposal',
      projectDescription: project?.description,
      customerName: client?.name || 'Valued Client',
      customerEmail: client?.email,
      sellerName: user?.business_name || user?.name || 'Verified Professional',
      sellerEmail: user?.business_email || user?.email,
      sellerAddress: user?.business_address,
      acceptedAt: quote.accepted_at,
      rejectedAt: quote.rejected_at,
    },
  })
})
