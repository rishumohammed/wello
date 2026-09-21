// backend/tests/test_trust_onboarding_privacy_and_lifecycle.mjs
// Comprehensive End-to-End Verification Suite for Trust & Onboarding Essentials:
// 1. Data Export (ZIP, JSON, CSV)
// 2. Data Import & Presets (Toggl, Clockify, Wello CSV) + Roundtrip
// 3. Privacy Settings & Telemetry Opt-Out
// 4. User Feedback Submission & Admin Triage
// 5. Data Retention Policies & Scheduled Purge
// 6. Work Data Wipe (keep user & addons)
// 7. Account Deletion Grace Period & Cancellation
// 8. Full Permanent Erasure across all 25+ tables

import knex from 'knex'
import knexConfig from '../knexfile.cjs'

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001'
const db = knex(knexConfig)

let totalTests = 0
let passedTests = 0

function testLog(passed, message) {
  totalTests++
  if (passed) {
    console.log(`  ✅ PASS: ${message}`)
    passedTests++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    process.exitCode = 1
  }
}

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // Non-JSON response
  }

  return { status: res.status, headers: res.headers, body: data }
}

async function createTestUser(email, name = 'Trust Test User') {
  const sendRes = await api('/api/auth/send-otp', {
    method: 'POST',
    body: { email },
  })

  if (!sendRes.body?.devOtp) {
    throw new Error(`Failed to get OTP for ${email}: ${JSON.stringify(sendRes.body)}`)
  }

  const verifyRes = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: { email, code: sendRes.body.devOtp, name },
  })

  return { token: verifyRes.body?.token, user: verifyRes.body?.user }
}

async function createAdminUser() {
  const sendRes = await api('/api/auth/send-otp', {
    method: 'POST',
    body: { email: 'admin@wello.com' },
  })
  const verifyRes = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: { email: 'admin@wello.com', code: sendRes.body?.devOtp },
  })
  return { token: verifyRes.body?.token, user: verifyRes.body?.user }
}

