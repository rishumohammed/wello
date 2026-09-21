// backend/api/admin/store/addons.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'
import { recordAuditLog } from '../../../utils/auditStore'

const addonAdminSchema = z.object({
  action: z.enum(['CREATE', 'UPDATE', 'TOGGLE_STATUS', 'TOGGLE_KILL_SWITCH', 'REORDER', 'DELETE']).optional().default('CREATE'),
  id: z.union([z.string(), z.number()]).optional(),
  key: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().optional(),
  version: z.string().optional(),
  status: z.enum(['active', 'beta', 'deprecated', 'published', 'draft', 'archived', 'ACTIVE', 'BETA', 'DEPRECATED', 'PUBLISHED', 'DRAFT', 'ARCHIVED']).optional(),
  defaultEnabled: z.boolean().optional(),
  dependsOn: z.array(z.string()).optional(),
  sortOrder: z.number().optional(),
  isKilled: z.boolean().optional(),
  orderList: z.array(z.object({ id: z.union([z.string(), z.number()]), sortOrder: z.number() })).optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'store.manage')
  const body = await readBody(event).catch(() => ({}))
  const parsed = addonAdminSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()

  // 1. REORDER
  if (data.action === 'REORDER' && data.orderList) {
    await db.transaction(async (trx) => {
      for (const item of data.orderList || []) {
        await trx('addons').where({ id: item.id }).update({ sort_order: item.sortOrder, updated_at: now })
      }
    })
    return sendSuccess(event, { message: 'Addons reordered successfully.' })
  }

  // 2. TOGGLE KILL SWITCH
  if (data.action === 'TOGGLE_KILL_SWITCH' && data.id) {
    const existing = await db('addons').where({ id: data.id }).first()
    if (!existing) return sendError(event, 404, 'ADDON_NOT_FOUND', 'Addon not found.')

    const newKilled = data.isKilled !== undefined ? Boolean(data.isKilled) : !existing.is_killed
    await db('addons').where({ id: data.id }).update({ is_killed: newKilled, updated_at: now })

    recordAuditLog({
      adminEmail: admin.email,
      action: newKilled ? 'ADDON_KILL_SWITCH_ENGAGED' : 'ADDON_KILL_SWITCH_RELEASED',
      module: 'Wello Store',
      target: existing.name,
      newValue: `is_killed: ${newKilled}`,
    })

    return sendSuccess(event, {
      message: `Kill-switch for ${existing.name} is now ${newKilled ? 'ENGAGED (addon disabled for all users)' : 'RELEASED (addon enabled)'}.`,
      isKilled: newKilled,
    })
  }

  // 3. TOGGLE STATUS
  if (data.action === 'TOGGLE_STATUS' && data.id) {
    const existing = await db('addons').where({ id: data.id }).first()
    if (!existing) return sendError(event, 404, 'ADDON_NOT_FOUND', 'Addon not found.')

    const nextStatus = existing.status === 'PUBLISHED' || existing.status === 'active' ? 'deprecated' : 'active'
    await db('addons').where({ id: data.id }).update({ status: nextStatus, updated_at: now })

    recordAuditLog({
      adminEmail: admin.email,
      action: 'ADDON_STATUS_CHANGED',
      module: 'Wello Store',
      target: existing.name,
      newValue: `Status changed to ${nextStatus}`,
    })

    return sendSuccess(event, {
      message: `Addon ${existing.name} status changed to ${nextStatus}.`,
      status: nextStatus,
    })
  }

  // 4. CREATE
  if (data.action === 'CREATE') {
    if (!data.name) return sendError(event, 400, 'MISSING_NAME', 'Addon name is required.')
    const slug = data.key || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    const [newId] = await db('addons').insert({
      key: slug,
      slug,
      name: data.name,
      description: data.description || '',
      category: data.category || 'Utilities',
      icon: data.icon || 'IconPackage',
      version: data.version || '1.0.0',
      status: (data.status || 'active').toLowerCase(),
      is_free: true,
      default_enabled: Boolean(data.defaultEnabled),
      depends_on: JSON.stringify(data.dependsOn || []),
      sort_order: data.sortOrder || 1,
      is_killed: false,
      created_at: now,
      updated_at: now,
    })

    recordAuditLog({
      adminEmail: admin.email,
      action: 'ADDON_CREATED',
      module: 'Wello Store',
      target: data.name,
      newValue: `Key: ${slug}, DefaultEnabled: ${Boolean(data.defaultEnabled)}`,
    })

    const created = await db('addons').where({ id: newId }).first()
    return sendSuccess(event, { message: `Addon ${data.name} created successfully.`, addon: created }, undefined, 201)
  }

  // 5. UPDATE
  if (data.action === 'UPDATE' && data.id) {
    const existing = await db('addons').where({ id: data.id }).first()
    if (!existing) return sendError(event, 404, 'ADDON_NOT_FOUND', 'Addon not found.')

    await db('addons').where({ id: data.id }).update({
      name: data.name !== undefined ? data.name : existing.name,
      description: data.description !== undefined ? data.description : existing.description,
      category: data.category !== undefined ? data.category : existing.category,
      icon: data.icon !== undefined ? data.icon : existing.icon,
      version: data.version !== undefined ? data.version : existing.version,
      status: data.status !== undefined ? data.status.toLowerCase() : existing.status,
      default_enabled: data.defaultEnabled !== undefined ? Boolean(data.defaultEnabled) : existing.default_enabled,
      depends_on: data.dependsOn !== undefined ? JSON.stringify(data.dependsOn) : existing.depends_on,
      sort_order: data.sortOrder !== undefined ? data.sortOrder : existing.sort_order,
      is_killed: data.isKilled !== undefined ? Boolean(data.isKilled) : existing.is_killed,
      updated_at: now,
    })

    recordAuditLog({
      adminEmail: admin.email,
      action: 'ADDON_UPDATED',
      module: 'Wello Store',
      target: existing.name,
      newValue: `Updated addon fields for ${existing.slug}`,
    })

    const updated = await db('addons').where({ id: data.id }).first()
    return sendSuccess(event, { message: `Addon ${updated.name} updated successfully.`, addon: updated })
  }

  // 6. DELETE (Soft deprecate/archive)
  if (data.action === 'DELETE' && data.id) {
    await db('addons').where({ id: data.id }).update({ status: 'archived', updated_at: now })
    return sendSuccess(event, { message: 'Addon archived successfully.' })
  }

  return sendError(event, 400, 'INVALID_ACTION', 'Unrecognized addon management action.')
})
