// backend/api/billing/create-subscription.post.ts
import { defineEventHandler } from 'h3'
import { requireUser, blockIfImpersonating } from '../../utils/authGuard'
import { initiateSubscriptionCheckout } from '../../utils/subscriptionService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event)
    blockIfImpersonating(user)

    const checkoutData = await initiateSubscriptionCheckout(user.id)
    return sendSuccess(event, checkoutData)
  } catch (err: any) {
    return sendError(event, 500, 'SUBSCRIPTION_CREATION_FAILED', err.message || 'Failed to initiate subscription')
  }
})
