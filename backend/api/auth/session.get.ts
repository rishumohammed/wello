// server/api/auth/session.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  return {
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone_e164,
      avatarInitials: user.avatar_initials,
      targetHourly: user.target_hourly,
      currencyCode: user.base_currency,
      timezone: user.timezone,
      countryCode: user.country,
      role: user.role,
      adminRole: user.adminRole,
      adminPermissions: user.adminPermissions || [],
      status: user.status,
    },
  }
})
