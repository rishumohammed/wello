// backend/api/income-sources/[id].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const updateIncomeSourceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['project', 'salary', 'hourly_wage', 'daily_wage', 'retainer', 'gig', 'other']).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  payFrequency: z.enum(['hourly', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'per_job', 'one_off']).optional(),
  expectedAmount: z.number().min(0).max(999999999).nullable().optional(),
  expectedHoursPerPeriod: z.number().min(0).max(9999).nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid income source ID')
  }

  const body = await readBody(event)
  const parsed = updateIncomeSourceSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  const existing = await db('income_sources')
    .where({ id, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'NOT_FOUND', 'Income source not found')
  }

  const updates: Record<string, any> = {
    updated_at: new Date(),
  }

  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.type !== undefined) updates.type = data.type
  if (data.currency !== undefined) updates.currency = data.currency
  if (data.payFrequency !== undefined) {
    updates.pay_frequency = data.payFrequency
    updates.frequency = data.payFrequency
  }
  if (data.expectedAmount !== undefined) updates.expected_amount = data.expectedAmount
  if (data.expectedHoursPerPeriod !== undefined) updates.expected_hours_per_period = data.expectedHoursPerPeriod
  if (data.isActive !== undefined) updates.is_active = data.isActive
  if (data.notes !== undefined) updates.notes = data.notes ? data.notes.trim() : null

  await db('income_sources').where({ id }).update(updates)

  const updated = await db('income_sources').where({ id }).first()
  return sendSuccess(event, {
    id: updated.id,
    userId: updated.user_id,
    type: updated.type,
    name: updated.name,
    currency: updated.currency,
    payFrequency: updated.pay_frequency || updated.frequency,
    expectedAmount: updated.expected_amount !== null ? Number(updated.expected_amount) : null,
    expectedHoursPerPeriod: updated.expected_hours_per_period !== null ? Number(updated.expected_hours_per_period) : null,
    isActive: Boolean(updated.is_active),
    notes: updated.notes,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  })
})
