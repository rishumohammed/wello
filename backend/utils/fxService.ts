// backend/utils/fxService.ts
// Robust Multi-Provider Foreign Exchange (FX) Engine, Fixed Pegs, and Precision Triangulation

import { getDb } from './db'
import { roundToCurrencyDecimals } from './currencyUtils'

export class RateUnavailableError extends Error {
  public code: string
  public fromCurrency: string
  public toCurrency: string

  constructor(fromCurrency: string, toCurrency: string, message?: string) {
    super(message || `Exchange rate unavailable to convert ${fromCurrency} to ${toCurrency}. Manual rate required.`)
    this.name = 'RateUnavailableError'
    this.code = 'RATE_UNAVAILABLE'
    this.fromCurrency = fromCurrency
    this.toCurrency = toCurrency
  }
}

export type FxRateType = 'live' | 'pegged' | 'stale' | 'manual'

export interface FxRateDetail {
  rate: number
  rateType: FxRateType
  rateAgeDays: number
  isStale: boolean
  source: string
}

export interface IFxRateProvider {
  name: string
  fetchRates(baseCurrency: string, targetCurrencies?: string[], dateStr?: string): Promise<Record<string, number>>
}

// 1. Primary Wide-Coverage Provider (Covers 160+ ISO currencies including AED, SAR, QAR, KWD, OMR, BHD, JOD, INR, etc.)
export class WideCoverageProvider implements IFxRateProvider {
  name = 'WideCoverageProvider'

  async fetchRates(baseCurrency: string = 'USD', targetCurrencies?: string[], dateStr?: string): Promise<Record<string, number>> {
    const base = baseCurrency.toUpperCase().trim()
    const customUrl = process.env.FX_PROVIDER_URL
    const url = customUrl ? customUrl.replace('{base}', base) : `https://open.er-api.com/v6/latest/${base}`

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data && data.rates && typeof data.rates === 'object') {
        const rates: Record<string, number> = {}
        for (const [k, v] of Object.entries(data.rates)) {
          if (typeof v === 'number' && v > 0) {
            rates[k.toUpperCase()] = v
          }
        }
        return rates
      }
      return {}
    } catch (err: any) {
      // Quietly allow chain to fallback to ECB / DB / Pegs
      return {}
    }
  }
}

// 2. European Central Bank Provider (Frankfurter API)
export class FrankfurterProvider implements IFxRateProvider {
  name = 'Frankfurter (ECB)'

  async fetchRates(baseCurrency: string = 'USD', targetCurrencies?: string[], dateStr?: string): Promise<Record<string, number>> {
    const base = baseCurrency.toUpperCase()
    const endpointDate = dateStr || 'latest'
    const symbols = targetCurrencies && targetCurrencies.length > 0 ? `&to=${targetCurrencies.join(',')}` : ''
    const url = `https://api.frankfurter.app/${endpointDate}?from=${base}${symbols}`

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.rates || {}
    } catch (err: any) {
      return {}
    }
  }
}

// 3. Database Cache Provider
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
        if (!rates[row.quote_currency] && Number(row.rate) > 0) {
          rates[row.quote_currency] = Number(row.rate)
        }
      }
      return rates
    } catch (err: any) {
      return {}
    }
  }
}

// Active provider instance
let primaryProvider: IFxRateProvider = new WideCoverageProvider()
let secondaryProvider: IFxRateProvider = new FrankfurterProvider()

export function setFxProvider(provider: IFxRateProvider) {
  primaryProvider = provider
}

/**
 * Checks the fixed_peg_rates table for official currency pegs (e.g., AED = 3.6725 USD).
 */
export async function getFixedPegRate(currencyCode: string): Promise<{ pegCurrency: string; pegRate: number; source: string; effectiveDate: string } | null> {
  const code = currencyCode.toUpperCase().trim()
  try {
    const db = getDb()
    const peg = await db('fixed_peg_rates').where({ currency: code }).first()
    if (peg && Number(peg.peg_rate) > 0) {
      return {
        pegCurrency: peg.peg_currency || 'USD',
        pegRate: Number(peg.peg_rate),
        source: peg.source,
        effectiveDate: peg.effective_date ? String(peg.effective_date).slice(0, 10) : '1997-01-01',
      }
    }
  } catch (err) {}
  return null
}

/**
 * Resolves the exchange rate detail to convert 1 unit of `fromCurrency` to `toCurrency`.
 * Follows the strict provider chain:
 * Manual -> Live Primary -> Live ECB -> DB Cache (with age) -> Fixed Pegs -> RateUnavailableError.
 * 
 * NEVER falls back silently to 1.0 or 0.0.
 */
