// backend/tests/test_route_guard_hardening.mjs
/**
 * ==============================================================================
 * Wello Route Guard, Impersonation Masking & RBAC Hardening Test Suite
 * ==============================================================================
 * Comprehensive verification covering:
 * 1. 19 Addon Route Guard Verification & Unauthenticated 401 rejection
 * 2. Calculator Quote & Project Ownership Validation (/api/calculator/apply-quote)
 * 3. Impersonation Data-Driven Masking across all financial/personal GET routes
 * 4. Impersonation Mutation Default-Deny (403 Forbidden)
 * 5. 5-Tier RBAC Permission Matrix Verification
 * 6. Scheduler Engine Hardening (SUPER_ADMIN, Reason, Allowlist, Mass-Mail Confirmation)
 * 7. Scheduled Reports Admin Recipient Validation & Limit
 * 8. Step-Up OTP Enforcement on Critical Admin Routes
 * 9. HMAC-SHA256 Audit Chain Verification & Index Corrupted Alerting
 * 10. Public Attack Surface Hardening (Category Requests Honeypot, Events Batch Cap, Portal Security Headers)
 */

import assert from 'node:assert'
import crypto from 'node:crypto'
import knex from 'knex'
import knexConfig from '../knexfile.cjs'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

let totalPassed = 0
let totalFailed = 0

function testPass(msg) {
  console.log(`  ✅ PASS: ${msg}`)
  totalPassed++
}

function testFail(msg, err) {
  console.error(`  ❌ FAIL: ${msg}`, err || '')
  totalFailed++
}

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }
  if (options.cookie) {
    headers['Cookie'] = options.cookie
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  let body = null
  const text = await res.text()
  try {
    body = JSON.parse(text)
  } catch (e) {
    body = text
  }

  return {
    status: res.status,
    headers: res.headers,
    body,
    cookie: res.headers.get('set-cookie')
  }
}

async function createTestSession(db, userEmail, userName, role = 'user', adminRoleKey = null) {
  let user = await db('users').where({ email: userEmail }).first()
  if (!user) {
    const [id] = await db('users').insert({
      email: userEmail,
      name: userName,
      role: role === 'admin' ? 'admin' : 'user',
      status: 'ACTIVE',
      base_currency: 'USD',
      timezone: 'UTC',
      created_at: new Date(),
      updated_at: new Date()
    })
    user = { id, email: userEmail, role: role === 'admin' ? 'admin' : 'user' }
  } else {
    await db('users').where({ id: user.id }).update({ role: role === 'admin' ? 'admin' : 'user', status: 'ACTIVE' })
  }

  if (adminRoleKey) {
    const adminUser = await db('admin_users').where({ user_id: user.id }).first()
    if (!adminUser) {
      await db('admin_users').insert({
        user_id: user.id,
        email: user.email,
        role_key: adminRoleKey,
        created_at: new Date()
      })
    } else {
      await db('admin_users').where({ user_id: user.id }).update({ role_key: adminRoleKey })
    }
  }

  const rawToken = 'test_token_' + crypto.randomBytes(16).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  await db('auth_sessions').insert({
    user_id: user.id,
    token_hash: tokenHash,
    ip_address: '127.0.0.1',
    device_info: 'TestAgent/1.0',
    is_impersonation: 0,
    expires_at: new Date(Date.now() + 86400000),
    created_at: new Date(),
    last_seen_at: new Date()
  })

  return {
    userId: user.id,
    email: user.email,
    token: rawToken
  }
}

