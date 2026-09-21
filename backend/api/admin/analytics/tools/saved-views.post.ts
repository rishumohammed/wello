// backend/api/admin/analytics/tools/saved-views.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requirePermission } from '../../../../utils/authGuard'
import { createSavedView } from '../../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'analytics.view')
  const body = await readBody(event)

  if (!body?.name) {
    throw createError({ statusCode: 400, statusMessage: 'View name is required' })
  }

  return await createSavedView(user.id, {
    name: body.name,
    sectionKey: body.sectionKey || 'overview',
    filters: body.filters || {},
    isDefault: Boolean(body.isDefault),
  })
})
