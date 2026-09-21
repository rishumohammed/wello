// backend/api/notifications/[id]/read.patch.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { sendSuccess, sendError } from '../../../utils/apiResponse'
import { markNotificationAsRead } from '../../../utils/notificationsEngine'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idStr = event.context.params?.id
  const notifId = Number(idStr)

  if (!idStr || isNaN(notifId)) {
    return sendError(event, 400, 'INVALID_ID', 'Valid notification ID is required.')
  }

  const success = await markNotificationAsRead(user.id, notifId)
  if (!success) {
    return sendError(event, 404, 'NOT_FOUND', 'Notification not found or already marked as read.')
  }

  return sendSuccess(event, { id: notifId, isRead: true })
})