export async function getFxRateDetail(
  fromCurrency: string = 'USD',
  toCurrency: string = 'USD',
  dateStr?: string,
  manualRate?: number | null
): Promise<FxRateDetail> {
  const from = fromCurrency.toUpperCase().trim()
  const to = toCurrency.toUpperCase().trim()
  const todayStr = new Date().toISOString().slice(0, 10)
  const targetDate = dateStr ? dateStr.slice(0, 10) : todayStr

  // 1. Identity pair
  if (from === to) {
    return {
      rate: 1.0,
      rateType: 'live',
      rateAgeDays: 0,
      isStale: false,
      source: 'identity',
    }
  }

  // 2. Explicit manual rate
  if (manualRate && Number(manualRate) > 0) {
    return {
      rate: Number(manualRate),
      rateType: 'manual',
      rateAgeDays: 0,
      isStale: false,
      source: 'manual_override',
    }
  }

  const db = getDb()

  // 3. Check direct pair in DB fx_rates
  const directDb = await db('fx_rates')
    .where({ base_currency: from, quote_currency: to })
    .where('rate_date', '<=', targetDate)
    .orderBy('rate_date', 'desc')
    .first()

  if (directDb && Number(directDb.rate) > 0) {
    const rateDate = new Date(directDb.rate_date)
    const ageDays = Math.max(0, Math.floor((new Date(targetDate).getTime() - rateDate.getTime()) / 86400000))
    const isStale = ageDays > 2
    return {
      rate: Number(directDb.rate),
      rateType: isStale ? 'stale' : 'live',
      rateAgeDays: ageDays,
      isStale,
      source: 'db_cache',
    }
  }

  // 4. Try Live Primary Provider
  try {
    const liveRates = await primaryProvider.fetchRates(from, [to], targetDate)
    if (liveRates[to] && Number(liveRates[to]) > 0) {
      const fetchedRate = Number(liveRates[to])
      // Cache rate to DB for future offline resilience
      await db('fx_rates')
        .insert({
          rate_date: targetDate,
          base_currency: from,
          quote_currency: to,
          rate: fetchedRate,
          created_at: new Date(),
        })
        .onConflict(['rate_date', 'base_currency', 'quote_currency'])
        .ignore()

      return {
        rate: fetchedRate,
        rateType: 'live',
        rateAgeDays: 0,
        isStale: false,
        source: primaryProvider.name,
      }
    }
  } catch (e) {}

  // 5. Try Live Secondary Provider (ECB)
  try {
    const ecbRates = await secondaryProvider.fetchRates(from, [to], targetDate)
    if (ecbRates[to] && Number(ecbRates[to]) > 0) {
      const fetchedRate = Number(ecbRates[to])
      await db('fx_rates')
        .insert({
          rate_date: targetDate,
          base_currency: from,
          quote_currency: to,
          rate: fetchedRate,
          created_at: new Date(),
        })
        .onConflict(['rate_date', 'base_currency', 'quote_currency'])
        .ignore()

      return {
        rate: fetchedRate,
        rateType: 'live',
        rateAgeDays: 0,
        isStale: false,
        source: secondaryProvider.name,
      }
    }
  } catch (e) {}

  // 6. Triangular Cross-Rate via USD in DB fx_rates
  const fromUsd = from === 'USD' ? { rate: 1.0, rate_date: targetDate } : await db('fx_rates')
    .where({ base_currency: 'USD', quote_currency: from })
    .where('rate_date', '<=', targetDate)
    .orderBy('rate_date', 'desc')
    .first()

  const toUsd = to === 'USD' ? { rate: 1.0, rate_date: targetDate } : await db('fx_rates')
    .where({ base_currency: 'USD', quote_currency: to })
    .where('rate_date', '<=', targetDate)
    .orderBy('rate_date', 'desc')
    .first()

  if (fromUsd && toUsd && Number(fromUsd.rate) > 0 && Number(toUsd.rate) > 0) {
    const crossRate = Number(toUsd.rate) / Number(fromUsd.rate)
    const oldestDate = new Date(Math.min(new Date(fromUsd.rate_date).getTime(), new Date(toUsd.rate_date).getTime()))
    const ageDays = Math.max(0, Math.floor((new Date(targetDate).getTime() - oldestDate.getTime()) / 86400000))
    const isStale = ageDays > 2
    return {
      rate: crossRate,
      rateType: isStale ? 'stale' : 'live',
      rateAgeDays: ageDays,
      isStale,
      source: 'usd_triangular_db',
    }
  }

  // 7. Fixed-Peg Rates (Official central bank peg table)
  const fromPeg = from === 'USD' ? { pegRate: 1.0, source: 'USD anchor' } : await getFixedPegRate(from)
  const toPeg = to === 'USD' ? { pegRate: 1.0, source: 'USD anchor' } : await getFixedPegRate(to)

  if (fromPeg && toPeg && fromPeg.pegRate > 0 && toPeg.pegRate > 0) {
    const pegRate = toPeg.pegRate / fromPeg.pegRate
    return {
      rate: pegRate,
      rateType: 'pegged',
      rateAgeDays: 0,
      isStale: false,
      source: `${fromPeg.source || from} / ${toPeg.source || to}`,
    }
  }

  // Peg to a floating currency via USD anchor
  if (fromPeg && toUsd && Number(toUsd.rate) > 0) {
    return {
      rate: Number(toUsd.rate) / fromPeg.pegRate,
      rateType: 'pegged',
      rateAgeDays: 0,
      isStale: false,
      source: `${fromPeg.source} + USD cache`,
    }
  }

  if (toPeg && fromUsd && Number(fromUsd.rate) > 0) {
    return {
      rate: toPeg.pegRate / Number(fromUsd.rate),
      rateType: 'pegged',
      rateAgeDays: 0,
      isStale: false,
      source: `${toPeg.source} + USD cache`,
    }
  }

  // 8. NO RATE FOUND: Throw explicit RateUnavailableError (Never silent 1.0 or 0.0)
  throw new RateUnavailableError(from, to)
}

