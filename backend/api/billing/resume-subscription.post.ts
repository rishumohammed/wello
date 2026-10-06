// backend/api/billing/resume-subscription.post.ts
import { defineEventHandler } from 'h3'
import { requireUser, blockIfImpersonating } from '../../utils/authGuard'
import { resumeUserSubscription } from '../../utils/subscriptionService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireUser(event)
    blockIfImpersonating(user)

    const result = await resumeUserSubscription(user.id)
    return sendSuccess(event, result)
  } catch (err: any) {
    return sendError(event, 400, 'SUBSCRIPTION_RESUME_FAILED', err.message || 'Failed to resume subscription')
  }
})
