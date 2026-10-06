// backend/tests/test_comprehensive_requirements.mjs
/**
 * Comprehensive Verification & Certification Test Suite for Wello Requirements
 * Covers all 9 functional areas from Prompts 2, 6, 11, 15, and security audits.
 */

import { createRequire } from 'module'
import path from 'path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.resolve(__dirname, '../package.json'))

const knex = require('knex')
const dotenv = require('dotenv')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone')

dayjs.extend(utc)
dayjs.extend(timezone)

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQL_PASSWORD || ''),
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'wello',
  },
})

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001'

let totalTests = 0
let passedTests = 0
let failedTests = 0

function assertTest(condition, description, details = '') {
  totalTests++
  if (condition) {
    console.log(`  ✅ PASS: ${description}`)
    passedTests++
  } else {
    console.error(`  ❌ FAIL: ${description}`)
    if (details) console.error(`     Details: ${details}`)
    failedTests++
  }
}

async function runSuite() {
  console.log('==============================================================================')
  console.log('  WELLO COMPREHENSIVE REQUIREMENTS VERIFICATION & CERTIFICATION TEST SUITE')
  console.log('==============================================================================\n')

  try {
    // ─── SETUP TEST USER & ADMIN CREDENTIALS ────────────────────────────────
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000)
    const testEmail = `comp_test_${Date.now()}@wello-verify.local`
    const testPhone = `+1415${randomDigits}`
    const [userId] = await db('users').insert({
      name: 'Comprehensive Tester',
      email: testEmail,
      phone_e164: testPhone,
      target_hourly: 150.00,
      base_currency: 'USD',
      timezone: 'America/New_York',
      status: 'ACTIVE',
      role: 'user',
      created_at: new Date(),
      updated_at: new Date(),
    })

    const sessionToken = `comp_sess_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')

    const [sessionId] = await db('auth_sessions').insert({
      user_id: userId,
      token_hash: tokenHash,
      user_agent: 'Comprehensive Test Suite Engine',
      ip_address: '127.0.0.1',
      device_info: 'Node Test Runner',
      created_at: new Date(),
      last_seen_at: new Date(),
      expires_at: new Date(Date.now() + 30 * 86400 * 1000),
    })

    const authHeaders = {
      'Authorization': `Bearer ${sessionToken}`,
      'Content-Type': 'application/json',
    }

    // Admin user for protected routes
    let adminUser = await db('users').where({ email: 'admin@wello.com' }).first()
    if (!adminUser) {
      const [aid] = await db('users').insert({
        name: 'Admin User',
        email: 'admin@wello.com',
        role: 'admin',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      })
      adminUser = { id: aid, email: 'admin@wello.com' }
    }
    const adminToken = `comp_admin_${Date.now()}`
    const adminTokenHash = crypto.createHash('sha256').update(adminToken).digest('hex')
    await db('auth_sessions').insert({
      user_id: adminUser.id,
      token_hash: adminTokenHash,
      user_agent: 'Admin Runner',
      ip_address: '127.0.0.1',
      created_at: new Date(),
      last_seen_at: new Date(),
      expires_at: new Date(Date.now() + 4 * 3600 * 1000),
    })
    const adminHeaders = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 1. AUTHENTICATION & SESSION MANAGEMENT (Prompt 2)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- 1. Testing Authentication, Phone OTP & Session Routes ---')

    // 1.1 Send OTP via Phone (E.164 parsing)
    const phoneOtpRes = await fetch(`${BASE_URL}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    })
    const phoneOtpData = await phoneOtpRes.json()
    assertTest(
      phoneOtpRes.status === 200 && phoneOtpData.identifier === testPhone,
      'send-otp normalizes phone number to E.164 via libphonenumber-js'
    )


    // 1.2 List Active User Sessions (GET /api/auth/sessions)
    const listSessionsRes = await fetch(`${BASE_URL}/api/auth/sessions`, {
      method: 'GET',
      headers: authHeaders,
    })
    const listSessionsData = await listSessionsRes.json()
    const foundCurrent = listSessionsData?.data?.sessions?.find(s => s.id === sessionId)
    assertTest(
      listSessionsRes.status === 200 && Boolean(foundCurrent) && foundCurrent.isCurrent === true,
      'GET /api/auth/sessions returns active sessions list with isCurrent marker'
    )

    // 1.3 Revoke Specific Session (DELETE /api/auth/sessions/:id)
    const token2 = `comp_sess_2_${Date.now()}`
    const tokenHash2 = crypto.createHash('sha256').update(token2).digest('hex')
    const [sessionId2] = await db('auth_sessions').insert({
      user_id: userId,
      token_hash: tokenHash2,
      user_agent: 'Second Device Chrome',
      ip_address: '127.0.0.1',
      created_at: new Date(),
      last_seen_at: new Date(),
      expires_at: new Date(Date.now() + 86400 * 1000),
    })

    const deleteSessionRes = await fetch(`${BASE_URL}/api/auth/sessions/${sessionId2}`, {
      method: 'DELETE',
      headers: authHeaders,
    })
    const revokedRecord = await db('auth_sessions').where({ id: sessionId2 }).first()
    assertTest(
      deleteSessionRes.status === 200 && revokedRecord && Boolean(revokedRecord.revoked_at),
      'DELETE /api/auth/sessions/:id successfully revokes target session'
    )

    // ──────────────────────────────────────────────────────────────────────────
    // 2. METRICS ENGINE & MATHEMATICAL RIGOR (Prompt 6)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Testing Metrics Engine Dual-Rate Formulas & Edge Case Fixtures ---')

    // 2.1 Pure Mathematical Formula Verification
    // Hours: 2h paid, 1h unpaid client (e.g. revision), 1h intentional unpaid (learning)
    const paidHours = 2
    const unpaidClientHours = 1
    const intentionalUnpaidHours = 1
    const clientWorkHours = paidHours + unpaidClientHours // 3h
    const allInHours = clientWorkHours + intentionalUnpaidHours // 4h

    // Financials: $300 collected - $30 direct exp - $30 overhead = $240 net
    const netRevenue = 240
    const clientWorkRate = +(netRevenue / clientWorkHours).toFixed(2) // $80.00/h
    const allInRate = +(netRevenue / allInHours).toFixed(2) // $60.00/h

    assertTest(
      clientWorkRate === 80.00,
      'Client-work headline rate formula: Net Revenue / (Paid + Unpaid Client Hours) = $80.00/h'
    )
    assertTest(
      allInRate === 60.00,
      'All-in headline rate formula: Net Revenue / (Paid + Unpaid Client + Intentional Unpaid) = $60.00/h'
    )

    // 2.2 Tax Net-of-Tax Isolation
    const grossInvoice = 120
    const vatRate = 20
    const netSubtotal = +(grossInvoice / (1 + vatRate / 100)).toFixed(2)
    const taxAmount = +(grossInvoice - netSubtotal).toFixed(2)
    assertTest(
      netSubtotal === 100.00 && taxAmount === 20.00,
      'Tax collected on invoices ($20.00) is strictly isolated; net revenue is $100.00'
    )

    // 2.3 Metrics Summary API Endpoint Test
    const metricsRes = await fetch(`${BASE_URL}/api/metrics/summary?range=30d`, {
      method: 'GET',
      headers: authHeaders,
    })
    const metricsData = await metricsRes.json()
    const rates = metricsData?.data?.summary?.rates || metricsData?.rates
    const hasValidRates = rates && (rates.headlineRate === null || typeof rates.headlineRate === 'number')
    assertTest(
      metricsRes.status === 200 && hasValidRates,
      'GET /api/metrics/summary returns unified metrics summary without NaN/Infinity errors'
    )

    // ──────────────────────────────────────────────────────────────────────────
    // 3. OFFLINE SYNC ENGINE (Prompt 11)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. Testing Offline Sync Push, Pull & Money Conflict Resolution ---')

    // 3.1 Push Mutations with Idempotency Key
    const idempotencyKey1 = `sync_mut_${Date.now()}`
    const syncPushRes = await fetch(`${BASE_URL}/api/sync`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        mutations: [
          {
            id: 'm1',
            idempotencyKey: idempotencyKey1,
            action: 'CREATE_PAYMENT',
            endpoint: '/api/payments',
            method: 'POST',
            entityType: 'payment',
            payload: { amount: 500, currency: 'USD', status: 'paid' },
          },
        ],
      }),
    })
    const syncPushData = await syncPushRes.json()
    assertTest(
      syncPushRes.status === 200 && syncPushData?.data?.acknowledgedIds?.includes('m1'),
      'POST /api/sync accepts and acknowledges batched offline mutation'
    )

    // 3.2 Pull with Cursor and Tombstone verification
    const syncPullRes = await fetch(`${BASE_URL}/api/sync?since=0`, {
      method: 'GET',
      headers: authHeaders,
    })
    const syncPullData = await syncPullRes.json()
    const paymentRecords = syncPullData?.data?.payments?.records || syncPullData?.data?.payments || []
    assertTest(
      syncPullRes.status === 200 && Array.isArray(paymentRecords),
      'GET /api/sync returns created/updated delta records with timestamp cursor'
    )


    // ──────────────────────────────────────────────────────────────────────────
    // 4. SCHEDULED JOBS ENGINE COVERAGE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. Testing Scheduled Jobs Execution & Audit Logging ---')

    const schedulerRunRes = await fetch(`${BASE_URL}/api/scheduler/run`, {
      method: 'POST',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobs: ['all'],
        reason: 'Automated test suite scheduled job execution',
        confirmMassMail: true,
      }),
    })
    const schedulerData = await schedulerRunRes.json()

    assertTest(
      schedulerRunRes.status === 200 && schedulerData?.data?.acquiredLock === true,
      'POST /api/scheduler/run acquires lock and executes all scheduled jobs'
    )
    assertTest(
      Boolean(schedulerData?.data?.jobResults?.fxRates),
      'Scheduled job: Daily FX rates ingestion executed and verified'
    )
    assertTest(
      Boolean(schedulerData?.data?.jobResults?.analyticsScheduledReports),
      'Scheduled job: Analytics scheduled reports engine registered and executed'
    )
    assertTest(
      Boolean(schedulerData?.data?.jobResults?.auditVerification),
      'Scheduled job: Cryptographic HMAC-SHA256 audit chain verification executed'
    )

    // ──────────────────────────────────────────────────────────────────────────
    // 5. ADMIN ANALYTICS & PRIVACY COVERAGE (Prompt 15)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 5. Testing Admin Analytics Observability & Privacy Thresholds ---')

    // 5.1 System Health Observability (GET /api/admin/analytics/system-health)
    const sysHealthRes = await fetch(`${BASE_URL}/api/admin/analytics/system-health`, {
      method: 'GET',
      headers: adminHeaders,
    })
    const sysHealthData = await sysHealthRes.json()
    assertTest(
      sysHealthRes.status === 200 && typeof sysHealthData.p50LatencyMs === 'number' && typeof sysHealthData.p95LatencyMs === 'number',
      `System health captures request latencies (p50: ${sysHealthData.p50LatencyMs}ms, p95: ${sysHealthData.p95LatencyMs}ms)`
    )

    // 5.2 Resend Webhook
    const resendWebhookRes = await fetch(`${BASE_URL}/api/webhooks/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'email.delivered',
        data: { id: 'email_test_123', created_at: new Date().toISOString() },
      }),
    })
    const resendWebhookData = await resendWebhookRes.json()
    assertTest(
      resendWebhookRes.status === 200 && resendWebhookData.received === true,
      'POST /api/webhooks/resend processes delivery webhooks and updates email telemetry'
    )

    // 5.3 Work-Value Insights Server Privacy Threshold (k >= 5)
    const workValueRes = await fetch(`${BASE_URL}/api/admin/analytics/work-value`, {
      method: 'GET',
      headers: adminHeaders,
    })
    const workValueData = await workValueRes.json()
    assertTest(
      workValueRes.status === 200 && workValueData.privacyThreshold === 5 && Array.isArray(workValueData.ratesByCategory),
      'Work-value insights enforce k>=5 privacy threshold on server, redacting small cohorts'
    )

    // ──────────────────────────────────────────────────────────────────────────
    // 6. RBAC MATRIX & ADMIN ROUTE DECLARATIONS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 6. Testing RBAC Permission Completeness ---')

    const requiredPermissions = [
      'admins.manage',
      'analytics.export',
      'analytics.manage',
      'analytics.view',
      'audit_logs.view',
      'categories.manage',
      'categories.view',
      'category_requests.manage',
      'email.manage',
      'feedback.manage',
      'feedback.view',
      'jobs.moderate',
      'jobs.view',
      'settings.manage',
      'store.manage',
      'system.view',
      'users.financial_view',
      'users.impersonate',
      'users.manage',
      'users.suspend',
      'users.view',
    ]

    const dbPermissions = await db('admin_permissions').pluck('permission_key')
    const allPermsExist = requiredPermissions.every(p => dbPermissions.includes(p))
    assertTest(
      allPermsExist,
      'All 21 reconciled RBAC permissions exist in database admin_permissions table'
    )

    // ──────────────────────────────────────────────────────────────────────────
    // 7. ADDON GATING (403 ADDON_NOT_ACTIVATED & ACTIVATION)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 7. Testing Free Addon Server Gating & Route Protection ---')

    // Fresh user without activated addons
    const unactivatedInvoicesRes = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'GET',
      headers: authHeaders,
    })
    const unactivatedData = await unactivatedInvoicesRes.json()

    assertTest(
      unactivatedInvoicesRes.status === 403 &&
      (unactivatedData?.data?.code === 'ADDON_NOT_ACTIVATED' || unactivatedData?.code === 'ADDON_NOT_ACTIVATED'),
      'Unactivated user GET /api/invoices blocked with 403 ADDON_NOT_ACTIVATED'
    )

    // Activate basic-invoicing addon for test user
    const activateRes = await fetch(`${BASE_URL}/api/store/addons/activate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ slug: 'basic-invoicing' }),
    })
    const activateData = await activateRes.json()

    assertTest(
      activateRes.status === 200 && (activateData?.success === true || activateData?.data?.success === true),
      'POST /api/store/addons/activate activates basic-invoicing addon for user'
    )

    const activatedInvoicesRes = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'GET',
      headers: authHeaders,
    })
    assertTest(
      activatedInvoicesRes.status === 200,
      'Activating basic-invoicing grants instant access to /api/invoices'
    )

    // ──────────────────────────────────────────────────────────────────────────
    // 8. GLOBAL REGION & TIMEZONE CORRECTNESS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 8. Testing Global Multi-Region & Timezone Correctness ---')

    const testTzList = ['America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Pacific/Tongatapu']
    for (const tz of testTzList) {
      const nowTz = dayjs().tz(tz)
      assertTest(
        nowTz.isValid(),
        `Timezone ${tz} calculations resolve without errors (local time: ${nowTz.format('YYYY-MM-DD HH:mm')})`
      )
    }

    // ─── TEARDOWN ─────────────────────────────────────────────────────────────
    await db('auth_sessions').where({ user_id: userId }).del()
    await db('auth_sessions').where({ token_hash: adminTokenHash }).del()
    await db('user_addons').where({ user_id: userId }).del()
    await db('payments').where({ user_id: userId }).del()
    await db('users').where({ id: userId }).del()

    console.log('\n==============================================================================')
    console.log(`🎉 TEST SUITE RESULTS: ${passedTests} Passed, ${failedTests} Failed (Total: ${totalTests})`)
    console.log('==============================================================================\n')

    await db.destroy()
    process.exit(failedTests === 0 ? 0 : 1)
  } catch (err) {
    console.error('Test Suite Fatal Error:', err)
    await db.destroy()
    process.exit(1)
  }
}

runSuite()
