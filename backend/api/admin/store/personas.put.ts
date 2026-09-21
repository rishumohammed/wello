// backend/api/admin/store/personas.put.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'
import { recordAuditLog } from '../../../utils/auditStore'

const updatePersonaSchema = z.object({
  persona: z.string().min(1),
  defaultAddonKeys: z.array(z.string()),
})

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'store.manage')
  const body = await readBody(event).catch(() => ({}))
  const parsed = updatePersonaSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { persona, defaultAddonKeys } = parsed.data
  const db = getDb()
  const now = new Date()

  const existing = await db('addon_persona_defaults').where({ persona }).first()
  if (existing) {
    await db('addon_persona_defaults').where({ persona }).update({
      default_addon_keys: JSON.stringify(defaultAddonKeys),
      updated_at: now,
    })
  } else {
    await db('addon_persona_defaults').insert({
      persona,
      default_addon_keys: JSON.stringify(defaultAddonKeys),
      created_at: now,
      updated_at: now,
    })
  }

  recordAuditLog({
    adminEmail: admin.email,
    action: 'PERSONA_DEFAULTS_UPDATED',
    module: 'Wello Store',
    target: `Persona: ${persona}`,
    newValue: JSON.stringify(defaultAddonKeys),
  })

  return sendSuccess(event, {
    message: `Default addons for persona '${persona}' updated successfully.`,
    persona,
    defaultAddonKeys,
  })
})
