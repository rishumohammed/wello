// server/api/admin/categories.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { createCategory, updateCategory, toggleCategoryStatus } from '../../utils/categoryStore'
import { recordAuditLog } from '../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'categories.manage')
  const body = await readBody(event)
  const action = body?.action || 'CREATE'

  if (action === 'CREATE') {
    if (!body?.name) {
      throw createError({ statusCode: 400, statusMessage: 'Category name is required.' })
    }
    const created = createCategory({
      parentId: body.parentId,
      name: body.name,
      description: body.description,
      icon: body.icon,
    })

    recordAuditLog({
      adminEmail: admin.email,
      action: 'CATEGORY_CREATED',
      module: 'Categories',
      target: created.name,
      newValue: JSON.stringify(created),
    })

    return { success: true, message: `Created category ${created.name}`, category: created }
  }

  if (action === 'UPDATE') {
    if (!body?.id) throw createError({ statusCode: 400, statusMessage: 'Category ID required.' })
    const updated = updateCategory(body.id, body.updates || {})
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Category not found.' })

    recordAuditLog({
      adminEmail: admin.email,
      action: 'CATEGORY_UPDATED',
      module: 'Categories',
      target: updated.name,
      newValue: JSON.stringify(updated),
    })

    return { success: true, message: `Updated category ${updated.name}`, category: updated }
  }

  if (action === 'TOGGLE_STATUS') {
    if (!body?.id) throw createError({ statusCode: 400, statusMessage: 'Category ID required.' })
    const toggled = toggleCategoryStatus(body.id)
    if (!toggled) throw createError({ statusCode: 404, statusMessage: 'Category not found.' })

    recordAuditLog({
      adminEmail: admin.email,
      action: toggled.isActive ? 'CATEGORY_ENABLED' : 'CATEGORY_DISABLED',
      module: 'Categories',
      target: toggled.name,
      newValue: `isActive: ${toggled.isActive}`,
    })

    return { success: true, message: `Category ${toggled.name} is now ${toggled.isActive ? 'active' : 'disabled'}.`, category: toggled }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid category action.' })
})
