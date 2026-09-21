// backend/api/clients/index.post.ts
import { defineEventHandler, readBody, getRequestPath } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb, normalizeIdentifier } from '../../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getIdempotencyKey, checkIdempotency, saveIdempotency } from '../../utils/idempotency'
import { logAnalyticsEvent } from '../../utils/analyticsService'

const createClientSchema = z.object({
  name: z.string().min(1, 'Client name is required').max(200),
  email: z.string().email().max(255).nullable().optional().or(z.literal('')),
  phone: z.string().max(50).nullable().optional().or(z.literal('')),
  company: z.string().max(200).nullable().optional().or(z.literal('')),
  country: z.string().length(2).toUpperCase().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const path = getRequestPath(event)
  const idempotencyKey = getIdempotencyKey(event)

  if (idempotencyKey) {
    const cached = await checkIdempotency(user.id, idempotencyKey, path)
    if (cached.exists) {
      return sendSuccess(event, cached.body, undefined, cached.status)
    }
  }

  const body = await readBody(event)
  const parsed = createClientSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()

  let normalizedPhone: string | null = null
  if (data.phone && data.phone.trim()) {
    const norm = normalizeIdentifier(data.phone.trim(), data.country || user.country || 'US')
    normalizedPhone = norm.value
  }

  const [clientId] = await db('clients').insert({
    user_id: user.id,
    name: data.name.trim(),
    email: data.email && data.email.trim() ? data.email.trim().toLowerCase() : null,
    phone_e164: normalizedPhone,
    company: data.company && data.company.trim() ? data.company.trim() : null,
    country: data.country || null,
    notes: data.notes || null,
    created_at: now,
    updated_at: now,
  })

  const newClient = await db('clients').where({ id: clientId }).first()

  const responseData = {
    id: newClient.id,
    name: newClient.name,
    email: newClient.email,
    phone: newClient.phone_e164,
    company: newClient.company,
    country: newClient.country,
    notes: newClient.notes,
    totalProjects: 0,
    activeProjects: 0,
    createdAt: newClient.created_at,
    updatedAt: newClient.updated_at,
  }

  if (idempotencyKey) {
    await saveIdempotency(user.id, idempotencyKey, path, 201, responseData)
  }

  // Emit trusted analytics event
  await logAnalyticsEvent(user.id, 'client_created', {
    client_id: newClient.id,
    has_email: Boolean(newClient.email),
    country: newClient.country,
  })

  return sendSuccess(event, responseData, undefined, 201)
})
