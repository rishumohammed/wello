// backend/api/projects/[id].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { validateProjectStatusTransition, ProjectStatus } from '../../utils/stateMachine'

const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name cannot be empty').max(255).optional(),
  clientId: z.number().int().positive().nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  serviceCategory: z.string().max(150).nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['potential', 'quoted', 'approved', 'in_progress', 'completed', 'lost']).optional(),
  isJob: z.boolean().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  quoteAmount: z.number().min(0).max(999999999).nullable().optional(),
  quoteDate: z.string().nullable().optional(),
  quoteEstHours: z.number().min(0).max(9999).nullable().optional(),
  quoteNotes: z.string().nullable().optional(),
  quoteStatus: z.enum(['draft', 'sent', 'accepted', 'rejected']).optional(),
})

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
    return sendError(event, 404, 'PROJECT_NOT_FOUND', 'Project not found.')
  }

  const body = await readBody(event)
  const parsed = updateProjectSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data

  // Verify client if changed
  if (data.clientId) {
    const client = await db('clients')
      .where({ id: data.clientId, user_id: user.id })
      .whereNull('deleted_at')
      .first()
    if (!client) {
      return sendError(event, 400, 'INVALID_CLIENT', 'Specified client does not exist or does not belong to you.')
    }
  }

  // Validate status transition via State Machine
  if (data.status && data.status !== existing.status) {
    const transitionCheck = validateProjectStatusTransition(
      existing.status as ProjectStatus,
      data.status as ProjectStatus
    )
    if (!transitionCheck.valid) {
      return sendError(event, 400, 'ILLEGAL_STATUS_TRANSITION', transitionCheck.error!)
    }
  }

  const now = new Date()
  const updates: Record<string, any> = {
    updated_at: now,
  }

  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.clientId !== undefined) updates.client_id = data.clientId
  if (data.categoryId !== undefined) updates.category_id = data.categoryId
  if (data.serviceCategory !== undefined) updates.service_category = data.serviceCategory
  if (data.description !== undefined) updates.description = data.description
  if (data.status !== undefined) {
    updates.status = data.status
    if (['in_progress', 'approved', 'completed'].includes(data.status)) {
      updates.is_job = true
    } else if (data.status === 'potential' || data.status === 'lost') {
      if (data.isJob === undefined) {
        updates.is_job = false
      }
    }
  }
  if (data.isJob !== undefined) updates.is_job = data.isJob
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.quoteAmount !== undefined) updates.quote_amount = data.quoteAmount
  if (data.quoteDate !== undefined) updates.quote_date = data.quoteDate
  if (data.quoteEstHours !== undefined) updates.quote_est_hours = data.quoteEstHours
  if (data.quoteNotes !== undefined) updates.quote_notes = data.quoteNotes
  if (data.quoteStatus !== undefined) updates.quote_status = data.quoteStatus

  await db('projects')
    .where({ id: projectId, user_id: user.id })
    .update(updates)

  const updatedProject = await db('projects').where({ id: projectId }).first()

  return sendSuccess(event, {
    id: updatedProject.id,
    clientId: updatedProject.client_id,
    categoryId: updatedProject.category_id,
    serviceCategory: updatedProject.service_category,
    name: updatedProject.name,
    description: updatedProject.description,
    status: updatedProject.status,
    isJob: Boolean(updatedProject.is_job),
    currency: updatedProject.currency,
    quoteAmount: updatedProject.quote_amount !== null ? Number(updatedProject.quote_amount) : null,
    quoteDate: updatedProject.quote_date,
    quoteEstHours: updatedProject.quote_est_hours !== null ? Number(updatedProject.quote_est_hours) : null,
    quoteNotes: updatedProject.quote_notes,
    quoteStatus: updatedProject.quote_status,
    createdAt: updatedProject.created_at,
    updatedAt: updatedProject.updated_at,
  })
})
