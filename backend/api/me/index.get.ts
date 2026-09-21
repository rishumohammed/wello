// backend/api/me/index.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()

  const dbUser = await db('users')
    .where({ id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!dbUser) {
    return sendError(event, 404, 'USER_NOT_FOUND', 'User account not found or deactivated.')
  }

  return sendSuccess(event, {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    avatarInitials: dbUser.avatar_initials,
    targetHourly: dbUser.target_hourly !== null ? Number(dbUser.target_hourly) : null,
    baseCurrency: dbUser.base_currency || 'USD',
    currency: dbUser.base_currency || 'USD',
    timezone: dbUser.timezone || 'UTC',
    headlineRateMetric: dbUser.headline_rate_metric || 'client_work',
    country: dbUser.country,
    phone: dbUser.phone_e164,
    status: dbUser.status,
    role: dbUser.role,
    state: dbUser.state || dbUser.state_province,
    stateProvince: dbUser.state_province || dbUser.state,
    city: dbUser.city,
    addressLine1: dbUser.address_line1,
    addressLine2: dbUser.address_line2,
    postalCode: dbUser.postal_code,
    taxIdLabel: dbUser.tax_id_label || 'Tax ID',
    businessName: dbUser.business_name,
    businessAddress: dbUser.business_address,
    businessPhone: dbUser.business_phone,
    businessEmail: dbUser.business_email,
    businessTaxId: dbUser.business_tax_id,
    businessLogo: dbUser.business_logo,
    defaultInvoiceNotes: dbUser.default_invoice_notes,
    maxTimerHours: dbUser.max_timer_hours !== undefined && dbUser.max_timer_hours !== null ? Number(dbUser.max_timer_hours) : 8,
    createdAt: dbUser.created_at,
    updatedAt: dbUser.updated_at,
  })
})
