// frontend/utils/currencyUtils.js
// Comprehensive ISO 4217 Currency utilities & decimal precision engine

export const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
])

export const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'
])

export function getCurrencyDecimals(currencyCode) {
  if (!currencyCode) return 2
  const code = String(currencyCode).toUpperCase().trim()
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3
  return 2
}

export const ISO_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', decimals: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'SEK', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'NOK', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'DKK', decimals: 2 },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'PLN', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'ZAR', decimals: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', decimals: 2 },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR', decimals: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KWD', decimals: 3 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BHD', decimals: 3 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', decimals: 3 },
  { code: 'ILS', name: 'Israeli New Shekel', symbol: '₪', decimals: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', decimals: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimals: 2 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', decimals: 2 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', decimals: 2 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', decimals: 0 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimals: 0 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: 'CN¥', decimals: 2 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', decimals: 2 },
  { code: 'CLP', name: 'Chilean Peso', symbol: 'CLP', decimals: 0 },
  { code: 'COP', name: 'Colombian Peso', symbol: 'COP', decimals: 2 },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'PEN', decimals: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'EGP', decimals: 2 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KES', decimals: 2 },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GHS', decimals: 2 },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'PKR', decimals: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: 'BDT', decimals: 2 },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'LKR', decimals: 2 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'NPR', decimals: 2 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'CZK', decimals: 2 },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'HUF', decimals: 2 },
  { code: 'RON', name: 'Romanian Leu', symbol: 'RON', decimals: 2 },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'BGN', decimals: 2 },
  { code: 'HRK', name: 'Croatian Kuna', symbol: 'HRK', decimals: 2 },
  { code: 'RSD', name: 'Serbian Dinar', symbol: 'RSD', decimals: 2 },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: 'UAH', decimals: 2 },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD', decimals: 2 },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JOD', decimals: 3 },
  { code: 'DZD', name: 'Algerian Dinar', symbol: 'DZD', decimals: 2 },
]

export const ISO_CURRENCY_MAP = new Map(
  ISO_CURRENCIES.map(c => [c.code, c])
)

export function formatCurrencyIntl(amount, currencyCode = 'USD', locale = 'en') {
  const num = Number(amount) || 0
  const code = (currencyCode || 'USD').toUpperCase().trim()
  const decimals = getCurrencyDecimals(code)

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num)
  } catch (e) {
    return `${code} ${num.toFixed(decimals)}`
  }
}

export function formatNumberIntl(amount, decimals, locale = 'en') {
  const num = Number(amount) || 0
  const minDec = decimals !== undefined ? decimals : 0
  const maxDec = decimals !== undefined ? decimals : 2

  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec,
    }).format(num)
  } catch (e) {
    return num.toFixed(maxDec)
  }
}

export function roundToCurrencyDecimals(amount, currencyCode = 'USD') {
  const decimals = getCurrencyDecimals(currencyCode)
  const factor = Math.pow(10, decimals)
  return Math.round(amount * factor) / factor
}
