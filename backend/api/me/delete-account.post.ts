// backend/api/me/delete-account.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { requestAccountDeletion } from '../../utils/dataRetentionService'
import { logAnalyticsEvent } from '../../utils/analyticsService'

const deleteSchema = z.object({
  confirmation: z.string().optional(),
  gracePeriodDays: z.number().int().min(1).max(30).optional().default(14),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))
  const parsed = deleteSchema.safeParse(body)
  const gracePeriodDays = parsed.success && parsed.data.gracePeriodDays ? parsed.data.gracePeriodDays : 14

  const res = await requestAccountDeletion(user.id, gracePeriodDays)

  await logAnalyticsEvent(user.id, 'account_deletion_requested', {
    gracePeriodDays,
    scheduledDeletionAt: res.scheduledDeletionAt,
  }, true)

  return {
    success: true,
    message: `Your account has been scheduled for permanent deletion in ${gracePeriodDays} days. You may log in anytime within this grace period to cancel deletion.`,
    data: res,
    ...res,
  }
})
