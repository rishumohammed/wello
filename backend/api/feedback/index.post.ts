// backend/api/feedback/index.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendError, formatZodError } from '../../utils/apiResponse'
import { logAnalyticsEvent } from '../../utils/analyticsService'

const feedbackSchema = z.object({
  category: z.enum(['bug', 'feature', 'question', 'support', 'general']).optional().default('general'),
  subject: z.string().max(255).optional(),
  message: z.string().min(1, 'Feedback message cannot be empty.').max(5000),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))

  const parsed = feedbackSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { category, subject, message } = parsed.data
  const db = getDb()

  const [id] = await db('user_feedback').insert({
    user_id: user.id,
    user_email: user.email,
    category,
    subject: subject || null,
    message,
    status: 'open',
    created_at: new Date(),
    updated_at: new Date(),
  })

  await logAnalyticsEvent(user.id, 'feedback_submitted', {
    category,
    feedbackId: id,
  }, true)

  return {
    success: true,
    message: 'Thank you for your feedback! Our support team has received your message.',
    data: {
      id,
      category,
      status: 'open',
    },
  }
})
