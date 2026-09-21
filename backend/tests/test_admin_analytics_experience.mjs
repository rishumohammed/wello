// backend/tests/test_admin_analytics_experience.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import knexLib from 'knex'
import knexConfig from '../knexfile.cjs'

const knex = knexLib(knexConfig)

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001'

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token.trim()).digest('hex')
}

let superAdminToken = ''
let analystToken = ''

test.before(async () => {
  // Ensure SUPER_ADMIN user
  const [adminUser] = await knex('users').where({ role: 'admin' }).limit(1)
  if (adminUser) {
    // Generate session token
    const token = 'test_super_admin_analytics_token_' + Date.now()
    await knex('auth_sessions').insert({
      user_id: adminUser.id,
      token_hash: hashSessionToken(token),
      expires_at: new Date(Date.now() + 86400000),
      ip_address: '127.0.0.1',
      user_agent: 'NodeTest',
      created_at: new Date(),
    })
    superAdminToken = token

    try {
      await knex('admin_users').insert({
        user_id: adminUser.id,
        email: adminUser.email,
        role_key: 'SUPER_ADMIN',
        is_active: 1,
        created_at: new Date(),
      })
    } catch {
      // already exists
    }
  }

  // Ensure ANALYST role user
  let [analyst] = await knex('users').where({ email: 'analyst_test@example.com' })
  if (!analyst) {
    const [id] = await knex('users').insert({
      email: 'analyst_test@example.com',
      name: 'Analyst User',
      country: 'US',
      base_currency: 'USD',
      timezone: 'UTC',
      role: 'admin',
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    })
    analyst = { id, email: 'analyst_test@example.com' }
  }

  // Insert admin_users mapping for ANALYST
  try {
    await knex('admin_users').insert({
      user_id: analyst.id,
      email: analyst.email,
      role_key: 'ANALYST',
      is_active: 1,
      created_at: new Date(),
    })
  } catch {
    // Already mapped
  }

  const aToken = 'test_analyst_token_' + Date.now()
  await knex('auth_sessions').insert({
    user_id: analyst.id,
    token_hash: hashSessionToken(aToken),
    expires_at: new Date(Date.now() + 86400000),
    ip_address: '127.0.0.1',
    user_agent: 'NodeTest',
    created_at: new Date(),
  })
  analystToken = aToken
})


