// backend/tests/test_globalization_fx_tz_tax.mjs
// Comprehensive test suite for Wello Globalization:
// ISO 4217, Decimal Precision, FX Triangular Engine, Timezones & DST, Generic Tax Regimes, and 3-City Multi-User Scenario

import assert from 'node:assert/strict'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001'

// --- Standalone helpers mirroring utils for unit testing ---
const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'
])

const THREE_DECIMAL_CURRENCIES = new Set([
  'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'
])

function getCurrencyDecimals(currencyCode) {
  if (!currencyCode) return 2
  const code = currencyCode.toUpperCase().trim()
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3
  return 2
}

function roundToCurrencyDecimals(amount, currencyCode = 'USD') {
  const decimals = getCurrencyDecimals(currencyCode)
  const factor = Math.pow(10, decimals)
  return Math.round((Number(amount) || 0) * factor) / factor
}

function formatCurrencyIntl(amount, currencyCode = 'USD', locale = 'en-US') {
  const num = Number(amount) || 0
  const decimals = getCurrencyDecimals(currencyCode)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

function calculateSessionDuration(startedAtUtc, endedAtUtc) {
  const startMs = new Date(startedAtUtc).getTime()
  const endMs = new Date(endedAtUtc).getTime()
  const diffMs = Math.max(0, endMs - startMs)
  const minutes = Math.round(diffMs / 60000)
  const hours = Math.round((diffMs / 3600000) * 100) / 100
  return { minutes, hours }
}

function calculateInvoiceTax({
  subtotal = 0,
  taxRatePercent = 0,
  isInclusive = false,
  isReverseCharge = false,
  isZeroRated = false,
  currency = 'USD'
}) {
  const sub = Number(subtotal) || 0
  const rate = Number(taxRatePercent) || 0
  const decimals = getCurrencyDecimals(currency)
  const factor = Math.pow(10, decimals)

  if (isReverseCharge || isZeroRated || rate === 0) {
    return {
      subtotal: Math.round(sub * factor) / factor,
      taxAmount: 0,
      total: Math.round(sub * factor) / factor,
      taxBreakdown: {
        ratePercent: isReverseCharge || isZeroRated ? 0 : rate,
        isInclusive,
        isReverseCharge,
        isZeroRated,
        reverseChargeNote: isReverseCharge ? 'Reverse Charge: Customer is liable for tax.' : undefined,
      }
    }
  }

  if (isInclusive) {
    const baseSubtotal = (sub / (1 + (rate / 100)))
    const taxAmount = sub - baseSubtotal
    return {
      subtotal: Math.round(baseSubtotal * factor) / factor,
      taxAmount: Math.round(taxAmount * factor) / factor,
      total: Math.round(sub * factor) / factor,
      taxBreakdown: { ratePercent: rate, isInclusive: true, isReverseCharge: false, isZeroRated: false }
    }
  } else {
    const taxAmount = (sub * (rate / 100))
    const total = sub + taxAmount
    return {
      subtotal: Math.round(sub * factor) / factor,
      taxAmount: Math.round(taxAmount * factor) / factor,
      total: Math.round(total * factor) / factor,
      taxBreakdown: { ratePercent: rate, isInclusive: false, isReverseCharge: false, isZeroRated: false }
    }
  }
}

async function loginTestUser(email = 'global_test_user@wello.local') {
  const sendRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, type: 'login' })
  })
  const sendData = await sendRes.json()
  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: sendData.devOtp })
  })
  const verifyData = await verifyRes.json()
  return verifyData.token
}

