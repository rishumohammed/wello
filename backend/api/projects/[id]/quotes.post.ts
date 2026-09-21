// backend/api/projects/[id]/quotes.post.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import crypto from 'node:crypto'
import { requireUser } from '../../../utils/authGuard'
import { getDb } from '../../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'

const createQuoteSchema = z.object({
  quoteAmount: z.number().min(0, 'Quote amount must be non-negative').max(999999999),
  currency: z.string().length(3).toUpperCase().optional(),
  estHours: z.number().min(0).max(9999).nullable().optional(),
  quoteDate: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']).optional().default('sent'),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const projectId = Number(idParam)

  if (!projectId || isNaN(projectId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid project ID parameter.')
  }

  const db = getDb()
  const project = await db('projects')
    .where({ id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!project) {
    return sendError(event, 404, 'PROJECT_NOT_FOUND', 'Project not found.')
  }

  const body = await readBody(event)
  const parsed = createQuoteSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const now = new Date()
  const quoteDate = data.quoteDate || now.toISOString().slice(0, 10)
  const currency = data.currency || project.currency || user.base_currency || 'USD'

  // Determine next version number
  const [maxVersionResult] = await db('project_quotes')
    .where({ project_id: projectId, user_id: user.id })
    .max('version as max_version')

  const nextVersion = (Number(maxVersionResult?.max_version) || 0) + 1

  // If new quote is sent, mark prior active quotes as superseded
  if (data.status === 'sent') {
    await db('project_quotes')
      .where({ project_id: projectId, user_id: user.id })
      .whereIn('status', ['draft', 'sent'])
      .update({ status: 'superseded', updated_at: now })
  }

  const publicToken = crypto.randomBytes(24).toString('hex')

  const [quoteId] = await db('project_quotes').insert({
    user_id: user.id,
    project_id: projectId,
    version: nextVersion,
    quote_amount: data.quoteAmount,
    currency,
    est_hours: data.estHours || null,
    quote_date: quoteDate,
    valid_until: data.validUntil || null,
    status: data.status,
    notes: data.notes || null,
    public_token: publicToken,
    created_at: now,
    updated_at: now,
  })

  // Update project current quote stats & status
  const projectUpdates: Record<string, any> = {
    quote_amount: data.quoteAmount,
    quote_date: quoteDate,
    quote_est_hours: data.estHours || null,
    quote_notes: data.notes || null,
    quote_status: data.status,
    updated_at: now,
  }

  if (project.status === 'potential' && data.status === 'sent') {
    projectUpdates.status = 'quoted'
  }

  await db('projects').where({ id: projectId }).update(projectUpdates)

  const newQuote = await db('project_quotes').where({ id: quoteId }).first()

  return sendSuccess(
    event,
    {
      id: newQuote.id,
      projectId: newQuote.project_id,
      version: newQuote.version,
      quoteAmount: Number(newQuote.quote_amount),
      currency: newQuote.currency,
      estHours: newQuote.est_hours !== null ? Number(newQuote.est_hours) : null,
      quoteDate: newQuote.quote_date,
      validUntil: newQuote.valid_until,
      status: newQuote.status,
      notes: newQuote.notes,
      publicToken: newQuote.public_token,
      quote: {
        id: newQuote.id,
        projectId: newQuote.project_id,
        version: newQuote.version,
        quoteAmount: Number(newQuote.quote_amount),
        currency: newQuote.currency,
        estHours: newQuote.est_hours !== null ? Number(newQuote.est_hours) : null,
        quoteDate: newQuote.quote_date,
        validUntil: newQuote.valid_until,
        status: newQuote.status,
        notes: newQuote.notes,
        publicToken: newQuote.public_token,
      },
      createdAt: newQuote.created_at,
      updatedAt: newQuote.updated_at,
    },
    undefined,
    201
  )
})