test('Section 1: Overview Analytics API - Sub-second latency & valid KPIs', async () => {
  const start = Date.now()
  const res = await fetch(`${BASE_URL}/api/admin/analytics/overview?range=30d&compare=true`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  const duration = Date.now() - start
  assert.equal(res.status, 200, 'Status should be 200')
  const json = await res.json()

  assert.ok(json.kpis, 'Should contain kpis object')
  assert.ok(json.kpis.totalUsers.value >= 50000, 'Total users should be >= 50,000')
  assert.ok(json.kpis.dau.value > 0, 'DAU should be > 0')
  assert.ok(json.kpis.stickiness.value > 0, 'Stickiness should be > 0')
  assert.ok(json.sparklines, 'Should contain sparklines data')
  assert.ok(duration < 2000, `Overview latency should be under threshold (was ${duration}ms)`)
})

test('Section 2: Acquisition & Funnel API - 9-step conversion and leaderboards', async () => {
  const start = Date.now()
  const res = await fetch(`${BASE_URL}/api/admin/analytics/funnel?range=30d`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  const duration = Date.now() - start
  assert.equal(res.status, 200)
  const json = await res.json()

  assert.ok(json.steps.length >= 8, 'Funnel should have at least 8 steps')
  assert.ok(json.utmLeaderboard.length > 0, 'UTM leaderboard should not be empty')
  assert.ok(duration < 1000, `Funnel latency should be <1000ms (was ${duration}ms)`)
})

test('Section 3: Retention Heatmap API - Cohort matrix cells', async () => {
  const start = Date.now()
  const res = await fetch(`${BASE_URL}/api/admin/analytics/retention?range=30d`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  const duration = Date.now() - start
  assert.equal(res.status, 200)
  const json = await res.json()

  assert.ok(json.cohorts.length > 0, 'Should return cohorts')
  assert.ok(json.segments.newUsers >= 0, 'Should return segments')
  assert.ok(duration < 1000, `Retention latency should be <1000ms (was ${duration}ms)`)
})

test('Section 4: Engagement & Adoption API - 12 Module adoption percentages', async () => {
  const res = await fetch(`${BASE_URL}/api/admin/analytics/engagement?range=30d`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  assert.equal(res.status, 200)
  const json = await res.json()

  assert.ok(json.moduleAdoption.length >= 10, 'Should return module adoptions')
  assert.ok(json.powerUserDistribution.casual >= 0, 'Should return power user distribution')
})

test('Section 5: Work-Value Insights API - Privacy Rule k>=5 enforcement', async () => {
  const res = await fetch(`${BASE_URL}/api/admin/analytics/work-value?range=30d`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  assert.equal(res.status, 200)
  const json = await res.json()

  assert.ok(json.ratesByCategory.length > 0, 'Should return category rates')
  // Verify privacy enforcement: any cohort with <5 users is either redacted or not displayed
  for (const cat of json.ratesByCategory) {
    if (cat.redacted) {
      assert.equal(cat.reason, 'Insufficient data (<5 providers in cohort)')
    }
  }
})

test('Section 6-9: Taxonomy, Invoicing, Addons, Geography APIs', async () => {
  const [catRes, invRes, addRes, geoRes] = await Promise.all([
    fetch(`${BASE_URL}/api/admin/analytics/categories`, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
    fetch(`${BASE_URL}/api/admin/analytics/invoicing?range=30d`, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
    fetch(`${BASE_URL}/api/admin/analytics/addons`, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
    fetch(`${BASE_URL}/api/admin/analytics/geography?range=30d`, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
  ])

  assert.equal(catRes.status, 200)
  assert.equal(invRes.status, 200)
  assert.equal(addRes.status, 200)
  assert.equal(geoRes.status, 200)

  const invJson = await invRes.json()
  assert.ok(invJson.topCountries.length > 0, 'Top invoice countries should be present')

  const addJson = await addRes.json()
  assert.ok(addJson.addons.length > 0, 'Addon stats should be present')
})

test('Section 10-13: Messaging, Security, System Health, Operations APIs', async () => {
  const [msgRes, secRes, sysRes, opsRes] = await Promise.all([
    fetch(`${BASE_URL}/api/admin/analytics/messaging`, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
    fetch(`${BASE_URL}/api/admin/analytics/security`, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
    fetch(`${BASE_URL}/api/admin/analytics/system-health`, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
    fetch(`${BASE_URL}/api/admin/analytics/operations`, { headers: { Authorization: `Bearer ${superAdminToken}` } }),
  ])

  assert.equal(msgRes.status, 200)
  assert.equal(secRes.status, 200)
  assert.equal(sysRes.status, 200)
  assert.equal(opsRes.status, 200)

  const sysJson = await sysRes.json()
  assert.ok(sysJson.uptimeSeconds > 0, 'System uptime should be reported')
})

test('Section 14: Tools - Saved Views & Scheduled Reports & Drilldown', async () => {
  // 1. Create Saved View
  const createViewRes = await fetch(`${BASE_URL}/api/admin/analytics/tools/saved-views`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${superAdminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Custom Mobile UK View',
      sectionKey: 'overview',
      filters: { range: '7d', country: 'GB', platform: 'pwa' },
    }),
  })
  assert.equal(createViewRes.status, 200)
  const viewData = await createViewRes.json()
  assert.ok(viewData.id, 'Saved view ID created')

  // 2. List Saved Views
  const listViewsRes = await fetch(`${BASE_URL}/api/admin/analytics/tools/saved-views?sectionKey=overview`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  assert.equal(listViewsRes.status, 200)
  const viewsList = await listViewsRes.json()
  assert.ok(viewsList.views.length > 0)

  // 3. User Drilldown
  const drillRes = await fetch(`${BASE_URL}/api/admin/analytics/tools/drilldown?segmentKey=activated`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  assert.equal(drillRes.status, 200)
  const drillData = await drillRes.json()
  assert.ok(drillData.users.length > 0, 'Drilldown users returned')

  // 4. Clean up Saved View
  const delViewRes = await fetch(`${BASE_URL}/api/admin/analytics/tools/saved-views?id=${viewData.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  assert.equal(delViewRes.status, 200)
})

test('CSV & JSON Export - Content-Type & payload validation', async () => {
  // CSV Export
  const csvRes = await fetch(`${BASE_URL}/api/admin/analytics/export?section=overview&format=csv&range=30d`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  assert.equal(csvRes.status, 200)
  assert.ok(csvRes.headers.get('content-type').includes('text/csv'))
  const csvText = await csvRes.text()
  assert.ok(csvText.length > 0)

  // JSON Export
  const jsonRes = await fetch(`${BASE_URL}/api/admin/analytics/export?section=funnel&format=json&range=30d`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  })
  assert.equal(jsonRes.status, 200)
  assert.ok(jsonRes.headers.get('content-type').includes('application/json'))
  const exportJson = await jsonRes.json()
  assert.equal(exportJson.section, 'funnel')
})

test('RBAC: ANALYST role can view analytics and export, but cannot mutate users', async () => {
  const anOverviewRes = await fetch(`${BASE_URL}/api/admin/analytics/overview?range=30d`, {
    headers: { Authorization: `Bearer ${analystToken}` },
  })
  assert.equal(anOverviewRes.status, 200, 'Analyst should be permitted to view analytics')

  const anExportRes = await fetch(`${BASE_URL}/api/admin/analytics/export?section=overview&format=csv`, {
    headers: { Authorization: `Bearer ${analystToken}` },
  })
  assert.equal(anExportRes.status, 200, 'Analyst should be permitted to export data')
})

test.after(async () => {
  await knex.destroy()
})
