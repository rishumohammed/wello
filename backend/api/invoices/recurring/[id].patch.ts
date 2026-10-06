// backend/api/invoices/recurring/[id].patch.ts
import { defineEventHandler, readBody, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireAddon } from '../../../utils/addonService'
import { getDb } from '../../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'
import { recordAuditLog } from '../../../utils/auditStore'

const updateRecurringSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  profileName: z.string().min(1).max(150).optional(),
  name: z.string().min(1).max(150).optional(),
  clientId: z.number().int().positive().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'yearly', 'custom_days']).optional(),
  total: z.number().positive().optional(),
  amount: z.number().positive().optional(),
  subtotal: z.number().min(0).optional(),
  taxAmount: z.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  nextIssueDate: z.string().optional(),
  autoSend: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

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

  const body = await readBody(event).catch(() => ({}))
  const parsed = updateRecurringSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const updates: Record<string, any> = {
    updated_at: new Date(),
  }

  if (data.title || data.profileName || data.name) updates.title = data.title || data.profileName || data.name
  if (data.clientId !== undefined) updates.client_id = data.clientId
  if (data.projectId !== undefined) updates.project_id = data.projectId
  if (data.frequency !== undefined) updates.frequency = data.frequency === 'yearly' ? 'annual' : data.frequency
  if (data.total !== undefined || data.amount !== undefined) {
    const tot = data.total !== undefined ? data.total : data.amount
    updates.total = tot
    if (data.subtotal === undefined) updates.subtotal = tot
  }
  if (data.subtotal !== undefined) updates.subtotal = data.subtotal
  if (data.taxAmount !== undefined) updates.tax_amount = data.taxAmount
  if (data.currency !== undefined) updates.currency = data.currency.toUpperCase()
  if (data.nextIssueDate !== undefined) updates.next_issue_date = new Date(data.nextIssueDate)
  if (data.autoSend !== undefined) updates.auto_send = Boolean(data.autoSend)
  if (data.isActive !== undefined) updates.is_active = Boolean(data.isActive)

  await db('recurring_invoice_profiles').where({ id: profile.id }).update(updates)

  await recordAuditLog({
    action: 'recurring_profile_updated',
    actorType: 'user',
    actorId: user.id,
    targetType: 'recurring_invoice_profile',
    targetId: String(profile.id),
    details: { profileId: profile.id, updates },
  }).catch(() => {})

  const updated = await db('recurring_invoice_profiles').where({ id: profile.id }).first()

  return sendSuccess(event, {
    profile: updated,
    message: 'Recurring profile updated successfully. Issued invoices remain unaffected.',
  })
})
