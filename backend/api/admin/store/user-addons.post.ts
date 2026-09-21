// backend/api/admin/store/user-addons.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requirePermission } from '../../../utils/authGuard'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'
import { activateAddonForUser, deactivateAddonForUser, hasAddon } from '../../../utils/addonService'
import { recordAuditLog } from '../../../utils/auditStore'

const adminUserAddonSchema = z.object({
  userId: z.number().int().positive(),
  addonKey: z.string().min(1),
  action: z.enum(['activate', 'deactivate']),
  reason: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const admin = await requirePermission(event, 'store.manage')
  const body = await readBody(event).catch(() => ({}))
  const parsed = adminUserAddonSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { userId, addonKey, action, reason } = parsed.data
  const db = getDb()

  const targetUser = await db('users').where({ id: userId }).first()
  if (!targetUser) {
    return sendError(event, 404, 'USER_NOT_FOUND', 'Target user not found.')
  }

  if (action === 'activate') {
    const res = await activateAddonForUser(userId, addonKey, 'admin')
    recordAuditLog({
      adminEmail: admin.email,
      action: 'ADMIN_USER_ADDON_ACTIVATED',
      module: 'Wello Store',
      target: `User #${userId} (${targetUser.email})`,
      newValue: `Activated addon: ${addonKey}. Reason: ${reason || 'Admin action'}`,
    })

    return sendSuccess(event, {
      message: `Addon '${addonKey}' successfully activated for ${targetUser.email}.`,
      isActivated: true,
      activatedKeys: res.activatedKeys,
    })
  } else {
    const res = await deactivateAddonForUser(userId, addonKey, 'admin')
    recordAuditLog({
      adminEmail: admin.email,
      action: 'ADMIN_USER_ADDON_DEACTIVATED',
      module: 'Wello Store',
      target: `User #${userId} (${targetUser.email})`,
      newValue: `Deactivated addon: ${addonKey}. Reason: ${reason || 'Admin action'}`,
    })

    return sendSuccess(event, {
      message: `Addon '${addonKey}' successfully deactivated for ${targetUser.email}. (Data preserved)`,
      isActivated: false,
      dependentsWarned: res.dependentsWarned,
    })
  }
})
