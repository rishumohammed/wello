// server/api/category-requests/index.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { submitCategoryRequest } from '../../utils/categoryStore'
import { pushAdminNotification } from '../../utils/auditStore'
import { logAnalyticsEvent } from '../../utils/analyticsEngine'

const categoryRequestSchema = z.object({
  userEmail: z.string().email('Please enter a valid email address.').optional(),
  email: z.string().email('Please enter a valid email address.').optional(),
  requestedName: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  reason: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parseResult = categoryRequestSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors[0]?.message || 'Invalid request data.',
    })
  }

  const userEmail = (parseResult.data.userEmail || parseResult.data.email || '').trim().toLowerCase()
  const requestedName = (parseResult.data.requestedName || parseResult.data.name || '').trim()

  if (!userEmail || !requestedName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email address and requested category name are required.',
    })
  }

  const req = submitCategoryRequest({
    userEmail,
    requestedName,
    description: parseResult.data.description,
    reason: parseResult.data.reason,
  })

  // Push notification for Admin
  pushAdminNotification({
    type: 'new_category_request',
    title: 'New Category Request',
    message: `User ${userEmail} requested category "${requestedName}" (Total requests: ${req.requestCount}).`,
    metadata: { requestId: req.id, requestedName },
  })

  // Track event
  logAnalyticsEvent({
    email: userEmail,
    eventName: 'category_requested',
    metadata: { requestedName },
  })

  return {
    success: true,
    message: 'Your category request has been submitted to the Wello curation team. Thank you!',
    request: req,
  }
})

