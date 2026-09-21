// backend/api/store/addons/activate.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../../utils/authGuard'
import { sendError, formatZodError } from '../../../utils/apiResponse'
import { activateAddonForUser, deactivateAddonForUser, hasAddon } from '../../../utils/addonService'
import { getDb } from '../../../utils/authService'
import { logAnalyticsEvent } from '../../../utils/analyticsService'

const activateSchema = z.object({
  addonId: z.union([z.string(), z.number()]).optional(),
  addonKey: z.string().optional(),
  key: z.string().optional(),
  slug: z.string().optional(),
  action: z.enum(['activate', 'deactivate', 'toggle']).optional().default('toggle'),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))
  const parsed = activateSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { addonId, addonKey, key, slug, action } = parsed.data
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

  const currentActive = await hasAddon(user, addon.key || addon.slug)
  let targetAction = action
  if (targetAction === 'toggle') {
    targetAction = currentActive ? 'deactivate' : 'activate'
  }

  if (targetAction === 'activate') {
    const res = await activateAddonForUser(user.id, addon.key || addon.slug, 'store')
    const message = `The free ${addon.name} addon has been activated successfully.`

    await logAnalyticsEvent(user.id, 'addon_activated', {
      addon_key: addon.key || addon.slug,
      addon_name: addon.name,
      source: 'store',
    })

    return {
      success: true,
      message,
      data: {
        message,
        addonKey: addon.key || addon.slug,
        isActivated: true,
        activatedKeys: res.activatedKeys,
      },
      userAddon: {
        status: 'ACTIVATED',
        addonId: addon.id,
      },
    }
  } else {
    const res = await deactivateAddonForUser(user.id, addon.key || addon.slug, 'store')
    const message = `The ${addon.name} addon has been deactivated. Your data is preserved and will be restored when reactivated.`

    await logAnalyticsEvent(user.id, 'addon_deactivated', {
      addon_key: addon.key || addon.slug,
      addon_name: addon.name,
      source: 'store',
    })

    return {
      success: true,
      message,
      data: {
        message,
        addonKey: addon.key || addon.slug,
        isActivated: false,
        dependentsWarned: res.dependentsWarned,
      },
      userAddon: {
        status: 'DISABLED',
        addonId: addon.id,
      },
    }
  }
})
