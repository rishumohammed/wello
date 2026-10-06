// backend/utils/responseMasker.ts
/**
 * Central Data-Driven Response Serializer & Masker for Impersonation Support Sessions
 * 
 * Automatically redacts financial amounts, rates, balances, and sensitive personal contact details
 * when an administrator inspects an account via read-only support impersonation without
 * an approved, active `users.financial_view` permission grant.
 */

import { AuthenticatedUser } from './authService'
import { shouldMaskFinancials } from './authGuard'

export const FINANCIAL_FIELD_NAMES = new Set([
  'amount',
  'total',
  'subtotal',
  'balance',
  'balancedue',
  'amountpaid',
  'paidamount',
  'targethourly',
  'targetmonthlyincome',
  'monthlybudget',
  'expectedrevenue',
  'collectedrevenue',
  'earnedrevenue',
  'outstandingrevenue',
  'directexpenses',
  'overheadexpenses',
  'grossamount',
  'netamount',
  'taxamount',
  'unitprice',
  'rate',
  'effectiverate',
  'effectivehourlyrate',
  'clientworkrate',
  'allinrate',
  'realrate',
  'realeffectiverate',
  'hourlyrate',
  'quoteamount',
  'estimatedearnings',
  'actualearnings',
  'earnings',
  'totalbilled',
  'totaloutstanding',
  'basetotal',
  'expectedamount',
  'claimedamount',
  'monthlyequivalent',
  'annualequivalent',
])

export const CONTACT_FIELD_NAMES = new Set([
  'email',
  'phone',
  'phonee164',
  'ipaddress',
  'useragent',
  'deviceinfo',
  'customeremail',
  'customerphone',
  'customercontact',
  'customeraddress',
  'sellerphone',
  'selleraddress',
  'selleremail',
  'sellertaxid',
  'billingaddress',
  'contactemail',
  'contactphone',
  'businessphone',
  'businessemail',
  'businessaddress',
  'businesstaxid',
])

/**
 * Recursively masks sensitive financial and contact fields in a payload
 */
export function maskSensitivePayload<T = any>(data: T, customFields?: { financial?: string[]; contact?: string[] }): T {
  if (data === null || data === undefined) return data

  if (Array.isArray(data)) {
    return data.map(item => maskSensitivePayload(item, customFields)) as unknown as T
  }

  if (typeof data === 'object' && !(data instanceof Date)) {
    const output: Record<string, any> = {}

    for (const [key, val] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().replace(/[_-]/g, '')

      const isFinancial = FINANCIAL_FIELD_NAMES.has(lowerKey) ||
        (customFields?.financial && customFields.financial.includes(key))
      
      const isContact = CONTACT_FIELD_NAMES.has(lowerKey) ||
        (customFields?.contact && customFields.contact.includes(key))

      if (isFinancial) {
        if (typeof val === 'number') {
          output[key] = 0
        } else if (typeof val === 'string' && !isNaN(Number(val)) && val.trim() !== '') {
          output[key] = '0.00'
        } else {
          output[key] = 0
        }
      } else if (isContact) {
        if (typeof val === 'string' && val.length > 0) {
          output[key] = '[REDACTED]'
        } else {
          output[key] = null
        }
      } else if (typeof val === 'object' && val !== null) {
        output[key] = maskSensitivePayload(val, customFields)
      } else {
        output[key] = val
      }
    }

    output.isFinancialsMasked = true
    return output as T
  }

  return data
}

/**
 * Serializes response, applying data masking if user session requires it.
 */
export function serializeWithFinancialMasking<T = any>(
  user: AuthenticatedUser | null | undefined,
  data: T,
  customFields?: { financial?: string[]; contact?: string[] }
): { data: T; isMasked: boolean } {
  const isMasked = shouldMaskFinancials(user)

  if (!isMasked) {
    return { data, isMasked: false }
  }

  const masked = maskSensitivePayload(data, customFields)
  return { data: masked, isMasked: true }
}
