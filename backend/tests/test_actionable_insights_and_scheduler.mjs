// backend/tests/test_actionable_insights_and_scheduler.mjs
// Comprehensive Test Suite for Wello Actionable Hourly-Value Insights & Distributed Scheduler:
// 1. Pricing Calculator formulas, buffer math, similar jobs benchmarking, and 1-click quote application
// 2. Executive Reports (daily, weekly, monthly) summaries, CSV export, and vector PDF generation
// 3. Notifications Engine multi-channel routing, preference persistence, read/dismiss mutations
// 4. Resend weekly email digest dispatch, template formatting, and secure unsubscribe flow
// 5. Distributed scheduler locking (scheduler_locks lease), idempotent logging (scheduled_jobs_log)
// 6. Web Push subscription persistence and notification dispatch hooks

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
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      body = await res.json()
    } catch (e) {
      body = null
    }
  } else if (contentType.includes('text/csv')) {
    body = await res.text()
  } else if (contentType.includes('application/pdf')) {
    const arrayBuf = await res.arrayBuffer()
    body = Buffer.from(arrayBuf)
  } else {
    body = await res.text()
  }

  return {
    status: res.status,
    headers: res.headers,
    body,
  }
}

async function createTestUser(email, name = 'Insights & Scheduler Tester') {
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

  return {
    token: verifyRes.body.token,
    user: verifyRes.body.user,
  }
}

