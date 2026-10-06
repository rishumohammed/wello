// backend/api/admin/users/[id]/comp-subscription.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requirePermission, blockIfImpersonating } from '../../../../utils/authGuard'
import { adminCompUserSubscription } from '../../../../utils/subscriptionService'
import { sendSuccess, sendError } from '../../../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  try {
    const adminUser = await requirePermission(event, 'users.manage')
    blockIfImpersonating(adminUser)

    const targetUserId = event.context.params?.id
    if (!targetUserId) {
      return sendError(event, 400, 'MISSING_PARAM', 'User ID is required')
    }

    const body = await readBody(event) || {}
    const isComped = Boolean(body.isComped)
    const reason = body.reason || (isComped ? 'Granted complimentary VIP subscription' : 'Revoked complimentary subscription')

    const result = await adminCompUserSubscription(adminUser.id, targetUserId, isComped, reason)
    return sendSuccess(event, result)
  } catch (err: any) {
    return sendError(event, 400, 'COMP_SUBSCRIPTION_FAILED', err.message || 'Failed to update comp status')
  }
})
