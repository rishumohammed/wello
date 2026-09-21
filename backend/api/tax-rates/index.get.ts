// backend/api/tax-rates/index.get.ts
import { defineEventHandler } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess } from '../../utils/apiResponse'
import { GLOBAL_TAX_PRESETS } from '../../utils/taxService'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const db = getDb()

  const userTaxRates = await db('tax_rates')
    .where({ user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('created_at', 'asc')

  return sendSuccess(event, {
    taxRates: userTaxRates.map(tr => ({
      id: tr.id,
      name: tr.name,
      percentage: Number(tr.percentage),
      isInclusive: Boolean(tr.is_inclusive),
      isCompound: Boolean(tr.is_compound),
      isDefault: Boolean(tr.is_default),
      isReverseCharge: Boolean(tr.is_reverse_charge),
      isZeroRated: Boolean(tr.is_zero_rated),
      description: tr.description,
      createdAt: tr.created_at,
    })),
    presets: GLOBAL_TAX_PRESETS,
  })
})
