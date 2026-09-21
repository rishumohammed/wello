// backend/tests/test_metrics_engine.mjs
// Comprehensive test suite for Authoritative Metrics Engine, Dual Rates, Earned vs Collected Financials,
// Unified Unpaid Taxonomy, Zero-safe Division, and 6 Intelligence Insights

import assert from 'node:assert/strict'
import {
  computeSessionHours,
  computeFinancials,
  computeDualRates,
  computeUnifiedMetricsSummary,
  computeIntelligenceInsights,
  categorizeUnpaidReason,
  UNPAID_TAXONOMY,
} from '../../frontend/utils/metricsEngine.js'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001'

console.log('─────────────────────────────────────────────────────────────────────────────')
console.log('🧪 RUNNING AUTHORITATIVE METRICS ENGINE & INTELLIGENCE TEST SUITE')
console.log('─────────────────────────────────────────────────────────────────────────────\n')

let passedTests = 0

function runTest(name, fn) {
  try {
    fn()
    console.log(`  ✅ PASS: ${name}`)
    passedTests++
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`)
    console.error(err)
    process.exit(1)
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn()
    console.log(`  ✅ PASS: ${name}`)
    passedTests++
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`)
    console.error(err)
    process.exit(1)
  }
}

// ── TEST 1: Unpaid Taxonomy Classification ───────────────────────────────────

runTest('Taxonomy: Correctly categorizes all 6 unpaid_client reasons', () => {
  const clientReasons = ['scope_creep', 'revisions_beyond_scope', 'pitching', 'client_friction', 'admin_overhead', 'uncollectible']
  for (const reason of clientReasons) {
    const cat = categorizeUnpaidReason(reason, 'unpaid')
    assert.strictEqual(cat, 'unpaid_client', `Reason ${reason} should be categorized as unpaid_client`)
  }
})

runTest('Taxonomy: Correctly categorizes all 5 intentional_unpaid reasons', () => {
  const intentionalReasons = ['learning', 'portfolio', 'charity', 'strategic', 'personal']
  for (const reason of intentionalReasons) {
    const cat = categorizeUnpaidReason(reason, 'intentional_unpaid')
    assert.strictEqual(cat, 'intentional_unpaid', `Reason ${reason} should be categorized as intentional_unpaid`)
  }
})

// ── TEST 2: Session Hours Breakdown ──────────────────────────────────────────

runTest('Hours Engine: Computes exact paid, unpaid-client, and intentional-unpaid hours', () => {
  const sessions = [
    { id: 's1', durationMin: 120, paymentType: 'paid' },                         // 2h paid
    { id: 's2', durationMin: 60, paymentType: 'unpaid', unpaidReason: 'scope_creep' }, // 1h unpaid client
    { id: 's3', durationMin: 30, paymentType: 'unpaid', unpaidReason: 'pitching' },    // 0.5h unpaid client
    { id: 's4', durationMin: 90, paymentType: 'intentional_unpaid', unpaidReason: 'learning' }, // 1.5h intentional
  ]

  const hours = computeSessionHours(sessions)
  assert.strictEqual(hours.paidMinutes, 120)
  assert.strictEqual(hours.paidHours, 2.0)
  assert.strictEqual(hours.unpaidClientMinutes, 90)
  assert.strictEqual(hours.unpaidClientHours, 1.5)
  assert.strictEqual(hours.intentionalUnpaidMinutes, 90)
  assert.strictEqual(hours.intentionalUnpaidHours, 1.5)
  assert.strictEqual(hours.clientWorkMinutes, 210) // 120 + 90
  assert.strictEqual(hours.clientWorkHours, 3.5)
  assert.strictEqual(hours.totalAllMinutes, 300) // 210 + 90
  assert.strictEqual(hours.totalAllHours, 5.0)
  assert.strictEqual(hours.unpaidRatioPct, 60) // (90 + 90) / 300 = 60%
})

// ── TEST 3: Zero Hours Safety & Divide-by-Zero Elimination ───────────────────

