// backend/utils/taxService.ts
// Generic, Global Tax Engine supporting Inclusive/Exclusive, Reverse Charge & Zero-Rated Taxes

import { roundToCurrencyDecimals } from './currencyUtils'

export interface TaxCalculationParams {
  subtotal: number
  discount?: number
  taxPercent: number
  isInclusive?: boolean
  isCompound?: boolean
  isReverseCharge?: boolean
  isZeroRated?: boolean
  currencyCode?: string
}

export interface TaxCalculationResult {
  subtotal: number
  discount: number
  taxableAmount: number
  taxPercent: number
  taxAmount: number
  total: number
  isInclusive: boolean
  isReverseCharge: boolean
  isZeroRated: boolean
}

export interface GlobalTaxPreset {
  id: string
  name: string
  percentage: number
  isInclusive: boolean
  isReverseCharge?: boolean
  isZeroRated?: boolean
  region: string
  taxIdLabel: string
}

export const GLOBAL_TAX_PRESETS: GlobalTaxPreset[] = [
  { id: 'vat_uk_20', name: 'Standard VAT (20%)', percentage: 20.0, isInclusive: false, region: 'United Kingdom / EU', taxIdLabel: 'VAT ID' },
  { id: 'vat_uae_5', name: 'UAE VAT (5%)', percentage: 5.0, isInclusive: false, region: 'United Arab Emirates', taxIdLabel: 'TRN' },
  { id: 'vat_de_19', name: 'German VAT (19%)', percentage: 19.0, isInclusive: false, region: 'Germany / EU', taxIdLabel: 'USt-IdNr' },
  { id: 'gst_in_18', name: 'Indian GST (18%)', percentage: 18.0, isInclusive: false, region: 'India', taxIdLabel: 'GSTIN' },
  { id: 'gst_au_10', name: 'Australian GST (10%)', percentage: 10.0, isInclusive: true, region: 'Australia', taxIdLabel: 'ABN' },
  { id: 'gst_sg_9', name: 'Singapore GST (9%)', percentage: 9.0, isInclusive: false, region: 'Singapore', taxIdLabel: 'GST Reg No' },
  { id: 'sales_tax_us_8', name: 'US Sales Tax (8.25%)', percentage: 8.25, isInclusive: false, region: 'United States', taxIdLabel: 'EIN' },
  { id: 'tax_zero_rated', name: 'Zero-Rated / Export (0%)', percentage: 0.0, isInclusive: false, isZeroRated: true, region: 'International', taxIdLabel: 'Tax ID' },
  { id: 'tax_reverse_charge', name: 'Reverse Charge / B2B Cross-Border (0%)', percentage: 0.0, isInclusive: false, isReverseCharge: true, region: 'Cross-Border', taxIdLabel: 'VAT ID' },
]

export function calculateInvoiceTax(params: TaxCalculationParams): TaxCalculationResult {
  const currency = params.currencyCode || 'USD'
  const subtotal = Number(params.subtotal) || 0
  const discount = Math.min(Number(params.discount) || 0, subtotal)
  const taxableAmount = Math.max(0, subtotal - discount)

  const isReverseCharge = Boolean(params.isReverseCharge)
  const isZeroRated = Boolean(params.isZeroRated)
  const isInclusive = Boolean(params.isInclusive)
  const rawPercent = isReverseCharge || isZeroRated ? 0 : (Number(params.taxPercent) || 0)

  let taxAmount = 0
  let total = 0

  if (rawPercent <= 0 || taxableAmount <= 0) {
    taxAmount = 0
    total = taxableAmount
  } else if (isInclusive) {
    // Inclusive: Tax is already inside taxableAmount
    // Base before tax = taxableAmount / (1 + rate / 100)
    // Tax amount = taxableAmount - Base before tax
    const baseBeforeTax = taxableAmount / (1 + rawPercent / 100)
    taxAmount = taxableAmount - baseBeforeTax
    total = taxableAmount
  } else {
    // Exclusive: Tax is added on top of taxableAmount
    taxAmount = taxableAmount * (rawPercent / 100)
    total = taxableAmount + taxAmount
  }

  const roundedTax = roundToCurrencyDecimals(taxAmount, currency)
  const roundedTotal = roundToCurrencyDecimals(total, currency)

  return {
    subtotal: roundToCurrencyDecimals(subtotal, currency),
    discount: roundToCurrencyDecimals(discount, currency),
    taxableAmount: roundToCurrencyDecimals(taxableAmount, currency),
    taxPercent: rawPercent,
    taxAmount: roundedTax,
    total: roundedTotal,
    isInclusive,
    isReverseCharge,
    isZeroRated,
  }
}
