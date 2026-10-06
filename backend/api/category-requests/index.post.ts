// server/api/category-requests/index.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { submitCategoryRequest } from '../../utils/categoryStore'
import { pushAdminNotification } from '../../utils/auditStore'
import { logAnalyticsEvent } from '../../utils/analyticsEngine'
import { requireRateLimit } from '../../utils/rateLimiter'

const categoryRequestSchema = z.object({
  userEmail: z.string().email('Please enter a valid email address.').max(255).optional(),
  email: z.string().email('Please enter a valid email address.').max(255).optional(),
  requestedName: z.string().min(2, 'Category name must be at least 2 characters.').max(100, 'Category name cannot exceed 100 characters.').optional(),
  name: z.string().min(2, 'Category name must be at least 2 characters.').max(100, 'Category name cannot exceed 100 characters.').optional(),
  description: z.string().max(500, 'Description cannot exceed 500 characters.').optional(),
  reason: z.string().max(500, 'Reason cannot exceed 500 characters.').optional(),
  // Honeypot fields (must be empty)
  website: z.string().optional(),
  hp_field: z.string().optional(),
  company_url: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  // 1. Rate limiting: 5 requests per hour per IP
  await requireRateLimit(event, {
    keyPrefix: 'category_request_public',
    limit: 5,
    windowSeconds: 3600,
    keyByIpOnly: true,
    customErrorMessage: 'Too many category requests from this network. Maximum 5 submissions per hour allowed.',
  })

  const body = await readBody(event)
  const parseResult = categoryRequestSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors[0]?.message || 'Invalid request data.',
    })
  }

  // 2. Honeypot check for automated bot spam
  if (parseResult.data.website || parseResult.data.hp_field || parseResult.data.company_url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid submission parameters detected.',
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