runTest('Dual Rates: Safely handles zero hours without NaN, returning 0 with isZeroHours flag', () => {
  const financials = {
    collectedRevenue: 1000,
    earnedRevenue: 1000,
    directExpenses: 100,
    collectedNetIncome: 900,
    earnedNetIncome: 900,
    outstandingRevenue: 0,
    overheadExpenses: 0,
  }

  const zeroHours = {
    paidMinutes: 0,
    paidHours: 0,
    unpaidClientMinutes: 0,
    unpaidClientHours: 0,
    intentionalUnpaidMinutes: 0,
    intentionalUnpaidHours: 0,
    clientWorkMinutes: 0,
    clientWorkHours: 0,
    totalAllMinutes: 0,
    totalAllHours: 0,
    unpaidRatioPct: 0,
  }

  const rates = computeDualRates(financials, zeroHours, 100, 'client_work', 'USD')
  assert.strictEqual(rates.clientWorkRate, 0)
  assert.strictEqual(rates.allInRate, 0)
  assert.strictEqual(rates.headlineRate, 0)
  assert.strictEqual(rates.isZeroHours, true)
  assert.strictEqual(Number.isNaN(rates.clientWorkRate), false)
  assert.strictEqual(Number.isFinite(rates.clientWorkRate), true)
})

// ── TEST 4: Dual Rates Computation (Client-Work vs All-In) ──────────────────

runTest('Dual Rates: Computes exact Client-Work Rate vs All-In Rate', () => {
  const financials = {
    collectedRevenue: 5000,
    earnedRevenue: 5000,
    directExpenses: 500,
    collectedNetIncome: 4500,
    earnedNetIncome: 4500,
    outstandingRevenue: 0,
    overheadExpenses: 0,
  }

  const hours = {
    paidMinutes: 300,            // 5h
    paidHours: 5.0,
    unpaidClientMinutes: 120,     // 2h -> clientWorkHours = 7h
    unpaidClientHours: 2.0,
    intentionalUnpaidMinutes: 180,// 3h -> totalAllHours = 10h
    intentionalUnpaidHours: 3.0,
    clientWorkMinutes: 420,
    clientWorkHours: 7.0,
    totalAllMinutes: 600,
    totalAllHours: 10.0,
    unpaidRatioPct: 28.57,
  }

  // Client Work Rate = 4500 / 7h = 642.86
  // All In Rate = 4500 / 10h = 450.00
  const ratesClientPref = computeDualRates(financials, hours, 500, 'client_work', 'USD')
  assert.strictEqual(ratesClientPref.clientWorkRate, 642.86)
  assert.strictEqual(ratesClientPref.allInRate, 450)
  assert.strictEqual(ratesClientPref.headlineRate, 642.86)
  assert.strictEqual(ratesClientPref.isTargetMet, true)

  const ratesAllInPref = computeDualRates(financials, hours, 500, 'all_in', 'USD')
  assert.strictEqual(ratesAllInPref.headlineRate, 450)
  assert.strictEqual(ratesAllInPref.isTargetMet, false)
})

// ── TEST 5: Earned Revenue vs Collected Revenue in-progress ──────────────────

runTest('Financials: Computes Earned Revenue & Outstanding Balance for in-progress projects', () => {
  const projects = [
    {
      id: 'p1',
      status: 'in_progress',
      isJob: true,
      currency: 'USD',
      quoteAmount: 10000,
      quoteStatus: 'accepted',
    },
  ]

  const payments = [
    { id: 'pmt1', projectId: 'p1', amount: 3000, baseAmount: 3000 }, // $3000 deposit collected
  ]

  const expenses = [
    { id: 'exp1', projectId: 'p1', amount: 400, baseAmount: 400 },
  ]

  const invoices = [
    { id: 'inv1', projectId: 'p1', totalAmount: 6000, baseTotalAmount: 6000, status: 'issued' }, // $6000 invoiced
  ]

  const fin = computeFinancials(payments, expenses, projects, invoices, 'USD')
  assert.strictEqual(fin.collectedRevenue, 3000)
  assert.strictEqual(fin.earnedRevenue, 10000) // max(collected=3000, invoiced=6000, acceptedQuote=10000)
  assert.strictEqual(fin.outstandingRevenue, 7000) // 10000 - 3000 = 7000
  assert.strictEqual(fin.directExpenses, 400)
  assert.strictEqual(fin.collectedNetIncome, 2600)
  assert.strictEqual(fin.earnedNetIncome, 9600)
})

// ── TEST 6: Refunds and Partial Payments ─────────────────────────────────────

runTest('Financials: Properly accounts for refunds (negative payment records)', () => {
  const projects = [{ id: 'p1', status: 'completed', currency: 'USD' }]
  const payments = [
    { id: 'pmt1', projectId: 'p1', amount: 2000, baseAmount: 2000 },
    { id: 'pmt2', projectId: 'p1', amount: -500, baseAmount: -500 }, // Refund
  ]
  const expenses = []

  const fin = computeFinancials(payments, expenses, projects, [], 'USD')
  assert.strictEqual(fin.collectedRevenue, 1500)
  assert.strictEqual(fin.collectedNetIncome, 1500)
})

