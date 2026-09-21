// backend/api/quotes/public/[token].get.ts
import { defineEventHandler } from 'h3'
import { getDb } from '../../../utils/db'
import { sendSuccess, sendError } from '../../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const token = event.context.params?.token
  if (!token) {
    return sendError(event, 400, 'MISSING_TOKEN', 'Public quote token is required.')
  }

  const db = getDb()
  const quote = await db('project_quotes')
    .where({ public_token: token })
    .whereNull('deleted_at')
    .first()

  if (!quote) {
    return sendError(event, 404, 'QUOTE_NOT_FOUND', 'Quote proposal not found or link has expired.')
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
