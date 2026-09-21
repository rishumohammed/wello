// backend/api/notifications/preferences.put.ts
import { defineEventHandler, readBody } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { sendSuccess } from '../../utils/apiResponse'
import { updateNotificationPreferences, getNotificationPreferences } from '../../utils/notificationsEngine'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))
  const db = getDb()

  if (Array.isArray(body.preferences)) {
    await updateNotificationPreferences(user.id, body.preferences)
  }

  // Update digest frequency & timezone day settings
  const digestUpdates: any = {}
  if (body.digestFrequency) digestUpdates.digest_frequency = body.digestFrequency
  if (body.digestDayOfWeek != null) digestUpdates.digest_day_of_week = Number(body.digestDayOfWeek)
  if (body.digestHourUtc != null) digestUpdates.digest_hour_utc = Number(body.digestHourUtc)
  if (body.isEmailUnsubscribed !== undefined) {
    digestUpdates.email_unsubscribed_at = body.isEmailUnsubscribed ? db.fn.now(3) : null
  }

  if (Object.keys(digestUpdates).length > 0) {
    digestUpdates.updated_at = db.fn.now(3)
    await db('users').where({ id: user.id }).update(digestUpdates)
  }

  const { preferences, topics } = await getNotificationPreferences(user.id)
  const updatedUser = await db('users').where({ id: user.id }).first()

  return sendSuccess(event, {
    message: 'Notification preferences updated successfully.',
    preferences,
    topics,
    digest: {
      frequency: updatedUser?.digest_frequency || 'weekly',
      dayOfWeek: updatedUser?.digest_day_of_week,
      hourUtc: updatedUser?.digest_hour_utc,
      isEmailUnsubscribed: Boolean(updatedUser?.email_unsubscribed_at),
    },
  })
})
