// backend/api/billing/status.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getUserSubscriptionDetails } from '../../utils/subscriptionService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event)
    const details = await getUserSubscriptionDetails(user.id)
    return sendSuccess(event, details)
  } catch (err: any) {
    return sendError(event, 500, 'BILLING_STATUS_ERROR', err.message || 'Failed to fetch subscription status')
  }
})
