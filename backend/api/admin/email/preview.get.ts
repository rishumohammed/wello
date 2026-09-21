// backend/api/admin/email/preview.get.ts
import { defineEventHandler, getQuery, createError } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { previewEmailTemplate } from '../../../utils/emailEngine'

export default defineEventHandler(async (event) => {
  // Requires communications management or admin permission
  await requirePermission(event, 'email.manage')

  const query = getQuery(event)
  const templateKey = (query?.key as string || '').trim()

  if (!templateKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template key is required for preview (e.g. ?key=welcome)',
    })
  }

  let customVars: Record<string, string> | undefined
  if (query?.variables && typeof query.variables === 'string') {
    try {
      customVars = JSON.parse(query.variables)
    } catch (e) {
      // ignore
    }
  }

  const preview = previewEmailTemplate(templateKey, customVars)
  if (!preview) {
    throw createError({
      statusCode: 404,
      statusMessage: `Email template '${templateKey}' not found.`,
    })
  }

  return {
    success: true,
    templateKey,
    preview,
  }
})
