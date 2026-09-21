// backend/api/admin/store/user-addons.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError } from '../../../utils/apiResponse'
import { hasAddon } from '../../../utils/addonService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.manage')
  const query = getQuery(event)
  const db = getDb()

  const userId = query.userId ? Number(query.userId) : null
  if (!userId) {
    return sendError(event, 400, 'MISSING_USER_ID', 'userId query parameter is required.')
  }

  const targetUser = await db('users').where({ id: userId }).first()
  if (!targetUser) {
    return sendError(event, 404, 'USER_NOT_FOUND', 'Target user not found.')
  }

  const allAddons = await db('addons').orderBy('sort_order', 'asc')
  const userAddons = await db('user_addons').where({ user_id: userId })
  const userAddonMap = new Map(userAddons.map((ua: any) => [ua.addon_id, ua]))

  const addonsList = await Promise.all(allAddons.map(async (a: any) => {
    const userEntitlement = userAddonMap.get(a.id)
    const active = await hasAddon(targetUser, a.key || a.slug)
    let dependsOn: string[] = []
    if (a.depends_on) {
      dependsOn = typeof a.depends_on === 'string' ? JSON.parse(a.depends_on) : a.depends_on
    }

    return {
      id: a.id,
      key: a.key || a.slug,
      slug: a.slug || a.key,
      name: a.name,
      category: a.category,
      icon: a.icon,
      status: a.status,
      isFree: true,
      defaultEnabled: Boolean(a.default_enabled),
      dependsOn,
      isKilled: Boolean(a.is_killed),
      isActivated: active,
      activatedAt: userEntitlement?.activated_at || null,
      deactivatedAt: userEntitlement?.deactivated_at || null,
    }
  }))

  return sendSuccess(event, {
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      earningPersona: targetUser.earning_persona,
    },
    addons: addonsList,
  })
})
