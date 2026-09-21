// backend/api/calculator/apply-quote.post.ts
import { defineEventHandler, readBody } from 'h3'
import crypto from 'node:crypto'
import { requireAddon } from '../../utils/addonService'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'pricing-calculator')
  const body = await readBody(event).catch(() => ({}))
  const db = getDb()

  const quoteAmount = Number(body.quoteAmount || body.quote_amount || 0)
  if (quoteAmount <= 0) {
    return sendError(event, 400, 'INVALID_AMOUNT', 'Quote amount must be greater than zero.')
  }

  const estimatedHours = body.estimatedHours != null ? Number(body.estimatedHours) : null
  let projectId = body.projectId ? Number(body.projectId) : null

  // If no projectId, create a new project
  if (!projectId) {
    const projectName = body.projectName?.trim() || `Proposed Project (${new Date().toLocaleDateString()})`
    const [newProjId] = await db('projects').insert({
      user_id: user.id,
      client_id: body.clientId ? Number(body.clientId) : null,
      name: projectName,
      description: body.notes || 'Calculated project proposal via Wello Pricing Engine',
      service_category: body.serviceCategory || 'General',
      status: 'potential',
      currency: body.currency || user.base_currency || 'USD',
      quote_amount: quoteAmount,
      quote_est_hours: estimatedHours,
      quote_notes: body.notes || null,
      quote_status: 'draft',
      created_at: db.fn.now(3),
      updated_at: db.fn.now(3),
    })
    projectId = Number(newProjId)
  } else {
    // Verify ownership
    const existing = await db('projects').where({ id: projectId, user_id: user.id }).first()
    if (!existing) {
      return sendError(event, 404, 'PROJECT_NOT_FOUND', 'Project not found.')
    }

    await db('projects').where({ id: projectId }).update({
      quote_amount: quoteAmount,
      quote_est_hours: estimatedHours,
      quote_notes: body.quoteNotes || body.notes || existing.quote_notes,
      quote_status: 'draft',
      updated_at: db.fn.now(3),
    })
  }

  // Create or update project_quotes record
  const latestQuote = await db('project_quotes')
    .where({ project_id: projectId, user_id: user.id })
    .orderBy('version', 'desc')
    .first()

  const version = latestQuote ? latestQuote.version + 1 : 1
  const publicToken = crypto.randomBytes(24).toString('hex')

  const [quoteId] = await db('project_quotes').insert({
    project_id: projectId,
    user_id: user.id,
    version,
    quote_amount: quoteAmount,
    currency: body.currency || user.base_currency || 'USD',
    est_hours: estimatedHours,
    quote_date: db.fn.now(3),
    valid_until: null,
    status: 'draft',
    notes: body.quoteNotes || body.notes || null,
    public_token: publicToken,
    created_at: db.fn.now(3),
    updated_at: db.fn.now(3),
  })

  const rawProject = await db('projects').where({ id: projectId }).first()
  const quote = await db('project_quotes').where({ id: quoteId }).first()

  const project = {
    ...rawProject,
    quoteAmount: Number(rawProject.quote_amount),
    quoteEstHours: Number(rawProject.quote_est_hours),
    quoteNotes: rawProject.quote_notes,
    quoteStatus: rawProject.quote_status,
  }

  return sendSuccess(event, {
    message: 'Calculated quote successfully applied to project.',
    project,
    quote,
    quoteId,
    projectId,
    publicToken,
  }, 200)
})
