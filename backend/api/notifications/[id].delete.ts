// backend/api/notifications/[id].delete.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { sendSuccess, sendError } from '../../utils/apiResponse'
import { deleteNotification } from '../../utils/notificationsEngine'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idStr = event.context.params?.id
  const notifId = Number(idStr)

  if (!idStr || isNaN(notifId)) {
    return sendError(event, 400, 'INVALID_ID', 'Valid notification ID is required.')
  }

  const success = await deleteNotification(user.id, notifId)
  if (!success) {
    return sendError(event, 404, 'NOT_FOUND', 'Notification not found.')
  }

  return sendSuccess(event, { id: notifId, deleted: true })
})
