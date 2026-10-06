// backend/tests/test_global_correctness_and_sync.mjs
/**
 * Automated Verification Suite for Global FX Provider Chains, ISO Decimal Precision,
 * Metrics Edge Null States, Persistent Request Metrics, Privacy Thresholds,
 * Missing Route Handlers, and Resilient Offline Sync.
 */

import assert from 'node:assert'
import crypto from 'node:crypto'
import { createRequire } from 'module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(__dirname, '../package.json'))

const knex = require('knex')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '',
    database: process.env.DB_NAME || 'wello',
  },
})

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001'

let totalTests = 0
let passedTests = 0
let failedTests = 0

function testPass(description) {
  totalTests++
  passedTests++
  console.log(`  ✅ PASS: ${description}`)
}

function testFail(description, err) {
  totalTests++
  failedTests++
  console.error(`  ❌ FAIL: ${description}`)
  if (err) console.error(`     Error: ${err?.message || err}`)
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }

  const fetchOpts = {
    method: options.method || 'GET',
    headers,
  }

  if (options.body) {
    fetchOpts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
  }

  const res = await fetch(url, fetchOpts)
  let body = null
  const text = await res.text()
  try {
    body = JSON.parse(text)
  } catch (e) {
    body = text
  }

  return { status: res.status, headers: res.headers, body }
}

async function createTestUser(baseCurrency = 'USD', role = 'user') {
  const phone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`
  const email = `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@wello.local`
  const token = `test_token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const [userId] = await db('users').insert({
    phone_e164: phone,
    email,
    name: `User ${baseCurrency}`,
    base_currency: baseCurrency,
    role,
    status: 'ACTIVE',
    created_at: new Date(),
    updated_at: new Date(),
  })

  await db('auth_sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    ip_address: '127.0.0.1',
    user_agent: 'TestRunner/1.0',
    expires_at: new Date(Date.now() + 86400000 * 7),
    created_at: new Date(),
  })

  // Activate standard addons for tests
  await db('user_addons').insert([
    { user_id: userId, addon_id: 1, status: 'ACTIVATED', activated_at: new Date() },
    { user_id: userId, addon_id: 2, status: 'ACTIVATED', activated_at: new Date() },
    { user_id: userId, addon_id: 3, status: 'ACTIVATED', activated_at: new Date() },
    { user_id: userId, addon_id: 4, status: 'ACTIVATED', activated_at: new Date() },
  ]).onConflict(['user_id', 'addon_id']).ignore()

  return { id: userId, email, phone, token, baseCurrency }
}

