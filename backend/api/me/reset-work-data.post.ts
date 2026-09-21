// backend/api/me/reset-work-data.post.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { resetUserWorkData } from '../../utils/dataRetentionService'
import { logAnalyticsEvent } from '../../utils/analyticsService'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const res = await resetUserWorkData(user.id)

  await logAnalyticsEvent(user.id, 'work_data_reset', {
    purgedCounts: res.purgedCounts,
  }, true)

  return {
    success: true,
    message: 'All your tracking and work data has been deleted cleanly. Your account credentials and free addon preferences remain active.',
    data: res,
    ...res,
  }
})
