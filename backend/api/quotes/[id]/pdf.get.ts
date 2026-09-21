// backend/api/quotes/[id]/pdf.get.ts
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { getDb } from '../../../utils/db'
import { sendError } from '../../../utils/apiResponse'
import { generateQuotePdf, QuotePdfData } from '../../../utils/pdfGenerator'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idStr = event.context.params?.id
  const query = getQuery(event)
  const template = (query.template === 'classic_executive' ? 'classic_executive' : 'modern_clean') as 'modern_clean' | 'classic_executive'

  const quoteId = Number(idStr)
  if (!idStr || isNaN(quoteId)) {
    return sendError(event, 400, 'INVALID_ID', 'Valid numeric quote ID is required.')
  }

  const db = getDb()
  const quote = await db('project_quotes')
    .where({ id: quoteId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!quote) {
    return sendError(event, 404, 'QUOTE_NOT_FOUND', 'Quote not found.')
  }

  const project = await db('projects').where({ id: quote.project_id }).first()
  const client = project?.client_id ? await db('clients').where({ id: project.client_id }).first() : null

  const pdfData: QuotePdfData = {
    quoteNumber: `Q-${project?.name ? project.name.slice(0, 4).toUpperCase() : 'PROP'}-v${quote.version}`,
    projectName: project?.name || 'Project Proposal',
    quoteDate: quote.quote_date || quote.created_at,
    validUntil: quote.valid_until,
    currency: quote.currency || 'USD',
    quoteAmount: Number(quote.quote_amount),
    estimatedHours: quote.est_hours ? Number(quote.est_hours) : undefined,
    sellerName: user.business_name || user.name,
    sellerEmail: user.business_email || user.email,
    sellerAddress: user.business_address,
    customerName: client?.name || 'Valued Client',
    customerEmail: client?.email,
    notes: quote.notes || project?.description,
    template,
  }

  const pdfBuffer = generateQuotePdf(pdfData)

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="Quote-${quote.id}.pdf"`)
  setHeader(event, 'Content-Length', pdfBuffer.length)

  return pdfBuffer
})
