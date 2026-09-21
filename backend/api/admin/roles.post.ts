// server/api/admin/roles.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { revokeAllSessionsForUser } from '../../utils/authService'
import { recordAuditLog } from '../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'admins.manage')
  const body = await readBody(event)
  const action = body?.action || 'UPDATE_ROLE'
  const db = getDb()

  if (action === 'CREATE_ADMIN') {
    const email = (body?.email || '').trim().toLowerCase()
    const name = (body?.name || '').trim()
    const roleKey = (body?.roleKey || 'ADMIN').trim().toUpperCase()

    if (!email || !name) {
      throw createError({ statusCode: 400, statusMessage: 'Email and name are required.' })
    }

    // Verify valid role in database
    const roleExists = await db('admin_roles').where({ role_key: roleKey }).first()
    if (!roleExists) {
      throw createError({ statusCode: 400, statusMessage: `Role ${roleKey} does not exist.` })
    }

    // Look up or create user
    let user = await db('users').where({ email }).whereNull('deleted_at').first()
    if (!user) {
      const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) || 'AD'
      const [newUserId] = await db('users').insert({
        name,
        email,
        avatar_initials: initials,
        target_hourly: 500.0000,
        base_currency: 'USD',
        timezone: 'UTC',
        country: 'US',
        role: 'admin',
        status: 'ACTIVE',
        created_at: db.fn.now(3),
        updated_at: db.fn.now(3),
      })
      user = await db('users').where({ id: newUserId }).first()
    } else {
      await db('users').where({ id: user.id }).update({ role: 'admin', updated_at: db.fn.now(3) })
    }

    // Insert or update in admin_users
    const existingAdmin = await db('admin_users').where({ user_id: user.id }).first()
    if (existingAdmin) {
      await db('admin_users').where({ id: existingAdmin.id }).update({
        role_key: roleKey,
        is_active: true,
      })
    } else {
      await db('admin_users').insert({
        user_id: user.id,
        email: user.email,
        role_key: roleKey,
        is_active: true,
        created_at: db.fn.now(3),
      })
    }

    recordAuditLog({
      adminEmail: admin.email,
      action: 'ADMIN_CREATED',
      module: 'Security',
      target: user.email,
      newValue: `Role: ${roleKey}`,
    })

    return {
      success: true,
      message: `Granted ${user.email} ${roleKey} access.`,
      admin: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleKey,
        isActive: true,
      },
    }
  }

  if (action === 'UPDATE_ROLE') {
    const targetEmail = (body?.targetEmail || '').trim().toLowerCase()
    const targetUserId = body?.targetUserId ? Number(body.targetUserId) : null
    const newRoleKey = (body?.roleKey || '').trim().toUpperCase()

    if ((!targetEmail && !targetUserId) || !newRoleKey) {
      throw createError({ statusCode: 400, statusMessage: 'Target user identifier and roleKey are required.' })
    }

    const roleExists = await db('admin_roles').where({ role_key: newRoleKey }).first()
    if (!roleExists) {
      throw createError({ statusCode: 400, statusMessage: `Role ${newRoleKey} does not exist.` })
    }

    let userQuery = db('users').whereNull('deleted_at')
    if (targetUserId) {
      userQuery = userQuery.where('id', targetUserId)
    } else {
      userQuery = userQuery.where('email', targetEmail)
    }

    const targetUser = await userQuery.first()
    if (!targetUser) {
      throw createError({ statusCode: 404, statusMessage: 'User account not found.' })
    }

    // 1. Self-demotion check: admin cannot change or demote their own role
    if (Number(targetUser.id) === Number(admin.id) && newRoleKey !== admin.adminRole) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Security Policy Violation: You cannot change or demote your own administrator role.',
      })
    }

    // 2. Last SUPER_ADMIN check: prevent removing the last SUPER_ADMIN
    const adminRecord = await db('admin_users').where({ user_id: targetUser.id, is_active: true }).first()
    if (adminRecord && adminRecord.role_key === 'SUPER_ADMIN' && newRoleKey !== 'SUPER_ADMIN') {
      const [{ count }] = await db('admin_users')
        .where({ role_key: 'SUPER_ADMIN', is_active: true })
        .whereNot('user_id', targetUser.id)
        .count('id as count')

      if (Number(count) === 0) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Security Policy Violation: Cannot demote the last active SUPER_ADMIN.',
        })
      }
    }

    if (adminRecord) {
      await db('admin_users').where({ id: adminRecord.id }).update({
        role_key: newRoleKey,
      })
    } else {
      await db('admin_users').insert({
        user_id: targetUser.id,
        email: targetUser.email,
        role_key: newRoleKey,
        is_active: true,
        created_at: db.fn.now(3),
      })
    }

    // Ensure users table role is set to 'admin'
    await db('users').where({ id: targetUser.id }).update({ role: 'admin', updated_at: db.fn.now(3) })

    // Invalidate target user's sessions to enforce role reload on subsequent requests
    await revokeAllSessionsForUser(targetUser.id)

    recordAuditLog({
      adminEmail: admin.email,
      action: 'ADMIN_ROLE_UPDATED',
      module: 'Security',
      target: targetUser.email,
      prevValue: adminRecord?.role_key || 'None',
      newValue: newRoleKey,
    })

    return {
      success: true,
      message: `Updated ${targetUser.email} role to ${newRoleKey}.`,
      admin: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        roleKey: newRoleKey,
      },
    }
  }

  throw createError({ statusCode: 400, statusMessage: 'Invalid admin role action.' })
})
