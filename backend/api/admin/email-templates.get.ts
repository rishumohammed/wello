// server/api/admin/email-templates.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getAllEmailTemplates } from '../../utils/emailEngine'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'email.manage')
  const templates = getAllEmailTemplates()
  return {
    success: true,
    templates,
  }
})