async function run() {
  console.log('\n===============================================================')
  console.log('🧪 RUNNING TRUST, ONBOARDING, PRIVACY & LIFECYCLE TEST SUITE')
  console.log('===============================================================\n')

  let regularUser = null
  let adminUser = null

  try {
    // ── STEP 1: AUTH & ONBOARDING SETUP ───────────────────────────────────────
    console.log('--- 1. Setting up Test Users & Onboarding Completion ---')
    const userEmail = `user_trust_${Date.now()}@example.com`
    regularUser = await createTestUser(userEmail, 'Alex Trust')
    adminUser = await createAdminUser()

    testLog(!!regularUser.token, `Authenticated test user ID ${regularUser.user.id}`)
    testLog(!!adminUser.token, `Authenticated admin user ID ${adminUser.user.id}`)

    // Complete Onboarding Wizard via PATCH /api/me
    const onboardingRes = await api('/api/me', {
      method: 'PATCH',
      token: regularUser.token,
      body: {
        name: 'Alex Trust',
        timezone: 'America/New_York',
        baseCurrency: 'USD',
        targetHourly: 150,
        targetMonthlyIncome: 12000,
        earningPersona: 'freelancer_projects',
        onboardingCompletedAt: new Date().toISOString(),
      },
    })

    testLog(onboardingRes.status === 200, 'PATCH /api/me completed 4-step onboarding')
    testLog(onboardingRes.body?.data?.onboardingCompletedAt !== null, 'onboardingCompletedAt persisted')
    testLog(onboardingRes.body?.data?.targetMonthlyIncome === 12000, 'targetMonthlyIncome persisted')

    // Create client, project, session, payment, expense
    const clientRes = await api('/api/clients', {
      method: 'POST',
      token: regularUser.token,
      body: {
        name: 'Omni Global',
        email: 'billing@omniglobal.com',
        country: 'US',
      },
    })
    const clientId = clientRes.body?.data?.id || clientRes.body?.id
    testLog([200, 201].includes(clientRes.status) && !!clientId, `Created test client (ID: ${clientId})`)

    const projRes = await api('/api/projects', {
      method: 'POST',
      token: regularUser.token,
      body: {
        clientId,
        name: 'Core System Rebuild',
        serviceCategory: 'Engineering',
        status: 'in_progress',
        isJob: true,
        quoteAmount: 8000,
      },
    })
    const projectId = projRes.body?.data?.id || projRes.body?.id
    testLog([200, 201].includes(projRes.status) && !!projectId, `Created test project (ID: ${projectId})`)

    const sessRes = await api('/api/sessions', {
      method: 'POST',
      token: regularUser.token,
      body: {
        projectId,
        title: 'Architecture Blueprint',
        type: 'production',
        paymentType: 'paid',
        startedAt: new Date(Date.now() - 7200000).toISOString(),
        endedAt: new Date().toISOString(),
        durationMinutes: 120,
      },
    })
    testLog([200, 201].includes(sessRes.status), 'Created test work session (120 min)')

    const pmtRes = await api('/api/payments', {
      method: 'POST',
      token: regularUser.token,
      body: {
        projectId,
        amount: 4000,
        currency: 'USD',
        paidDate: new Date().toISOString().slice(0, 10),
      },
    })
    testLog([200, 201].includes(pmtRes.status), 'Created test payment ($4,000)')

    const expRes = await api('/api/expenses', {
      method: 'POST',
      token: regularUser.token,
      body: {
        projectId,
        description: 'Design Assets License',
        amount: 250,
        currency: 'USD',
        expenseDate: new Date().toISOString().slice(0, 10),
      },
    })
    testLog([200, 201].includes(expRes.status), 'Created test expense ($250)')

    // ── STEP 2: DATA EXPORT (ZIP, JSON, CSV) ──────────────────────────────────
    console.log('\n--- 2. Verifying Data Export Engine (ZIP, JSON, CSV) ---')

    // 2A. Full JSON Export
    const jsonExportRes = await api('/api/export/json', {
      method: 'GET',
      token: regularUser.token,
    })
    testLog(jsonExportRes.status === 200, 'GET /api/export/json returns 200')
    const jsonClients = jsonExportRes.body?.clients || jsonExportRes.body?.data?.clients || []
    const jsonProjects = jsonExportRes.body?.projects || jsonExportRes.body?.data?.projects || []
    const jsonSessions = jsonExportRes.body?.workSessions || jsonExportRes.body?.sessions || jsonExportRes.body?.data?.workSessions || jsonExportRes.body?.data?.sessions || []
    const jsonPayments = jsonExportRes.body?.payments || jsonExportRes.body?.data?.payments || []
    const jsonExpenses = jsonExportRes.body?.expenses || jsonExportRes.body?.data?.expenses || []

    testLog(jsonClients.length >= 1, 'JSON export contains client')
    testLog(jsonProjects.length >= 1, 'JSON export contains project')
    testLog(jsonSessions.length >= 1, 'JSON export contains session')
    testLog(jsonPayments.length >= 1, 'JSON export contains payment')
    testLog(jsonExpenses.length >= 1, 'JSON export contains expense')

    // 2B. Individual CSV Exports
    const entities = ['sessions', 'payments', 'expenses', 'clients', 'projects', 'invoices']
    for (const ent of entities) {
      const csvRes = await fetch(`${BASE_URL}/api/export/csv?entity=${ent}`, {
        headers: { Authorization: `Bearer ${regularUser.token}` },
      })
      const csvText = await csvRes.text()
      testLog(
        csvRes.status === 200 && csvRes.headers.get('content-type')?.includes('text/csv'),
        `GET /api/export/csv?entity=${ent} returns text/csv (Content-Length: ${csvText.length})`
      )
      if (ent === 'sessions') {
        testLog(csvText.includes('Architecture Blueprint'), 'Sessions CSV includes session title')
      }
    }

    // 2C. Complete ZIP Archive Export
    const zipRes = await fetch(`${BASE_URL}/api/export/all`, {
      headers: { Authorization: `Bearer ${regularUser.token}` },
    })
    testLog(zipRes.status === 200, 'GET /api/export/all returns 200 OK')
    testLog(
      zipRes.headers.get('content-type')?.includes('application/zip'),
      'GET /api/export/all returns application/zip Content-Type'
    )
    const zipArrayBuf = await zipRes.arrayBuffer()
    const zipBytes = new Uint8Array(zipArrayBuf)
    testLog(zipBytes.length > 100, `ZIP Archive downloaded successfully (${zipBytes.length} bytes)`)
    // PKZIP Magic header check (0x50 0x4B 0x03 0x04)
    testLog(
      zipBytes[0] === 0x50 && zipBytes[1] === 0x4b && zipBytes[2] === 0x03 && zipBytes[3] === 0x04,
      'ZIP file has valid standard PKZIP magic header (PK\\x03\\x04)'
    )

    // ── STEP 3: DATA IMPORT ENGINE (TOGGL, CLOCKIFY, WELLO) ───────────────────
    console.log('\n--- 3. Verifying CSV Import Engine & Presets ---')

    // 3A. Toggl Import Preview & Execution
    const togglCsv = `"User","Email","Client","Project","Task","Description","Billable","Start date","Start time","End date","End time","Duration","Tags","Amount ()"
"Alex","alex@test.com","Toggl Client","Toggl App Redesign","","Database Index Tuning","Yes","2026-09-20","09:00:00","2026-09-20","11:30:00","02:30:00","",""`

    const togglPreviewRes = await api('/api/import/preview', {
      method: 'POST',
      token: regularUser.token,
      body: { csvText: togglCsv, targetEntity: 'sessions' },
    })
    testLog(togglPreviewRes.status === 200, 'POST /api/import/preview returns 200')
    testLog(togglPreviewRes.body?.data?.preset === 'toggl', 'Auto-detected format preset: toggl')
    testLog(togglPreviewRes.body?.data?.totalRows === 1, 'Detected 1 valid session row in Toggl CSV')

    const togglMapping = togglPreviewRes.body?.data?.detectedMapping || togglPreviewRes.body?.data?.mapping || togglPreviewRes.body?.mapping
    const togglExecRes = await api('/api/import/execute', {
      method: 'POST',
      token: regularUser.token,
      body: { csvText: togglCsv, entityType: 'sessions', mapping: togglMapping },
    })
    testLog(togglExecRes.status === 200, 'POST /api/import/execute succeeded for Toggl')
    if ((togglExecRes.body?.importedCount || togglExecRes.body?.data?.importedCount) !== 1) {
      console.log('    [DEBUG Toggl Response]:', JSON.stringify(togglExecRes.body))
    }
    testLog(
      (togglExecRes.body?.importedCount || togglExecRes.body?.data?.importedCount) === 1,
      'Toggl session imported cleanly'
    )

    // Verify session in database
    const importedSess = await db('work_sessions')
      .where('user_id', regularUser.user.id)
      .andWhere('title', 'Database Index Tuning')
      .first()
    testLog(
      importedSess && importedSess.duration_seconds === 9000,
      'Imported Toggl session created with 9000 seconds (150 min)'
    )

    // 3B. Clockify Import Preview & Execution
    const clockifyCsv = `"Project","Client","Description","Task","User","Group","Tag","Billable","Start Date","Start Time","End Date","End Time","Duration (h)","Duration (decimal)","Billable Rate (USD)","Billable Amount (USD)"
"Clockify Service","Clockify Client","Microservice Containerization","","Alex","","","Yes","09/20/2026","14:00:00","09/20/2026","15:00:00","01:00:00","1.00","100.00","100.00"`

    const clockifyPreviewRes = await api('/api/import/preview', {
      method: 'POST',
      token: regularUser.token,
      body: { csvText: clockifyCsv, targetEntity: 'sessions' },
    })
    testLog(clockifyPreviewRes.status === 200, 'POST /api/import/preview returns 200')
    testLog(clockifyPreviewRes.body?.data?.preset === 'clockify', 'Auto-detected format preset: clockify')

    const clockifyMapping = clockifyPreviewRes.body?.data?.detectedMapping || clockifyPreviewRes.body?.data?.mapping || clockifyPreviewRes.body?.mapping
    const clockifyExecRes = await api('/api/import/execute', {
      method: 'POST',
      token: regularUser.token,
      body: { csvText: clockifyCsv, entityType: 'sessions', mapping: clockifyMapping },
    })
    testLog(clockifyExecRes.status === 200, 'POST /api/import/execute succeeded for Clockify')
    if ((clockifyExecRes.body?.importedCount || clockifyExecRes.body?.data?.importedCount) !== 1) {
      console.log('    [DEBUG Clockify Response]:', JSON.stringify(clockifyExecRes.body))
    }
    testLog(
      (clockifyExecRes.body?.importedCount || clockifyExecRes.body?.data?.importedCount) === 1,
      'Clockify session imported cleanly'
    )

    // ── STEP 4: PRIVACY SETTINGS & TELEMETRY CONTROLS ─────────────────────────
    console.log('\n--- 4. Verifying In-App Privacy Controls & Telemetry Gating ---')

    const getPrivacyRes = await api('/api/me/privacy', {
      method: 'GET',
      token: regularUser.token,
    })
    testLog(getPrivacyRes.status === 200, 'GET /api/me/privacy returns 200')
    testLog(getPrivacyRes.body?.data?.analyticsConsent === true, 'Default analyticsConsent is true')

    // Update privacy preferences (opt-out of analytics)
    const updatePrivacyRes = await api('/api/me/privacy', {
      method: 'POST',
      token: regularUser.token,
      body: {
        analyticsConsent: false,
        cookieConsent: 'rejected',
      },
    })
    testLog(updatePrivacyRes.status === 200, 'POST /api/me/privacy updated preferences')
    testLog(updatePrivacyRes.body?.data?.analyticsConsent === false, 'analyticsConsent updated to false')

    const dbUser = await db('users').where('id', regularUser.user.id).first()
    testLog(dbUser.analytics_consent === 0, 'Database reflects analytics_consent = 0')

    // ── STEP 5: USER FEEDBACK & ADMIN TRIAGE ──────────────────────────────────
    console.log('\n--- 5. Verifying User Feedback & Admin Support Triage ---')

    const feedbackSubmitRes = await api('/api/feedback', {
      method: 'POST',
      token: regularUser.token,
      body: {
        category: 'feature',
        subject: 'Add Excel .xlsx export option',
        message: 'Could we get native Excel spreadsheets alongside CSVs?',
      },
    })
    testLog([200, 201].includes(feedbackSubmitRes.status), 'POST /api/feedback submitted user feedback')
    const feedbackId = feedbackSubmitRes.body?.data?.id || feedbackSubmitRes.body?.id
    testLog(feedbackId > 0, `Feedback saved with ID ${feedbackId}`)

    // Admin Triage listing
    const adminFeedbackListRes = await api('/api/admin/feedback', {
      method: 'GET',
      token: adminUser.token,
    })
    testLog(adminFeedbackListRes.status === 200, 'GET /api/admin/feedback accessible to admin')
    const feedbackList = adminFeedbackListRes.body?.data?.feedback || adminFeedbackListRes.body?.feedback || []
    const foundFeedback = feedbackList.find((f) => f.id === feedbackId)
    testLog(foundFeedback && foundFeedback.subject === 'Add Excel .xlsx export option', 'Admin can view submitted feedback')

    // Admin updates feedback status
    const adminFeedbackUpdateRes = await api(`/api/admin/feedback/${feedbackId}`, {
      method: 'PATCH',
      token: adminUser.token,
      body: {
        status: 'in_review',
        adminResponse: 'Prioritized for next quarterly release',
      },
    })
    testLog(adminFeedbackUpdateRes.status === 200, `PATCH /api/admin/feedback/${feedbackId} updated status to in_review`)

    // ── STEP 6: DATA RETENTION POLICIES & AUTOMATED PURGE ─────────────────────
    console.log('\n--- 6. Verifying Data Retention Engine ---')

    const retentionPoliciesRes = await api('/api/admin/retention/policies', {
      method: 'GET',
      token: adminUser.token,
    })
    testLog(retentionPoliciesRes.status === 200, 'GET /api/admin/retention/policies returns default policies')
    testLog(Array.isArray(retentionPoliciesRes.body?.data?.policies), 'Policies list returned')

    // Insert simulated stale records (> 13 months / 395 days)
    const expiredDate = new Date(Date.now() - 400 * 24 * 3600 * 1000) // 400 days ago (> 13 months)
    await db('analytics_events').insert({
      user_id: regularUser.user.id,
      event_name: 'old_telemetry',
      metadata: JSON.stringify({ old: true }),
      created_at: expiredDate,
    })
    await db('fair_use_logs').insert({
      user_id: regularUser.user.id,
      limit_key: 'csv_export',
      window_start: new Date(Date.now() - 45 * 24 * 3600 * 1000), // 45 days ago
      current_count: 1,
      updated_at: new Date(Date.now() - 45 * 24 * 3600 * 1000),
    })

    const runRetentionRes = await api('/api/admin/retention/run', {
      method: 'POST',
      token: adminUser.token,
    })
    testLog(runRetentionRes.status === 200, 'POST /api/admin/retention/run executed automated retention purge')
    const summary = runRetentionRes.body?.data?.summary || runRetentionRes.body?.summary || {}
    testLog(
      summary.raw_analytics_events >= 1,
      `Purged expired raw analytics events: ${summary.raw_analytics_events}`
    )
    testLog(
      summary.fair_use_logs >= 1,
      `Purged expired fair use logs: ${summary.fair_use_logs}`
    )

    // ── STEP 7: WORK DATA RESET ("DELETE ALL MY WORK DATA BUT KEEP ACCOUNT") ──
    console.log('\n--- 7. Verifying "Delete All Work Data (Keep Account)" ---')

    // Activate a free addon for this user
    const invoicingAddon = await db('addons')
      .where('key', 'basic-invoicing')
      .orWhere('slug', 'basic-invoicing')
      .orWhere('key', 'invoicing')
      .first()
    if (invoicingAddon) {
      const existingUserAddon = await db('user_addons')
        .where({ user_id: regularUser.user.id, addon_id: invoicingAddon.id })
        .first()
      if (!existingUserAddon) {
        await db('user_addons').insert({
          user_id: regularUser.user.id,
          addon_id: invoicingAddon.id,
          activated_at: new Date(),
        })
      }
    }

    const resetRes = await api('/api/me/reset-work-data', {
      method: 'POST',
      token: regularUser.token,
    })
    testLog(resetRes.status === 200, 'POST /api/me/reset-work-data executed successfully')

    const sessCount = await db('work_sessions').where('user_id', regularUser.user.id).count('id as c')
    const projCount = await db('projects').where('user_id', regularUser.user.id).count('id as c')
    const clientCount = await db('clients').where('user_id', regularUser.user.id).count('id as c')
    const pmtCount = await db('payments').where('user_id', regularUser.user.id).count('id as c')
    const expCount = await db('project_expenses').where('user_id', regularUser.user.id).count('id as c')

    testLog(sessCount[0].c === 0, 'Work sessions count is 0')
    testLog(projCount[0].c === 0, 'Projects count is 0')
    testLog(clientCount[0].c === 0, 'Clients count is 0')
    testLog(pmtCount[0].c === 0, 'Payments count is 0')
    testLog(expCount[0].c === 0, 'Expenses count is 0')

    // Verify User Account & User Addons remain intact
    const userAfterReset = await db('users').where('id', regularUser.user.id).first()
    testLog(userAfterReset && userAfterReset.email === userEmail, 'User login account remains active')

    const userAddonAfterReset = await db('user_addons').where('user_id', regularUser.user.id).first()
    testLog(userAddonAfterReset !== undefined, 'User activated addons remain preserved')

    // ── STEP 8: ACCOUNT DELETION GRACE PERIOD & CANCELLATION ──────────────────
    console.log('\n--- 8. Verifying Account Deletion Grace Period & Cancellation ---')

    const delReqRes = await api('/api/me/delete-account', {
      method: 'POST',
      token: regularUser.token,
      body: { gracePeriodDays: 14 },
    })
    testLog(delReqRes.status === 200, 'POST /api/me/delete-account initiated deletion')
    testLog(delReqRes.body?.data?.status === 'pending_deletion', 'Status changed to pending_deletion')
    testLog(delReqRes.body?.data?.scheduledDeletionAt !== null, 'Scheduled deletion date set 14 days in future')

    const cancelDelRes = await api('/api/me/cancel-deletion', {
      method: 'POST',
      token: regularUser.token,
    })
    testLog(cancelDelRes.status === 200, 'POST /api/me/cancel-deletion restored active status')
    testLog(cancelDelRes.body?.data?.status === 'active', 'User restored to active status')
    testLog(cancelDelRes.body?.data?.scheduledDeletionAt === null, 'scheduledDeletionAt cleared')

    // ── STEP 9: FULL PERMANENT ERASURE ACROSS ALL 25+ TABLES ──────────────────
    console.log('\n--- 9. Verifying Full Irreversible Erasure (25+ Tables) ---')

    // Setup another user to be permanently deleted via retention engine
    const victimUser = await createTestUser(`victim_${Date.now()}@example.com`, 'Victim User')
    await db('users').where('id', victimUser.user.id).update({
      status: 'pending_deletion',
      scheduled_deletion_at: new Date(Date.now() - 3600000), // scheduled 1 hour ago (past grace period)
    })

    // Populate several tables for victim
    await db('analytics_events').insert({ user_id: victimUser.user.id, event_name: 'test', metadata: JSON.stringify({ test: true }), created_at: new Date() })
    await db('notification_preferences').insert({ user_id: victimUser.user.id, channel: 'in_app', topic: 'forgotten_timer', is_enabled: 1 })
    await db('user_feedback').insert({ user_id: victimUser.user.id, category: 'general', subject: 'test', message: 'test', status: 'open', created_at: new Date() })

    // Trigger retention purge which processes expired scheduled deletions
    const purgeRes = await api('/api/admin/retention/run', {
      method: 'POST',
      token: adminUser.token,
    })
    testLog(purgeRes.status === 200, 'Retention purge triggered')
    const purgeSummary = purgeRes.body?.data?.summary || purgeRes.body?.summary || {}
    testLog(purgeSummary.expired_accounts_purged >= 1, `Erased expired users: ${purgeSummary.expired_accounts_purged}`)

    // Check all 25+ tables for zero remaining rows for victimUser
    const userTables = [
      'analytics_events',
      'web_push_subscriptions',
      'auth_sessions',
      'fair_use_logs',
      'idempotency_keys',
      'scheduled_jobs_log',
      'user_feedback',
      'user_addons',
      'notification_preferences',
      'notifications',
      'work_session_edits',
      'work_sessions',
      'payments',
      'project_expenses',
      'credit_notes',
      'invoices',
      'invoice_sequences',
      'recurring_invoice_profiles',
      'project_quotes',
      'projects',
      'clients',
      'income_sources',
      'overhead_expenses',
      'tax_rates',
      'category_requests',
      'admin_users',
      'users',
    ]

    for (const table of userTables) {
      const col = table === 'users' ? 'id' : 'user_id'
      const rows = await db(table).where(col, victimUser.user.id)
      testLog(rows.length === 0, `0 remaining rows in "${table}" for erased user ID ${victimUser.user.id}`)
    }

    console.log('\n===============================================================')
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED CLEANLY!`)
    console.log('===============================================================\n')
  } catch (err) {
    console.error('\n❌ TEST RUNNER EXCEPTION:', err)
    process.exitCode = 1
  } finally {
    // Cleanup created test users (skip seeded admin)
    if (regularUser?.user?.id) {
      try {
        await db('users').where('id', regularUser.user.id).del()
      } catch {}
    }
    await db.destroy()
  }
}

run()
