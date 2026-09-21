// backend/utils/fxService.ts
// Foreign Exchange (FX) Rate Engine, Triangular Conversion & Pluggable Providers

import { getDb } from './db'
import { roundToCurrencyDecimals, getCurrencyDecimals } from './currencyUtils'

export interface FxRateRecord {
  baseCurrency: string
  quoteCurrency: string
  rate: number
  date: string
}

export interface IFxRateProvider {
  name: string
  fetchRates(baseCurrency: string, targetCurrencies?: string[], dateStr?: string): Promise<Record<string, number>>
}

// 1. Free European Central Bank Provider (Frankfurter API - no API key required)
export class FrankfurterProvider implements IFxRateProvider {
  name = 'Frankfurter (ECB)'

  async fetchRates(baseCurrency: string = 'USD', targetCurrencies?: string[], dateStr?: string): Promise<Record<string, number>> {
    const base = baseCurrency.toUpperCase()
    const endpointDate = dateStr || 'latest'
    const symbols = targetCurrencies && targetCurrencies.length > 0 ? `&to=${targetCurrencies.join(',')}` : ''
    const url = `https://api.frankfurter.app/${endpointDate}?from=${base}${symbols}`

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.rates || {}
    } catch (err: any) {
      console.warn(`[FX] FrankfurterProvider fetch failed: ${err.message}`)
      return {}
    }
  }
}

// 2. Database Fallback Provider (Reads from MySQL fx_rates table)
export class DatabaseFallbackProvider implements IFxRateProvider {
  name = 'DatabaseFallback'

  async fetchRates(baseCurrency: string = 'USD', targetCurrencies?: string[], dateStr?: string): Promise<Record<string, number>> {
    const db = getDb()
    const base = baseCurrency.toUpperCase()
    const targetDate = dateStr || new Date().toISOString().slice(0, 10)

    try {
      let query = db('fx_rates')
        .where({ base_currency: base })
        .where('rate_date', '<=', targetDate)
        .orderBy('rate_date', 'desc')

      if (targetCurrencies && targetCurrencies.length > 0) {
        query = query.whereIn('quote_currency', targetCurrencies)
      }

      const rows = await query
      const rates: Record<string, number> = {}
      for (const row of rows) {
        if (!rates[row.quote_currency]) {
          rates[row.quote_currency] = Number(row.rate)
        }
      }
      return rates
    } catch (err: any) {
      console.warn(`[FX] DatabaseFallbackProvider failed: ${err.message}`)
      return {}
    }
  }
}

// Default seeded fallback rates against USD (used if network offline and DB table empty)
const DEFAULT_USD_FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  AED: 3.6725,
  INR: 83.50,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 155.0,
  CHF: 0.91,
  SGD: 1.35,
  HKD: 7.82,
  NZD: 1.64,
  SEK: 10.60,
  NOK: 10.80,
  DKK: 6.85,
  PLN: 3.95,
  BRL: 5.40,
  MXN: 18.20,
  ZAR: 18.50,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.307,
  BHD: 0.376,
  OMR: 0.385,
  ILS: 3.70,
  TRY: 32.50,
  THB: 36.80,
  MYR: 4.70,
  IDR: 16200.0,
  PHP: 58.0,
  VND: 25400.0,
  KRW: 1370.0,
  CNY: 7.23,
}

let activeProvider: IFxRateProvider = new FrankfurterProvider()

export function setFxProvider(provider: IFxRateProvider) {
  activeProvider = provider
}

/**
 * Retrieves the exchange rate to convert 1 unit of `fromCurrency` to `toCurrency`.
 * Rate meaning: `Amount in toCurrency = Amount in fromCurrency * Rate`
 */
export async function getFxRate(
  fromCurrency: string = 'USD',
  toCurrency: string = 'USD',
  dateStr?: string
): Promise<number> {
  const from = fromCurrency.toUpperCase().trim()
  const to = toCurrency.toUpperCase().trim()

  if (from === to) return 1.0

  const db = getDb()
  const targetDate = dateStr ? dateStr.slice(0, 10) : new Date().toISOString().slice(0, 10)

  // 1. Direct pair in DB: from -> to
  const direct = await db('fx_rates')
    .where({ base_currency: from, quote_currency: to })
    .where('rate_date', '<=', targetDate)
    .orderBy('rate_date', 'desc')
    .first()

  if (direct && Number(direct.rate) > 0) {
    return Number(direct.rate)
  }

  // 2. Inverse pair in DB: to -> from
  const inverse = await db('fx_rates')
    .where({ base_currency: to, quote_currency: from })
    .where('rate_date', '<=', targetDate)
    .orderBy('rate_date', 'desc')
    .first()

  if (inverse && Number(inverse.rate) > 0) {
    return 1.0 / Number(inverse.rate)
  }

  // 3. Triangular cross-rate via USD anchor in DB
  const fromUsd = from === 'USD' ? { rate: 1.0 } : await db('fx_rates')
    .where({ base_currency: 'USD', quote_currency: from })
    .where('rate_date', '<=', targetDate)
    .orderBy('rate_date', 'desc')
    .first()

  const toUsd = to === 'USD' ? { rate: 1.0 } : await db('fx_rates')
    .where({ base_currency: 'USD', quote_currency: to })
    .where('rate_date', '<=', targetDate)
    .orderBy('rate_date', 'desc')
    .first()

  if (fromUsd && toUsd && Number(fromUsd.rate) > 0 && Number(toUsd.rate) > 0) {
    // 1 USD = fromUsd.rate FROM, 1 USD = toUsd.rate TO => 1 FROM = (toUsd.rate / fromUsd.rate) TO
    return Number(toUsd.rate) / Number(fromUsd.rate)
  }

  // 4. Try live provider
  try {
    const liveRates = await activeProvider.fetchRates(from, [to], targetDate)
    if (liveRates[to] && Number(liveRates[to]) > 0) {
      const fetchedRate = Number(liveRates[to])
      // Persist to DB for future offline/cached requests
      await db('fx_rates').insert({
        rate_date: targetDate,
        base_currency: from,
        quote_currency: to,
        rate: fetchedRate,
        created_at: new Date(),
      }).onConflict(['rate_date', 'base_currency', 'quote_currency']).ignore()
      return fetchedRate
    }
  } catch (e) {}

  // 5. Fallback hard-coded anchor rates
  const fallbackFrom = DEFAULT_USD_FALLBACK_RATES[from] || 1.0
  const fallbackTo = DEFAULT_USD_FALLBACK_RATES[to] || 1.0
  return fallbackTo / fallbackFrom
}

/**
 * Converts any transaction amount from its source currency to the user's base currency.
 */
export async function convertToBase(
  amount: number,
  fromCurrency: string = 'USD',
  baseCurrency: string = 'USD',
  dateStr?: string,
  manualFxRate?: number | null
): Promise<{ convertedAmount: number; rateUsed: number }> {
  const from = fromCurrency.toUpperCase().trim()
  const base = baseCurrency.toUpperCase().trim()
  const numAmount = Number(amount) || 0

  if (from === base) {
    return {
      convertedAmount: roundToCurrencyDecimals(numAmount, base),
      rateUsed: 1.0,
    }
  }

  let rate = 1.0
  if (manualFxRate && Number(manualFxRate) > 0) {
    rate = Number(manualFxRate)
  } else {
    rate = await getFxRate(from, base, dateStr)
  }

  const converted = numAmount * rate
  return {
    convertedAmount: roundToCurrencyDecimals(converted, base),
    rateUsed: rate,
  }
}
