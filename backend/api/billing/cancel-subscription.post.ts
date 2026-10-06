// backend/api/billing/cancel-subscription.post.ts
import { defineEventHandler } from 'h3'
import { requireUser, blockIfImpersonating } from '../../utils/authGuard'
import { cancelUserSubscription } from '../../utils/subscriptionService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event)
    blockIfImpersonating(user)

    const result = await cancelUserSubscription(user.id)
    return sendSuccess(event, result)
  } catch (err: any) {
    return sendError(event, 400, 'SUBSCRIPTION_CANCEL_FAILED', err.message || 'Failed to cancel subscription')
  }
})
