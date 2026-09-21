// backend/api/notifications/push/subscribe.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { sendSuccess, sendError } from '../../../utils/apiResponse'
import { savePushSubscription } from '../../../utils/pushEngine'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))

  const p256dh = body.keys?.p256dh || body.p256dh
  const auth = body.keys?.auth || body.auth

  if (!body.endpoint || !p256dh || !auth) {
    return sendError(event, 400, 'INVALID_SUBSCRIPTION', 'Valid push subscription object with endpoint and keys is required.')
  }

  await savePushSubscription(user.id, {
    endpoint: body.endpoint,
    keys: {
      p256dh,
      auth,
    },
    userAgent: body.userAgent || event.node?.req?.headers['user-agent'],
  })

  return sendSuccess(event, { subscribed: true, message: 'Web Push subscription registered successfully.' })
})
