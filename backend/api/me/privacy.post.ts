// backend/api/me/privacy.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendError, formatZodError } from '../../utils/apiResponse'
import { logAnalyticsEvent } from '../../utils/analyticsService'

const privacySchema = z.object({
  analyticsConsent: z.boolean().optional(),
  cookieConsent: z.enum(['accepted', 'essential_only', 'custom', 'rejected']).optional(),
  digestFrequency: z.enum(['daily', 'weekly', 'none']).optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))

  const parsed = privacySchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const db = getDb()
  const updates: Record<string, any> = { updated_at: new Date() }

  if (parsed.data.analyticsConsent !== undefined) {
    updates.analytics_consent = parsed.data.analyticsConsent
  }
  if (parsed.data.cookieConsent !== undefined) {
    updates.cookie_consent = parsed.data.cookieConsent
  }
  if (parsed.data.digestFrequency !== undefined) {
    updates.digest_frequency = parsed.data.digestFrequency
    if (parsed.data.digestFrequency === 'none') {
      updates.email_unsubscribed_at = new Date()
    } else {
      updates.email_unsubscribed_at = null
    }
  }

  await db('users').where({ id: user.id }).update(updates)

  await logAnalyticsEvent(user.id, 'privacy_settings_updated', {
    analyticsConsent: updates.analytics_consent,
    cookieConsent: updates.cookie_consent,
    digestFrequency: updates.digest_frequency,
  }, true)

  return {
    success: true,
    message: 'Privacy settings updated successfully.',
    data: {
      analyticsConsent: updates.analytics_consent ?? user.analytics_consent,
      cookieConsent: updates.cookie_consent ?? user.cookie_consent,
      digestFrequency: updates.digest_frequency ?? user.digest_frequency,
    },
  }
})
