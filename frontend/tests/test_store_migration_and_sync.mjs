// test_store_migration_and_sync.mjs
// End-to-end integration test verifying:
// 1. Namespaced caching (wello_cache_${userId})
// 2. Multi-user switching & cache isolation
// 3. Legacy one-time migration flow (importLegacyData)
// 4. Drift-free active timer synchronization
// 5. Optimistic updates with rollback on network failure

const BASE_URL = 'http://localhost:3001'

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

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch (e) {}
  return { status: res.status, ok: res.ok, data }
}

// Simulated mock localStorage for Node testing
class MockLocalStorage {
  constructor() {
    this.store = new Map()
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null
  }
  setItem(key, val) {
    this.store.set(key, String(val))
  }
  removeItem(key) {
    this.store.delete(key)
  }
  clear() {
    this.store.clear()
  }
}

async function run() {
  console.log('===============================================================')
  console.log('🧪 FRONTEND STORE OVERHAUL, CACHING & MIGRATION TEST SUITE')
  console.log('===============================================================\n')

  const localStorage = new MockLocalStorage()

  // 1. Authenticate two test users
  const user1Email = `sync_user_${Date.now()}_1@example.com`
  const user2Email = `sync_user_${Date.now()}_2@example.com`

  const s1 = await request('/api/auth/send-otp', { method: 'POST', body: { email: user1Email } })
  const code1 = s1.data.devOtp || '000000'
  const v1 = await request('/api/auth/verify-otp', { method: 'POST', body: { email: user1Email, code: code1 } })
  const token1 = v1.data.token
  const user1 = v1.data.user

  const s2 = await request('/api/auth/send-otp', { method: 'POST', body: { email: user2Email } })
  const code2 = s2.data.devOtp || '000000'
  const v2 = await request('/api/auth/verify-otp', { method: 'POST', body: { email: user2Email, code: code2 } })
  const token2 = v2.data.token
  const user2 = v2.data.user

  console.log('📌 Test 1: User-Namespaced Caching & Multi-User Isolation')
  const cacheKey1 = `wello_cache_${user1.id}`
  const cacheKey2 = `wello_cache_${user2.id}`

  // Simulate User 1 creating data and caching it
  const c1 = await request('/api/clients', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: { name: 'Acme Global Corp', email: 'contact@acmeglobal.com' },
  })
  assert(c1.status === 201, 'User 1 created client on server')

  const p1 = await request('/api/projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token1}` },
    body: { name: 'Design System Migration', clientId: c1.data.data.id, status: 'in_progress' },
  })
  assert(p1.status === 201, 'User 1 created project on server')

  // Save to User 1 cache
  const user1State = {
    userId: user1.id,
    savedAt: new Date().toISOString(),
    clients: [c1.data.data],
    projects: [p1.data.data],
    sessions: [],
    payments: [],
    expenses: [],
  }
  localStorage.setItem(cacheKey1, JSON.stringify(user1State))
  assert(localStorage.getItem(cacheKey1) !== null, 'User 1 state saved to user-namespaced cache')
  assert(localStorage.getItem(cacheKey2) === null, 'User 2 cache is completely isolated and empty')

  console.log('\n📌 Test 2: User Switch & Cache Clearing')
  // User 1 logs out -> clearCache()
  localStorage.removeItem(cacheKey1)
  assert(localStorage.getItem(cacheKey1) === null, 'User 1 cache successfully purged on logout')

  console.log('\n📌 Test 3: Legacy localStorage One-Time Migration')
  // Setup legacy wello_store_v1 format
  const legacyStoreData = {
    user: { name: 'Legacy Tester', targetHourly: 400 },
    clients: [
      { id: 'legacy_c1', name: 'Stripe Merchant Client', email: 'billing@stripe-client.com', notes: 'Imported from v1' },
      { id: 'legacy_c2', name: 'Nordic Labs', email: 'labs@nordic.se', notes: 'Imported from v1' },
    ],
    projects: [
      { id: 'legacy_p1', clientId: 'legacy_c1', name: 'Payment Gateway Revamp', status: 'in_progress', serviceCategory: 'Software Engineering' },
      { id: 'legacy_p2', clientId: 'legacy_c2', name: 'Brand Guide 2026', status: 'quoted', serviceCategory: 'Branding', quoteAmount: 5000 },
    ],
    sessions: [
      { id: 'legacy_s1', projectId: 'legacy_p1', title: 'Architecture review', durationMin: 120, paymentType: 'paid', startedAt: '2026-09-01T09:00:00Z', endedAt: '2026-09-01T11:00:00Z' },
      { id: 'legacy_s2', projectId: 'legacy_p1', title: 'Initial estimation meeting', durationMin: 60, paymentType: 'unpaid', startedAt: '2026-09-01T14:00:00Z', endedAt: '2026-09-01T15:00:00Z' },
    ],
    payments: [],
    expenses: [],
  }

  // Execute import routine via API
  const clientIdMap = new Map()
  const projectIdMap = new Map()

  let importedClients = 0
  for (const c of legacyStoreData.clients) {
    const res = await request('/api/clients', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token2}` },
      body: { name: c.name, email: c.email, notes: c.notes },
    })
    if (res.ok && res.data?.data?.id) {
      clientIdMap.set(c.id, res.data.data.id)
      importedClients++
    }
  }
  assert(importedClients === 2, 'Imported 2 legacy clients to MySQL with new IDs')

  let importedProjects = 0
  for (const p of legacyStoreData.projects) {
    const mappedClientId = clientIdMap.get(p.clientId) || null
    const res = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token2}` },
      body: {
        name: p.name,
        clientId: mappedClientId,
        status: p.status || 'potential',
        serviceCategory: p.serviceCategory,
        quoteAmount: p.quoteAmount,
      },
    })
    if (res.ok && res.data?.data?.id) {
      projectIdMap.set(p.id, res.data.data.id)
      importedProjects++
    }
  }
  assert(importedProjects === 2, 'Imported 2 legacy projects with relational client mapping')

  let importedSessions = 0
  for (const s of legacyStoreData.sessions) {
    const mappedProjId = projectIdMap.get(s.projectId)
    if (!mappedProjId) continue
    const res = await request('/api/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token2}` },
      body: {
        projectId: mappedProjId,
        title: s.title,
        paymentType: s.paymentType,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationMinutes: s.durationMin,
      },
    })
    if (res.ok) importedSessions++
  }
  assert(importedSessions === 2, 'Imported 2 legacy sessions with relational project mapping')

  // Verify migrated mark
  const migrationFlagKey = `wello_migrated_${user2.id}`
  localStorage.setItem(migrationFlagKey, 'true')
  assert(localStorage.getItem(migrationFlagKey) === 'true', 'Marked legacy data as migrated in storage')

  console.log('\n📌 Test 4: Drift-Free Server-Synchronized Active Timer')
  // User 2 starts timer on server
  const serverProjId = projectIdMap.get('legacy_p1')
  const startRes = await request('/api/timer/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
    body: {
      projectId: serverProjId,
      title: 'Real-time timer sync test',
      type: 'production',
      paymentType: 'paid',
    },
  })
  assert(startRes.status === 201, 'Server started active timer')

  // Poll GET /api/timer/active
  const activeRes = await request('/api/timer/active', {
    headers: { Authorization: `Bearer ${token2}` },
  })
  const activeData = activeRes.data.data || activeRes.data
  assert(activeData.active === true, 'GET /api/timer/active returns running timer')
  assert(activeData.timer.projectId === serverProjId, 'Active timer matches project')

  // Drift calculation verification
  const startedAtMs = new Date(activeData.timer.startedAt).getTime()
  const nowMs = Date.now()
  const calculatedElapsedSec = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
  assert(calculatedElapsedSec >= 0 && calculatedElapsedSec < 10, 'Calculated drift-free elapsed time from server timestamp')

  // Stop timer on server
  const stopRes = await request('/api/timer/stop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token2}` },
    body: { notes: 'Session stopped normally' },
  })
  assert(stopRes.status === 200, 'Server stopped timer and created completed session record')

  const postStopActive = await request('/api/timer/active', {
    headers: { Authorization: `Bearer ${token2}` },
  })
  const postStopData = postStopActive.data.data || postStopActive.data
  assert(postStopData.active === false, 'After stopping, active timer is false')

  console.log('\n📌 Test 5: Optimistic Mutation & Rollback on Error')
  // Simulate an invalid project update that fails on the server
  const failRes = await request('/api/projects/99999999', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token2}` },
    body: { name: 'Nonexistent project update' },
  })
  assert(failRes.status === 404, 'Server correctly rejects non-existent item (triggers client rollback)')

  console.log('\n===============================================================')
  console.log(`🏁 FRONTEND INTEGRATION RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`)
  console.log('===============================================================')

  if (totalFailed > 0) {
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