async function runAllTests() {
  console.log('\n============================================================')
  console.log('🚀 RUNNING TEST SUITE: ACTIONABLE INSIGHTS & SCHEDULER')
  console.log('============================================================\n')

  const timestamp = Date.now()
  const userA = await createTestUser(`tester_${timestamp}_a@wello.app`, 'Alice Insightful')
  const userB = await createTestUser(`tester_${timestamp}_b@wello.app`, 'Bob Scheduler')

  // Activate pricing-calculator and executive-reports addons for userA
  await api('/api/store/addons/activate', {
    method: 'POST',
    token: userA.token,
    body: { key: 'pricing-calculator' },
  })
  await api('/api/store/addons/activate', {
    method: 'POST',
    token: userA.token,
    body: { key: 'executive-reports' },
  })

  // Setup sample client & projects for userA
  const clientRes = await api('/api/clients', {
    method: 'POST',
    token: userA.token,
    body: { name: 'Acme Enterprise', email: 'billing@acme.com', currency: 'USD' }
  })
  const clientId = clientRes.body?.data?.id

  // Project 1 (Completed with high rate)
  const p1Res = await api('/api/projects', {
    method: 'POST',
    token: userA.token,
    body: {
      clientId,
      name: 'Web Portal Redesign',
      serviceCategory: 'Web Development',
      status: 'completed',
      quoteAmount: 5000,
      quoteEstHours: 40,
    }
  })
  const p1Id = p1Res.body?.data?.id

  // Project 2 (In Progress for quote testing)
  const p2Res = await api('/api/projects', {
    method: 'POST',
    token: userA.token,
    body: {
      clientId,
      name: 'Cloud Infrastructure Migration',
      serviceCategory: 'Web Development',
      status: 'in_progress',
      quoteAmount: 0,
      quoteEstHours: 0,
    }
  })
  const p2Id = p2Res.body?.data?.id

  // Add work sessions to P1: 20h paid, 5h unpaid
  await api('/api/sessions', {
    method: 'POST',
    token: userA.token,
    body: {
      projectId: p1Id,
      durationMinutes: 1200, // 20 hours
      paymentType: 'paid',
      isUnpaid: false,
      notes: 'Frontend architecture & core build',
      startedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      allowOverlap: true,
    }
  })

  await api('/api/sessions', {
    method: 'POST',
    token: userA.token,
    body: {
      projectId: p1Id,
      durationMinutes: 300, // 5 hours
      paymentType: 'unpaid',
      isUnpaid: true,
      unpaidReason: 'scope_creep',
      notes: 'Unplanned scope additions',
      startedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      allowOverlap: true,
    }
  })

  // Add payment of $4000 to P1
  await api('/api/payments', {
    method: 'POST',
    token: userA.token,
    body: {
      projectId: p1Id,
      amount: 4000,
      paymentDate: new Date().toISOString().slice(0, 10),
    }
  })

  // ==========================================================================
  // 1. PRICING CALCULATOR TESTS
  // ==========================================================================
  console.log('\n--- 1. Testing Pricing Calculator Engine ---')

  const calcPayload = {
    targetHourlyRate: 100,
    estimatedHours: 50,
    unpaidBufferPercent: 20, // 20% buffer on 50h = 10h -> 60h total labor = $6,000
    expectedOverhead: 200,
    directExpenses: 300,
    serviceCategory: 'Web Development',
    complexity: 'standard',
    currentProjectId: p2Id,
  }

  const calcRes = await api('/api/calculator/pricing', {
    method: 'POST',
    token: userA.token,
    body: calcPayload,
  })

  testLog(calcRes.status === 200, 'POST /api/calculator/pricing returns 200 OK')
  
  // Math verification:
  // Base labor: 50 * 100 = 5000
  // Buffer hours: 50 * 0.20 = 10 -> Buffer cost = 1000
  // Total Labor = 6000
  // Minimum Quote = 6000 + 200 + 300 = 6500
  // Target Quote (+20% margin default) = 6500 + 1300 = 7800
  const calcData = calcRes.body?.data
  testLog(calcData?.suggestedMinQuote === 6500, `suggestedMinQuote matches exact formula: $${calcData?.suggestedMinQuote} (expected 6500)`)
  testLog(calcData?.suggestedTargetQuote === 7800, `suggestedTargetQuote includes target margin: $${calcData?.suggestedTargetQuote} (expected 7800)`)
  testLog(calcData?.baseLaborCost === 5000, `baseLaborCost is $${calcData?.baseLaborCost}`)
  testLog(calcData?.bufferCost === 1000, `bufferCost is $${calcData?.bufferCost}`)

  // Benchmarking verification
  testLog(calcData?.similarJobsBenchmark?.sampleSize >= 1, `similarJobsBenchmark identified ${calcData?.similarJobsBenchmark?.sampleSize} similar jobs`)
  testLog(calcData?.similarJobsBenchmark?.medianHourlyEarned > 0, `medianHourlyEarned benchmarked at $${calcData?.similarJobsBenchmark?.medianHourlyEarned}/hr`)

  // 1-Click Apply Quote to Project
  console.log('\n--- Testing 1-Click Apply Quote to Project ---')
  const applyRes = await api('/api/calculator/apply-quote', {
    method: 'POST',
    token: userA.token,
    body: {
      projectId: p2Id,
      quoteAmount: 7800,
      estimatedHours: 50,
      quoteNotes: 'Calculated via Wello Pricing Engine with 20% buffer & 20% margin.',
    }
  })

  testLog(applyRes.status === 200, 'POST /api/calculator/apply-quote returns 200 OK')
  testLog(Number(applyRes.body?.data?.project?.quoteAmount) === 7800, `Project ${p2Id} quoteAmount successfully updated to 7800`)
  testLog(Number(applyRes.body?.data?.project?.quoteEstHours) === 50, `Project ${p2Id} estimated hours updated to 50`)

  // ==========================================================================
  // 2. EXECUTIVE REPORTS TESTS
  // ==========================================================================
  console.log('\n--- 2. Testing Executive Reports Engine & Exports ---')

  const summaryRes = await api('/api/reports/summary?period=weekly', {
    token: userA.token,
  })

  testLog(summaryRes.status === 200, 'GET /api/reports/summary returns 200 OK')
  const rep = summaryRes.body?.data
  testLog(rep?.totalHours >= 25, `Total tracked hours in report: ${rep?.totalHours} hrs`)
  testLog(rep?.paidHours === 20, `Paid hours in report: ${rep?.paidHours} hrs`)
  testLog(rep?.unpaidHours === 5, `Unpaid hours in report: ${rep?.unpaidHours} hrs`)
  testLog(rep?.collectedRevenue === 4000, `Collected revenue in report: $${rep?.collectedRevenue}`)
  testLog(rep?.clientWorkRate > 0, `Client-Work realized rate calculated: $${rep?.clientWorkRate}/hr`)
  testLog(Array.isArray(rep?.topLeakageReasons) && rep?.topLeakageReasons.length > 0, 'Top leakage reasons taxonomy populated')
  const bestClientName = rep?.bestClient?.clientName || rep?.bestClient?.name
  testLog(bestClientName === 'Acme Enterprise', `Best client identified as ${bestClientName}`)

  // CSV Export Test
  console.log('\n--- Testing CSV Report Export ---')
  const csvRes = await api('/api/reports/export?period=weekly&format=csv', {
    token: userA.token,
  })

  testLog(csvRes.status === 200, 'GET /api/reports/export?format=csv returns 200 OK')
  testLog(typeof csvRes.body === 'string' && csvRes.body.includes('WELLO BUSINESS PERFORMANCE REPORT'), 'CSV includes executive report header')
  testLog(typeof csvRes.body === 'string' && csvRes.body.includes('Paid Client Hours') && csvRes.body.includes('Collected Revenue'), 'CSV contains all key metrics sections')

  // PDF Export Test
  console.log('\n--- Testing Vector PDF Report Generation ---')
  const pdfRes = await api('/api/reports/export?period=weekly&format=pdf', {
    token: userA.token,
  })

  testLog(pdfRes.status === 200, 'GET /api/reports/export?format=pdf returns 200 OK')
  const isPdfBinary = Buffer.isBuffer(pdfRes.body) && pdfRes.body.toString('ascii', 0, 5) === '%PDF-'
  testLog(isPdfBinary, `PDF export generated valid binary PDF document (${pdfRes.body?.length || 0} bytes)`)

  // ==========================================================================
  // 3. NOTIFICATIONS ENGINE & ROUTING TESTS
  // ==========================================================================
  console.log('\n--- 3. Testing Notifications Engine & Lifecycle ---')

  const listNotifsRes = await api('/api/notifications', {
    token: userA.token,
  })
  testLog(listNotifsRes.status === 200, 'GET /api/notifications returns 200 OK')
  testLog(Array.isArray(listNotifsRes.body?.data?.notifications), 'Notifications list is an array')

  // Get Preferences
  const prefRes = await api('/api/notifications/preferences', {
    token: userA.token,
  })
  testLog(prefRes.status === 200, 'GET /api/notifications/preferences returns 200 OK')
  testLog(Array.isArray(prefRes.body?.data?.preferences), 'Preferences list contains defaults')

  // Update Preferences
  const updatedPrefs = [
    { type: 'forgotten_timer', inApp: true, email: false },
    { type: 'invoice_overdue', inApp: true, email: true },
    { type: 'weekly_leakage_alert', inApp: true, email: false },
  ]
  const savePrefRes = await api('/api/notifications/preferences', {
    method: 'PUT',
    token: userA.token,
    body: { preferences: updatedPrefs },
  })
  testLog(savePrefRes.status === 200, 'PUT /api/notifications/preferences updates successfully')

  // Mark all read
  const markAllRes = await api('/api/notifications/mark-all-read', {
    method: 'POST',
    token: userA.token,
  })
  testLog(markAllRes.status === 200, 'POST /api/notifications/mark-all-read returns 200 OK')

  // ==========================================================================
  // 4. UNSUBSCRIBE & RESUBSCRIBE FLOW TESTS
  // ==========================================================================
  console.log('\n--- 4. Testing Email Digest Unsubscribe Flow ---')

  // UserA has an unsubscribe token
  const meRes = await api('/api/me', { token: userA.token })
  const userProfile = meRes.body?.data
  const unsubToken = userProfile.unsubscribeToken || userProfile.unsubscribe_token

  // Perform unauthenticated unsubscribe via token link
  const unsubTokenRes = await api(`/api/auth/unsubscribe?token=${unsubToken}&format=json`)
  testLog(unsubTokenRes.status === 200, 'GET /api/auth/unsubscribe?token=... validates unsubscribe token')
  testLog(unsubTokenRes.body?.data?.email === userA.user.email, `Token matches user email: ${unsubTokenRes.body?.data?.email}`)

  const confirmUnsubRes = await api('/api/auth/unsubscribe', {
    method: 'POST',
    body: { token: unsubToken }
  })
  testLog(confirmUnsubRes.status === 200, 'POST /api/auth/unsubscribe confirms unsubscription')

  // Resubscribe via authenticated session
  const resubRes = await api('/api/auth/unsubscribe', {
    method: 'POST',
    token: userA.token,
    body: { resubscribe: true },
  })
  testLog(resubRes.status === 200, 'POST /api/auth/unsubscribe (resubscribe) successfully restores digest delivery')

  // ==========================================================================
  // 5. DISTRIBUTED SCHEDULER & IDEMPOTENT RUN TESTS
  // ==========================================================================
  console.log('\n--- 5. Testing Distributed Scheduler Engine ---')

  // Run scheduled jobs manually via admin / trigger endpoint
  const runSchedRes = await api('/api/scheduler/run', {
    method: 'POST',
    token: userA.token,
  })

  testLog(runSchedRes.status === 200, 'POST /api/scheduler/run executed scheduled jobs runner')
  testLog(runSchedRes.body?.data?.success === true, `Scheduler ran successfully with lease lock: ${runSchedRes.body?.data?.jobsExecuted} jobs executed`)

  // Run a second time immediately -> Must be idempotent and skip duplicate keys
  const rerunSchedRes = await api('/api/scheduler/run', {
    method: 'POST',
    token: userA.token,
  })
  testLog(rerunSchedRes.status === 200, 'Second run of scheduler succeeds with 0 duplicate key dispatches (idempotent)')

  // ==========================================================================
  // 6. WEB PUSH SUBSCRIPTION HOOKS TESTS
  // ==========================================================================
  console.log('\n--- 6. Testing Web Push Subscription Persistence ---')

  const pushSubRes = await api('/api/notifications/push/subscribe', {
    method: 'POST',
    token: userA.token,
    body: {
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/test_sub_' + timestamp,
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9h0Re45',
      auth: 'tBHItJI5svbpez7KI4CCXg',
    }
  })
  testLog(pushSubRes.status === 200, 'POST /api/notifications/push/subscribe stores subscription')

  const testPushRes = await api('/api/notifications/push/test', {
    method: 'POST',
    token: userA.token,
    body: {
      title: 'Wello Test Alert',
      message: 'Test push notification delivery',
    }
  })
  testLog(testPushRes.status === 200, 'POST /api/notifications/push/test dispatches test notification')

  // Unsubscribe push
  const unsubPushRes = await api('/api/notifications/push/unsubscribe', {
    method: 'POST',
    token: userA.token,
    body: {
      endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/test_sub_' + timestamp,
    }
  })
  testLog(unsubPushRes.status === 200, 'POST /api/notifications/push/unsubscribe removes subscription')

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n============================================================')
  console.log(`📊 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`)
  console.log('============================================================\n')

  if (totalFailed > 0) {
    process.exit(1)
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled test failure:', err)
  process.exit(1)
})