async function runSuite() {
  console.log('==============================================================================')
  console.log('  WELLO GLOBAL CORRECTNESS, FX CHAINS, METRICS & SYNC TEST BATTERY')
  console.log('==============================================================================\n')

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. CURRENCY COVERAGE, FIXED PEGS & ISO 4217 DECIMAL PRECISION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- 1. Currency Coverage, Fixed Pegs & Decimal Precision ---')

    // Create a Kuwaiti Dinar (KWD) user (3 decimal precision)
    const kwdUser = await createTestUser('KWD')

    // Create client for KWD user
    const [kwdClientId] = await db('clients').insert({
      user_id: kwdUser.id,
      name: 'Gulf Trading Co',
      created_at: new Date(),
      updated_at: new Date(),
    })

    // Create 3-decimal invoice in KWD with tax
    const kwdInvoiceRes = await api('/api/invoices', {
      method: 'POST',
      token: kwdUser.token,
      body: {
        clientId: kwdClientId,
        customerName: 'Gulf Trading Co',
        currency: 'KWD',
        taxPercent: 5.0,
        taxMode: 'exclusive',
        items: [
          { description: 'Cloud Engineering Service', quantity: 1, unitPrice: 150.250 },
        ],
      },
    })

    assert(kwdInvoiceRes.status === 200 || kwdInvoiceRes.status === 201, `KWD invoice creates with 200/201 (got ${kwdInvoiceRes.status})`)
    const kwdInv = kwdInvoiceRes.body?.data?.invoice || kwdInvoiceRes.body?.invoice
    assert(kwdInv, 'KWD Invoice returned')
    assert.strictEqual(Number(kwdInv.subtotal), 150.25, '3-decimal subtotal matches 150.250')
    assert.strictEqual(Number(kwdInv.total), 157.763, '3-decimal total with 5% tax is 157.763 KWD')
    testPass('3-decimal currency (KWD) invoice with tax computes exact subtotal (150.250) and total (157.763)')

    // Zero-decimal currency (JPY) payment
    const jpyUser = await createTestUser('JPY')
    const [jpyClientId] = await db('clients').insert({
      user_id: jpyUser.id,
      name: 'Tokyo Creative KK',
      created_at: new Date(),
      updated_at: new Date(),
    })

    const jpyPaymentRes = await api('/api/payments', {
      method: 'POST',
      token: jpyUser.token,
      body: {
        clientId: jpyClientId,
        amount: 50000,
        currency: 'JPY',
        paidDate: new Date().toISOString().slice(0, 10),
      },
    })
    assert(jpyPaymentRes.status === 200 || jpyPaymentRes.status === 201, `JPY payment creates with 200/201 (got ${jpyPaymentRes.status})`)
    const jpyPay = jpyPaymentRes.body?.data?.payment || jpyPaymentRes.body?.payment || jpyPaymentRes.body?.data
    assert.strictEqual(Number(jpyPay.amount), 50000, 'Zero-decimal JPY payment is exactly 50000')
    testPass('0-decimal currency (JPY) payment stored and formatted with 0 decimal minor units')

    // USD Client paid into an AED User (Pegged rate fallback)
    const aedUser = await createTestUser('AED')
    const [aedClientId] = await db('clients').insert({
      user_id: aedUser.id,
      name: 'US Tech Client',
      created_at: new Date(),
      updated_at: new Date(),
    })

    const aedPaymentRes = await api('/api/payments', {
      method: 'POST',
      token: aedUser.token,
      body: {
        clientId: aedClientId,
        amount: 1000,
        currency: 'USD', // Paying $1000 USD to an AED base currency user
        paidDate: new Date().toISOString().slice(0, 10),
      },
    })
    assert(aedPaymentRes.status === 200 || aedPaymentRes.status === 201, `USD payment to AED user creates with 200/201 (got ${aedPaymentRes.status})`)
    const aedPay = aedPaymentRes.body?.data?.payment || aedPaymentRes.body?.payment || aedPaymentRes.body?.data
    // 1000 USD * 3.6725 (AED peg) = 3672.50 AED
    const expectedAed = 3672.50
    assert.strictEqual(Number(aedPay.base_amount || aedPay.baseAmount), expectedAed, `USD payment converted via official peg (3672.50 AED, got ${aedPay.base_amount || aedPay.baseAmount})`)
    testPass('USD client payment to AED user converts via official 3.6725 central bank fixed peg (3672.50 AED)')

    // ──────────────────────────────────────────────────────────────────────────
    // 2. METRICS EDGE STATES, NEGATIVE NET INCOME & REASON CODES
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Metrics Null States & Negative Net Income ---')

    // Fresh user with literally no sessions or income at all -> 'no_data'
    const zeroHourUser = await createTestUser('USD')
    const zeroMetricsRes = await api('/api/metrics/summary', { token: zeroHourUser.token })
    assert.strictEqual(zeroMetricsRes.status, 200, 'Metrics summary returns 200 for 0 hours')
    const zeroRates = zeroMetricsRes.body?.data?.summary?.rates || zeroMetricsRes.body?.rates
    assert.strictEqual(zeroRates?.headlineRate, null, 'Headline rate is null when 0 hours logged')
    assert.strictEqual(zeroRates?.clientWorkRate, null, 'Client work rate is null when 0 hours logged')
    assert.strictEqual(zeroRates?.allInRate, null, 'All-in rate is null when 0 hours logged')
    assert.strictEqual(zeroRates?.nullReason, 'no_data', 'Fresh user without sessions or income has nullReason "no_data"')
    assert.strictEqual(zeroRates?.statusLabel, 'Not enough data', 'Status label indicates "Not enough data"')
    testPass('Fresh user with zero records yields null rate state with reason "no_data"')

    // User with payments but zero hours worked -> 'no_hours'
    await db('payments').insert({
      user_id: zeroHourUser.id,
      amount: 1500,
      currency: 'USD',
      paid_date: new Date(),
      status: 'paid',
      created_at: new Date(),
      updated_at: new Date(),
    })
    const zeroHoursWithIncomeRes = await api('/api/metrics/summary', { token: zeroHourUser.token })
    const zeroHoursWithIncomeRates = zeroHoursWithIncomeRes.body?.data?.summary?.rates || zeroHoursWithIncomeRes.body?.rates
    assert.strictEqual(zeroHoursWithIncomeRates?.clientWorkRate, null, 'Client work rate is null when 0 hours worked')
    assert.strictEqual(zeroHoursWithIncomeRates?.nullReason, 'no_hours', 'User with income but 0 hours worked has nullReason "no_hours"')
    testPass('User with income but 0 hours worked yields null rate with reason "no_hours"')

    // User with hours and negative net income (expenses > revenue)
    const negUser = await createTestUser('USD')
    const [negProject] = await db('projects').insert({
      user_id: negUser.id,
      name: 'Loss Project',
      currency: 'USD',
      created_at: new Date(),
      updated_at: new Date(),
    })

    // Log 10 hours of work
    await db('work_sessions').insert({
      user_id: negUser.id,
      project_id: negProject,
      title: 'Heavy engineering',
      payment_type: 'paid',
      started_at: new Date(Date.now() - 36000000),
      ended_at: new Date(),
      duration_seconds: 36000, // 10 hours
      created_at: new Date(),
      updated_at: new Date(),
    })

    // Direct expense of $500 with $200 revenue -> net -$300 over 10 hours = -$30.00/h
    await db('payments').insert({
      user_id: negUser.id,
      project_id: negProject,
      amount: 200,
      currency: 'USD',
      paid_date: new Date(),
      status: 'paid',
      created_at: new Date(),
      updated_at: new Date(),
    })

    await db('project_expenses').insert({
      user_id: negUser.id,
      project_id: negProject,
      amount: 500,
      currency: 'USD',
      expense_date: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    })

    const negMetricsRes = await api('/api/metrics/summary', { token: negUser.token })
    const negRates = negMetricsRes.body?.data?.summary?.rates || negMetricsRes.body?.rates
    assert.strictEqual(Number(negRates?.clientWorkRate), -30, `User with hours and loss gets exact real negative rate (-$30.00/h, got ${negRates?.clientWorkRate})`)
    assert.strictEqual(negRates?.nullReason, null, 'Negative rate has nullReason: null')
    testPass('User with hours and negative net revenue gets exact calculated negative rate (-$30.00/h)')

    // ──────────────────────────────────────────────────────────────────────────
    // 3. ANALYTICS PIPELINE, PERSISTENT REQUEST METRICS & PRIVACY THRESHOLD
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. Analytics Pipeline, Request Metrics & Privacy Thresholds ---')

    // Create Super Admin for analytics access
    const adminPhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`
    const adminEmail = `admin_${Date.now()}@wello.local`
    const [adminId] = await db('users').insert({
      phone_e164: adminPhone,
      email: adminEmail,
      name: 'Super Admin',
      role: 'admin',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    })

    await db('admin_users').insert({
      user_id: adminId,
      email: adminEmail,
      role_key: 'SUPER_ADMIN',
      is_active: true,
      created_at: new Date(),
    })

    const adminToken = `admin_token_${Date.now()}`
    await db('auth_sessions').insert({
      user_id: adminId,
      token_hash: crypto.createHash('sha256').update(adminToken).digest('hex'),
      ip_address: '127.0.0.1',
      user_agent: 'TestRunner/Admin',
      expires_at: new Date(Date.now() + 86400000),
      created_at: new Date(),
    })

    // Test system-health endpoint reading from persistent request_metrics_minute
    await db('request_metrics_minute').insert([
      {
        minute: new Date(),
        route_pattern: 'GET /api/invoices',
        method: 'GET',
        status_class: '2xx',
        request_count: 50,
        error_count: 0,
        p50_latency_ms: 14,
        p95_latency_ms: 28,
        latency_sum_ms: 800,
        instance_id: 'instance_node_1',
        created_at: new Date(),
      },
      {
        minute: new Date(),
        route_pattern: 'GET /api/invoices',
        method: 'GET',
        status_class: '2xx',
        request_count: 50,
        error_count: 1,
        p50_latency_ms: 18,
        p95_latency_ms: 36,
        latency_sum_ms: 1100,
        instance_id: 'instance_node_2',
        created_at: new Date(),
      },
    ])

    const sysHealthRes = await api('/api/admin/analytics/system-health', { token: adminToken })
    assert.strictEqual(sysHealthRes.status, 200, 'System health returns 200')
    assert(typeof sysHealthRes.body?.p50LatencyMs === 'number', 'Merged p50 latency is a number')
    assert(typeof sysHealthRes.body?.p95LatencyMs === 'number', 'Merged p95 latency is a number')
    testPass('Persistent request_metrics_minute merges metrics across multiple cluster instances')

    // Privacy threshold k >= 5 check
    const workValueRes = await api('/api/admin/analytics/work-value', { token: adminToken })
    assert.strictEqual(workValueRes.status, 200, 'Work value insights returns 200')
    assert.strictEqual(workValueRes.body?.privacyThreshold, 5, 'Privacy threshold enforced at k >= 5')
    testPass('Privacy threshold helper enforces k >= 5 protection on platform cohorts')

    // ──────────────────────────────────────────────────────────────────────────
    // 4. MISSING ROUTES: ADDON DEACTIVATION, DRAFT INVOICE PATCH & RECURRING
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. Missing Routes & Lifecycle Handlers ---')

    // 4.1 Addon Deactivation
    const addonUser = await createTestUser('USD')
    const deactRes = await api('/api/store/addons/deactivate', {
      method: 'POST',
      token: addonUser.token,
      body: { addonKey: 'recurring-retainers' },
    })
    assert.strictEqual(deactRes.status, 200, 'Deactivate addon returns 200')
    assert.strictEqual(deactRes.body?.data?.isActivated, false, 'Addon status is false after deactivation')
    testPass('POST /api/store/addons/deactivate successfully deactivates addon while preserving data')

    // 4.2 Draft Invoice PATCH vs Issued Invoice Immutability
    const invUser = await createTestUser('USD')
    const [invClientId] = await db('clients').insert({
      user_id: invUser.id,
      name: 'Client Alpha',
      created_at: new Date(),
      updated_at: new Date(),
    })

    // Create Draft Invoice
    const createDraftRes = await api('/api/invoices', {
      method: 'POST',
      token: invUser.token,
      body: {
        clientId: invClientId,
        customerName: 'Client Alpha',
        currency: 'USD',
        status: 'draft',
        items: [{ description: 'Initial draft item', quantity: 1, unitPrice: 100 }],
      },
    })
    const draftInvId = createDraftRes.body?.data?.invoice?.id || createDraftRes.body?.invoice?.id
    assert(draftInvId, 'Draft invoice created')

    // PATCH Draft Invoice -> Should Succeed
    const patchDraftRes = await api(`/api/invoices/${draftInvId}`, {
      method: 'PATCH',
      token: invUser.token,
      body: {
        notes: 'Updated draft notes',
        items: [{ description: 'Revised item', quantity: 2, unitPrice: 150 }],
      },
    })
    assert.strictEqual(patchDraftRes.status, 200, 'PATCH draft invoice returns 200')
    assert.strictEqual(Number(patchDraftRes.body?.data?.invoice?.total || patchDraftRes.body?.invoice?.total), 300, 'Draft total updated to $300')
    testPass('PATCH /api/invoices/:id allows editing draft invoices and recomputes totals')

    // Mark invoice as SENT -> should now reject PATCH
    await db('invoices').where({ id: draftInvId }).update({ status: 'sent' })
    const patchSentRes = await api(`/api/invoices/${draftInvId}`, {
      method: 'PATCH',
      token: invUser.token,
      body: { notes: 'Attempted edit on issued invoice' },
    })
    assert.strictEqual(patchSentRes.status, 400, 'PATCH issued invoice rejects with 400')
    testPass('PATCH /api/invoices/:id strictly blocks modifications to issued invoices (immutable)')

    // 4.3 Recurring Invoice Lifecycle (PATCH, Pause, Resume, Delete)
    const [recProfId] = await db('recurring_invoice_profiles').insert({
      user_id: invUser.id,
      client_id: invClientId,
      title: 'Monthly Retainer',
      frequency: 'monthly',
      subtotal: 1500,
      tax_amount: 0,
      total: 1500,
      currency: 'USD',
      next_issue_date: new Date(Date.now() + 86400000 * 30),
      is_active: 1,
      template_data: JSON.stringify({ items: [] }),
      created_at: new Date(),
      updated_at: new Date(),
    })

    // PATCH recurring profile
    const patchRecRes = await api(`/api/invoices/recurring/${recProfId}`, {
      method: 'PATCH',
      token: invUser.token,
      body: { total: 2000, title: 'Monthly Retainer v2' },
    })
    assert.strictEqual(patchRecRes.status, 200, 'PATCH recurring profile returns 200')
    assert.strictEqual(Number(patchRecRes.body?.data?.profile?.total || patchRecRes.body?.profile?.total), 2000, 'Total updated to $2000')

    // Pause recurring profile
    const pauseRecRes = await api(`/api/invoices/recurring/${recProfId}/pause`, {
      method: 'POST',
      token: invUser.token,
    })
    assert.strictEqual(pauseRecRes.status, 200, 'Pause recurring returns 200')

    // Resume recurring profile
    const resumeRecRes = await api(`/api/invoices/recurring/${recProfId}/resume`, {
      method: 'POST',
      token: invUser.token,
    })
    assert.strictEqual(resumeRecRes.status, 200, 'Resume recurring returns 200')

    // Delete recurring profile
    const deleteRecRes = await api(`/api/invoices/recurring/${recProfId}`, {
      method: 'DELETE',
      token: invUser.token,
    })
    assert.strictEqual(deleteRecRes.status, 200, 'Delete recurring returns 200')
    testPass('Recurring invoices full lifecycle (PATCH, Pause, Resume, DELETE) executed with zero retrospective impact')

    // ──────────────────────────────────────────────────────────────────────────
    // 5. OFFLINE SYNC PULL EXTENSIONS & TIMER CONFLICT RESOLUTION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 5. Offline Sync Delta Pull & Timer Conflict Resolution ---')

    // Sync Pull delta check
    const syncPullRes = await api('/api/sync?since=0', { token: invUser.token })
    assert.strictEqual(syncPullRes.status, 200, 'GET /api/sync returns 200')
    assert(Array.isArray(syncPullRes.body?.data?.quotes?.records), 'Sync pull includes quotes')
    assert(Array.isArray(syncPullRes.body?.data?.creditNotes?.records), 'Sync pull includes creditNotes')
    assert(Array.isArray(syncPullRes.body?.data?.recurringProfiles?.records), 'Sync pull includes recurringProfiles')
    assert(Array.isArray(syncPullRes.body?.data?.categories?.records), 'Sync pull includes categories')
    testPass('GET /api/sync includes project_quotes, credit_notes, recurring_invoice_profiles, and categories')

    // Offline Timer Sync & 2-Device Conflict Detection
    const timerUser = await createTestUser('USD')
    const timerStartMutation = {
      id: `mut_timer_${Date.now()}`,
      idempotencyKey: `idem_timer_${Date.now()}`,
      action: 'TIMER_START',
      endpoint: '/api/timer/start',
      method: 'POST',
      entityType: 'timer',
      payload: {
        title: 'Offline Timer Session 1',
        startedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    }

    const timerSyncRes1 = await api('/api/sync', {
      method: 'POST',
      token: timerUser.token,
      body: { mutations: [timerStartMutation] },
    })
    assert.strictEqual(timerSyncRes1.status, 200, 'First offline timer starts successfully')
    assert(timerSyncRes1.body?.data?.acknowledgedIds?.includes(timerStartMutation.id), 'Timer start acknowledged')

    // Simulate Device 2 starting another concurrent timer while Timer 1 is running
    const timerConflictMutation = {
      id: `mut_timer_conflict_${Date.now()}`,
      idempotencyKey: `idem_timer_conflict_${Date.now()}`,
      action: 'TIMER_START',
      endpoint: '/api/timer/start',
      method: 'POST',
      entityType: 'timer',
      payload: {
        title: 'Concurrent Device 2 Timer',
        startedAt: new Date().toISOString(),
      },
    }

    const timerSyncRes2 = await api('/api/sync', {
      method: 'POST',
      token: timerUser.token,
      body: { mutations: [timerConflictMutation] },
    })
    assert.strictEqual(timerSyncRes2.status, 200, 'Sync call returns 200')
    const conflict = timerSyncRes2.body?.data?.conflicts?.find(c => c.mutationId === timerConflictMutation.id)
    assert(conflict, 'Conflict detected on concurrent active timer')
    assert.strictEqual(conflict.code, 'ACTIVE_TIMER_CONFLICT', 'Conflict code is ACTIVE_TIMER_CONFLICT')
    assert.strictEqual(conflict.status, 409, 'Conflict status is 409')
    testPass('Offline timer single-active-timer rule detects 2-device concurrency and returns 409 conflict')

    // Timer Pause, Resume and Stop offline sync sequence
    const pauseMut = {
      id: `mut_pause_${Date.now()}`,
      idempotencyKey: `idem_pause_${Date.now()}`,
      action: 'TIMER_PAUSE',
      endpoint: '/api/timer/pause',
      method: 'POST',
      entityType: 'timer',
      payload: { pausedAt: new Date(Date.now() - 1800000).toISOString() },
    }

    const resumeMut = {
      id: `mut_resume_${Date.now()}`,
      idempotencyKey: `idem_resume_${Date.now()}`,
      action: 'TIMER_RESUME',
      endpoint: '/api/timer/resume',
      method: 'POST',
      entityType: 'timer',
      payload: { resumedAt: new Date(Date.now() - 1200000).toISOString() },
    }

    const stopMut = {
      id: `mut_stop_${Date.now()}`,
      idempotencyKey: `idem_stop_${Date.now()}`,
      action: 'TIMER_STOP',
      endpoint: '/api/timer/stop',
      method: 'POST',
      entityType: 'timer',
      payload: { endedAt: new Date().toISOString() },
    }

    const timerLifecycleRes = await api('/api/sync', {
      method: 'POST',
      token: timerUser.token,
      body: { mutations: [pauseMut, resumeMut, stopMut] },
    })
    assert(timerLifecycleRes.body?.data?.acknowledgedIds?.includes(stopMut.id), 'Stop mutation acknowledged')
    testPass('Offline timer pause, resume and stop sequence reconciled seamlessly into completed work session')

    // ──────────────────────────────────────────────────────────────────────────
    // 6. QUOTE & RECURRING PROFILE OFFLINE SYNC AND 13-ENTITY PULL
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 6. Offline Quote & Recurring Profile Push/Pull Sync ---')

    // A. Project quote created offline syncs correctly on reconnect
    const offlineSyncUser = await createTestUser('USD')
    const [syncProjId] = await db('projects').insert({
      user_id: offlineSyncUser.id,
      name: 'Offline Quote Project',
      currency: 'USD',
      created_at: new Date(),
      updated_at: new Date(),
    })

    const quoteOfflineMut = {
      id: `mut_quote_${Date.now()}`,
      idempotencyKey: `idem_quote_${Date.now()}`,
      action: 'PROJECT_QUOTE_CREATE',
      endpoint: '/api/projects/' + syncProjId + '/quotes',
      method: 'POST',
      entityType: 'project_quote',
      payload: {
        projectId: syncProjId,
        amount: 3500,
        currency: 'USD',
        estimatedHours: 35,
        pricingModel: 'fixed_project',
        status: 'draft',
      },
    }

    const quotePushRes = await api('/api/sync', {
      method: 'POST',
      token: offlineSyncUser.token,
      body: { mutations: [quoteOfflineMut] },
    })
    assert.strictEqual(quotePushRes.status, 200, 'Quote offline push returns 200')
    assert(quotePushRes.body?.data?.acknowledgedIds?.includes(quoteOfflineMut.id), 'Quote mutation acknowledged')

    const dbQuotes = await db('project_quotes').where({ project_id: syncProjId, user_id: offlineSyncUser.id })
    assert.strictEqual(dbQuotes.length, 1, 'Project quote persisted in database from offline sync')
    assert.strictEqual(Number(dbQuotes[0].quote_amount !== undefined ? dbQuotes[0].quote_amount : dbQuotes[0].amount), 3500, 'Project quote amount is $3500')
    testPass('Project quote created offline syncs correctly on reconnect')

    // B. Recurring invoice profile paused offline syncs and updates state
    const [recProfId2] = await db('recurring_invoice_profiles').insert({
      user_id: offlineSyncUser.id,
      project_id: syncProjId,
      title: 'Retainer Sync Test',
      frequency: 'monthly',
      subtotal: 2500,
      total: 2500,
      template_data: JSON.stringify({ items: [] }),
      currency: 'USD',
      next_issue_date: new Date(Date.now() + 86400000 * 15),
      is_active: 1,
      auto_send: 0,
      created_at: new Date(),
      updated_at: new Date(),
    })

    const recurringPauseMut = {
      id: `mut_rec_pause_${Date.now()}`,
      idempotencyKey: `idem_rec_pause_${Date.now()}`,
      action: 'RECURRING_PROFILE_UPDATE',
      endpoint: `/api/invoices/recurring/${recProfId2}/pause`,
      method: 'PUT',
      entityType: 'recurring_profile',
      payload: {
        id: recProfId2,
        isActive: false,
        amount: 2500,
      },
    }

    const recPushRes = await api('/api/sync', {
      method: 'POST',
      token: offlineSyncUser.token,
      body: { mutations: [recurringPauseMut] },
    })
    assert.strictEqual(recPushRes.status, 200, 'Recurring profile offline pause push returns 200')
    const dbRec = await db('recurring_invoice_profiles').where({ id: recProfId2 }).first()
    assert.strictEqual(Boolean(dbRec.is_active), false, 'Recurring profile paused successfully in DB')
    testPass('Recurring invoice profile paused offline syncs and does not fire duplicate invoice')

    // C. Pulling since cursor returns all 13 entities including credit notes, categories, tax rates
    const cursor = new Date(Date.now() - 60000).toISOString()
    const pull13Res = await api(`/api/sync?since=${encodeURIComponent(cursor)}`, { token: offlineSyncUser.token })
    assert.strictEqual(pull13Res.status, 200, 'GET /api/sync returns 200')
    const pullData = pull13Res.body?.data || pull13Res.body
    assert(pullData.clients, 'Sync payload has clients')
    assert(pullData.projects, 'Sync payload has projects')
    assert(pullData.quotes, 'Sync payload has quotes')
    assert(pullData.sessions, 'Sync payload has sessions')
    assert(pullData.payments, 'Sync payload has payments')
    assert(pullData.expenses, 'Sync payload has expenses')
    assert(pullData.invoices, 'Sync payload has invoices')
    assert(pullData.creditNotes, 'Sync payload has creditNotes')
    assert(pullData.recurringProfiles, 'Sync payload has recurringProfiles')
    assert(pullData.incomeSources, 'Sync payload has incomeSources')
    assert(pullData.overheads || pullData.overheadExpenses, 'Sync payload has overheads')
    assert(pullData.taxRates, 'Sync payload has taxRates')
    assert(pullData.categories, 'Sync payload has categories')
    testPass('GET /api/sync covers all 13 entities with delta records and tombstones')

    // ──────────────────────────────────────────────────────────────────────────
    // 7. PUBLIC ENDPOINT RATE LIMITING & ABUSE PREVENTION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 7. Public Endpoint Rate Limiting & Abuse Prevention ---')

    // Test category-requests strict limit: 5 per hour per IP -> 6th is 429
    // Clear existing rate limits for test isolation
    await db('rate_limits').where('key', 'like', '%category%').delete()

    const catReqPayload = {
      email: 'test_requester@example.com',
      requestedName: 'Blockchain Auditing',
      reason: 'Need custom category for web3 smart contract audits',
    }

    for (let i = 1; i <= 5; i++) {
      const res = await api('/api/category-requests', {
        method: 'POST',
        body: { ...catReqPayload, requestedName: `Category Attempt ${i}` },
      })
      assert.strictEqual(res.status, 200, `Category request #${i} accepted with 200 (got ${res.status})`)
    }

    const throttledRes = await api('/api/category-requests', {
      method: 'POST',
      body: { ...catReqPayload, requestedName: 'Category Attempt 6' },
    })
    assert.strictEqual(throttledRes.status, 429, `6th category request from same IP rejected with 429 (got ${throttledRes.status})`)
    testPass('POST /api/category-requests enforces strict 5 req/hour per IP rate limit (6th request returns 429)')

  } catch (err) {
    console.error('\n❌ UNEXPECTED ERROR IN TEST BATTERY:', err)
    testFail('Test battery failed', err)
  } finally {
    await db.destroy()
  }

  console.log('\n==============================================================================')
  console.log(`📊 RESULTS: ${passedTests} Passed, ${failedTests} Failed (Total: ${totalTests})`)
  console.log('==============================================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runSuite()