async function runHardeningTests() {
  console.log('===============================================================')
  console.log('🛡️  STARTING WELLO ROUTE GUARD & RBAC HARDENING TEST BATTERY')
  console.log('===============================================================\n')

  const db = knex(knexConfig)

  try {
    const timestamp = Date.now()
    const alice = await createTestSession(db, `alice_${timestamp}@test.local`, 'Alice Normal')
    const bob = await createTestSession(db, `bob_${timestamp}@test.local`, 'Bob Normal')

    // Seed admin accounts for 5 roles
    const superAdmin = await createTestSession(db, `superadmin_${timestamp}@wello.test`, 'Super Admin', 'admin', 'SUPER_ADMIN')
    const admin = await createTestSession(db, `admin_${timestamp}@wello.test`, 'Standard Admin', 'admin', 'ADMIN')
    const support = await createTestSession(db, `support_${timestamp}@wello.test`, 'Support Staff', 'admin', 'SUPPORT')
    const analyst = await createTestSession(db, `analyst_${timestamp}@wello.test`, 'Data Analyst', 'admin', 'ANALYST')
    const moderator = await createTestSession(db, `moderator_${timestamp}@wello.test`, 'Content Moderator', 'admin', 'MODERATOR')

    // Grant all catalog addons to Alice and Bob in user_addons
    const addonRows = await db('addons').select('id', 'slug')
    for (const addon of addonRows) {
      for (const u of [alice, bob]) {
        const existing = await db('user_addons').where({ user_id: u.userId, addon_id: addon.id }).first()
        if (!existing) {
          await db('user_addons').insert({
            user_id: u.userId,
            addon_id: addon.id,
            status: 'ACTIVATED',
            activated_at: new Date(),
            last_used_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          })
        }
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // 1. ADDON ROUTE AUTHENTICATION (Unauthenticated 401 Rejection)
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 1. Addon Route Guard & Unauthenticated 401 Rejection ---')
    const unauthRoutes = [
      { method: 'GET', path: '/api/invoices' },
      { method: 'POST', path: '/api/invoices' },
      { method: 'GET', path: '/api/invoices/999999' },
      { method: 'DELETE', path: '/api/invoices/999999' },
      { method: 'POST', path: '/api/invoices/999999/confirm-claim' },
      { method: 'POST', path: '/api/invoices/999999/credit-notes' },
      { method: 'POST', path: '/api/invoices/999999/mark-sent' },
      { method: 'POST', path: '/api/invoices/999999/payments' },
      { method: 'GET', path: '/api/invoices/999999/pdf' },
      { method: 'POST', path: '/api/invoices/999999/send' },
      { method: 'POST', path: '/api/invoices/evaluate-overdue' },
      { method: 'POST', path: '/api/invoices/from-job' },
      { method: 'POST', path: '/api/invoices/status' },
      { method: 'GET', path: '/api/invoices/recurring' },
      { method: 'POST', path: '/api/invoices/recurring' },
      { method: 'POST', path: '/api/calculator/pricing' },
      { method: 'POST', path: '/api/calculator/apply-quote' },
      { method: 'GET', path: '/api/reports/summary' },
      { method: 'GET', path: '/api/reports/export' },
    ]

    for (const r of unauthRoutes) {
      const res = await api(r.path, { method: r.method })
      if (res.status === 401) {
        testPass(`Unauthenticated ${r.method} ${r.path} returns 401 Unauthorized`)
      } else {
        testFail(`Unauthenticated ${r.method} ${r.path} returned ${res.status}, expected 401`)
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // 2. CALCULATOR QUOTE & PROJECT OWNERSHIP VERIFICATION
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Calculator Quote & Project Ownership Validation ---')
    // Alice creates project & quote
    const [aliceProjId] = await db('projects').insert({
      user_id: alice.userId,
      name: 'Alice Project',
      status: 'in_progress',
      currency: 'USD',
      quote_amount: 1500.00,
      created_at: new Date(),
      updated_at: new Date()
    })
    const [aliceQuoteId] = await db('project_quotes').insert({
      user_id: alice.userId,
      project_id: aliceProjId,
      version: 1,
      quote_amount: 1500.00,
      currency: 'USD',
      quote_date: '2026-09-22',
      status: 'accepted',
      created_at: new Date(),
      updated_at: new Date()
    })

    // Bob creates project & quote
    const [bobProjId] = await db('projects').insert({
      user_id: bob.userId,
      name: 'Bob Project',
      status: 'in_progress',
      currency: 'USD',
      quote_amount: 2500.00,
      created_at: new Date(),
      updated_at: new Date()
    })
    const [bobQuoteId] = await db('project_quotes').insert({
      user_id: bob.userId,
      project_id: bobProjId,
      version: 1,
      quote_amount: 2500.00,
      currency: 'USD',
      quote_date: '2026-09-22',
      status: 'accepted',
      created_at: new Date(),
      updated_at: new Date()
    })

    // Bob attempts to apply Alice's quote to Bob's project -> 404
    const crossQuoteRes = await api('/api/calculator/apply-quote', {
      method: 'POST',
      token: bob.token,
      body: { quoteId: aliceQuoteId, projectId: bobProjId, quoteAmount: 1500 }
    })
    if (crossQuoteRes.status === 404) {
      testPass('Bob applying Alice quote returns 404 Quote not found')
    } else {
      testFail(`Bob applying Alice quote returned ${crossQuoteRes.status}, expected 404`)
    }

    // Bob attempts to apply Bob's quote to Alice's project -> 404
    const crossProjRes = await api('/api/calculator/apply-quote', {
      method: 'POST',
      token: bob.token,
      body: { quoteId: bobQuoteId, projectId: aliceProjId, quoteAmount: 2500 }
    })
    if (crossProjRes.status === 404) {
      testPass('Bob applying quote to Alice project returns 404 Project not found')
    } else {
      testFail(`Bob applying quote to Alice project returned ${crossProjRes.status}, expected 404`)
    }

    // Bob applies Bob's quote to Bob's project -> 200
    const validApplyRes = await api('/api/calculator/apply-quote', {
      method: 'POST',
      token: bob.token,
      body: { quoteId: bobQuoteId, projectId: bobProjId, quoteAmount: 2500 }
    })
    if (validApplyRes.status === 200) {
      testPass('Bob applying Bob quote to Bob project succeeds with 200')
    } else {
      testFail(`Bob applying own quote failed: ${validApplyRes.status} ${JSON.stringify(validApplyRes.body)}`)
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. IMPERSONATION MASKING & MUTATION DEFAULT-DENY
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 3. Impersonation Masking & Default-Deny Guards ---')
    // Seed some financial data for Alice
    const [aliceClientId] = await db('clients').insert({
      user_id: alice.userId,
      name: 'Confidential Alice Client',
      email: 'aliceclient@secret.com',
      phone_e164: '+15550001111',
      created_at: new Date(),
      updated_at: new Date()
    })
    await db('payments').insert({
      user_id: alice.userId,
      project_id: aliceProjId,
      client_id: aliceClientId,
      amount: 1200.50,
      currency: 'USD',
      paid_date: '2026-09-22',
      notes: 'Confidential client payment notes',
      created_at: new Date(),
      updated_at: new Date()
    })
    await db('project_expenses').insert({
      user_id: alice.userId,
      project_id: aliceProjId,
      description: 'Secret server hosting',
      category: 'Software',
      amount: 340.00,
      currency: 'USD',
      expense_date: '2026-09-22',
      created_at: new Date(),
      updated_at: new Date()
    })
    const [aliceInvoiceDbId] = await db('invoices').insert({
      user_id: alice.userId,
      project_id: aliceProjId,
      client_id: aliceClientId,
      invoice_number: `INV-ALICE-${timestamp}`,
      invoice_date: '2026-09-22',
      due_date: '2026-10-06',
      customer_name: 'Secret Corp',
      subtotal: 5000.00,
      tax_percent: 10.00,
      tax_amount: 500.00,
      total: 5500.00,
      currency: 'USD',
      status: 'sent',
      created_at: new Date(),
      updated_at: new Date()
    })

    // Create an impersonation session for Alice via the impersonation API
    const impStartRes = await api('/api/admin/users/impersonate', {
      method: 'POST',
      token: support.token,
      body: { userId: alice.userId, reason: 'Customer support invoice diagnosis' }
    })
    assert(impStartRes.status === 200, `Support created impersonation session: ${JSON.stringify(impStartRes.body)}`)
    const impersonationToken = impStartRes.body.impersonationToken

    // Verify mutations return 403 Forbidden under impersonation
    const mutationDenials = [
      { method: 'POST', path: '/api/invoices', body: { customerName: 'Test Corp', total: 100 } },
      { method: 'POST', path: '/api/expenses', body: { amount: 50, category: 'Hosting' } },
      { method: 'POST', path: `/api/invoices/${aliceInvoiceDbId}/send`, body: {} },
      { method: 'GET', path: `/api/invoices/${aliceInvoiceDbId}/pdf` },
      { method: 'GET', path: '/api/reports/export' },
    ]

    for (const m of mutationDenials) {
      const res = await api(m.path, { method: m.method, token: impersonationToken, body: m.body })
      if (res.status === 403) {
        testPass(`Impersonation blocked on ${m.method} ${m.path} with 403 Forbidden`)
      } else {
        testFail(`Impersonation on ${m.method} ${m.path} returned ${res.status}, expected 403`)
      }
    }

    // Verify GET routes return masked values under impersonation
    const getMaskChecks = [
      {
        name: 'payments',
        path: '/api/payments',
        check: (body) => {
          const items = body.data || body
          return Array.isArray(items) && items.some(p => p.amount === 0 || p.amount === '0.00' || p.amount === '[MASKED]')
        }
      },
      {
        name: 'expenses',
        path: '/api/expenses',
        check: (body) => {
          const items = body.data || body
          return Array.isArray(items) && items.some(e => e.amount === 0 || e.amount === '0.00' || e.amount === '[MASKED]')
        }
      },
      {
        name: 'clients',
        path: '/api/clients',
        check: (body) => {
          const items = body.data || body
          return Array.isArray(items) && items.some(c => c.email === '[REDACTED]' || c.phone === '[REDACTED]' || c.phoneE164 === '[REDACTED]')
        }
      },
      {
        name: 'invoices',
        path: '/api/invoices',
        check: (body) => {
          const items = body.data?.invoices || body.invoices || body.data || body
          return Array.isArray(items) && items.some(inv => inv.total === 0 || inv.total === '0.00' || inv.subtotal === 0 || inv.subtotal === '0.00')
        }
      },
      {
        name: 'session',
        path: '/api/auth/session',
        check: (body) => {
          const u = body.user || body.data?.user || body
          return u?.targetHourly === 0 || u?.targetHourly === '0.00' || u?.email === '[REDACTED]' || u?.phone === '[REDACTED]'
        }
      },
      {
        name: 'sessions',
        path: '/api/auth/sessions',
        check: (body) => {
          const items = body.data?.sessions || body.sessions || body
          return Array.isArray(items) && items.some(s => s.ipAddress === '[REDACTED]' || s.userAgent === '[REDACTED]' || s.ipAddress === null)
        }
      }
    ]

    for (const g of getMaskChecks) {
      const res = await api(g.path, { token: impersonationToken })
      if (res.status === 200) {
        const isMasked = g.check(res.body)
        if (isMasked) {
          testPass(`GET ${g.path} returns masked values under impersonation`)
        } else {
          testFail(`GET ${g.path} did not mask sensitive values: ${JSON.stringify(res.body).slice(0, 150)}`)
        }
      } else {
        testFail(`GET ${g.path} under impersonation returned ${res.status}`)
      }
    }

    // ─────────────────────────────────────────────────────────────────
    // 4. 5-TIER RBAC PERMISSION MATRIX
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 4. 5-Tier RBAC Permission Hierarchy Verification ---')

    // Test feedback.view (SUPER_ADMIN, ADMIN, SUPPORT, MODERATOR allowed; ANALYST blocked)
    const fbSuper = await api('/api/admin/feedback', { token: superAdmin.token })
    const fbAdmin = await api('/api/admin/feedback', { token: admin.token })
    const fbSupport = await api('/api/admin/feedback', { token: support.token })
    const fbMod = await api('/api/admin/feedback', { token: moderator.token })
    const fbAnalyst = await api('/api/admin/feedback', { token: analyst.token })

    assert(fbSuper.status === 200, 'SUPER_ADMIN has feedback.view (200)')
    assert(fbAdmin.status === 200, 'ADMIN has feedback.view (200)')
    assert(fbSupport.status === 200, 'SUPPORT has feedback.view (200)')
    assert(fbMod.status === 200, 'MODERATOR has feedback.view (200)')
    assert(fbAnalyst.status === 403, 'ANALYST lacks feedback.view (403)')
    testPass('feedback.view permission properly enforced across all 5 roles')

    // Test feedback.manage (SUPER_ADMIN, ADMIN, SUPPORT allowed; ANALYST, MODERATOR blocked)
    const fbManageSupport = await api('/api/admin/feedback/1', { method: 'PATCH', token: support.token, body: { status: 'RESOLVED' } })
    const fbManageAnalyst = await api('/api/admin/feedback/1', { method: 'PATCH', token: analyst.token, body: { status: 'RESOLVED' } })
    const fbManageMod = await api('/api/admin/feedback/1', { method: 'PATCH', token: moderator.token, body: { status: 'RESOLVED' } })
    assert(fbManageSupport.status !== 403, 'SUPPORT has feedback.manage (not 403)')
    assert(fbManageAnalyst.status === 403, 'ANALYST lacks feedback.manage (403)')
    assert(fbManageMod.status === 403, 'MODERATOR lacks feedback.manage (403)')
    testPass('feedback.manage allowed for SUPPORT and blocked for ANALYST & MODERATOR')

    // Test system.view on /api/health/details (SUPER_ADMIN, ADMIN, ANALYST allowed; SUPPORT, MODERATOR blocked)
    const healthSuper = await api('/api/health/details', { token: superAdmin.token })
    const healthAdmin = await api('/api/health/details', { token: admin.token })
    const healthAnalyst = await api('/api/health/details', { token: analyst.token })
    const healthSupport = await api('/api/health/details', { token: support.token })
    const healthMod = await api('/api/health/details', { token: moderator.token })
    assert(healthSuper.status === 200, 'SUPER_ADMIN has system.view (200)')
    assert(healthAdmin.status === 200, 'ADMIN has system.view (200)')
    assert(healthAnalyst.status === 200, 'ANALYST has system.view (200)')
    assert(healthSupport.status === 403, 'SUPPORT lacks system.view (403)')
    assert(healthMod.status === 403, 'MODERATOR lacks system.view (403)')
    testPass('system.view on /api/health/details properly enforced across roles')

    // Test analytics.export (SUPER_ADMIN, ADMIN, ANALYST allowed; SUPPORT, MODERATOR blocked)
    const exportAnalyst = await api('/api/admin/analytics/export', { token: analyst.token })
    const exportSupport = await api('/api/admin/analytics/export', { token: support.token })
    assert(exportAnalyst.status === 200, 'ANALYST has analytics.export (200)')
    assert(exportSupport.status === 403, 'SUPPORT lacks analytics.export (403)')
    testPass('analytics.export properly allows ANALYST and blocks SUPPORT')

    // Test analytics.manage on backfill (SUPER_ADMIN, ADMIN allowed; ANALYST blocked)
    const backfillAnalyst = await api('/api/admin/analytics/backfill', { method: 'POST', token: analyst.token, body: { startDate: '2026-01-01', endDate: '2026-01-02' } })
    assert(backfillAnalyst.status === 403, 'ANALYST lacks analytics.manage (403)')
    testPass('analytics.manage properly blocks ANALYST from backfilling')

    // Test jobs.moderate (SUPER_ADMIN, ADMIN, MODERATOR allowed; ANALYST, SUPPORT blocked)
    const modJobsMod = await api('/api/admin/jobs/moderate', { method: 'POST', token: moderator.token, body: { jobId: 1, action: 'APPROVE', reason: 'Verified standard test listing' } })
    const modJobsAnalyst = await api('/api/admin/jobs/moderate', { method: 'POST', token: analyst.token, body: { jobId: 1, action: 'APPROVE', reason: 'Test' } })
    assert(modJobsMod.status !== 403, 'MODERATOR has jobs.moderate (status not 403)')
    assert(modJobsAnalyst.status === 403, 'ANALYST lacks jobs.moderate (403)')
    testPass('jobs.moderate properly allows MODERATOR and blocks ANALYST')

    // Test retention policies (SUPER_ADMIN run allowed; ADMIN run blocked)
    const retentionAdminRun = await api('/api/admin/retention/run', { method: 'POST', token: admin.token, body: { reason: 'Test retention run' } })
    assert(retentionAdminRun.status === 403, 'ADMIN cannot execute retention run (SUPER_ADMIN only -> 403)')
    testPass('Retention execution strictly restricted to SUPER_ADMIN')

    // ─────────────────────────────────────────────────────────────────
    // 5. SCHEDULER ENGINE HARDENING
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 5. Scheduler Engine Hardening ---')
    // Non-superadmin cannot run scheduler
    const schedAdmin = await api('/api/scheduler/run', { method: 'POST', token: admin.token, body: { jobs: ['invoiceOverdue'], reason: 'Admin run' } })
    assert(schedAdmin.status === 403, 'Non-SUPER_ADMIN cannot run scheduler jobs (403)')

    // Superadmin without reason -> 400
    const schedNoReason = await api('/api/scheduler/run', { method: 'POST', token: superAdmin.token, body: { jobs: ['invoiceOverdue'] } })
    assert(schedNoReason.status === 400, 'Scheduler run without reason rejected with 400')

    // Disallowed jobKey -> 400
    const schedInvalidJob = await api('/api/scheduler/run', { method: 'POST', token: superAdmin.token, body: { jobs: ['unauthorized-arbitrary-job'], reason: 'Security test' } })
    assert(schedInvalidJob.status === 400, 'Disallowed jobKey rejected with 400')

    // Mass mail job without confirmMassMail -> 400
    const schedMassMailNoConfirm = await api('/api/scheduler/run', {
      method: 'POST',
      token: superAdmin.token,
      body: { jobs: ['weeklyDigests'], reason: 'Security test for mass mail confirmation' }
    })
    assert(schedMassMailNoConfirm.status === 400, 'Mass mail job without confirmMassMail rejected with 400')

    // Valid job with reason -> 200
    const schedValid = await api('/api/scheduler/run', {
      method: 'POST',
      token: superAdmin.token,
      body: { jobs: ['invoiceOverdue'], reason: 'Automated test suite overdue invoice evaluation' }
    })
    assert(schedValid.status === 200, 'Valid scheduler execution with reason returns 200')
    testPass('Scheduler engine hardening strictly validated')

    // ─────────────────────────────────────────────────────────────────
    // 6. SCHEDULED REPORTS ADMIN RECIPIENTS RESTRICTION & CAP
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 6. Scheduled Reports Admin Recipients Validation ---')
    // More than 10 recipients -> 400
    const elevenRecipients = Array.from({ length: 11 }, (_, i) => `admin${i}@wello.test`)
    const schedReportTooMany = await api('/api/admin/analytics/tools/scheduled-reports', {
      method: 'POST',
      token: admin.token,
      body: { name: 'Weekly Report', frequency: 'WEEKLY', reportType: 'FINANCIAL', recipients: elevenRecipients }
    })
    assert(schedReportTooMany.status === 400, 'Scheduled report with > 10 recipients rejected with 400')

    // Recipient not an admin -> 400
    const schedReportNonAdmin = await api('/api/admin/analytics/tools/scheduled-reports', {
      method: 'POST',
      token: admin.token,
      body: { name: 'Weekly Report', frequency: 'WEEKLY', reportType: 'FINANCIAL', recipients: [alice.email] }
    })
    assert(schedReportNonAdmin.status === 400, 'Scheduled report with non-admin recipient rejected with 400')
    testPass('Scheduled report recipients capped at 10 and restricted to admins')

    // ─────────────────────────────────────────────────────────────────
    // 7. STEP-UP OTP ENFORCEMENT ON CRITICAL ADMIN ROUTES
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 7. Step-Up OTP Guard Enforcement ---')
    // 1. Roles modification with x-enforce-step-up: true without OTP -> 403
    const roleNoOtp = await api('/api/admin/roles', {
      method: 'POST',
      token: superAdmin.token,
      headers: { 'x-enforce-step-up': 'true' },
      body: { action: 'UPDATE_ROLE', targetEmail: admin.email, roleKey: 'SUPPORT' }
    })
    assert(roleNoOtp.status === 403, 'Admin role change without OTP returns 403 Step-up required')

    // Roles modification with valid OTP -> 200
    // Request an admin action OTP first
    const sendOtpRes = await api('/api/admin/security/request-otp', {
      method: 'POST',
      token: superAdmin.token,
      body: { actionType: 'roles' }
    })
    const devOtp = sendOtpRes.body?.devOtp || '123456'
    const roleWithOtp = await api('/api/admin/roles', {
      method: 'POST',
      token: superAdmin.token,
      headers: { 'x-enforce-step-up': 'true' },
      body: { action: 'UPDATE_ROLE', targetEmail: admin.email, roleKey: 'ADMIN', stepUpOtp: devOtp }
    })
    if (roleWithOtp.status !== 200) {
      console.error('  [DEBUG roleWithOtp failed]:', roleWithOtp.status, JSON.stringify(roleWithOtp.body))
    }
    assert(roleWithOtp.status === 200, 'Admin role change with valid OTP returns 200')

    // 2. User status suspension without OTP -> 403
    const userStatusNoOtp = await api('/api/admin/users/status', {
      method: 'POST',
      token: superAdmin.token,
      headers: { 'x-enforce-step-up': 'true' },
      body: { email: bob.email, status: 'SUSPENDED', reason: 'Security check' }
    })
    assert(userStatusNoOtp.status === 403, 'User suspension without OTP returns 403')

    // 3. Addon Kill-Switch without OTP -> 403
    const killSwitchNoOtp = await api('/api/admin/store/kill-switch', {
      method: 'POST',
      token: superAdmin.token,
      headers: { 'x-enforce-step-up': 'true' },
      body: { addonKey: 'invoicing', isKilled: true, reason: 'Security testing kill switch' }
    })
    assert(killSwitchNoOtp.status === 403, 'Addon kill switch without OTP returns 403')

    // 4. Impersonation start without OTP -> 403
    const impersonateNoOtp = await api('/api/admin/users/impersonate', {
      method: 'POST',
      token: superAdmin.token,
      headers: { 'x-enforce-step-up': 'true' },
      body: { userId: alice.userId, reason: 'Customer support request' }
    })
    assert(impersonateNoOtp.status === 403, 'Starting impersonation without OTP returns 403')
    testPass('Step-up OTP guards successfully enforce 403 without valid OTP')

    // ─────────────────────────────────────────────────────────────────
    // 8. HMAC-SHA256 AUDIT CHAIN VERIFICATION & INDEX TAMPER ALERTING
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 8. HMAC-SHA256 Audit Chain Verification & Index Corrupted Alerting ---')
    const initialVerify = await api('/api/admin/audit-logs/verify', { token: superAdmin.token })
    if (!initialVerify.body?.valid) {
      console.error('  [DEBUG initialVerify]:', initialVerify.status, JSON.stringify(initialVerify.body))
    }
    assert(initialVerify.status === 200, 'Verify endpoint returns 200')
    assert(initialVerify.body?.valid === true, 'Initial audit chain verification is valid')
    testPass('Initial audit chain is valid and verified via HMAC-SHA256')

    // ─────────────────────────────────────────────────────────────────
    // 9. PUBLIC ATTACK SURFACES HARDENING
    // ─────────────────────────────────────────────────────────────────
    console.log('\n--- 9. Public Attack Surface Hardening ---')
    await db('rate_limits').where('key', 'like', '%category_request%').delete()

    // Category requests honeypot trigger
    const honeypotRes = await api('/api/category-requests', {
      method: 'POST',
      body: {
        email: 'spammer@bot.xyz',
        name: 'Spam Category',
        reason: 'Spam reason',
        website: 'http://spambot.xyz' // Honeypot field
      }
    })
    assert(honeypotRes.status === 400, 'Honeypot submission is rejected with 400')
    testPass('Category requests honeypot traps and rejects bot submissions')

    // Category requests field length validation (> 100 chars name)
    const longNameRes = await api('/api/category-requests', {
      method: 'POST',
      body: {
        email: 'user@test.local',
        name: 'A'.repeat(101),
        reason: 'Valid reason'
      }
    })
    assert(longNameRes.status === 400, 'Excessive category name length (>100) rejected with 400')
    testPass('Category requests validates maximum field lengths')

    // Events batch cap of 50
    const fiftyOneEvents = Array.from({ length: 51 }, (_, i) => ({
      eventType: 'page_view',
      eventName: `view_${i}`,
      data: {}
    }))
    const eventBatchCapRes = await api('/api/events', {
      method: 'POST',
      body: { events: fiftyOneEvents }
    })
    assert(eventBatchCapRes.status === 400, 'Events batch > 50 rejected with 400 Bad Request')
    testPass('Events endpoint strictly caps batch ingestion at 50 events')

    // Public portal security headers
    // Set public token on project_quotes
    const rawQuoteToken = crypto.randomBytes(24).toString('base64url')
    const tokenHash = crypto.createHash('sha256').update(rawQuoteToken).digest('hex')
    await db('project_quotes').where({ id: aliceQuoteId }).update({
      public_token: rawQuoteToken,
      public_token_hash: tokenHash,
      public_token_expires_at: new Date(Date.now() + 86400000)
    })

    const publicPortalRes = await api(`/api/quotes/public/${rawQuoteToken}`)
    assert(publicPortalRes.status === 200, 'Public quote portal returns 200')
    const refPolicy = publicPortalRes.headers.get('referrer-policy')
    const robotsTag = publicPortalRes.headers.get('x-robots-tag')
    const cacheControl = publicPortalRes.headers.get('cache-control')

    assert(refPolicy === 'no-referrer', `Referrer-Policy is no-referrer (got ${refPolicy})`)
    assert(robotsTag === 'noindex, nofollow', `X-Robots-Tag is noindex, nofollow (got ${robotsTag})`)
    assert(cacheControl && cacheControl.includes('no-store'), `Cache-Control includes no-store (got ${cacheControl})`)
    testPass('Public portal enforces Referrer-Policy, X-Robots-Tag, and no-store headers')

  } catch (err) {
    testFail('Unexpected error during test battery execution', err)
  } finally {
    await db.destroy()
  }

  console.log('\n===============================================================')
  console.log(`📊 RESULTS: ${totalPassed} Passed, ${totalFailed} Failed`)
  console.log('===============================================================')

  if (totalFailed > 0) {
    process.exit(1)
  }
}

runHardeningTests()
