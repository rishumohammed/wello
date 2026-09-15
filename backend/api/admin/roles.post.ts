// server/api/admin/roles.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { updateAdminRole, createAdminUser, AdminRoleKey } from '../../utils/adminStore'
import { recordAuditLog } from '../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const action = body?.action || 'UPDATE_ROLE'
  const adminEmail = body?.adminEmail || 'admin@wello.com'

  if (action === 'CREATE_ADMIN') {
    if (!body?.email || !body?.name) {
      throw createError({ statusCode: 400, statusMessage: 'Email and name are required.' })
    }
    const newAdmin = createAdminUser({
      name: body.name,
      email: body.email,
      roleKey: (body.roleKey || 'ADMIN') as AdminRoleKey,
    })

    recordAuditLog({
      adminEmail,
      action: 'ADMIN_CREATED',
      module: 'Security',
      target: newAdmin.email,
      newValue: `Role: ${newAdmin.roleKey}`,
    })

    return { success: true, message: `Granted ${newAdmin.email} ${newAdmin.roleKey} access.`, admin: newAdmin }
  }

  if (action === 'UPDATE_ROLE') {
    if (!body?.targetEmail || !body?.roleKey) {
      throw createError({ statusCode: 400, statusMessage: 'Target email and roleKey are required.' })
    }
    const updated = updateAdminRole(body.targetEmail, body.roleKey as AdminRoleKey)
    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Admin user record not found.' })
    }

    recordAuditLog({
      adminEmail,
      action: 'ADMIN_ROLE_UPDATED',
      module: 'Security',
      target: updated.email,
      newValue: `New Role: ${updated.roleKey}`,
    })

    return { success: true, message: `Updated ${updated.email} role to ${updated.roleKey}.`, admin: updated }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid admin role action.' })
})
