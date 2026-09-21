// server/api/admin/email-templates.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { updateEmailTemplate } from '../../utils/emailEngine'
import { recordAuditLog } from '../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'email.manage')
  const body = await readBody(event)
  const key = body?.key
  const subject = body?.subject
  const bodyHtml = body?.bodyHtml
  const isActive = body?.isActive

  if (!key) {
    throw createError({ statusCode: 400, statusMessage: 'Template key required.' })
  }

  const updated = updateEmailTemplate(key, { subject, bodyHtml, isActive })
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Email template not found.' })
  }

  recordAuditLog({
    adminEmail: admin.email,
    action: 'EMAIL_TEMPLATE_UPDATED',
    module: 'Communications',
    target: updated.name,
    newValue: `Subject: ${updated.subject}`,
  })

  return {
    success: true,
    message: `Updated template ${updated.name}`,
    template: updated,
  }
})
