// backend/api/store/addons/deactivate.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../../utils/authGuard'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'
import { deactivateAddonForUser, hasAddon } from '../../../utils/addonService'
import { getDb } from '../../../utils/authService'
import { logAnalyticsEvent } from '../../../utils/analyticsService'
import { recordAuditLog } from '../../../utils/auditStore'

const deactivateSchema = z.object({
  addonId: z.union([z.string(), z.number()]).optional(),
  addonKey: z.string().optional(),
  key: z.string().optional(),
  slug: z.string().optional(),
  force: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))
  const parsed = deactivateSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { addonId, addonKey, key, slug } = parsed.data
  const db = getDb()

  const targetIdentifier = addonKey || key || slug || (addonId !== undefined && addonId !== '' ? String(addonId) : '')
  if (!targetIdentifier) {
    return sendError(event, 400, 'MISSING_ADDON_IDENTIFIER', 'addonKey, key, slug, or addonId is required.')
  }

  const addon = await db('addons')
    .where({ id: !isNaN(Number(targetIdentifier)) ? Number(targetIdentifier) : -1 })
    .orWhere({ key: targetIdentifier })
    .orWhere({ slug: targetIdentifier })
    .first()

  if (!addon) {
    return sendError(event, 404, 'ADDON_NOT_FOUND', `Addon '${targetIdentifier}' not found in catalog.`)
  }

  const resolvedKey = addon.key || addon.slug
  const isCurrentlyActive = await hasAddon(user, resolvedKey)
  if (!isCurrentlyActive) {
    return sendSuccess(event, {
      message: `Addon '${addon.name}' is already deactivated.`,
      addonKey: resolvedKey,
      isActivated: false,
    })
  }

  const res = await deactivateAddonForUser(user.id, resolvedKey, 'store')

  // Emit event & record audit log
  await logAnalyticsEvent(user.id, 'addon_deactivated', {
    addon_key: resolvedKey,
    addon_name: addon.name,
    source: 'store',
  })

  await recordAuditLog({
    action: 'addon_deactivated',
    actorType: 'user',
    actorId: user.id,
    targetType: 'addon',
    targetId: String(addon.id),
    details: { addonKey: resolvedKey, name: addon.name },
  }).catch(() => {})

  return sendSuccess(event, {
    message: `The ${addon.name} addon has been deactivated. Your data is preserved and will be restored when reactivated.`,
    addonKey: resolvedKey,
    isActivated: false,
    dependentsWarned: res.dependentsWarned || [],
    userAddon: {
      status: 'DISABLED',
      addonId: addon.id,
    },
  })
})
