// backend/api/notifications/push/unsubscribe.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { sendSuccess, sendError } from '../../../utils/apiResponse'
import { removePushSubscription } from '../../../utils/pushEngine'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))

  if (!body.endpoint) {
    return sendError(event, 400, 'MISSING_ENDPOINT', 'Endpoint is required to remove push subscription.')
  }

  await removePushSubscription(user.id, body.endpoint)
  return sendSuccess(event, { unsubscribed: true, message: 'Web Push subscription removed.' })
})
