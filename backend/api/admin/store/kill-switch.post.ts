// backend/api/admin/store/kill-switch.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'
import { recordAuditLog } from '../../../utils/auditStore'

const killSwitchSchema = z.object({
  addonKey: z.string().min(1),
  isKilled: z.boolean(),
  incidentReason: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'store.manage')
  const body = await readBody(event).catch(() => ({}))
  const parsed = killSwitchSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { addonKey, isKilled, incidentReason } = parsed.data
  const db = getDb()
  const now = new Date()

  const addon = await db('addons')
    .where({ key: addonKey })
    .orWhere({ slug: addonKey })
    .first()

  if (!addon) {
    return sendError(event, 404, 'ADDON_NOT_FOUND', `Addon '${addonKey}' not found.`)
  }

  await db('addons')
    .where({ id: addon.id })
    .update({
      is_killed: isKilled,
      updated_at: now,
    })

  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: isKilled ? 'INCIDENT_KILL_SWITCH_ENGAGED' : 'INCIDENT_KILL_SWITCH_RELEASED',
    module: 'Store',
    permissionUsed: 'store.manage',
    target: `Addon: ${addon.name} (${addonKey})`,
    reason: incidentReason || (isKilled ? 'Emergency kill-switch engaged' : 'Kill-switch released'),
    ipAddress: extractClientIp(event),
    prevValue: `is_killed: ${Boolean(addon.is_killed)}`,
    newValue: `is_killed: ${isKilled}. Reason: ${incidentReason || 'Admin override'}`,
  })

  return sendSuccess(event, {
    message: `Kill switch for '${addon.name}' is now ${isKilled ? 'ENGAGED' : 'RELEASED'}.`,
    addonKey: addon.key || addon.slug,
    isKilled,
  })
})