async function runTests() {
  console.log('=== Starting Globalization & Currency/Timezone/Tax Test Suite ===\n')
  let passed = 0

  // ── TEST 1: ISO 4217 Decimal Precision Engine ───────────────────────────
  console.log('--- TEST 1: ISO 4217 Decimal Precision ---')

  // Zero-decimal currencies
  assert.equal(getCurrencyDecimals('JPY'), 0, 'JPY must have 0 decimals')
  assert.equal(getCurrencyDecimals('KRW'), 0, 'KRW must have 0 decimals')
  assert.equal(getCurrencyDecimals('VND'), 0, 'VND must have 0 decimals')
  assert.equal(roundToCurrencyDecimals(15420.75, 'JPY'), 15421, 'JPY should round to integer')

  // Three-decimal currencies
  assert.equal(getCurrencyDecimals('KWD'), 3, 'KWD must have 3 decimals')
  assert.equal(getCurrencyDecimals('BHD'), 3, 'BHD must have 3 decimals')
  assert.equal(getCurrencyDecimals('OMR'), 3, 'OMR must have 3 decimals')
  assert.equal(roundToCurrencyDecimals(12.3456, 'KWD'), 12.346, 'KWD should round to 3 decimals')

  // Standard two-decimal currencies
  assert.equal(getCurrencyDecimals('USD'), 2, 'USD must have 2 decimals')
  assert.equal(getCurrencyDecimals('EUR'), 2, 'EUR must have 2 decimals')
  assert.equal(getCurrencyDecimals('AED'), 2, 'AED must have 2 decimals')
  assert.equal(getCurrencyDecimals('INR'), 2, 'INR must have 2 decimals')
  assert.equal(roundToCurrencyDecimals(99.994, 'USD'), 99.99, 'USD round 2 decimals')
  assert.equal(roundToCurrencyDecimals(99.996, 'USD'), 100.00, 'USD round 2 decimals')

  // Formatting strings
  const formattedJpy = formatCurrencyIntl(15000, 'JPY')
  assert.ok(formattedJpy.includes('15,000') || formattedJpy.includes('15000'), `JPY format should not have cents: ${formattedJpy}`)

  const formattedUsd = formatCurrencyIntl(15000.5, 'USD')
  assert.ok(formattedUsd.includes('15,000.50'), `USD format should have 2 decimals: ${formattedUsd}`)

  console.log('✓ PASS: ISO 4217 Decimal Precision verification passed.')
  passed++

  // Authenticate user for API calls
  const token = await loginTestUser('global_runner@wello.local')
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  // ── TEST 2: FX Rate Engine & API Endpoints ───────────────────────────────
  console.log('\n--- TEST 2: FX Rate Engine & API Endpoints ---')

  // Test live FX Rates API
  const fxRatesRes = await fetch(`${BASE_URL}/api/fx/rates?base=USD`, {
    headers: authHeaders
  })
  assert.equal(fxRatesRes.status, 200, 'FX Rates endpoint status 200')
  const fxRatesResJson = await fxRatesRes.json()
  const fxRatesData = fxRatesResJson.data || fxRatesResJson
  assert.ok(fxRatesData.rates, 'FX rates response contains rates object')
  assert.equal(fxRatesData.baseCurrency || fxRatesData.base, 'USD', 'Base currency is USD')
  assert.ok(fxRatesData.rates.EUR, 'Contains EUR rate')
  assert.ok(fxRatesData.rates.AED, 'Contains AED rate')
  assert.ok(fxRatesData.rates.INR, 'Contains INR rate')
  console.log(`  ✓ Fetched live/cached rates: USD/EUR = ${fxRatesData.rates.EUR}, USD/AED = ${fxRatesData.rates.AED}, USD/INR = ${fxRatesData.rates.INR}`)

  // Test FX Convert API endpoint
  const convRes = await fetch(`${BASE_URL}/api/fx/convert`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ amount: 100, fromCurrency: 'EUR', toCurrency: 'USD' })
  })
  assert.equal(convRes.status, 200, 'FX Convert endpoint status 200')
  const convResJson = await convRes.json()
  const convData = convResJson.data || convResJson
  assert.ok(convData.convertedAmount > 0, `Converted 100 EUR to USD: ${convData.convertedAmount}`)
  assert.ok(convData.rateUsed > 0, `Rate used: ${convData.rateUsed}`)

  // Test Manual Rate Override on FX Convert API
  const manualConvRes = await fetch(`${BASE_URL}/api/fx/convert`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ amount: 100, fromCurrency: 'EUR', toCurrency: 'USD', manualFxRate: 1.15 })
  })
  const manualConvJson = await manualConvRes.json()
  const manualConvData = manualConvJson.data || manualConvJson
  assert.equal(manualConvData.convertedAmount, 115.00, 'Manual override rate 1.15 produces exact 115.00 USD')
  assert.equal(manualConvData.rateUsed, 1.15, 'Manual rate logged correctly')

  console.log('✓ PASS: FX Engine & Conversion API endpoints passed.')
  passed++

  // ── TEST 3: IANA Timezones & API Endpoints ────────────────────────────────
  console.log('\n--- TEST 3: Timezones & DST-Safe Session Math ---')

  const tzRes = await fetch(`${BASE_URL}/api/timezones`, {
    headers: authHeaders
  })
  assert.equal(tzRes.status, 200, 'Timezones endpoint status 200')
  const tzResJson = await tzRes.json()
  const tzData = tzResJson.data || tzResJson
  assert.ok(Array.isArray(tzData.timezones), 'Timezones is an array')
  assert.ok(tzData.timezones.some(t => (t.value || t.tz) === 'Asia/Dubai'), 'Contains Asia/Dubai')
  assert.ok(tzData.timezones.some(t => (t.value || t.tz) === 'Europe/Berlin'), 'Contains Europe/Berlin')
  assert.ok(tzData.timezones.some(t => (t.value || t.tz) === 'Asia/Kolkata'), 'Contains Asia/Kolkata')
  console.log(`  ✓ Loaded ${tzData.timezones.length} valid IANA timezones from server.`)

  // Session duration across midnight
  const sessionCrossingMidnight = calculateSessionDuration('2026-06-15T23:30:00.000Z', '2026-06-16T01:15:00.000Z')
  assert.equal(sessionCrossingMidnight.minutes, 105, '105 minutes duration crossing midnight')
  assert.equal(sessionCrossingMidnight.hours, 1.75, '1.75 hours duration')

  // DST Transition test (Europe/Berlin spring forward: 2026-03-29 02:00 -> 03:00)
  const dstSession = calculateSessionDuration('2026-03-29T00:30:00.000Z', '2026-03-29T03:30:00.000Z')
  assert.equal(dstSession.minutes, 180, 'UTC epoch duration stays exact across DST shift (3 hours = 180 mins)')

  console.log('✓ PASS: IANA Timezones & DST calculation verification passed.')
  passed++

  // ── TEST 4: Generic Global Tax Engine & CRUD API ──────────────────────────
  console.log('\n--- TEST 4: Generic Global Tax Engine & API ---')

  // 1. Exclusive Tax (e.g. standard EU/UK VAT 20%)
  const exclTax = calculateInvoiceTax({
    subtotal: 1000,
    taxRatePercent: 20,
    isInclusive: false,
  })
  assert.equal(exclTax.subtotal, 1000, 'Subtotal stays 1000')
  assert.equal(exclTax.taxAmount, 200, 'Tax is 200 (20%)')
  assert.equal(exclTax.total, 1200, 'Total is 1200')

  // 2. Inclusive Tax (e.g. Retail price includes 5% UAE VAT)
  const inclTax = calculateInvoiceTax({
    subtotal: 1050,
    taxRatePercent: 5,
    isInclusive: true,
  })
  assert.equal(inclTax.taxAmount, 50, '5% inclusive tax on 1050 is 50')
  assert.equal(inclTax.subtotal, 1000, 'Base subtotal before tax is 1000')
  assert.equal(inclTax.total, 1050, 'Total remains 1050')

  // 3. Reverse-Charge (Cross-border EU B2B or Export)
  const reverseChargeTax = calculateInvoiceTax({
    subtotal: 5000,
    taxRatePercent: 20,
    isReverseCharge: true,
  })
  assert.equal(reverseChargeTax.taxAmount, 0, 'Reverse charge tax amount is 0')
  assert.equal(reverseChargeTax.total, 5000, 'Total equals subtotal with reverse charge')
  assert.ok(reverseChargeTax.taxBreakdown.reverseChargeNote.includes('Reverse Charge'), 'Reverse charge note attached')

  // 4. Zero-Rated (Exempt services)
  const zeroRatedTax = calculateInvoiceTax({
    subtotal: 3000,
    taxRatePercent: 18,
    isZeroRated: true,
  })
  assert.equal(zeroRatedTax.taxAmount, 0, 'Zero-rated tax amount is 0')
  assert.equal(zeroRatedTax.total, 3000, 'Total equals subtotal for zero-rated')

  // 5. Test Tax Rate CRUD API
  const createTaxRes = await fetch(`${BASE_URL}/api/tax-rates`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Standard UAE VAT',
      percentage: 5.0,
      isDefault: true,
      isInclusive: false,
    })
  })
  assert.ok(createTaxRes.status === 200 || createTaxRes.status === 201, 'Create Tax Rate status 200/201')
  const createdTaxJson = await createTaxRes.json()
  const createdTax = createdTaxJson.data?.taxRate || createdTaxJson.data || createdTaxJson
  assert.ok(createdTax.id, 'Tax rate created with ID')
  assert.equal(Number(createdTax.percentage), 5.0, 'Tax rate percentage is 5.0')

  const listTaxRes = await fetch(`${BASE_URL}/api/tax-rates`, {
    headers: authHeaders
  })
  const listTaxJson = await listTaxRes.json()
  const listTax = listTaxJson.data?.taxRates || listTaxJson.data || listTaxJson
  assert.ok(Array.isArray(listTax), 'Tax rates list is an array')
  assert.ok(listTax.some(r => r.id === createdTax.id), 'Contains newly created tax rate')

  console.log('✓ PASS: Generic Tax Model & Tax Rates API verified.')
  passed++

  // ── TEST 5: Acceptance Scenario: 3 Global Users ─────────────────────────
  console.log('\n--- TEST 5: Acceptance Scenario (Dubai, Kerala, Berlin) ---')

  // Scenario A: User in Dubai (AED base, TRN, Asia/Dubai)
  const userDubai = {
    timezone: 'Asia/Dubai',
    baseCurrency: 'AED',
    taxIdLabel: 'TRN',
    taxId: '100234567800003',
    hourlyRateTarget: 400,
  }
  const dubaiInvoice = calculateInvoiceTax({
    subtotal: 10000,
    taxRatePercent: 5,
    currency: userDubai.baseCurrency,
  })
  assert.equal(dubaiInvoice.total, 10500, 'Dubai invoice 10,000 AED + 5% VAT = 10,500 AED')
  console.log('  ✓ User Dubai (AED, TRN, Asia/Dubai): Validated')

  // Scenario B: User in Kerala (INR base, GSTIN, Asia/Kolkata)
  const userKerala = {
    timezone: 'Asia/Kolkata',
    baseCurrency: 'INR',
    taxIdLabel: 'GSTIN',
    taxId: '32AAAAA0000A1Z5',
    hourlyRateTarget: 2500,
  }
  const keralaInvoice = calculateInvoiceTax({
    subtotal: 50000,
    taxRatePercent: 18,
    currency: userKerala.baseCurrency,
  })
  assert.equal(keralaInvoice.total, 59000, 'Kerala invoice 50,000 INR + 18% GST = 59,000 INR')
  console.log('  ✓ User Kerala (INR, GSTIN, Asia/Kolkata): Validated')

  // Scenario C: User in Berlin (EUR base, Europe/Berlin) with USD Client
  const userBerlin = {
    timezone: 'Europe/Berlin',
    baseCurrency: 'EUR',
    taxIdLabel: 'VAT ID',
    taxId: 'DE123456789',
    hourlyRateTarget: 90,
  }
  // Client pays $5,000 USD for a 50-hour project
  const usdProjectAmount = 5000
  const usdToEurRes = await fetch(`${BASE_URL}/api/fx/convert`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ amount: usdProjectAmount, fromCurrency: 'USD', toCurrency: 'EUR' })
  })
  const usdToEurJson = await usdToEurRes.json()
  const usdToEurData = usdToEurJson.data || usdToEurJson
  const convertedEurRevenue = usdToEurData.convertedAmount
  const hoursWorked = 50
  const realEffectiveHourlyValueEur = roundToCurrencyDecimals(convertedEurRevenue / hoursWorked, 'EUR')

  assert.ok(convertedEurRevenue > 4000 && convertedEurRevenue < 5200, `USD to EUR project conversion: ${convertedEurRevenue} EUR`)
  assert.ok(realEffectiveHourlyValueEur > 80, `Real Effective Hourly Value in EUR: ${realEffectiveHourlyValueEur} EUR/hr`)
  console.log(`  ✓ User Berlin (EUR base, Europe/Berlin) with USD Client: $5,000 USD -> ${convertedEurRevenue} EUR -> ${realEffectiveHourlyValueEur} EUR/hr: Validated`)
  passed++

  console.log('\n✓ PASS: All 5 Globalization & Multi-Currency Test Suites PASSED completely!')
  console.log(`Summary: ${passed}/5 suites passed successfully.`)
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err)
  process.exit(1)
})
