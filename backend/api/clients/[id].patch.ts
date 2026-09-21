// backend/api/clients/[id].patch.ts
import { defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb, normalizeIdentifier } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const updateClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200).optional(),
  email: z.string().email().max(255).nullable().optional().or(z.literal('')),
  phone: z.string().max(50).nullable().optional().or(z.literal('')),
  company: z.string().max(200).nullable().optional().or(z.literal('')),
  country: z.string().length(2).toUpperCase().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const clientId = Number(idParam)

  if (!clientId || isNaN(clientId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid client ID parameter.')
  }

  const db = getDb()
  const existing = await db('clients')
    .where({ id: clientId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!existing) {
    return sendError(event, 404, 'CLIENT_NOT_FOUND', 'Client not found.')
  }

  const body = await readBody(event)
  const parsed = updateClientSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const now = new Date()
  const updates: Record<string, any> = {
    updated_at: now,
  }

  if (data.name !== undefined) updates.name = data.name.trim()
  if (data.email !== undefined) updates.email = data.email && data.email.trim() ? data.email.trim().toLowerCase() : null
  if (data.phone !== undefined) {
    if (data.phone && data.phone.trim()) {
      const norm = normalizeIdentifier(data.phone.trim(), data.country || existing.country || 'US')
      updates.phone_e164 = norm.value
    } else {
      updates.phone_e164 = null
    }
  }
  if (data.company !== undefined) updates.company = data.company && data.company.trim() ? data.company.trim() : null
  if (data.country !== undefined) updates.country = data.country || null
  if (data.notes !== undefined) updates.notes = data.notes

  await db('clients')
    .where({ id: clientId, user_id: user.id })
    .update(updates)

  const updatedClient = await db('clients').where({ id: clientId }).first()

  return sendSuccess(event, {
    id: updatedClient.id,
    name: updatedClient.name,
    email: updatedClient.email,
    phone: updatedClient.phone_e164,
    company: updatedClient.company,
    country: updatedClient.country,
    notes: updatedClient.notes,
    createdAt: updatedClient.created_at,
    updatedAt: updatedClient.updated_at,
  })
})
