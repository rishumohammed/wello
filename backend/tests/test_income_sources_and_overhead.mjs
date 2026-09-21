// backend/tests/test_income_sources_and_overhead.mjs
// Comprehensive Test Suite for Wello Non-Project Income Sources & Overhead Tracking:
// 1. Income sources CRUD & multi-employer wage tracking
// 2. 2-tap Quick Entry atomic session + payment creation
// 3. Active timer targeting income sources
// 4. Recurring expected income generation & 1-click confirmation
// 5. Overhead expenses & allocation rules (per_hour_worked, per_period, per_source, none)
// 6. True salaried rate accounting for commute time & transit costs
// 7. Multi-employer comparison ranking
// 8. Overhead toggle in metrics & backwards compatibility for project-only users

import assert from 'node:assert/strict'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

let totalPassed = 0
let totalFailed = 0

function testLog(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    totalPassed++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    totalFailed++
  }
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let body
  try {
    body = await res.json()
  } catch (e) {
    body = null
  }

  return {
    status: res.status,
    headers: res.headers,
    body,
  }
}

async function createTestUser(email, name = 'Income Sources Tester') {
  const sendRes = await api('/api/auth/send-otp', {
    method: 'POST',
    body: { email, name, type: 'login' },
  })
  if (!sendRes.body?.devOtp) {
    throw new Error(`Failed to send OTP for ${email}: ${JSON.stringify(sendRes.body)}`)
  }

  const verifyRes = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: { email, code: sendRes.body.devOtp, name },
  })

  return verifyRes.body.token
}

