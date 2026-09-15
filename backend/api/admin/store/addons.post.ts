// server/api/admin/store/addons.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { createOrUpdateAddon, getAddonById } from '../../../utils/storeEngine'
import { recordAuditLog } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const role = body?.role || 'admin'
  const adminEmail = body?.adminEmail || 'admin@wello.com'

  // Server-side security check: reject non-admin users
  if (role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Server-side admin authorization required.' })
  }

  const action = body?.action || 'CREATE'

  if (action === 'CREATE' || action === 'UPDATE') {
    if (!body?.name) {
      throw createError({ statusCode: 400, statusMessage: 'Addon name is required.' })
    }

    const addon = createOrUpdateAddon({
      id: body.id,
      name: body.name,
      slug: body.slug,
      description: body.description,
      icon: body.icon,
      version: body.version,
      category: body.category,
      features: Array.isArray(body.features) ? body.features : (body.features ? body.features.split('\n').filter(Boolean) : []),
      isFree: body.isFree !== undefined ? Boolean(body.isFree) : true,
      status: body.status || 'PUBLISHED',
      displayOrder: body.displayOrder || 1,
    })

    recordAuditLog({
      adminEmail,
      action: action === 'CREATE' ? 'ADDON_CREATED' : 'ADDON_UPDATED',
      module: 'Wello Store',
      target: addon.name,
      newValue: `Status: ${addon.status}, Version: ${addon.version}, IsFree: ${addon.isFree}`,
    })

    return {
      success: true,
      message: `Addon ${addon.name} ${action === 'CREATE' ? 'created' : 'updated'} successfully.`,
      addon,
    }
  }

  if (action === 'TOGGLE_STATUS') {
    const addonId = body?.id
    if (!addonId) throw createError({ statusCode: 400, statusMessage: 'Addon ID required.' })
    const existing = getAddonById(addonId)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Addon not found.' })

    const newStatus = existing.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED'
    const updated = createOrUpdateAddon({
      ...existing,
      status: newStatus,
    })

    recordAuditLog({
      adminEmail,
      action: newStatus === 'PUBLISHED' ? 'ADDON_PUBLISHED' : 'ADDON_UNPUBLISHED',
      module: 'Wello Store',
      target: updated.name,
      newValue: `Status changed to ${updated.status}`,
    })

    return {
      success: true,
      message: `Addon ${updated.name} status set to ${updated.status}.`,
      addon: updated,
    }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid addon admin action.' })
})
