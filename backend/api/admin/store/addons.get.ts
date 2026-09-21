// backend/api/admin/store/addons.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess } from '../../../utils/apiResponse'
import { getStoreAnalytics } from '../../../utils/storeEngine'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'store.manage')
  const db = getDb()

  const addons = await db('addons').orderBy('sort_order', 'asc')
  const analytics = getStoreAnalytics()

  // Calculate real DB adoption stats
  const userAddonCounts = await db('user_addons')
    .select('addon_id')
    .count('id as total_users')
    .sum({ active_users: db.raw('CASE WHEN deactivated_at IS NULL AND status = "ACTIVATED" THEN 1 ELSE 0 END') })
    .groupBy('addon_id')

  const statsMap: Record<string, { totalUsers: number, activeUsers: number, usageCount: number }> = {}
  userAddonCounts.forEach((r: any) => {
    statsMap[String(r.addon_id)] = {
      totalUsers: Number(r.total_users || 0),
      activeUsers: Number(r.active_users || 0),
      usageCount: 0,
    }
  })

  const catalog = addons.map((a: any) => {
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
      stats: statsMap[String(a.id)] || { totalUsers: 0, activeUsers: 0, usageCount: 0 },
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }
  })

  return sendSuccess(event, {
    addons: catalog,
    analytics,
  })
})
