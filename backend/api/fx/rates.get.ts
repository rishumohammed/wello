// backend/api/fx/rates.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess } from '../../utils/apiResponse'
import { getFxRate } from '../../utils/fxService'
import { ISO_CURRENCIES } from '../../utils/currencyUtils'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const baseCurrency = String(query.base || user.base_currency || 'USD').toUpperCase().trim()

  const commonCurrencies = ['USD', 'EUR', 'GBP', 'AED', 'INR', 'CAD', 'AUD', 'JPY', 'CHF', 'SGD', 'SAR', 'QAR', 'KWD']
  const rates: Record<string, number> = {}

  for (const quote of commonCurrencies) {
    if (quote === baseCurrency) {
      rates[quote] = 1.0
    } else {
      rates[quote] = await getFxRate(baseCurrency, quote)
    }
  }

  return sendSuccess(event, {
    baseCurrency,
    rates,
    currencies: ISO_CURRENCIES,
  })
})
