// backend/api/admin/store/personas.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess } from '../../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.manage')
  const db = getDb()

  const rows = await db('addon_persona_defaults').select('*').orderBy('persona', 'asc')
  const defaults = rows.map((r: any) => ({
    id: r.id,
    persona: r.persona,
    defaultAddonKeys: typeof r.default_addon_keys === 'string' ? JSON.parse(r.default_addon_keys) : r.default_addon_keys,
    updatedAt: r.updated_at,
  }))

  return sendSuccess(event, { personaDefaults: defaults })
})
