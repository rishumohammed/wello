// backend/api/notifications/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { sendSuccess } from '../../utils/apiResponse'
import { getUserNotifications } from '../../utils/notificationsEngine'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)

  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30))
  const offset = Math.max(0, Number(query.offset) || 0)

  const result = await getUserNotifications(user.id, limit, offset)
  return sendSuccess(event, result)
})
