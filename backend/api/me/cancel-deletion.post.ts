// backend/api/me/cancel-deletion.post.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { cancelAccountDeletion } from '../../utils/dataRetentionService'
import { logAnalyticsEvent } from '../../utils/analyticsService'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const res = await cancelAccountDeletion(user.id)

  await logAnalyticsEvent(user.id, 'account_deletion_cancelled', {}, true)

  return {
    success: true,
    data: res,
    ...res,
  }
})
