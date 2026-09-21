// backend/api/store/addons/index.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { recordStoreVisit } from '../../../utils/storeEngine'
import { hasAddon } from '../../../utils/addonService'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()

  // Track store visit
  recordStoreVisit()

  // Query all active/beta/deprecated published addons from DB
  const addons = await db('addons')
    .whereNot({ status: 'ARCHIVED' })
    .orderBy('sort_order', 'asc')

  const userAddons = await db('user_addons')
    .where({ user_id: user.id })

  const userAddonMap = new Map(userAddons.map((ua: any) => [ua.addon_id, ua]))

  const catalog = await Promise.all(addons.map(async (a: any) => {
    const userEntitlement = userAddonMap.get(a.id)
    const active = await hasAddon(user, a.key || a.slug)
    let dependsOn: string[] = []
    if (a.depends_on) {
      dependsOn = typeof a.depends_on === 'string' ? JSON.parse(a.depends_on) : a.depends_on
    }

    return {
      id: a.id,
      key: a.key || a.slug,
      slug: a.slug || a.key,
      name: a.name,
      description: a.description || '',
      category: a.category || 'Utilities',
      icon: a.icon || 'IconPackage',
      version: a.version || '1.0.0',
      status: a.status ? a.status.toLowerCase() : 'active',
      isFree: true,
      defaultEnabled: Boolean(a.default_enabled),
      dependsOn,
      sortOrder: Number(a.sort_order || 0),
      isKilled: Boolean(a.is_killed),
      isActivated: active,
      activatedAt: userEntitlement?.activated_at || null,
      deactivatedAt: userEntitlement?.deactivated_at || null,
    }
  }))

  return {
    success: true,
    data: {
      addons: catalog,
    },
    addons: catalog,
  }
})
