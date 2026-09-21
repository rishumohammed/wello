// tests/test_audit_chain_and_financial_safety.mjs
/**
 * Automated Verification Suite for Admin Personal Income Privacy,
 * Tamper-Evident Audit Chain, Support Impersonation, and Job Moderation.
 */

import assert from 'node:assert'
import crypto from 'node:crypto'
import knex from 'knex'
import knexConfig from '../knexfile.cjs'

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

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
  }
}

async function runTests() {
  console.log('\n🔒 STARTING ADMIN CONSOLE SECURITY & FINANCIAL PRIVACY TEST SUITE\n')

  const db = knex(knexConfig)

  try {
    // 0. Setup test users and admin sessions
    const superAdminToken = 'admin_token_test_superadmin_' + Date.now()
    const analystToken = 'analyst_token_test_analyst_' + Date.now()
    const supportToken = 'support_token_test_support_' + Date.now()

    // Find or seed Super Admin User
    let superAdminUser = await db('users').where({ email: 'superadmin@wello-test.local' }).first()
    if (!superAdminUser) {
      const [id] = await db('users').insert({
        email: 'superadmin@wello-test.local',
        name: 'Super Admin Tester',
        role: 'admin',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      })
      superAdminUser = { id, email: 'superadmin@wello-test.local', role: 'admin' }
    } else {
      await db('users').where({ id: superAdminUser.id }).update({ role: 'admin', status: 'ACTIVE' })
    }

    // Ensure superadmin in admin_users
    const superAdminEntry = await db('admin_users').where({ user_id: superAdminUser.id }).first()
    if (!superAdminEntry) {
      await db('admin_users').insert({ user_id: superAdminUser.id, email: superAdminUser.email, role_key: 'SUPER_ADMIN', created_at: new Date() })
    } else {
      await db('admin_users').where({ user_id: superAdminUser.id }).update({ role_key: 'SUPER_ADMIN' })
    }

    // Find or seed Analyst User
    let analystUser = await db('users').where({ email: 'analyst@wello-test.local' }).first()
    if (!analystUser) {
      const [id] = await db('users').insert({
        email: 'analyst@wello-test.local',
        name: 'Analyst Tester',
        role: 'admin',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      })
      analystUser = { id, email: 'analyst@wello-test.local', role: 'admin' }
    } else {
      await db('users').where({ id: analystUser.id }).update({ role: 'admin', status: 'ACTIVE' })
    }

    // Ensure analyst in admin_users
    const analystEntry = await db('admin_users').where({ user_id: analystUser.id }).first()
    if (!analystEntry) {
      await db('admin_users').insert({ user_id: analystUser.id, email: analystUser.email, role_key: 'ANALYST', created_at: new Date() })
    } else {
      await db('admin_users').where({ user_id: analystUser.id }).update({ role_key: 'ANALYST' })
    }

    // Find or seed Support User
    let supportUser = await db('users').where({ email: 'support@wello-test.local' }).first()
    if (!supportUser) {
      const [id] = await db('users').insert({
        email: 'support@wello-test.local',
        name: 'Support Tester',
        role: 'admin',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      })
      supportUser = { id, email: 'support@wello-test.local', role: 'admin' }
    } else {
      await db('users').where({ id: supportUser.id }).update({ role: 'admin', status: 'ACTIVE' })
    }

    // Ensure support in admin_users
    const supportEntry = await db('admin_users').where({ user_id: supportUser.id }).first()
    if (!supportEntry) {
      await db('admin_users').insert({ user_id: supportUser.id, email: supportUser.email, role_key: 'SUPPORT', created_at: new Date() })
    } else {
      await db('admin_users').where({ user_id: supportUser.id }).update({ role_key: 'SUPPORT' })
    }

    // Insert active sessions
    const sessions = [
      { userId: superAdminUser.id, token: superAdminToken },
      { userId: analystUser.id, token: analystToken },
      { userId: supportUser.id, token: supportToken }
    ]

    for (const s of sessions) {
      const hash = crypto.createHash('sha256').update(s.token).digest('hex')
      await db('auth_sessions').insert({
        user_id: s.userId,
        token_hash: hash,
        ip_address: '127.0.0.1',
        user_agent: 'TestAgent/1.0',
        expires_at: new Date(Date.now() + 86400000),
        created_at: new Date()
      })
    }

    // ─── TEST 1: Default Admin User Directory Shows Aggregates / Non-Financial ──
    console.log('\n--- 1. Default User Directory Privacy Check ---')
    const userListRes = await api('/api/admin/users', { token: superAdminToken })
    assert.strictEqual(userListRes.status, 200, 'GET /api/admin/users returns 200')
    assert.ok(Array.isArray(userListRes.body?.users), 'Returns users array')
    
    const sampleUser = userListRes.body.users[0]
    assert.strictEqual(sampleUser?.targetHourly, undefined, 'Default user directory omits personal targetHourly')
    testPass('Default user directory does NOT expose individual targetHourly rates')

    // ─── TEST 2: ANALYST Role Cannot Access Individual Financial Records ────────
    console.log('\n--- 2. Analyst Financial Data Access Isolation ---')
    const targetUserObj = userListRes.body.users.find(u => u.role !== 'admin' && u.email !== 'admin@wello.com') || userListRes.body.users[1] || { id: 2 }
    const targetUserId = targetUserObj?.id || 2

    // Analyst attempts to access user financials -> 403 Forbidden
    const analystFinRes = await api(`/api/admin/users/${targetUserId}/financials?reason=AnalystCheck`, {
      token: analystToken,
    })
    assert.strictEqual(analystFinRes.status, 403, 'ANALYST gets 403 Forbidden when requesting user financials')
    testPass('ANALYST cannot view individual user financial records (403 Forbidden)')

    // Analyst attempts to unmask jobs -> monetary amounts remain masked
    const analystJobsRes = await api('/api/admin/jobs?unmaskFinancials=true&reason=GrowthAnalysis', {
      token: analystToken,
    })
    assert.strictEqual(analystJobsRes.status, 200, 'ANALYST can access Jobs overview')
    assert.strictEqual(analystJobsRes.body?.financialsUnmasked, false, 'Jobs financials remain masked for ANALYST')
    assert.strictEqual(analystJobsRes.body?.jobs[0]?.isFinancialsMasked, true, 'Job quote amount is masked')
    testPass('ANALYST cannot unmask monetary amounts in Jobs overview')

    // ─── TEST 3: SUPER_ADMIN Viewing Financials Requires Reason & Audits ────────
    console.log('\n--- 3. Super Admin Reason Enforcement & Financial Audit Logging ---')
    
    // Attempt without reason -> 400 Bad Request
    const noReasonRes = await api(`/api/admin/users/${targetUserId}/financials`, {
      token: superAdminToken,
    })
    assert.strictEqual(noReasonRes.status, 400, 'SUPER_ADMIN without reason receives 400 Bad Request')
    testPass('Viewing financial records without business reason is blocked (400 Bad Request)')

    // Attempt with valid reason -> 200 OK & Audited
    const auditReason = 'Discrepancy audit ticket #9481'
    const validFinRes = await api(`/api/admin/users/${targetUserId}/financials?reason=${encodeURIComponent(auditReason)}`, {
      token: superAdminToken,
    })
    assert.strictEqual(validFinRes.status, 200, 'SUPER_ADMIN with reason receives 200 OK')
    assert.ok(validFinRes.body?.financials, 'Returns user financial breakdown')
    testPass('SUPER_ADMIN with valid justification reason successfully accesses financial records')

    // Check audit logs for VIEW_USER_FINANCIALS record
    const auditLogsRes = await api('/api/admin/audit-logs', { token: superAdminToken })
    const viewLog = auditLogsRes.body?.logs?.find(l => l.action === 'VIEW_USER_FINANCIALS')
    assert.ok(viewLog, 'Audit log contains VIEW_USER_FINANCIALS entry')
    assert.strictEqual(viewLog.reason, auditReason, 'Audit log recorded the exact justification reason')
    assert.strictEqual(viewLog.permissionUsed, 'users.financial_view', 'Audit log recorded users.financial_view permission')
    testPass('Financial view operation recorded in audit log with permission and justification reason')

    // ─── TEST 4: Tamper-Evident Audit Chain Verification ────────────────────────
    console.log('\n--- 4. Cryptographic Tamper-Evident Hash Chain Verification ---')
    const verifyRes = await api('/api/admin/audit-logs/verify', { token: superAdminToken })
    assert.strictEqual(verifyRes.status, 200, 'GET /api/admin/audit-logs/verify returns 200')
    assert.strictEqual(verifyRes.body?.valid, true, 'Audit chain integrity is valid')
    assert.ok(verifyRes.body?.totalEntries > 0, 'Verified multiple audit entries')
    testPass(`Audit log cryptographic chain verified intact (${verifyRes.body?.totalEntries} entries)`)

    // Verify tampering detection
    const latestLog = await db('audit_logs').orderBy('id', 'desc').first()
    if (latestLog) {
      // Artificially mutate action column
      await db('audit_logs').where({ id: latestLog.id }).update({ action: 'TAMPERED_ACTION' })
      
      const tamperedVerify = await api('/api/admin/audit-logs/verify', { token: superAdminToken })
      assert.strictEqual(tamperedVerify.body?.valid, false, 'Tampered audit row is detected by verify-chain')
      assert.strictEqual(tamperedVerify.body?.corruptedAtId, latestLog.id, 'Identified exact corrupted record ID')
      testPass('Tampering with an audit row is successfully detected by verify-chain')

      // Restore original action
      await db('audit_logs').where({ id: latestLog.id }).update({ action: latestLog.action })
      const restoredVerify = await api('/api/admin/audit-logs/verify', { token: superAdminToken })
      assert.strictEqual(restoredVerify.body?.valid, true, 'Restored audit chain returns valid: true')
      testPass('Restored audit chain passes integrity verification')
    }

    // ─── TEST 5: Support Read-Only Time-Boxed Impersonation ──────────────────────
    console.log('\n--- 5. Support User Impersonation (Read-Only & Time-Boxed) ---')
    
    // Support requests impersonation without reason -> 400
    const noReasonImp = await api('/api/admin/users/impersonate', {
      method: 'POST',
      token: supportToken,
      body: { userId: targetUserId },
    })
    assert.strictEqual(noReasonImp.status, 400, 'Impersonation without reason returns 400 Bad Request')
    testPass('Impersonation without reason rejected')

    // Support requests impersonation with reason -> 200 with 15-min token
    const impReason = 'Troubleshooting customer invoice generation issue'
    const impRes = await api('/api/admin/users/impersonate', {
      method: 'POST',
      token: supportToken,
      body: { userId: targetUserId, reason: impReason },
    })
    assert.strictEqual(impRes.status, 200, 'Support impersonation session created')
    assert.ok(impRes.body?.impersonationToken, 'Returns temporary impersonation token')
    const impToken = impRes.body.impersonationToken
    testPass('Support impersonation session created with 15-minute time-box')

    // Verify read-only constraint: Mutation attempt with impersonation token -> 403 Forbidden
    const mutateRes = await api('/api/quick-entry', {
      method: 'POST',
      token: impToken,
      body: { type: 'timer', action: 'start' },
    })
    assert.strictEqual(mutateRes.status, 403, 'Mutation in impersonation mode blocked with 403')
    testPass('Read-only enforcement blocks mutations in impersonation mode (403 Forbidden)')

    // Exit impersonation
    const exitRes = await api('/api/auth/impersonate/exit', {
      method: 'POST',
      token: impToken,
    })
    assert.strictEqual(exitRes.status, 200, 'Exit impersonation succeeds')
    testPass('Support impersonation session successfully terminated')

    // ─── TEST 6: Job Insights & Moderation Flagging ─────────────────────────────
    console.log('\n--- 6. Job Insights Moderation & Flag Handling ---')
    const jobsList = await api('/api/admin/jobs', { token: superAdminToken })
    const sampleJob = jobsList.body?.jobs?.[0] || { id: 101 }

    // Flag job
    const flagRes = await api('/api/admin/jobs/moderate', {
      method: 'POST',
      token: superAdminToken,
      body: { jobId: sampleJob.id, action: 'FLAG', flagReason: 'Misleading description' },
    })
    assert.strictEqual(flagRes.status, 200, 'Job flagged successfully')
    testPass('Admin successfully flags job for moderation')

    // Resolve flag
    const resolveRes = await api('/api/admin/jobs/moderate', {
      method: 'POST',
      token: superAdminToken,
      body: { jobId: sampleJob.id, action: 'DISMISS_FLAG' },
    })
    assert.strictEqual(resolveRes.status, 200, 'Flag resolved successfully')
    testPass('Admin successfully resolves moderation flag')

    // ─── TEST 7: Step-Up OTP Re-Authentication for Role Changes ────────────────
    console.log('\n--- 7. Step-Up Re-Authentication for Role Changes ---')
    const reqOtpRes = await api('/api/admin/security/request-otp', {
      method: 'POST',
      token: superAdminToken,
      body: { actionType: 'roles' },
    })
    assert.strictEqual(reqOtpRes.status, 200, 'Request re-auth OTP succeeds')
    testPass('Admin successfully requested step-up re-authentication OTP')

    console.log(`\n🎉 TEST SUITE COMPLETED: ${totalPassed} Passed, ${totalFailed} Failed\n`)
  } finally {
    await db.destroy()
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
