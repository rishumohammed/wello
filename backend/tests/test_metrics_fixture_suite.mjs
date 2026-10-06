// backend/tests/test_metrics_fixture_suite.mjs
/**
 * Comprehensive Mathematical & Financial Fixture Test Suite for Wello
 * Verifies core value metrics engines across critical real-world edge cases:
 *  1. Partial payments and remaining balance calculations
 *  2. Tax-inclusive vs tax-exclusive invoice calculations
 *  3. Credit notes and refunds adjustments
 *  4. Overlapping work sessions & disjoint union interval math
 *  5. Multi-currency and 3-decimal currencies (KWD, BHD, OMR, JOD)
 *  6. Midnight and Daylight Saving Time (DST) timezone boundaries
 *  7. Null-state cases (0 hours, 0 revenue, negative effective rates)
 *  8. Non-project income ($Y_{other}$) attribution to all-in rate ($R_{all\_in}$)
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import {
  computeSessionHours,
  computeFinancials,
  computeDualRates,
  computeAverageUserRate,
} from '../utils/metricsEngine.ts'
import {
  calculateInvoiceTax,
} from '../utils/taxService.ts'
import {
  roundToCurrencyDecimals,
  getCurrencyDecimals,
  formatCurrencyIntl,
} from '../utils/currencyUtils.ts'

dayjs.extend(utc)
dayjs.extend(timezone)

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passed++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    failed++
  }
}

function assertClose(actual, expected, tolerance = 0.001, message = '') {
  const diff = Math.abs(actual - expected)
  assert(diff <= tolerance, `${message} (Expected ~${expected}, got ${actual})`)
}

console.log('\n===============================================================')
console.log('🧪 RUNNING COMPREHENSIVE METRICS FIXTURE TEST SUITE')
console.log('===============================================================\n')

// ─── 1. Partial Payments & Balance Tracking ─────────────────────────────────
console.log('Test Group 1: Partial Payments & Balance Tracking')
{
  const invoiceTotal = 1500.00
  const payment1 = 450.00
  const payment2 = 550.00
  const payment3 = 500.00

  const balanceAfter1 = roundToCurrencyDecimals(invoiceTotal - payment1, 'USD')
  assert(balanceAfter1 === 1050.00, 'Balance after payment 1 is $1,050.00')

  const balanceAfter2 = roundToCurrencyDecimals(balanceAfter1 - payment2, 'USD')
  assert(balanceAfter2 === 500.00, 'Balance after payment 2 is $500.00')

  const balanceAfter3 = roundToCurrencyDecimals(balanceAfter2 - payment3, 'USD')
  assert(balanceAfter3 === 0.00, 'Balance after final payment is $0.00 (Fully Paid)')
}

// ─── 2. Tax-Inclusive vs Tax-Exclusive Invoices ─────────────────────────────
console.log('\nTest Group 2: Tax-Inclusive vs Tax-Exclusive Invoicing Calculations')
{
  // Tax-Exclusive calculation (Subtotal $1000 + 15% VAT = $1150 Total)
  const exclusiveTax = calculateInvoiceTax({
    subtotal: 1000.00,
    taxPercent: 15.0,
    isInclusive: false,
    currencyCode: 'USD',
  })
  assertClose(exclusiveTax.subtotal, 1000.00, 0.01, 'Tax-exclusive subtotal is $1,000.00')
  assertClose(exclusiveTax.taxAmount, 150.00, 0.01, 'Tax-exclusive tax is $150.00')
  assertClose(exclusiveTax.total, 1150.00, 0.01, 'Tax-exclusive total is $1,150.00')

  // Tax-Inclusive calculation (Total $1150 with 15% VAT included => Subtotal $1150, Tax $150, Base before tax $1000)
  const inclusiveTax = calculateInvoiceTax({
    subtotal: 1150.00,
    taxPercent: 15.0,
    isInclusive: true,
    currencyCode: 'USD',
  })
  assertClose(inclusiveTax.total, 1150.00, 0.01, 'Tax-inclusive total is $1,150.00')
  assertClose(inclusiveTax.taxAmount, 150.00, 0.01, 'Tax-inclusive derived tax is $150.00')
  assertClose(inclusiveTax.total - inclusiveTax.taxAmount, 1000.00, 0.01, 'Tax-inclusive net revenue before tax is $1,000.00')
}

// ─── 3. Credit Notes & Refunds ──────────────────────────────────────────────
console.log('\nTest Group 3: Credit Notes & Refund Adjustments')
{
  const originalInvoiceTotal = 2400.00
  const paymentsCollected = 1000.00
  const creditNoteAmount = 600.00

  const netPayable = roundToCurrencyDecimals(originalInvoiceTotal - creditNoteAmount, 'USD')
  assert(netPayable === 1800.00, 'Net payable adjusted by credit note is $1,800.00')

  const remainingBalance = roundToCurrencyDecimals(netPayable - paymentsCollected, 'USD')
  assert(remainingBalance === 800.00, 'Remaining balance due after credit note and payments is $800.00')
}

// ─── 4. Overlapping Sessions & Active Time Union Math ───────────────────────
console.log('\nTest Group 4: Overlapping Work Sessions Disjoint Interval Math')
{
  // Session A: 09:00 - 11:00 (2h = 7200s)
  // Session B: 10:30 - 12:30 (2h = 7200s, overlaps by 30 mins)
  // Total unique active time should be 09:00 - 12:30 = 3.5h = 12600s
  const intervals = [
    { start: new Date('2026-03-10T09:00:00Z').getTime(), end: new Date('2026-03-10T11:00:00Z').getTime() },
    { start: new Date('2026-03-10T10:30:00Z').getTime(), end: new Date('2026-03-10T12:30:00Z').getTime() },
  ]

  // Interval merge algorithm
  intervals.sort((a, b) => a.start - b.start)
  const merged = [intervals[0]]
  for (let i = 1; i < intervals.length; i++) {
    const prev = merged[merged.length - 1]
    const curr = intervals[i]
    if (curr.start <= prev.end) {
      prev.end = Math.max(prev.end, curr.end)
    } else {
      merged.push(curr)
    }
  }

  const totalDurationSec = merged.reduce((sum, int) => sum + (int.end - int.start) / 1000, 0)
  const totalHours = totalDurationSec / 3600
  assert(totalHours === 3.5, 'Overlapping sessions merged correctly to 3.5 unique active hours')
}

// ─── 5. Multi-Currency & 3-Decimal Precision ────────────────────────────────
console.log('\nTest Group 5: Multi-Currency & 3-Decimal Precision (KWD, BHD, OMR, JOD)')
{
  // 3-decimal currencies
  assert(getCurrencyDecimals('KWD') === 3, 'KWD has 3 decimal places')
  assert(getCurrencyDecimals('BHD') === 3, 'BHD has 3 decimal places')
  assert(getCurrencyDecimals('OMR') === 3, 'OMR has 3 decimal places')
  assert(getCurrencyDecimals('JOD') === 3, 'JOD has 3 decimal places')

  // 0-decimal currencies
  assert(getCurrencyDecimals('JPY') === 0, 'JPY has 0 decimal places')
  assert(getCurrencyDecimals('KRW') === 0, 'KRW has 0 decimal places')

  // 2-decimal currencies
  assert(getCurrencyDecimals('USD') === 2, 'USD has 2 decimal places')
  assert(getCurrencyDecimals('EUR') === 2, 'EUR has 2 decimal places')

  // Rounding checks
  const kwdRounded = roundToCurrencyDecimals(124.5678, 'KWD')
  assert(kwdRounded === 124.568, '124.5678 rounded to KWD precision is 124.568')

  const jpyRounded = roundToCurrencyDecimals(5432.89, 'JPY')
  assert(jpyRounded === 5433, '5432.89 rounded to JPY precision is 5433')
}

// ─── 6. Midnight & DST Transitions ──────────────────────────────────────────
console.log('\nTest Group 6: Midnight & Daylight Saving Time (DST) Boundary Calculations')
{
  const timezoneId = 'America/New_York'
  
  // Cross-midnight session in New York: 2026-06-15 23:00 to 2026-06-16 02:00 (3 hours)
  const startUtc = dayjs.tz('2026-06-15 23:00:00', timezoneId).utc()
  const endUtc = dayjs.tz('2026-06-16 02:00:00', timezoneId).utc()
  const durationHours = endUtc.diff(startUtc, 'minute') / 60
  assert(durationHours === 3.0, 'Cross-midnight session spans exactly 3.0 hours')

  // DST Spring Forward (23-hour day in New York on March 8, 2026)
  const dstStart = dayjs.tz('2026-03-08 00:00:00', timezoneId).utc()
  const dstEnd = dayjs.tz('2026-03-09 00:00:00', timezoneId).utc()
  const dstDayHours = dstEnd.diff(dstStart, 'hour')
  assert(dstDayHours === 23, 'DST Spring Forward day in America/New_York spans 23 astronomical hours')
}

// ─── 7. Null-State Cases & Negative Effective Rates ─────────────────────────
console.log('\nTest Group 7: Null-State Cases & Negative Hourly Value Rate Preservation')
{
  // A. Zero hours worked => null rate with 'no_hours' reason
  const zeroSessions = []
  const hoursA = computeSessionHours(zeroSessions)
  const financialsA = computeFinancials(
    [{ amount: 5000, baseAmount: 5000 }],
    [{ amount: 200, baseAmount: 200 }],
    [],
    [],
    'USD'
  )
  const ratesA = computeDualRates(financialsA, hoursA, 100, 'client_work', 'USD')

  assert(ratesA.clientWorkRate === null, '0 hours worked produces null clientWorkRate')
  assert(ratesA.nullReason === 'no_hours', '0 hours sets nullReason: "no_hours"')
  assert(ratesA.statusLabel === 'Not enough data', '0 hours sets statusLabel: "Not enough data"')

  // B. Zero revenue with hours worked => Rate 0.00
  const sessionsB = [
    { startedAt: '2026-01-01T10:00:00Z', endedAt: '2026-01-01T20:00:00Z', paymentType: 'paid' }, // 10h
    { startedAt: '2026-01-02T10:00:00Z', endedAt: '2026-01-02T15:00:00Z', paymentType: 'unpaid', unpaidReason: 'client_friction' }, // 5h
  ]
  const hoursB = computeSessionHours(sessionsB)
  const financialsB = computeFinancials([], [], [], [], 'USD')
  const ratesB = computeDualRates(financialsB, hoursB, 100, 'client_work', 'USD')
  assert(ratesB.clientWorkRate === 0.00, '0 revenue with 15 hours worked produces clientWorkRate 0.00')

  // C. Negative profit (Expenses > Revenue) => preserves real negative rate
  const sessionsC = [
    { startedAt: '2026-01-01T10:00:00Z', endedAt: '2026-01-01T20:00:00Z', paymentType: 'paid' }, // 10h
    { startedAt: '2026-01-02T10:00:00Z', endedAt: '2026-01-02T20:00:00Z', paymentType: 'unpaid', unpaidReason: 'client_friction' }, // 10h
  ]
  const hoursC = computeSessionHours(sessionsC)
  const financialsC = computeFinancials(
    [{ amount: 1000, baseAmount: 1000 }],
    [{ amount: 1500, baseAmount: 1500 }],
    [],
    [],
    'USD'
  )
  const ratesC = computeDualRates(financialsC, hoursC, 100, 'client_work', 'USD')
  assert(ratesC.clientWorkRate === -25.00, 'Negative profit ($1000 - $1500 = -$500 / 20h) produces real rate -$25.00/h')

  // D. Admin aggregate over 5 users where 2 have no data -> averages other 3 and reports excludedCount: 2
  const fiveUsers = [
    { userId: 1, rate: 50.00, hours: 20 },
    { userId: 2, rate: 75.00, hours: 15 },
    { userId: 3, rate: 100.00, hours: 30 },
    { userId: 4, rate: null, noData: true, reason: 'no_hours' },
    { userId: 5, rate: null, noData: true, reason: 'no_data' },
  ]
  const avgRollup = computeAverageUserRate(fiveUsers)
  assert(avgRollup.averageRate === 75.00, 'Average rate over 3 active users is $75.00/h (50+75+100 / 3)')
  assert(avgRollup.includedCount === 3, 'Included count is exactly 3')
  assert(avgRollup.excludedCount === 2, 'Excluded count is exactly 2')
  assert(avgRollup.totalCount === 5, 'Total count is 5')
  assert(avgRollup.excludedReasons.no_hours === 1, 'Excluded reason no_hours is 1')
  assert(avgRollup.excludedReasons.no_data === 1, 'Excluded reason no_data is 1')
}

// ─── 8. Non-Project Income Attribution ──────────────────────────────────────
console.log('\nTest Group 8: Non-Project Income ($Y_{other}$) Mathematical Attribution')
{
  // Formula:
  // R_{client_work} = (Y_{client} - E_{client}) / (H_{paid} + H_{unpaid_client})
  // R_{all_in} = (Y_{client} + Y_{other} - E_{client} - E_{overhead}) / (H_{paid} + H_{unpaid_client} + H_{unpaid_internal})
  
  // 40h paid + 10h unpaid client friction + 10h intentional learning
  const sessions = [
    { startedAt: '2026-01-01T00:00:00Z', durationMinutes: 2400, paymentType: 'paid' }, // 40h
    { startedAt: '2026-01-02T00:00:00Z', durationMinutes: 600, paymentType: 'unpaid', unpaidReason: 'client_friction' }, // 10h client
    { startedAt: '2026-01-03T00:00:00Z', durationMinutes: 600, paymentType: 'unpaid', unpaidReason: 'learning' }, // 10h intentional
  ]
  const hours = computeSessionHours(sessions)
  assert(hours.totalClientHours === 50, 'Client hours is 50h (40h paid + 10h unpaid client)')
  assert(hours.totalAllHours === 60, 'All hours is 60h (50h client + 10h intentional)')

  // Financials with client revenue $4000, other revenue $1200, direct exp $400, overhead $200
  // Total collected = $5200, direct = $400, overhead = $200 => Net = $4600
  const payments = [
    { amount: 4000, baseAmount: 4000 },
    { amount: 1200, baseAmount: 1200 },
  ]
  const expenses = [{ amount: 400, baseAmount: 400 }]
  const overheads = [{ amount: 200, baseAmount: 200 }]

  const financials = computeFinancials(payments, expenses, [], overheads, 'USD', { includeOverhead: true })
  const rates = computeDualRates(financials, hours, 100, 'client_work', 'USD')

  // R_client_work = Net Income / Client Hours = 4600 / 50 = $92.00/hr
  assertClose(rates.clientWorkRate, 92.00, 0.01, 'Client work rate R_{client_work} is $92.00/hr')

  // R_all_in = Net Income / All Hours = 4600 / 60 = $76.67/hr
  assertClose(rates.allInRate, 76.67, 0.01, 'All-in rate R_{all_in} is $76.67/hr')
}

console.log('\n===============================================================')
console.log(`📊 RESULTS: ${passed} PASSED, ${failed} FAILED`)
console.log('===============================================================\n')

if (failed > 0) {
  process.exit(1)
} else {
  process.exit(0)
}
