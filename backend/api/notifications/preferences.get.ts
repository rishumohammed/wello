// backend/api/notifications/preferences.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { sendSuccess } from '../../utils/apiResponse'
import { getNotificationPreferences } from '../../utils/notificationsEngine'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()

  const { preferences, topics } = await getNotificationPreferences(user.id)
  const userRecord = await db('users')
    .where({ id: user.id })
    .select('digest_frequency', 'digest_day_of_week', 'digest_hour_utc', 'email_unsubscribed_at')
    .first()

  return sendSuccess(event, {
    preferences,
    topics,
    digest: {
      frequency: userRecord?.digest_frequency || 'weekly',
      dayOfWeek: userRecord?.digest_day_of_week != null ? userRecord.digest_day_of_week : 1,
      hourUtc: userRecord?.digest_hour_utc != null ? userRecord.digest_hour_utc : 9,
      isEmailUnsubscribed: Boolean(userRecord?.email_unsubscribed_at),
    },
  })
})
