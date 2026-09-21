// backend/api/admin/analytics/tools/saved-views.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../../../utils/authGuard'
import { getSavedViews } from '../../../../utils/analyticsAdminService'

export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, 'analytics.view')
  const query = getQuery(event)
  const sectionKey = query?.sectionKey as string | undefined

  return await getSavedViews(user.id, sectionKey)
})
