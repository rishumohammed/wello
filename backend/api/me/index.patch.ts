// backend/api/me/index.patch.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { applyPersonaDefaults } from '../../utils/addonService'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(150).optional(),
  targetHourly: z.number().min(0, 'Target hourly rate must be non-negative').max(999999).nullable().optional(),
  baseCurrency: z.string().length(3, 'Base currency must be a 3-letter ISO 4217 code').toUpperCase().optional(),
  currency: z.string().length(3).toUpperCase().optional(), // Alias for baseCurrency
  timezone: z.string().min(1).max(50).optional(),
  country: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  stateProvince: z.string().max(100).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  addressLine1: z.string().max(255).nullable().optional(),
  addressLine2: z.string().max(255).nullable().optional(),
  postalCode: z.string().max(30).nullable().optional(),
  taxIdLabel: z.string().max(50).optional(),
  businessName: z.string().max(200).nullable().optional(),
  businessAddress: z.string().nullable().optional(),
  businessPhone: z.string().max(50).nullable().optional(),
  businessEmail: z.string().email().max(255).nullable().optional().or(z.literal('')),
  businessTaxId: z.string().max(100).nullable().optional(),
  businessLogo: z.string().nullable().optional(),
  defaultInvoiceNotes: z.string().nullable().optional(),
  headlineRateMetric: z.enum(['client_work', 'all_in']).optional(),
  headline_rate_metric: z.enum(['client_work', 'all_in']).optional(),
  maxTimerHours: z.number().int().min(1).max(24).optional(),
  earningPersona: z.enum(['freelancer_projects', 'salaried', 'daily_hourly_wage', 'gig_retainer', 'mixed_hybrid']).optional(),
  earning_persona: z.enum(['freelancer_projects', 'salaried', 'daily_hourly_wage', 'gig_retainer', 'mixed_hybrid']).optional(),
  includeOverheadInMetrics: z.boolean().optional(),
  include_overhead_in_metrics: z.boolean().optional(),
  targetMonthlyIncome: z.number().min(0).nullable().optional(),
  target_monthly_income: z.number().min(0).nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
  onboarding_completed: z.boolean().optional(),
  onboardingCompletedAt: z.string().nullable().optional(),
  onboarding_completed_at: z.string().nullable().optional(),
  analyticsConsent: z.boolean().optional(),
  analytics_consent: z.boolean().optional(),
  cookieConsent: z.string().optional(),
  cookie_consent: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()
  const now = new Date()

  const updates: Record<string, any> = {
    updated_at: now,
  }

  if (data.name !== undefined) {
    updates.name = data.name.trim()
    const nameParts = updates.name.split(' ').filter(Boolean)
    updates.avatar_initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : updates.name.slice(0, 2).toUpperCase()
  }
  if (data.targetHourly !== undefined) updates.target_hourly = data.targetHourly
  if (data.baseCurrency !== undefined) updates.base_currency = data.baseCurrency
  else if (data.currency !== undefined) updates.base_currency = data.currency
  if (data.timezone !== undefined) updates.timezone = data.timezone
  if (data.country !== undefined) updates.country = data.country
  if (data.state !== undefined) {
    updates.state = data.state
    updates.state_province = data.state
  }
  if (data.stateProvince !== undefined) {
    updates.state_province = data.stateProvince
    updates.state = data.stateProvince
  }
  if (data.city !== undefined) updates.city = data.city
  if (data.addressLine1 !== undefined) updates.address_line1 = data.addressLine1
  if (data.addressLine2 !== undefined) updates.address_line2 = data.addressLine2
  if (data.postalCode !== undefined) updates.postal_code = data.postalCode
  if (data.taxIdLabel !== undefined) updates.tax_id_label = data.taxIdLabel.trim() || 'Tax ID'
  if (data.businessName !== undefined) updates.business_name = data.businessName
  if (data.businessAddress !== undefined) updates.business_address = data.businessAddress
  if (data.businessPhone !== undefined) updates.business_phone = data.businessPhone
  if (data.businessEmail !== undefined) updates.business_email = data.businessEmail ? data.businessEmail : null
  if (data.businessTaxId !== undefined) updates.business_tax_id = data.businessTaxId
  if (data.businessLogo !== undefined) updates.business_logo = data.businessLogo
  if (data.defaultInvoiceNotes !== undefined) updates.default_invoice_notes = data.defaultInvoiceNotes
  if (data.headlineRateMetric !== undefined) updates.headline_rate_metric = data.headlineRateMetric
  else if (data.headline_rate_metric !== undefined) updates.headline_rate_metric = data.headline_rate_metric
  if (data.maxTimerHours !== undefined) updates.max_timer_hours = data.maxTimerHours
  else if (data.max_timer_hours !== undefined) updates.max_timer_hours = data.max_timer_hours
  if (data.earningPersona !== undefined) updates.earning_persona = data.earningPersona
  else if (data.earning_persona !== undefined) updates.earning_persona = data.earning_persona
  if (data.includeOverheadInMetrics !== undefined) updates.include_overhead_in_metrics = data.includeOverheadInMetrics
  else if (data.include_overhead_in_metrics !== undefined) updates.include_overhead_in_metrics = data.include_overhead_in_metrics
  if (data.targetMonthlyIncome !== undefined) updates.target_monthly_income = data.targetMonthlyIncome
  else if (data.target_monthly_income !== undefined) updates.target_monthly_income = data.target_monthly_income
  if (data.onboardingCompletedAt !== undefined) updates.onboarding_completed_at = data.onboardingCompletedAt ? new Date(data.onboardingCompletedAt) : null
  else if (data.onboarding_completed_at !== undefined) updates.onboarding_completed_at = data.onboarding_completed_at ? new Date(data.onboarding_completed_at) : null
  else if (data.onboardingCompleted !== undefined || data.onboarding_completed !== undefined) {
    const isCompleted = data.onboardingCompleted ?? data.onboarding_completed
    updates.onboarding_completed_at = isCompleted ? now : null
  }
  if (data.analyticsConsent !== undefined) updates.analytics_consent = data.analyticsConsent
  else if (data.analytics_consent !== undefined) updates.analytics_consent = data.analytics_consent
  if (data.cookieConsent !== undefined) updates.cookie_consent = data.cookieConsent
  else if (data.cookie_consent !== undefined) updates.cookie_consent = data.cookie_consent

  await db('users')
    .where({ id: user.id })
    .whereNull('deleted_at')
    .update(updates)

  const personaVal = data.earningPersona || data.earning_persona
  if (personaVal) {
    try {
      await applyPersonaDefaults(user.id, personaVal)
    } catch (e) {
      console.warn('[Addon Persona Defaults] Failed to apply:', e)
    }
  }

  const updatedUser = await db('users').where({ id: user.id }).first()

  return sendSuccess(event, {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    avatarInitials: updatedUser.avatar_initials,
    targetHourly: updatedUser.target_hourly !== null ? Number(updatedUser.target_hourly) : null,
    baseCurrency: updatedUser.base_currency || 'USD',
    currency: updatedUser.base_currency || 'USD',
    timezone: updatedUser.timezone || 'UTC',
    headlineRateMetric: updatedUser.headline_rate_metric || 'client_work',
    country: updatedUser.country,
    phone: updatedUser.phone_e164,
    status: updatedUser.status,
    role: updatedUser.role,
    state: updatedUser.state || updatedUser.state_province,
    stateProvince: updatedUser.state_province || updatedUser.state,
    city: updatedUser.city,
    addressLine1: updatedUser.address_line1,
    addressLine2: updatedUser.address_line2,
    postalCode: updatedUser.postal_code,
    taxIdLabel: updatedUser.tax_id_label || 'Tax ID',
    businessName: updatedUser.business_name,
    businessAddress: updatedUser.business_address,
    businessPhone: updatedUser.business_phone,
    businessEmail: updatedUser.business_email,
    businessTaxId: updatedUser.business_tax_id,
    businessLogo: updatedUser.business_logo,
    defaultInvoiceNotes: updatedUser.default_invoice_notes,
    maxTimerHours: updatedUser.max_timer_hours !== undefined && updatedUser.max_timer_hours !== null ? Number(updatedUser.max_timer_hours) : 8,
    earningPersona: updatedUser.earning_persona || 'freelancer_projects',
    includeOverheadInMetrics: updatedUser.include_overhead_in_metrics !== 0 && updatedUser.include_overhead_in_metrics !== false,
    targetMonthlyIncome: updatedUser.target_monthly_income !== null && updatedUser.target_monthly_income !== undefined ? Number(updatedUser.target_monthly_income) : null,
    onboardingCompletedAt: updatedUser.onboarding_completed_at || null,
    analyticsConsent: updatedUser.analytics_consent !== 0 && updatedUser.analytics_consent !== false,
    cookieConsent: updatedUser.cookie_consent || 'accepted',
    scheduledDeletionAt: updatedUser.scheduled_deletion_at || null,
    deletionGracePeriodDays: updatedUser.deletion_grace_period_days || 14,
    digestFrequency: updatedUser.digest_frequency || 'weekly',
    digestDayOfWeek: updatedUser.digest_day_of_week !== undefined && updatedUser.digest_day_of_week !== null ? Number(updatedUser.digest_day_of_week) : 1,
    digestHourUtc: updatedUser.digest_hour_utc !== undefined && updatedUser.digest_hour_utc !== null ? Number(updatedUser.digest_hour_utc) : 9,
    digestEnabled: updatedUser.digest_frequency !== 'disabled' && !updatedUser.email_unsubscribed_at,
    unsubscribeToken: updatedUser.unsubscribe_token || String(updatedUser.id),
    emailUnsubscribedAt: updatedUser.email_unsubscribed_at,
    createdAt: updatedUser.created_at,
    updatedAt: updatedUser.updated_at,
  })
})
