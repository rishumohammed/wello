// backend/api/notifications/mark-all-read.post.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { sendSuccess } from '../../utils/apiResponse'
import { markAllNotificationsAsRead } from '../../utils/notificationsEngine'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const count = await markAllNotificationsAsRead(user.id)
  return sendSuccess(event, { updatedCount: count, message: `${count} notifications marked as read.` })
})
