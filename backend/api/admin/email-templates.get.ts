// server/api/admin/email-templates.get.ts
import { defineEventHandler } from 'h3'
import { getAllEmailTemplates } from '../../utils/emailEngine'

export default defineEventHandler(() => {
  const templates = getAllEmailTemplates()
  return {
    success: true,
    templates,
  }
})
