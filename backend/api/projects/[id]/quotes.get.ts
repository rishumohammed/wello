// backend/api/projects/[id]/quotes.get.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError } from '../../../utils/apiResponse'

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

  const quotes = await db('project_quotes')
    .where({ project_id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('version', 'desc')

  return sendSuccess(
    event,
    quotes.map((q) => ({
      id: q.id,
      projectId: q.project_id,
      version: q.version,
      quoteAmount: Number(q.quote_amount),
      currency: q.currency,
      estHours: q.est_hours !== null ? Number(q.est_hours) : null,
      quoteDate: q.quote_date,
      validUntil: q.valid_until,
      status: q.status,
      notes: q.notes,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
    }))
  )
})