// ── TEST 7: Intelligence Insights Generation ─────────────────────────────────

runTest('Intelligence Engine: Produces all 6 diagnostics (Velocity, Leakage, Yield, Profitability, Quotes, Variance)', () => {
  const projects = [
    {
      id: 'p1',
      clientId: 'c1',
      serviceCategory: 'Web Development',
      status: 'in_progress',
      isJob: true,
      quoteAmount: 5000,
      quoteEstHours: 20,
      quoteStatus: 'accepted',
      createdAt: '2026-08-01T10:00:00Z',
    },
    {
      id: 'p2',
      clientId: 'c2',
      serviceCategory: 'Consulting',
      status: 'lost',
      isJob: false,
      quoteAmount: 2000,
      quoteEstHours: 10,
      quoteStatus: 'declined',
      createdAt: '2026-08-05T10:00:00Z',
    },
  ]

  const sessions = [
    { id: 's1', projectId: 'p1', startedAt: '2026-08-01T10:00:00Z', durationMin: 1200, paymentType: 'paid' }, // 20h paid
    { id: 's2', projectId: 'p1', startedAt: '2026-08-02T10:00:00Z', durationMin: 300, paymentType: 'unpaid', unpaidReason: 'scope_creep' }, // 5h creep
    { id: 's3', projectId: 'p2', startedAt: '2026-08-05T10:00:00Z', durationMin: 180, paymentType: 'unpaid', unpaidReason: 'pitching' }, // 3h pitching
  ]

  const payments = [
    { id: 'pmt1', projectId: 'p1', amount: 5000, baseAmount: 5000, paidDate: '2026-08-10' }, // 9 days from kickoff
  ]

  const expenses = [
    { id: 'exp1', projectId: 'p1', amount: 500, baseAmount: 500, expenseDate: '2026-08-03' },
  ]

  const insights = computeIntelligenceInsights(
    sessions,
    payments,
    expenses,
    projects,
    [{ id: 'c1', name: 'Acme', company: 'Acme Inc' }, { id: 'c2', name: 'Beta', company: 'Beta LLC' }],
    100,
    'USD'
  )

  // 1. Time-to-Money Velocity
  assert.strictEqual(insights.timeToMoney.completedCycleCount, 1)
  assert.strictEqual(insights.timeToMoney.avgDaysToPayment, 9)

  // 2. Unpaid Leakage
  assert.strictEqual(insights.unpaidLeakage.length, 2)
  const creepReason = insights.unpaidLeakage.find((r) => r.reasonKey === 'scope_creep')
  assert.strictEqual(creepReason.hours, 5)
  assert.strictEqual(creepReason.estimatedOpportunityCost, 500)

  // 3. Quotes Win Rate
  assert.strictEqual(insights.proposalWinRate.totalQuotes, 2)
  assert.strictEqual(insights.proposalWinRate.wonQuotes, 1)
  assert.strictEqual(insights.proposalWinRate.lostQuotes, 1)
  assert.strictEqual(insights.proposalWinRate.winRatePct, 50)

  // 4. Effort Variance
  // actual hours = 25h vs 20h estimated
  assert.strictEqual(insights.effortQuoteVariance.length, 2)
  const p1Var = insights.effortQuoteVariance.find((v) => v.projectId === 'p1')
  assert.strictEqual(p1Var.actualHours, 25)
  assert.strictEqual(p1Var.estimatedHours, 20)
  assert.strictEqual(p1Var.isOverBudget, true)

  // 5. Category Yield
  assert.strictEqual(insights.categoryYield.length, 2)
  const webDev = insights.categoryYield.find((c) => c.category === 'Web Development')
  assert.strictEqual(webDev.netIncome, 4500)
  assert.strictEqual(webDev.effectiveHourlyRate, 180) // 4500 / 25h = 180
})

// ── TEST 8: Server API Integration (GET /api/metrics/summary & insights) ─────

