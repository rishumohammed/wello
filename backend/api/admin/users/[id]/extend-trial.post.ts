// backend/api/admin/users/[id]/extend-trial.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requirePermission, blockIfImpersonating } from '../../../../utils/authGuard'
import { adminExtendUserTrial } from '../../../../utils/subscriptionService'
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
    const days = Math.max(1, Number(body.days) || 30)
    const reason = body.reason || `Admin extended trial by ${days} days`

    const result = await adminExtendUserTrial(adminUser.id, targetUserId, days, reason)
    return sendSuccess(event, result)
  } catch (err: any) {
    return sendError(event, 400, 'EXTEND_TRIAL_FAILED', err.message || 'Failed to extend trial')
  }
})
