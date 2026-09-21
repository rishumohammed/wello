// backend/api/quotes/public/[token]/action.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { getDb } from '../../../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../../../utils/apiResponse'

const quoteActionSchema = z.object({
  action: z.enum(['accept', 'decline']),
  feedback: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const token = event.context.params?.token
  if (!token) {
    return sendError(event, 400, 'MISSING_TOKEN', 'Public quote token is required.')
  }

  const body = await readBody(event)
  const parsed = quoteActionSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { action, feedback } = parsed.data
  const db = getDb()

  const quote = await db('project_quotes')
    .where({ public_token: token })
    .whereNull('deleted_at')
    .first()

  if (!quote) {
    return sendError(event, 404, 'QUOTE_NOT_FOUND', 'Quote not found.')
  }

  const now = new Date()

  if (action === 'accept') {
    await db('project_quotes')
      .where({ id: quote.id })
      .update({
        status: 'accepted',
        accepted_at: now,
        updated_at: now,
      })

    // Update project to in_progress
    await db('projects')
      .where({ id: quote.project_id })
      .update({
        status: 'in_progress',
        quote_status: 'approved',
        updated_at: now,
      })

    return sendSuccess(event, {
      message: 'Proposal accepted successfully. The project is now approved!',
      status: 'accepted',
      acceptedAt: now.toISOString(),
    })
  } else {
    await db('project_quotes')
      .where({ id: quote.id })
      .update({
        status: 'rejected',
        rejected_at: now,
        notes: feedback ? `${quote.notes || ''}\nDecline Reason: ${feedback}`.trim() : quote.notes,
        updated_at: now,
      })

    // Update project to lost
    await db('projects')
      .where({ id: quote.project_id })
      .update({
        status: 'lost',
        quote_status: 'rejected',
        updated_at: now,
      })

    return sendSuccess(event, {
      message: 'Proposal declined.',
      status: 'rejected',
      rejectedAt: now.toISOString(),
    })
  }
})
