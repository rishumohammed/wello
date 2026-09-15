// server/api/category-requests/index.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { submitCategoryRequest } from '../../utils/categoryStore'
import { pushAdminNotification } from '../../utils/auditStore'
import { logAnalyticsEvent } from '../../utils/analyticsEngine'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userEmail = (body?.userEmail || body?.email || '').trim().toLowerCase()
  const requestedName = (body?.requestedName || body?.name || '').trim()
  const description = body?.description
  const reason = body?.reason

  if (!userEmail || !requestedName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Email address and requested category name are required.',
    })
  }

  const req = submitCategoryRequest({
    userEmail,
    requestedName,
    description,
    reason,
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
