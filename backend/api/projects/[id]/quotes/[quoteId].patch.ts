// backend/api/projects/[id]/quotes/[quoteId].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../../../utils/authGuard'
import { getDb } from '../../../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../../../utils/apiResponse'
import { validateQuoteStatusTransition, QuoteStatus } from '../../../../utils/stateMachine'

const updateQuoteSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'superseded']).optional(),
  quoteAmount: z.number().min(0).max(999999999).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  estHours: z.number().min(0).max(9999).nullable().optional(),
  validUntil: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = Number(getRouterParam(event, 'id'))
  const quoteId = Number(getRouterParam(event, 'quoteId'))

  if (!projectId || !quoteId || isNaN(projectId) || isNaN(quoteId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid project or quote ID parameter.')
  }

  const db = getDb()
  const quote = await db('project_quotes')
    .where({ id: quoteId, project_id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!quote) {
    return sendError(event, 404, 'QUOTE_NOT_FOUND', 'Quote not found.')
  }

  const project = await db('projects')
    .where({ id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!project) {
    return sendError(event, 404, 'PROJECT_NOT_FOUND', 'Parent project not found.')
  }

  const body = await readBody(event)
  const parsed = updateQuoteSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data

  if (data.status && data.status !== quote.status) {
    const check = validateQuoteStatusTransition(quote.status as QuoteStatus, data.status as QuoteStatus)
    if (!check.valid) {
      return sendError(event, 400, 'ILLEGAL_STATUS_TRANSITION', check.error!)
    }
  }

  const now = new Date()
  const updates: Record<string, any> = {
    updated_at: now,
  }

  if (data.status !== undefined) updates.status = data.status
  if (data.quoteAmount !== undefined) updates.quote_amount = data.quoteAmount
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.estHours !== undefined) updates.est_hours = data.estHours
  if (data.validUntil !== undefined) updates.valid_until = data.validUntil
  if (data.notes !== undefined) updates.notes = data.notes

  await db('project_quotes')
    .where({ id: quoteId, user_id: user.id })
    .update(updates)

  // Side effects on parent project when quote accepted/rejected
  if (data.status === 'accepted') {
    await db('projects')
      .where({ id: projectId, user_id: user.id })
      .update({
        status: 'in_progress',
        is_job: true,
        quote_amount: data.quoteAmount !== undefined ? data.quoteAmount : quote.quote_amount,
        quote_status: 'accepted',
        updated_at: now,
      })
  } else if (data.status === 'rejected') {
    await db('projects')
      .where({ id: projectId, user_id: user.id })
      .update({
        status: 'lost',
        is_job: false,
        quote_status: 'rejected',
        updated_at: now,
      })
  }

  const updatedQuote = await db('project_quotes').where({ id: quoteId }).first()

  return sendSuccess(event, {
    id: updatedQuote.id,
    projectId: updatedQuote.project_id,
    version: updatedQuote.version,
    quoteAmount: Number(updatedQuote.quote_amount),
    currency: updatedQuote.currency,
    estHours: updatedQuote.est_hours !== null ? Number(updatedQuote.est_hours) : null,
    quoteDate: updatedQuote.quote_date,
    validUntil: updatedQuote.valid_until,
    status: updatedQuote.status,
    notes: updatedQuote.notes,
    createdAt: updatedQuote.created_at,
    updatedAt: updatedQuote.updated_at,
  })
})
