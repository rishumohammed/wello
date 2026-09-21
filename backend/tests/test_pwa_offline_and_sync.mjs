// ============================================================================
// WELLO TEST SUITE: PWA, MOBILE RESPONSIVENESS, OFFLINE OUTBOX & DELTA SYNC
// ============================================================================

import knex from 'knex'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import knexConfig from '../knexfile.cjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001'
const db = knex(knexConfig)

function testLog(passed, message) {
  if (passed) {
    console.log(`  ✅ PASS: ${message}`)
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
    // raw text response
  }

  return { status: res.status, body: data }
}

async function createTestUser(email, name = 'Mobile Offline Tester') {
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

async function runTestSuite() {
  console.log('==================================================================')
  console.log('📱 RUNNING VERIFICATION: PWA, OFFLINE OUTBOX & DELTA SYNC ENGINE')
  console.log('==================================================================\n')

  try {
    // -------------------------------------------------------------------------
    // TEST 1: PWA Web App Manifest & Static Assets Validation
    // -------------------------------------------------------------------------
    console.log('🔹 1. PWA Manifest & Service Worker Assets')
    const manifestPath = path.resolve(__dirname, '../../frontend/public/manifest.webmanifest')
    const swPath = path.resolve(__dirname, '../../frontend/public/sw.js')
    const iconsDir = path.resolve(__dirname, '../../frontend/public/icons')

    testLog(fs.existsSync(manifestPath), 'manifest.webmanifest exists in frontend/public/')
    testLog(fs.existsSync(swPath), 'sw.js service worker exists in frontend/public/')

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    testLog(manifestContent.display === 'standalone', 'Manifest display mode is "standalone"')
    testLog(Boolean(manifestContent.theme_color && manifestContent.background_color), 'Manifest defines theme_color and background_color')
    testLog(manifestContent.icons && manifestContent.icons.length >= 3, `Manifest specifies ${manifestContent.icons?.length || 0} icons`)
    testLog(manifestContent.shortcuts && manifestContent.shortcuts.length >= 3, `Manifest defines ${manifestContent.shortcuts?.length || 0} mobile app shortcuts (Timer, Quick Entry, Invoices)`)

    const icon192 = path.join(iconsDir, 'icon-192x192.png')
    const icon512 = path.join(iconsDir, 'icon-512x512.png')
    const iconMaskable = path.join(iconsDir, 'icon-maskable-512x512.png')
    testLog(fs.existsSync(icon192) && fs.existsSync(icon512) && fs.existsSync(iconMaskable), 'PWA icons (192px, 512px, 512px maskable) exist on disk')

    const swContent = fs.readFileSync(swPath, 'utf-8')
    testLog(swContent.includes('addEventListener(\'fetch\'') && swContent.includes('addEventListener(\'push\''), 'sw.js contains fetch interception and Web Push handlers')

    // -------------------------------------------------------------------------
    // TEST 2: VAPID Public Key API
    // -------------------------------------------------------------------------
    console.log('\n🔹 2. Web Push Notifications: VAPID Key Endpoint')
    const vapidRes = await api('/api/notifications/push/vapid-key')
    testLog(vapidRes.status === 200, 'GET /api/notifications/push/vapid-key returned 200')
    testLog(Boolean(vapidRes.body?.data?.publicKey), `VAPID public key returned: ${vapidRes.body?.data?.publicKey?.substring(0, 20)}...`)

    // -------------------------------------------------------------------------
    // TEST 3: Setup Test User & Initial Delta Sync (GET /api/sync)
    // -------------------------------------------------------------------------
    console.log('\n🔹 3. Initial Full Sync (GET /api/sync)')
    const testEmail = `pwa_tester_${Date.now()}@example.com`
    const { token, user } = await createTestUser(testEmail, 'Offline Outbox Tester')
    testLog(Boolean(token), `Created test user ${testEmail}`)

    const initialSyncRes = await api('/api/sync', { token })
    testLog(initialSyncRes.status === 200, 'GET /api/sync returned 200 for initial sync')
    const syncData = initialSyncRes.body?.data
    testLog(syncData.isInitialSync === true, 'isInitialSync is true on initial sync')
    testLog(Array.isArray(syncData.clients?.records), 'Returns clients array')
    testLog(Array.isArray(syncData.projects?.records), 'Returns projects array')
    testLog(Array.isArray(syncData.sessions?.records), 'Returns work sessions array')
    testLog(Array.isArray(syncData.payments?.records), 'Returns payments array')
    testLog(Array.isArray(syncData.invoices?.records), 'Returns invoices array')
    testLog(Array.isArray(syncData.incomeSources?.records), 'Returns income sources array')
    testLog(Array.isArray(syncData.overheadExpenses?.records), 'Returns overhead expenses array')

    const baselineServerTime = syncData.serverTime

    // -------------------------------------------------------------------------
    // TEST 4: Batch Offline Outbox Replay (POST /api/sync)
    // -------------------------------------------------------------------------
    console.log('\n🔹 4. Batch Outbox Replay with Idempotency (POST /api/sync)')
    const clientMutationId = `mut_client_${Date.now()}`
    const projectMutationId = `mut_proj_${Date.now()}`
    const sessionMutationId = `mut_sess_${Date.now()}`
    const paymentMutationId = `mut_pay_${Date.now()}`

    const mutations = [
      {
        id: clientMutationId,
        idempotencyKey: `idem_client_${Date.now()}`,
        action: 'CREATE_CLIENT',
        endpoint: '/api/clients',
        method: 'POST',
        entityType: 'client',
        payload: {
          name: 'Acme Mobile Offline Corp',
          company: 'Acme Mobile',
          email: 'contact@acmemobile.com',
          phone: '+15550199',
          country: 'US',
        },
      },
      {
        id: projectMutationId,
        idempotencyKey: `idem_proj_${Date.now()}`,
        action: 'CREATE_PROJECT',
        endpoint: '/api/projects',
        method: 'POST',
        entityType: 'project',
        payload: {
          name: 'Mobile App Redesign',
          description: 'Offline synced project',
          currency: 'USD',
          quoteAmount: 5000,
          quoteEstHours: 50,
        },
      },
      {
        id: sessionMutationId,
        idempotencyKey: `idem_sess_${Date.now()}`,
        action: 'CREATE_WORK_SESSION',
        endpoint: '/api/work-sessions',
        method: 'POST',
        entityType: 'work_session',
        payload: {
          title: 'Offline Timer Session',
          type: 'billable',
          startedAt: new Date(Date.now() - 3600000).toISOString(),
          endedAt: new Date().toISOString(),
          durationSeconds: 3600,
        },
      },
      {
        id: paymentMutationId,
        idempotencyKey: `idem_pay_${Date.now()}`,
        action: 'CREATE_PAYMENT',
        endpoint: '/api/payments',
        method: 'POST',
        entityType: 'payment',
        payload: {
          amount: 2500,
          currency: 'USD',
          paidDate: new Date().toISOString(),
          status: 'paid',
          notes: 'Offline deposit payment',
        },
      },
    ]

    const outboxSyncRes = await api('/api/sync', {
      method: 'POST',
      token,
      body: {
        mutations,
        since: baselineServerTime,
      },
    })

    testLog(outboxSyncRes.status === 200, 'POST /api/sync batch mutation processed with 200')
    const outboxData = outboxSyncRes.body?.data
    testLog(outboxData.acknowledgedIds?.includes(clientMutationId), 'Acknowledged client mutation')
    testLog(outboxData.acknowledgedIds?.includes(projectMutationId), 'Acknowledged project mutation')
    testLog(outboxData.acknowledgedIds?.includes(sessionMutationId), 'Acknowledged work session mutation')
    testLog(outboxData.acknowledgedIds?.includes(paymentMutationId), 'Acknowledged payment mutation')
    testLog(outboxData.conflicts?.length === 0, 'Zero conflicts on clean new insertions')

    // Verify records exist in database
    const createdClients = await db('clients').where({ user_id: user.id })
    const createdProjects = await db('projects').where({ user_id: user.id })
    const createdSessions = await db('work_sessions').where({ user_id: user.id })
    const createdPayments = await db('payments').where({ user_id: user.id })

    testLog(createdClients.length === 1 && createdClients[0].name === 'Acme Mobile Offline Corp', 'Client inserted via offline outbox sync')
    testLog(createdProjects.length === 1 && createdProjects[0].name === 'Mobile App Redesign', 'Project inserted via offline outbox sync')
    testLog(createdSessions.length === 1 && createdSessions[0].title === 'Offline Timer Session', 'Work session inserted via offline outbox sync')
    testLog(createdPayments.length === 1 && Number(createdPayments[0].amount) === 2500, 'Payment inserted via offline outbox sync')

    // -------------------------------------------------------------------------
    // TEST 5: Delta Sync after mutations
    // -------------------------------------------------------------------------
    console.log('\n🔹 5. Delta Sync Filtering by Timestamp')
    const deltaSyncRes = await api(`/api/sync?since=${encodeURIComponent(baselineServerTime)}`, { token })
    testLog(deltaSyncRes.status === 200, 'GET /api/sync with ?since returned 200')
    testLog(deltaSyncRes.body?.data?.clients?.records?.length === 1, 'Delta sync returned only the 1 newly created client')
    testLog(deltaSyncRes.body?.data?.payments?.records?.length === 1, 'Delta sync returned only the 1 newly created payment')

    // -------------------------------------------------------------------------
    // TEST 6: Money Row Conflict Resolution Handling
    // -------------------------------------------------------------------------
    console.log('\n🔹 6. Money Row Conflict Resolution (Interactive Prompt vs Blind Overwrite)')
    const paymentRecord = createdPayments[0]

    // Simulate Device B updating payment on server directly to $3000
    await new Promise(r => setTimeout(r, 1100))
    await db('payments').where({ id: paymentRecord.id }).update({
      amount: 3000,
      updated_at: new Date(),
    })

    // Now Device A (which was offline since baselineServerTime) tries to update payment to $2700
    const conflictMutationId = `mut_conflict_pay_${Date.now()}`
    const conflictSyncRes = await api('/api/sync', {
      method: 'POST',
      token,
      body: {
        mutations: [
          {
            id: conflictMutationId,
            idempotencyKey: `idem_conflict_${Date.now()}`,
            action: 'UPDATE_PAYMENT',
            endpoint: `/api/payments/${paymentRecord.id}`,
            method: 'PUT',
            entityType: 'payment',
            baselineUpdatedAt: baselineServerTime, // Outdated baseline
            payload: {
              id: paymentRecord.id,
              amount: 2700,
              currency: 'USD',
              notes: 'Edited offline on Device A',
            },
          },
        ],
      },
    })

    testLog(conflictSyncRes.status === 200, 'POST /api/sync executed conflict detection')
    const conflictResult = conflictSyncRes.body?.data
    testLog(conflictResult.conflicts && conflictResult.conflicts.length === 1, 'Server detected money row concurrent edit conflict')
    testLog(conflictResult.conflicts[0].entityType === 'payment', 'Conflict entity type is "payment"')
    testLog(conflictResult.conflicts[0].serverRecord.amount === 3000, 'Conflict contains serverRecord amount ($3000)')
    testLog(conflictResult.conflicts[0].clientPayload.amount === 2700, 'Conflict contains clientPayload amount ($2700)')

    // Check that database payment amount was preserved as $3000 (not overwritten blindly)
    const preservedPayment = await db('payments').where({ id: paymentRecord.id }).first()
    testLog(Number(preservedPayment.amount) === 3000, 'Server payment amount was protected against blind overwrite')

    // -------------------------------------------------------------------------
    // TEST 7: Non-Financial Last-Write-Wins (LWW)
    // -------------------------------------------------------------------------
    console.log('\n🔹 7. Non-Financial Last-Write-Wins (LWW)')
    const projectRecord = createdProjects[0]
    const lwwMutationId = `mut_lww_proj_${Date.now()}`
    const lwwSyncRes = await api('/api/sync', {
      method: 'POST',
      token,
      body: {
        mutations: [
          {
            id: lwwMutationId,
            idempotencyKey: `idem_lww_${Date.now()}`,
            action: 'UPDATE_PROJECT',
            endpoint: `/api/projects/${projectRecord.id}`,
            method: 'PUT',
            entityType: 'project',
            payload: {
              id: projectRecord.id,
              name: 'Mobile App Redesign - LWW Updated Name',
              description: 'Updated offline via LWW',
            },
          },
        ],
      },
    })

    testLog(lwwSyncRes.body?.data?.acknowledgedIds?.includes(lwwMutationId), 'Non-financial project mutation acknowledged via LWW')
    const updatedProj = await db('projects').where({ id: projectRecord.id }).first()
    testLog(updatedProj.name === 'Mobile App Redesign - LWW Updated Name', 'Project name updated in database via LWW')

    console.log('\n==================================================================')
    console.log('🎉 ALL PWA, OFFLINE OUTBOX & SYNC TESTS PASSED!')
    console.log('==================================================================\n')
  } catch (err) {
    console.error('❌ Test suite error:', err)
    process.exitCode = 1
  } finally {
    await db.destroy()
  }
}

runTestSuite()