async function testServerApiEndpoints() {
  const authEmail = `metrics_test_${Date.now()}@example.com`

  // 1. Authenticate via dev auth
  const sendRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: authEmail, type: 'login' }),
  })
  const sendData = await sendRes.json()
  const code = sendData.devOtp || '123456'

  const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: authEmail, code }),
  })
  const authData = await verifyRes.json()
  const token = authData.token || authData.data?.token
  assert.ok(token, 'Must receive auth token from verify endpoint')

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }

  // 2. Configure user preferences (headlineRateMetric = 'client_work')
  await fetch(`${BASE_URL}/api/me`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      targetHourly: 150,
      baseCurrency: 'USD',
      headlineRateMetric: 'client_work',
    }),
  })

  // 3. Create a test project, sessions, and payment
  const projRes = await fetch(`${BASE_URL}/api/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Metrics Test Project',
      serviceCategory: 'Engineering',
      status: 'in_progress',
      isJob: true,
      currency: 'USD',
      quoteAmount: 3000,
      quoteEstHours: 15,
      quoteStatus: 'accepted',
    }),
  })
  const proj = (await projRes.json()).data
  assert.ok(proj?.id, 'Must create project')

  // Log paid session (10h)
  await fetch(`${BASE_URL}/api/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: proj.id,
      title: 'Paid Feature Dev',
      type: 'production',
      paymentType: 'paid',
      durationMinutes: 600,
      allowOverlap: true,
    }),
  })

  // Log unpaid client session (2h scope creep)
  await fetch(`${BASE_URL}/api/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: proj.id,
      title: 'Scope Creep Meeting',
      type: 'meeting',
      paymentType: 'unpaid',
      unpaidReason: 'scope_creep',
      durationMinutes: 120,
      allowOverlap: true,
    }),
  })

  // Log intentional unpaid session (3h learning)
  await fetch(`${BASE_URL}/api/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: proj.id,
      title: 'Learning New Library',
      type: 'planning',
      paymentType: 'intentional_unpaid',
      unpaidReason: 'learning',
      durationMinutes: 180,
      allowOverlap: true,
    }),
  })

  // Add $1800 payment
  await fetch(`${BASE_URL}/api/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      projectId: proj.id,
      amount: 1800,
      paidDate: new Date().toISOString().slice(0, 10),
    }),
  })

  // 4. Test GET /api/metrics/summary
  const summaryRes = await fetch(`${BASE_URL}/api/metrics/summary?range=30d`, { headers })
  const summaryJson = await summaryRes.json()
  if (!summaryJson.success) {
    console.error('Summary API Error:', summaryRes.status, summaryJson)
  }
  assert.strictEqual(summaryJson.success, true)
  const summary = summaryJson.data?.summary || summaryJson.data
  assert.ok(summary.rates, 'Summary must return rates')
  assert.ok(summary.financials, 'Summary must return financials')
  assert.ok(summary.hours, 'Summary must return hours')

  // Client work hours = 10h + 2h = 12h. Net = 1800. Client-Work Rate = 1800 / 12 = 150
  assert.strictEqual(summary.financials.collectedRevenue, 1800)
  assert.strictEqual(summary.hours.paidHours, 10)
  assert.strictEqual(summary.hours.unpaidClientHours, 2)
  assert.strictEqual(summary.hours.intentionalUnpaidHours, 3)
  assert.strictEqual(summary.rates.clientWorkRate, 150)
  // All in hours = 15h. Net = 1800. All-In Rate = 1800 / 15 = 120
  assert.strictEqual(summary.rates.allInRate, 120)
  assert.strictEqual(summary.rates.headlineRate, 150)

  // 5. Test GET /api/metrics/insights
  const insightsRes = await fetch(`${BASE_URL}/api/metrics/insights`, { headers })
  const insightsJson = await insightsRes.json()
  assert.strictEqual(insightsJson.success, true)
  const intel = insightsJson.data?.insights || insightsJson.data
  assert.ok(intel.timeToMoney, 'Must include timeToMoney diagnostics')
  assert.ok(intel.unpaidLeakage, 'Must include unpaid leakage')
  assert.ok(intel.categoryYield, 'Must include category yield')
  assert.ok(intel.clientProfitability, 'Must include client profitability')
  assert.ok(intel.proposalWinRate, 'Must include quote diagnostics')
  assert.ok(intel.effortQuoteVariance, 'Must include effort variance')

  assert.strictEqual(intel.proposalWinRate.winRatePct, 100)
  assert.strictEqual(intel.unpaidLeakage.length, 1)
  assert.strictEqual(intel.unpaidLeakage[0].reasonKey, 'scope_creep')
  assert.strictEqual(intel.unpaidLeakage[0].hours, 2)
}

await runAsyncTest('Server API: GET /api/metrics/summary and /api/metrics/insights return authoritative diagnostics', testServerApiEndpoints)

console.log('\n─────────────────────────────────────────────────────────────────────────────')
console.log(`🎉 ALL ${passedTests} METRICS ENGINE & INTELLIGENCE TESTS PASSED PERFECTLY!`)
console.log('─────────────────────────────────────────────────────────────────────────────\n')
