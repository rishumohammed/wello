// backend/api/notifications/push/test.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { sendSuccess } from '../../../utils/apiResponse'
import { sendPushNotification } from '../../../utils/pushEngine'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))

  const result = await sendPushNotification(user.id, {
    title: body.title || 'Wello Push Test',
    body: body.body || 'This is a test notification from your Wello instance.',
    url: body.url || '/',
    tag: 'test-push',
  })

  return sendSuccess(event, {
    message: 'Test push notification dispatched.',
    ...result,
  })
})
