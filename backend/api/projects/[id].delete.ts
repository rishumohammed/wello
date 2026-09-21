// backend/api/projects/[id].delete.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const projectId = Number(idParam)

  if (!projectId || isNaN(projectId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid project ID parameter.')
  }

  const db = getDb()
  const existing = await db('projects')
    .where({ id: projectId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'PROJECT_NOT_FOUND', 'Project not found or already deleted.')
  }

  const now = new Date()
  await db('projects')
    .where({ id: projectId, user_id: user.id })
    .update({
      deleted_at: now,
      updated_at: now,
    })

  return sendSuccess(event, {
    id: projectId,
    deleted: true,
    message: 'Project soft-deleted successfully.',
    deletedAt: now.toISOString(),
  })
})
