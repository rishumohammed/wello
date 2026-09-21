// backend/api/projects/index.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'

const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  clientId: z.number().int().positive().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  serviceCategory: z.string().max(150).nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['potential', 'quoted', 'approved', 'in_progress', 'completed', 'lost']).optional().default('potential'),
  isJob: z.boolean().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  quoteAmount: z.number().min(0).max(999999999).nullable().optional(),
  quoteDate: z.string().nullable().optional(),
  quoteEstHours: z.number().min(0).max(9999).nullable().optional(),
  quoteNotes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const path = getRequestPath(event)
  const idempotencyKey = getIdempotencyKey(event)

  if (idempotencyKey) {
    const cached = await checkIdempotency(user.id, idempotencyKey, path)
    if (cached.exists) {
      return sendSuccess(event, cached.body, undefined, cached.status)
    }
  }

  const body = await readBody(event)
  const parsed = createProjectSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()

  // Verify client belongs to user if provided
  if (data.clientId) {
    const client = await db('clients')
      .where({ id: data.clientId, user_id: user.id })
      .whereNull('deleted_at')
      .first()
    if (!client) {
      return sendError(event, 400, 'INVALID_CLIENT', 'Specified client does not exist or does not belong to you.')
    }
  }

  const isJob = data.isJob !== undefined ? data.isJob : ['approved', 'in_progress', 'completed'].includes(data.status)
  const currency = data.currency || user.baseCurrency || 'USD'
  const quoteStatus = data.quoteAmount ? (data.status === 'potential' ? 'draft' : 'sent') : 'draft'

  const [projectId] = await db('projects').insert({
    user_id: user.id,
    client_id: data.clientId || null,
    category_id: data.categoryId || null,
    name: data.name.trim(),
    description: data.description || null,
    service_category: data.serviceCategory || 'General',
    status: data.status,
    is_job: isJob,
    currency,
    quote_amount: data.quoteAmount !== undefined ? data.quoteAmount : null,
    quote_date: data.quoteDate || null,
    quote_est_hours: data.quoteEstHours !== undefined ? data.quoteEstHours : null,
    quote_notes: data.quoteNotes || null,
    quote_status: quoteStatus,
    created_at: now,
    updated_at: now,
  })

  // If quote amount provided, create initial quote record
  if (data.quoteAmount !== undefined && data.quoteAmount !== null) {
    await db('project_quotes').insert({
      user_id: user.id,
      project_id: projectId,
      version: 1,
      quote_amount: data.quoteAmount,
      currency,
      est_hours: data.quoteEstHours || null,
      quote_date: data.quoteDate || now.toISOString().slice(0, 10),
      status: quoteStatus,
      notes: data.quoteNotes || null,
      created_at: now,
      updated_at: now,
    })
  }

  const newProject = await db('projects').where({ id: projectId }).first()

  const responseData = {
    id: newProject.id,
    clientId: newProject.client_id,
    categoryId: newProject.category_id,
    name: newProject.name,
    description: newProject.description,
    serviceCategory: newProject.service_category,
    status: newProject.status,
    isJob: Boolean(newProject.is_job),
    currency: newProject.currency,
    quoteAmount: newProject.quote_amount !== null ? Number(newProject.quote_amount) : null,
    quoteDate: newProject.quote_date,
    quoteEstHours: newProject.quote_est_hours !== null ? Number(newProject.quote_est_hours) : null,
    quoteNotes: newProject.quote_notes,
    quoteStatus: newProject.quote_status,
    metrics: {
      totalMinutes: 0,
      paidMinutes: 0,
      unpaidMinutes: 0,
      revenue: 0,
      expenses: 0,
      netIncome: 0,
      effectiveHourlyValue: 0,
    },
    createdAt: newProject.created_at,
    updatedAt: newProject.updated_at,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, responseData)
  }

  return sendSuccess(event, responseData, undefined, 201)
})
