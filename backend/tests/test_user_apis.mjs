// backend/tests/test_user_apis.mjs
// Wello Comprehensive User-Side APIs & Delta Sync Integration Test Suite

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

let totalPassed = 0
let totalFailed = 0

function assert(condition, message) {
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

async function registerAndLogin(email, name = 'Test User') {
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

async function runTestSuite() {
  console.log('===============================================================')
  console.log('🧪 WELLO USER-SIDE APIS, STATE MACHINE & DELTA SYNC TEST SUITE')
  console.log('===============================================================\n')

  try {
    const runId = Date.now()
    const userAEmail = `user_a_${runId}@test.com`
    const userBEmail = `user_b_${runId}@test.com`

    // Authenticate primary user (User A) and secondary user (User B)
    const userA = await registerAndLogin(userAEmail, 'Alice Engineer')
    const userB = await registerAndLogin(userBEmail, 'Bob Designer')

    const syncStartTime = new Date(Date.now() - 2000).toISOString()

    // -----------------------------------------------------------------
    // TEST 1: User Profile & Identity (/api/me)
    // -----------------------------------------------------------------
    console.log('📌 Test 1: User Profile & Invoice Identity (GET/PATCH /api/me)')
    const getMe = await api('/api/me', { token: userA.token })
    assert(getMe.status === 200, 'GET /api/me returns 200 OK')
    assert(getMe.body.data.email === userAEmail, 'Profile email matches user')

    const patchMe = await api('/api/me', {
      method: 'PATCH',
      token: userA.token,
      body: {
        targetHourly: 125,
        baseCurrency: 'EUR',
        timezone: 'Europe/Berlin',
        businessName: 'Alice Engineering Studio',
        businessAddress: 'Friedrichstraße 100, Berlin, Germany',
        businessPhone: '+49 30 1234567',
        businessTaxId: 'DE 123 456 789',
        defaultInvoiceNotes: 'Due within 14 days.',
      },
    })
    assert(patchMe.status === 200, 'PATCH /api/me returns 200 OK')
    assert(patchMe.body.data.targetHourly === 125, 'Target hourly rate updated to 125')
    assert(patchMe.body.data.baseCurrency === 'EUR', 'Base currency updated to EUR')
    assert(patchMe.body.data.timezone === 'Europe/Berlin', 'Timezone updated to Europe/Berlin')
    assert(patchMe.body.data.businessName === 'Alice Engineering Studio', 'Business name updated')

    // Validation test: negative target hourly rejected
    const invalidMe = await api('/api/me', {
      method: 'PATCH',
      token: userA.token,
      body: { targetHourly: -50 },
    })
    assert(invalidMe.status === 400, 'PATCH /api/me rejects negative target hourly with 400')

    // -----------------------------------------------------------------
    // TEST 2: Clients CRUD, Archiving & Idempotency (/api/clients)
    // -----------------------------------------------------------------
    console.log('\n📌 Test 2: Clients CRUD, Idempotency & Archiving (/api/clients)')
    const idempKeyClient = `client-idemp-${runId}`
    const createClientRes = await api('/api/clients', {
      method: 'POST',
      token: userA.token,
      headers: { 'Idempotency-Key': idempKeyClient },
      body: {
        name: 'Acme Global Corp',
        company: 'Acme Global Enterprises',
        email: 'billing@acmeglobal.com',
        phone: '+1 415 555 0199',
        country: 'US',
        notes: 'Enterprise account.',
      },
    })
    assert(createClientRes.status === 201, 'POST /api/clients returns 201 Created')
    const clientAId = createClientRes.body.data.id
    assert(Boolean(clientAId), 'Client created with valid ID')
    assert(createClientRes.body.data.phone === '+14155550199', 'Phone normalized to E.164')

    // Idempotency retry test
    const idempRetryRes = await api('/api/clients', {
      method: 'POST',
      token: userA.token,
      headers: { 'Idempotency-Key': idempKeyClient },
      body: { name: 'Acme Global Corp' },
    })
    assert(idempRetryRes.status === 201, 'Idempotent POST returns 201')
    assert(idempRetryRes.body.data.id === clientAId, 'Idempotent replay returns same client ID without duplication')

    // Read client
    const getClientRes = await api(`/api/clients/${clientAId}`, { token: userA.token })
    assert(getClientRes.status === 200, 'GET /api/clients/:id returns 200 OK')
    assert(getClientRes.body.data.name === 'Acme Global Corp', 'Client name matches')

    // Update client
    const patchClientRes = await api(`/api/clients/${clientAId}`, {
      method: 'PATCH',
      token: userA.token,
      body: { company: 'Acme Global Holding Ltd' },
    })
    assert(patchClientRes.status === 200, 'PATCH /api/clients/:id returns 200 OK')
    assert(patchClientRes.body.data.company === 'Acme Global Holding Ltd', 'Company updated')

    // Cursor-based list
    const listClientsRes = await api('/api/clients?limit=10', { token: userA.token })
    assert(listClientsRes.status === 200, 'GET /api/clients returns 200 OK')
    assert(Array.isArray(listClientsRes.body.data), 'Clients list returned as array')
    assert(listClientsRes.body.pagination !== undefined, 'Pagination envelope present')

    // -----------------------------------------------------------------
    // TEST 3: Projects CRUD & State Machine Transitions (/api/projects)
    // -----------------------------------------------------------------
    console.log('\n📌 Test 3: Projects CRUD & State Machine Enforcement (/api/projects)')
    const createProjectRes = await api('/api/projects', {
      method: 'POST',
      token: userA.token,
      body: {
        clientId: clientAId,
        name: 'E-Commerce Platform Rebuild',
        description: 'Microservices architecture and checkout optimization.',
        serviceCategory: 'Web Development',
        status: 'potential',
        currency: 'EUR',
      },
    })
    assert(createProjectRes.status === 201, 'POST /api/projects returns 201 Created')
    const projectId = createProjectRes.body.data.id
    assert(createProjectRes.body.data.status === 'potential', 'Project initial status is potential')

    // Illegal Transition Test: potential -> completed directly (must fail)
    const illegalTransition = await api(`/api/projects/${projectId}`, {
      method: 'PATCH',
      token: userA.token,
      body: { status: 'completed' },
    })
    assert(illegalTransition.status === 400, 'Illegal transition potential -> completed rejected with 400')
    assert(illegalTransition.body.error?.code === 'ILLEGAL_STATUS_TRANSITION', 'Error code is ILLEGAL_STATUS_TRANSITION')

    // Legal Transition 1: potential -> quoted
    const legalTransition1 = await api(`/api/projects/${projectId}`, {
      method: 'PATCH',
      token: userA.token,
      body: { status: 'quoted' },
    })
    assert(legalTransition1.status === 200, 'Legal transition potential -> quoted returns 200 OK')
    assert(legalTransition1.body.data.status === 'quoted', 'Status updated to quoted')

    // Legal Transition 2: quoted -> in_progress
    const legalTransition2 = await api(`/api/projects/${projectId}`, {
      method: 'PATCH',
      token: userA.token,
      body: { status: 'in_progress' },
    })
    assert(legalTransition2.status === 200, 'Legal transition quoted -> in_progress returns 200 OK')
    assert(legalTransition2.body.data.isJob === true, 'Project isJob automatically becomes true')

    // Legal Transition 3: in_progress -> completed
    const legalTransition3 = await api(`/api/projects/${projectId}`, {
      method: 'PATCH',
      token: userA.token,
      body: { status: 'completed' },
    })
    assert(legalTransition3.status === 200, 'Legal transition in_progress -> completed returns 200 OK')

    // Re-open: completed -> in_progress
    const reopenProject = await api(`/api/projects/${projectId}`, {
      method: 'PATCH',
      token: userA.token,
      body: { status: 'in_progress' },
    })
    assert(reopenProject.status === 200, 'Re-opening completed -> in_progress returns 200 OK')

    // -----------------------------------------------------------------
    // TEST 4: Versioned Project Quotes (/api/projects/:id/quotes)
    // -----------------------------------------------------------------
    console.log('\n📌 Test 4: Versioned Project Quotes (/api/projects/:id/quotes)')
    // Create Quote Version 1
    const createQuote1 = await api(`/api/projects/${projectId}/quotes`, {
      method: 'POST',
      token: userA.token,
      body: {
        quoteAmount: 15000,
        currency: 'EUR',
        estHours: 120,
        notes: 'Initial milestone scope.',
        status: 'sent',
      },
    })
    assert(createQuote1.status === 201, 'POST quote version 1 returns 201 Created')
    assert(createQuote1.body.data.version === 1, 'Quote version is 1')
    const quote1Id = createQuote1.body.data.id

    // Create Quote Version 2 (supersedes v1)
    const createQuote2 = await api(`/api/projects/${projectId}/quotes`, {
      method: 'POST',
      token: userA.token,
      body: {
        quoteAmount: 18500,
        currency: 'EUR',
        estHours: 150,
        notes: 'Revised scope with analytics integration.',
        status: 'sent',
      },
    })
    assert(createQuote2.status === 201, 'POST quote version 2 returns 201 Created')
    assert(createQuote2.body.data.version === 2, 'Quote version is 2')
    const quote2Id = createQuote2.body.data.id

    // List quotes
    const listQuotes = await api(`/api/projects/${projectId}/quotes`, { token: userA.token })
    assert(listQuotes.status === 200, 'GET quotes returns 200 OK')
    assert(listQuotes.body.data.length >= 2, 'Multiple quote versions returned')
    const v1Quote = listQuotes.body.data.find((q) => q.id === quote1Id)
    assert(v1Quote.status === 'superseded', 'Version 1 is marked superseded')

    // Accept Quote v2
    const acceptQuote = await api(`/api/projects/${projectId}/quotes/${quote2Id}`, {
      method: 'PATCH',
      token: userA.token,
      body: { status: 'accepted' },
    })
    assert(acceptQuote.status === 200, 'PATCH quote status accepted returns 200 OK')

    // Verify parent project updated
    const updatedProj = await api(`/api/projects/${projectId}`, { token: userA.token })
    assert(updatedProj.body.data.quoteAmount === 18500, 'Project quote amount synchronized to accepted quote')
    assert(updatedProj.body.data.quoteStatus === 'accepted', 'Project quote status is accepted')

    // -----------------------------------------------------------------
    // TEST 5: Active Timer Lifecycle & Work Sessions
    // -----------------------------------------------------------------
    console.log('\n📌 Test 5: Active Timer Lifecycle & Work Sessions (/api/timer & /api/sessions)')
    // 1. Check initial active timer (none)
    const initialActive = await api('/api/timer/active', { token: userA.token })
    assert(initialActive.status === 200 && initialActive.body.data.active === false, 'Initially no active timer')

    // 2. Start timer
    const startTimerRes = await api('/api/timer/start', {
      method: 'POST',
      token: userA.token,
      body: {
        projectId,
        title: 'Backend API implementation',
        type: 'production',
        paymentType: 'paid',
      },
    })
    assert(startTimerRes.status === 201, 'POST /api/timer/start returns 201 Created')
    assert(startTimerRes.body.data.active === true, 'Timer is active')

    // 3. Verify GET /api/timer/active
    const checkActive = await api('/api/timer/active', { token: userA.token })
    assert(checkActive.status === 200 && checkActive.body.data.active === true, 'GET /api/timer/active confirms running timer')
    assert(checkActive.body.data.timer.isPaused === false, 'Timer is not paused')

    // 4. Pause timer
    const pauseTimerRes = await api('/api/timer/pause', {
      method: 'POST',
      token: userA.token,
    })
    assert(pauseTimerRes.status === 200, 'POST /api/timer/pause returns 200 OK')
    const checkPaused = await api('/api/timer/active', { token: userA.token })
    assert(checkPaused.body.data.timer.isPaused === true, 'GET /api/timer/active confirms isPaused = true')

    // 5. Resume timer
    const resumeTimerRes = await api('/api/timer/resume', {
      method: 'POST',
      token: userA.token,
    })
    assert(resumeTimerRes.status === 200, 'POST /api/timer/resume returns 200 OK')
    const checkResumed = await api('/api/timer/active', { token: userA.token })
    assert(checkResumed.body.data.timer.isPaused === false, 'GET /api/timer/active confirms isPaused = false')

    // 6. Stop timer
    const stopTimerRes = await api('/api/timer/stop', {
      method: 'POST',
      token: userA.token,
      body: { notes: 'Completed sprint task.' },
    })
    assert(stopTimerRes.status === 200, 'POST /api/timer/stop returns 200 OK')
    assert(Boolean(stopTimerRes.body.data.session?.id), 'Completed session created with ID')
    const timerSessionId = stopTimerRes.body.data.session.id

    // 7. Verify no active timer remains
    const postStopActive = await api('/api/timer/active', { token: userA.token })
    assert(postStopActive.body.data.active === false, 'After stop, active timer is false')

    // 8. Create manual session
    const createManualSession = await api('/api/sessions', {
      method: 'POST',
      token: userA.token,
      body: {
        projectId,
        title: 'Architecture Review with Client',
        type: 'meeting',
        paymentType: 'unpaid',
        unpaidReason: 'strategic',
        durationMinutes: 90,
        notes: 'Roadmap alignment.',
        allowOverlap: true,
      },
    })
    assert(createManualSession.status === 201, 'POST manual session returns 201 Created')
    const manualSessionId = createManualSession.body.data.id

    // 9. List & filter sessions
    const listSessions = await api(`/api/sessions?projectId=${projectId}&paymentType=paid`, { token: userA.token })
    assert(listSessions.status === 200, 'GET /api/sessions filtered by paid returns 200 OK')
    assert(listSessions.body.data.every((s) => s.paymentType === 'paid'), 'Filtered sessions are exclusively paid')

    // -----------------------------------------------------------------
    // TEST 6: Payments & Expenses Tracking
    // -----------------------------------------------------------------
    console.log('\n📌 Test 6: Payments & Expenses Tracking (/api/payments & /api/expenses)')
    // Add Payment
    const createPaymentRes = await api('/api/payments', {
      method: 'POST',
      token: userA.token,
      body: {
        projectId,
        amount: 8000,
        currency: 'EUR',
        notes: 'Deposit invoice payment',
      },
    })
    assert(createPaymentRes.status === 201, 'POST /api/payments returns 201 Created')
    const paymentId = createPaymentRes.body.data.id

    // Add Expense
    const createExpenseRes = await api('/api/expenses', {
      method: 'POST',
      token: userA.token,
      body: {
        projectId,
        description: 'Cloud Database Server Provisioning',
        amount: 450,
        currency: 'EUR',
        category: 'Infrastructure',
      },
    })
    assert(createExpenseRes.status === 201, 'POST /api/expenses returns 201 Created')
    const expenseId = createExpenseRes.body.data.id

    // Verify Project Enriched Metrics
    const enrichedProjectRes = await api(`/api/projects/${projectId}`, { token: userA.token })
    assert(enrichedProjectRes.status === 200, 'GET /api/projects/:id returns 200 OK')
    assert(enrichedProjectRes.body.data.metrics.revenue === 8000, 'Project revenue correctly aggregated (8000 EUR)')
    assert(enrichedProjectRes.body.data.metrics.expenses === 450, 'Project expenses correctly aggregated (450 EUR)')
    assert(enrichedProjectRes.body.data.metrics.netIncome === 7550, 'Project net income calculated accurately (7550 EUR)')

    // -----------------------------------------------------------------
    // TEST 7: Cross-User Ownership & Data Isolation (Strict 404s)
    // -----------------------------------------------------------------
    console.log('\n📌 Test 7: Strict Ownership Scoping & Cross-User Data Isolation (404s)')
    // User B tries to view User A's client -> 404
    const crossClient = await api(`/api/clients/${clientAId}`, { token: userB.token })
    assert(crossClient.status === 404, 'User B reading User A client returns 404 Not Found')

    // User B tries to update User A's project -> 404
    const crossProject = await api(`/api/projects/${projectId}`, {
      method: 'PATCH',
      token: userB.token,
      body: { name: 'Hacked Project' },
    })
    assert(crossProject.status === 404, 'User B updating User A project returns 404 Not Found')

    // User B tries to delete User A's session -> 404
    const crossSession = await api(`/api/sessions/${manualSessionId}`, {
      method: 'DELETE',
      token: userB.token,
    })
    assert(crossSession.status === 404, 'User B deleting User A session returns 404 Not Found')

    // User B tries to view User A's payment -> 404
    const crossPayment = await api(`/api/payments/${paymentId}`, { token: userB.token })
    assert(crossPayment.status === 404, 'User B viewing User A payment returns 404 Not Found')

    // User B tries to delete User A's expense -> 404
    const crossExpense = await api(`/api/expenses/${expenseId}`, {
      method: 'DELETE',
      token: userB.token,
    })
    assert(crossExpense.status === 404, 'User B deleting User A expense returns 404 Not Found')

    // -----------------------------------------------------------------
    // TEST 8: Client Archiving Preserves Financial History
    // -----------------------------------------------------------------
    console.log('\n📌 Test 8: Client Archiving Preserves Financial & Project History')
    // Soft delete (archive) client
    const deleteClientRes = await api(`/api/clients/${clientAId}`, {
      method: 'DELETE',
      token: userA.token,
    })
    assert(deleteClientRes.status === 200, 'DELETE /api/clients/:id archives client with 200 OK')
    assert(deleteClientRes.body.data.archived === true, 'Response confirms client archived')

    // Client is now hidden from standard list
    const clientListAfter = await api('/api/clients', { token: userA.token })
    assert(!clientListAfter.body.data.some((c) => c.id === clientAId), 'Archived client excluded from active clients list')

    // Project and payment still exist and link is intact
    const projectAfterArchive = await api(`/api/projects/${projectId}`, { token: userA.token })
    assert(projectAfterArchive.status === 200, 'Project still exists after client archive')
    assert(projectAfterArchive.body.data.metrics.revenue === 8000, 'Financial revenue is fully preserved')

    // -----------------------------------------------------------------
    // TEST 9: Soft Deletions & Tombstones Generation
    // -----------------------------------------------------------------
    console.log('\n📌 Test 9: Soft Deletions for Sessions, Payments, Expenses')
    const delSession = await api(`/api/sessions/${manualSessionId}`, { method: 'DELETE', token: userA.token })
    assert(delSession.status === 200, 'DELETE session returns 200 OK')

    const delExpense = await api(`/api/expenses/${expenseId}`, { method: 'DELETE', token: userA.token })
    assert(delExpense.status === 200, 'DELETE expense returns 200 OK')

    // -----------------------------------------------------------------
    // TEST 10: Delta Sync Engine (/api/sync)
    // -----------------------------------------------------------------
    console.log('\n📌 Test 10: Delta Sync Engine & Tombstones Verification (/api/sync)')
    const syncRes = await api(`/api/sync?since=${encodeURIComponent(syncStartTime)}`, { token: userA.token })
    assert(syncRes.status === 200, 'GET /api/sync returns 200 OK')

    const syncData = syncRes.body.data
    assert(Boolean(syncData.serverTime), 'Sync returns server UTC timestamp')

    // Check records
    assert(syncData.projects.records.some((p) => p.id === projectId), 'Sync returns modified project record')
    assert(syncData.payments.records.some((p) => p.id === paymentId), 'Sync returns created payment record')

    // Check tombstones
    assert(syncData.clients.tombstones.includes(clientAId), 'Sync returns archived client ID in client tombstones')
    assert(syncData.sessions.tombstones.includes(manualSessionId), 'Sync returns deleted session ID in session tombstones')
    assert(syncData.expenses.tombstones.includes(expenseId), 'Sync returns deleted expense ID in expense tombstones')

    console.log('\n===============================================================')
    console.log(`🏁 USER APIS TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`)
    console.log('===============================================================\n')

    process.exit(totalFailed === 0 ? 0 : 1)
  } catch (err) {
    console.error('❌ Test suite failed unexpectedly:', err)
    process.exit(1)
  }
}

runTestSuite()
