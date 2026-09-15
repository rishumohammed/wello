// server/api/admin/category-requests.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { processCategoryRequest } from '../../utils/categoryStore'
import { recordAuditLog } from '../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const requestId = body?.requestId
  const action = body?.action // 'APPROVE' | 'REJECT' | 'MERGE' | 'UNDER_REVIEW'
  const adminEmail = body?.adminEmail || 'admin@wello.com'
  const adminNotes = body?.adminNotes

  if (!requestId || !action) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Request ID and action are required.',
    })
  }

  const result = processCategoryRequest({
    requestId,
    action,
    adminEmail,
    adminNotes,
    targetCategoryId: body?.targetCategoryId,
  })

  // Record Audit Log
  recordAuditLog({
    adminEmail,
    action: `CATEGORY_REQUEST_${action}`,
    module: 'Categories',
    target: result.request.requestedName,
    newValue: `Status: ${result.request.status}${result.createdCategory ? ' (New Category ID: ' + result.createdCategory.id + ')' : ''}`,
  })

  return {
    success: true,
    message: `Category request ${action.toLowerCase()} successfully.`,
    request: result.request,
    createdCategory: result.createdCategory,
  }
})
