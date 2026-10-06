// backend/api/invoices/recurring/[id].delete.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireAddon } from '../../../utils/addonService'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError } from '../../../utils/apiResponse'
import { recordAuditLog } from '../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'recurring-retainers')
  const profileId = getRouterParam(event, 'id')
  const db = getDb()

  const profile = await db('recurring_invoice_profiles')
    .where({ id: profileId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!profile) {
    return sendError(event, 404, 'RECURRING_PROFILE_NOT_FOUND', `Recurring invoice profile #${profileId} not found.`)
  }

  // Soft delete recurring profile
  await db('recurring_invoice_profiles').where({ id: profile.id }).update({
    deleted_at: new Date(),
    is_active: false,
    updated_at: new Date(),
  })

  await recordAuditLog({
    action: 'recurring_profile_deleted',
    actorType: 'user',
    actorId: user.id,
    targetType: 'recurring_invoice_profile',
    targetId: String(profile.id),
    details: { profileName: profile.profile_name },
  }).catch(() => {})

  return sendSuccess(event, {
    message: `Recurring invoice profile "${profile.profile_name}" has been cancelled. Existing invoices remain intact.`,
    id: profile.id,
  })
})
