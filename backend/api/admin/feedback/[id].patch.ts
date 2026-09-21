// backend/api/admin/feedback/[id].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireAdmin } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendError, formatZodError } from '../../../utils/apiResponse'

const updateSchema = z.object({
  status: z.enum(['open', 'in_review', 'resolved']).optional(),
  adminResponse: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const idStr = getRouterParam(event, 'id')
  const id = parseInt(idStr || '0', 10)
  if (!id) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid feedback ID.')
  }

  const body = await readBody(event).catch(() => ({}))
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const db = getDb()
  const updates: Record<string, any> = { updated_at: new Date() }
  if (parsed.data.status) updates.status = parsed.data.status
  if (parsed.data.adminResponse !== undefined) updates.admin_response = parsed.data.adminResponse

  const updated = await db('user_feedback').where({ id }).update(updates)
  if (!updated) {
    return sendError(event, 404, 'NOT_FOUND', 'Feedback ticket not found.')
  }

  const item = await db('user_feedback').where({ id }).first()

  return {
    success: true,
    message: 'Feedback updated successfully.',
    data: item,
    feedback: item,
  }
})
