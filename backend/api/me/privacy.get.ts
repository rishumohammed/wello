// backend/api/me/privacy.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()

  const row = await db('users')
    .where({ id: user.id })
    .select(
      'analytics_consent',
      'cookie_consent',
      'digest_frequency',
      'email_unsubscribed_at',
      'scheduled_deletion_at',
      'deletion_grace_period_days',
      'status'
    )
    .first()

  return {
    success: true,
    data: {
      analyticsConsent: Boolean(row?.analytics_consent ?? true),
      cookieConsent: row?.cookie_consent || 'accepted',
      digestFrequency: row?.digest_frequency || 'weekly',
      isEmailUnsubscribed: Boolean(row?.email_unsubscribed_at),
      status: row?.status || 'active',
      scheduledDeletionAt: row?.scheduled_deletion_at || null,
      gracePeriodDays: row?.deletion_grace_period_days || 14,
    },
  }
})