async function runIncomeSourcesAndOverheadTests() {
  console.log('==================================================================')
  console.log('🧪 RUNNING WELLO INCOME SOURCES & OVERHEAD TEST SUITE')
  console.log('==================================================================\n')

  const userEmail = `worker.tester.${Date.now()}@example.com`
  const token = await createTestUser(userEmail, 'Jordan Hybrid Worker')
  testLog(Boolean(token), 'Registered and authenticated test user')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Income Sources CRUD & Multiple Employers
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Income Sources CRUD & Multi-Employer Setup ---')

  // Create Salaried Job
  const salaryRes = await api('/api/income-sources', {
    method: 'POST',
    token,
    body: {
      name: 'Tech Corp Full-Time',
      type: 'salary',
      currency: 'USD',
      payFrequency: 'monthly',
      expectedAmount: 8000,
      expectedHoursPerPeriod: 160,
      isActive: true,
    },
  })
  testLog(salaryRes.status === 201 && salaryRes.body?.data?.id, 'Created salaried income source ($8,000/mo)')
  const salarySourceId = salaryRes.body.data.id

  // Create Daily Wage Job (Employer A)
  const dailyRes = await api('/api/income-sources', {
    method: 'POST',
    token,
    body: {
      name: 'Site Construction Co (Employer A)',
      type: 'daily_wage',
      currency: 'USD',
      payFrequency: 'daily',
      expectedAmount: 250,
      expectedHoursPerPeriod: 8,
      isActive: true,
    },
  })
  testLog(dailyRes.status === 201 && dailyRes.body?.data?.id, 'Created daily wage source ($250/day)')
  const dailySourceId = dailyRes.body.data.id

  // Create Hourly Tutoring (Employer B)
  const hourlyRes = await api('/api/income-sources', {
    method: 'POST',
    token,
    body: {
      name: 'Apex Academy Tutoring (Employer B)',
      type: 'hourly_wage',
      currency: 'USD',
      payFrequency: 'weekly',
      expectedAmount: 50,
      expectedHoursPerPeriod: 10,
      isActive: true,
    },
  })
  testLog(hourlyRes.status === 201 && hourlyRes.body?.data?.id, 'Created hourly wage source ($50/hr)')
  const hourlySourceId = hourlyRes.body.data.id

  // Create Retainer Client
  const retainerRes = await api('/api/income-sources', {
    method: 'POST',
    token,
    body: {
      name: 'Design Advisory Retainer',
      type: 'retainer',
      currency: 'USD',
      payFrequency: 'monthly',
      expectedAmount: 1500,
      expectedHoursPerPeriod: 15,
      isActive: true,
    },
  })
  testLog(retainerRes.status === 201 && retainerRes.body?.data?.id, 'Created monthly retainer source ($1,500/mo)')
  const retainerSourceId = retainerRes.body.data.id

  // List all sources
  const listRes = await api('/api/income-sources', { token })
  testLog(listRes.status === 200 && listRes.body?.data?.length === 4, 'Listed all 4 configured income sources')

  // Update a source
  const patchRes = await api(`/api/income-sources/${hourlySourceId}`, {
    method: 'PATCH',
    token,
    body: { expectedAmount: 55 },
  })
  testLog(patchRes.status === 200 && Number(patchRes.body?.data?.expectedAmount) === 55, 'Updated hourly expected rate to $55')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: 2-Tap Quick Entry Flow (Session + Payment without Project)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. 2-Tap Quick Entry Atomic Logger ---')

  const quickEntryRes = await api('/api/quick-entry', {
    method: 'POST',
    token,
    body: {
      incomeSourceId: dailySourceId,
      hours: 8,
      earnedAmount: 250,
      currency: 'USD',
      isPaid: true,
      title: 'Full Day Onsite Framing Shift',
      date: new Date().toISOString().slice(0, 10),
    },
  })

  testLog(
    quickEntryRes.status === 201 &&
    quickEntryRes.body?.data?.session?.id &&
    quickEntryRes.body?.data?.payment?.id,
    'Atomic Quick Entry created work session and paid payment in 1 call'
  )

  const quickSession = quickEntryRes.body.data.session
  const quickPayment = quickEntryRes.body.data.payment
  testLog(
    quickSession.durationMin === 480 &&
    quickSession.incomeSourceId === dailySourceId &&
    quickSession.projectId === null,
    'Quick session recorded 480 minutes (8h) linked directly to income source with null projectId'
  )
  testLog(
    Number(quickPayment.amount) === 250 &&
    quickPayment.incomeSourceId === dailySourceId &&
    quickPayment.projectId === null,
    'Quick payment recorded $250 linked directly to income source'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Active Timer Targeting Income Source
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Active Timer Targeting Income Source ---')

  const timerStartRes = await api('/api/timer/start', {
    method: 'POST',
    token,
    body: {
      incomeSourceId: hourlySourceId,
      title: 'Math Physics Tutoring Session',
    },
  })
  testLog(
    (timerStartRes.status === 200 || timerStartRes.status === 201) &&
    (timerStartRes.body?.data?.timer?.incomeSourceId === hourlySourceId || timerStartRes.body?.data?.activeTimer?.incomeSourceId === hourlySourceId),
    'Started live timer targeting income source'
  )

  // Stop timer and persist
  const timerStopRes = await api('/api/timer/stop', {
    method: 'POST',
    token,
  })
  testLog(
    timerStopRes.status === 200 &&
    timerStopRes.body?.data?.session?.incomeSourceId === hourlySourceId,
    'Stopped timer and successfully saved session linked to income source'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Recurring Expected Income Generation & 1-Click Confirmation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Recurring Expected Income Proposals & Confirmation ---')

  const expectedListRes = await api('/api/expected-payments', { token })
  testLog(
    expectedListRes.status === 200 && Array.isArray(expectedListRes.body?.data),
    'Fetched recurring expected payments list'
  )

  const salaryProposal = expectedListRes.body.data.find(p => p.incomeSourceId === salarySourceId)
  testLog(
    salaryProposal && Number(salaryProposal.amount) === 8000 && salaryProposal.isConfirmed === false,
    'System generated expected payment proposal of $8,000 for monthly salary'
  )

  // Confirm the salary payment for the month
  const confirmRes = await api('/api/expected-payments/confirm', {
    method: 'POST',
    token,
    body: {
      incomeSourceId: salarySourceId,
      amount: 8000,
      currency: 'USD',
      paymentDate: new Date().toISOString().slice(0, 10),
      expectedPeriodStart: salaryProposal.expectedPeriodStart,
      notes: 'Monthly salary confirmed via 1-click confirmation',
    },
  })

  testLog(
    confirmRes.status === 201 &&
    confirmRes.body?.data?.payment?.id &&
    Number(confirmRes.body.data.payment.amount) === 8000,
    'Confirmed recurring monthly salary payment of $8,000'
  )

  // Re-fetch expected payments and verify it is now confirmed
  const expectedAfterConfirmRes = await api('/api/expected-payments', { token })
  const updatedProposal = expectedAfterConfirmRes.body.data.find(p => p.incomeSourceId === salarySourceId)
  testLog(
    updatedProposal && updatedProposal.isConfirmed === true,
    'Expected proposal state reflects isConfirmed = true'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Overhead & Non-Project Costs with Allocation Rules
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Overhead Expenses & Allocation Rules ---')

  // 1. Commute Expense ($120/mo transit pass, allocated per hour worked)
  const commuteRes = await api('/api/overhead-expenses', {
    method: 'POST',
    token,
    body: {
      name: 'Monthly Regional Transit Pass',
      category: 'commute',
      amount: 120,
      currency: 'USD',
      frequency: 'monthly',
      allocationRule: 'per_hour_worked',
    },
  })
  testLog(commuteRes.status === 201 && commuteRes.body?.data?.id, 'Created commute overhead ($120/mo, per_hour_worked)')
  const commuteOverheadId = commuteRes.body.data.id

  // 2. Specific Tool ($80 boots linked to construction source)
  const toolRes = await api('/api/overhead-expenses', {
    method: 'POST',
    token,
    body: {
      name: 'Steel-toe Safety Boots',
      category: 'tool',
      amount: 80,
      currency: 'USD',
      frequency: 'one_off',
      allocationRule: 'per_source',
      incomeSourceId: dailySourceId,
    },
  })
  testLog(toolRes.status === 201 && toolRes.body?.data?.id, 'Created source-specific tool overhead ($80, per_source)')

  // 3. Software ($30/mo IDE, per_period)
  const saasRes = await api('/api/overhead-expenses', {
    method: 'POST',
    token,
    body: {
      name: 'Developer IDE Subscription',
      category: 'software',
      amount: 30,
      currency: 'USD',
      frequency: 'monthly',
      allocationRule: 'per_period',
    },
  })
  testLog(saasRes.status === 201 && saasRes.body?.data?.id, 'Created software subscription ($30/mo, per_period)')

  // List all overheads
  const overheadListRes = await api('/api/overhead-expenses', { token })
  testLog(overheadListRes.status === 200 && overheadListRes.body?.data?.length === 3, 'Listed all 3 overhead expenses')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: True Salaried Rate Accounting for Commute Time & Costs
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Salaried Commute Analysis & True Rate Math ---')

  // Log 160 hours of salaried work (10 days ago)
  const salaryWorkRes = await api('/api/sessions', {
    method: 'POST',
    token,
    body: {
      incomeSourceId: salarySourceId,
      title: 'Monthly Core Engineering Hours',
      durationMinutes: 160 * 60,
      paymentType: 'paid',
      allowOverlap: true,
      startedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      endedAt: new Date(Date.now() - 10 * 86400000 + 160 * 3600000).toISOString(),
    },
  })
  testLog(salaryWorkRes.status === 201, 'Logged 160 hours of salaried contract work')

  // Log 40 hours of unpaid commute time (5 days ago)
  const commuteTimeRes = await api('/api/sessions', {
    method: 'POST',
    token,
    body: {
      incomeSourceId: salarySourceId,
      title: 'Daily Train & Bus Commute',
      durationMinutes: 40 * 60,
      paymentType: 'unpaid',
      unpaidReason: 'commute',
      type: 'commute',
      allowOverlap: true,
      startedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      endedAt: new Date(Date.now() - 5 * 86400000 + 40 * 3600000).toISOString(),
    },
  })
  testLog(commuteTimeRes.status === 201, 'Logged 40 hours of unpaid daily commute time')

  // Fetch metrics summary to verify salaried commute analysis
  const metricsRes = await api('/api/metrics/summary', { token })
  testLog(metricsRes.status === 200, 'Fetched authoritative metrics summary')

  const commuteAnalysis = metricsRes.body?.data?.salariedCommuteAnalysis
  testLog(
    commuteAnalysis &&
    commuteAnalysis.nominalRate > 0 &&
    commuteAnalysis.trueRate > 0 &&
    commuteAnalysis.trueRate < commuteAnalysis.nominalRate,
    `Salaried True Rate correctly calculated: Nominal = $${commuteAnalysis?.nominalRate}/h vs True = $${commuteAnalysis?.trueRate}/h (Drag: ${commuteAnalysis?.commuteDragPct}%)`
  )

  // Verify True Rate formula: ($8000 - $120 commute cost) / (160h work + 40h commute) = 7880 / 200 = 39.40/h
  const expectedTrueRate = Math.round(((8000 - 120) / (160 + 40)) * 100) / 100
  testLog(
    Math.abs(commuteAnalysis.trueRate - expectedTrueRate) <= 1.0,
    `True rate (${commuteAnalysis.trueRate}) matches expected formula value (${expectedTrueRate})`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Multi-Employer Comparison Ranking
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Multi-Employer Comparison Ranking ---')

  const multiEmployer = metricsRes.body?.data?.multiEmployerComparison
  testLog(
    Array.isArray(multiEmployer) && multiEmployer.length >= 2,
    `Multi-employer comparison generated ranking for ${multiEmployer?.length} sources`
  )

  const topEmployer = multiEmployer[0]
  testLog(
    topEmployer && topEmployer.effectiveHourlyRate > 0,
    `Top performing income source identified: "${topEmployer?.name}" at $${topEmployer?.effectiveHourlyRate}/h`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: Earning Persona Profile & Overhead Toggle
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8. Earning Persona & Overhead Toggle ---')

  // Update persona to mixed_hybrid
  const updatePersonaRes = await api('/api/me', {
    method: 'PATCH',
    token,
    body: {
      earningPersona: 'mixed_hybrid',
      includeOverheadInMetrics: true,
    },
  })
  testLog(
    updatePersonaRes.status === 200 &&
    updatePersonaRes.body?.data?.earningPersona === 'mixed_hybrid' &&
    updatePersonaRes.body?.data?.includeOverheadInMetrics === true,
    'Updated user earning persona to "mixed_hybrid" with overhead enabled'
  )

  // Verify sync returns new fields
  const syncRes = await api('/api/sync', { token })
  const syncIncomeSources = syncRes.body?.data?.incomeSources?.records || syncRes.body?.data?.incomeSources
  const syncOverheads = syncRes.body?.data?.overheads?.records || syncRes.body?.data?.overheadExpenses?.records || syncRes.body?.data?.overheads
  testLog(
    syncRes.status === 200 &&
    (syncRes.body?.data?.user?.earningPersona === 'mixed_hybrid' || syncRes.body?.data?.userProfile?.earningPersona === 'mixed_hybrid') &&
    Array.isArray(syncIncomeSources) &&
    Array.isArray(syncOverheads),
    'Sync endpoint returns user persona, income sources, and overheads'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9: Backwards Compatibility for Project-Based Workflows
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 9. Backwards Compatibility for Project-Based Workflows ---')

  const legacyProjRes = await api('/api/projects', {
    method: 'POST',
    token,
    body: {
      name: 'Legacy Freelance Client',
      serviceCategory: 'Design',
      status: 'in_progress',
    },
  })
  const legacyProjId = legacyProjRes.body.data.id

  const legacySessionRes = await api('/api/sessions', {
    method: 'POST',
    token,
    body: {
      projectId: legacyProjId,
      title: 'Brand Design Discovery',
      durationMin: 120,
      paymentType: 'paid',
      allowOverlap: true,
      startedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      endedAt: new Date(Date.now() - 2 * 86400000 + 120 * 60000).toISOString(),
    },
  })
  testLog(
    legacySessionRes.status === 201 &&
    legacySessionRes.body?.data?.projectId === legacyProjId &&
    legacySessionRes.body?.data?.incomeSourceId === null,
    'Traditional project work session works flawlessly without income source'
  )

  const legacyPaymentRes = await api('/api/payments', {
    method: 'POST',
    token,
    body: {
      projectId: legacyProjId,
      amount: 500,
      currency: 'USD',
      paymentDate: new Date().toISOString().slice(0, 10),
    },
  })
  testLog(
    legacyPaymentRes.status === 201 &&
    legacyPaymentRes.body?.data?.projectId === legacyProjId &&
    legacyPaymentRes.body?.data?.incomeSourceId === null,
    'Traditional project payment works flawlessly without income source'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n==================================================================')
  console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`)
  console.log('==================================================================')

  if (totalFailed > 0) {
    process.exit(1)
  }
}

runIncomeSourcesAndOverheadTests().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