/**
 * Retrieves numeric rate or throws RateUnavailableError.
 */
export async function getFxRate(
  fromCurrency: string = 'USD',
  toCurrency: string = 'USD',
  dateStr?: string,
  manualRate?: number | null
): Promise<number> {
  const detail = await getFxRateDetail(fromCurrency, toCurrency, dateStr, manualRate)
  return detail.rate
}

/**
 * Converts any transaction amount from its source currency to the user's base currency.
 * Returns convertedAmount and full provenance metadata (rateType, rateAgeDays, isStale, source).
 */
export async function convertToBase(
  amount: number,
  fromCurrency: string = 'USD',
  baseCurrency: string = 'USD',
  dateStr?: string,
  manualFxRate?: number | null
): Promise<{
  convertedAmount: number
  rateUsed: number
  rateType: FxRateType
  rateAgeDays: number
  isStale: boolean
  source: string
  marker?: string | null
}> {
  const from = fromCurrency.toUpperCase().trim()
  const base = baseCurrency.toUpperCase().trim()
  const numAmount = Number(amount) || 0

  if (from === base) {
    return {
      convertedAmount: roundToCurrencyDecimals(numAmount, base),
      rateUsed: 1.0,
      rateType: 'live',
      rateAgeDays: 0,
      isStale: false,
      source: 'identity',
      marker: null,
    }
  }

  const detail = await getFxRateDetail(from, base, dateStr, manualFxRate)
  const converted = numAmount * detail.rate

  let marker: string | null = null
  if (detail.rateType === 'pegged') {
    marker = 'Pegged rate'
  } else if (detail.rateType === 'stale' || detail.rateAgeDays > 1) {
    marker = `Rate is ${detail.rateAgeDays} days old`
  } else if (detail.rateType === 'manual') {
    marker = 'Manual rate'
  }

  return {
    convertedAmount: roundToCurrencyDecimals(converted, base),
    rateUsed: detail.rate,
    rateType: detail.rateType,
    rateAgeDays: detail.rateAgeDays,
    isStale: detail.isStale,
    source: detail.source,
    marker,
  }
}

/**
 * Synchronizes daily FX rates across major ISO currencies and fixed pegs.
 */
export async function syncDailyFxRates(targetDateStr?: string): Promise<{ executed: number; skipped: number; errors: string[] }> {
  const db = getDb()
  const targetDate = targetDateStr || new Date().toISOString().slice(0, 10)
  const errors: string[] = []
  let executed = 0

  const TARGET_CURRENCIES = [
    'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD',
    'INR', 'CAD', 'AUD', 'JPY', 'CHF', 'SGD', 'HKD', 'NZD', 'SEK',
    'NOK', 'DKK', 'PLN', 'BRL', 'MXN', 'ZAR', 'ILS', 'TRY', 'THB',
    'MYR', 'IDR', 'PHP', 'VND', 'KRW', 'CNY'
  ]

  try {
    const liveRates = await primaryProvider.fetchRates('USD', TARGET_CURRENCIES, targetDate).catch(() => ({} as Record<string, number>))

    for (const quote of TARGET_CURRENCIES) {
      let rate = liveRates[quote]

      if (!rate || Number(rate) <= 0) {
        // Try Pegs
        const peg = await getFixedPegRate(quote)
        if (peg && peg.pegRate > 0) {
          rate = peg.pegRate
        } else {
          // Last known in DB
          const lastKnown = await db('fx_rates')
            .where({ base_currency: 'USD', quote_currency: quote })
            .orderBy('rate_date', 'desc')
            .first()
          if (lastKnown && Number(lastKnown.rate) > 0) {
            rate = Number(lastKnown.rate)
          }
        }
      }

      if (rate && Number(rate) > 0) {
        await db('fx_rates')
          .insert({
            rate_date: targetDate,
            base_currency: 'USD',
            quote_currency: quote,
            rate: Number(rate),
            created_at: new Date(),
          })
          .onConflict(['rate_date', 'base_currency', 'quote_currency'])
          .merge(['rate'])

        executed++
      }
    }
  } catch (err: any) {
    errors.push(err.message || String(err))
  }

  return { executed, skipped: 0, errors }
}
