// backend/tests/test_analytics_data_layer.mjs
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import knex from 'knex'

const BASE_URL = 'http://localhost:3001'

// Direct DB connection for state verification
const db = knex({
  client: 'mysql2',
  connection: {
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'wello',
  },
})

async function runTests() {
  console.log('=== STARTING ANALYTICS DATA LAYER TEST SUITE ===\n')

  try {
    // 0. Ensure Admin & Test Users Exist
    const adminEmail = `admin_analytics_${Date.now()}@test.com`
    const userEmail = `user_analytics_${Date.now()}@test.com`
    const optOutEmail = `optout_analytics_${Date.now()}@test.com`

    // Create admin user
    const [adminId] = await db('users').insert({
      email: adminEmail,
      name: 'Analytics Admin',
      role: 'admin',
      status: 'ACTIVE',
      base_currency: 'USD',
      country: 'US',
      created_at: new Date(),
      updated_at: new Date(),
    })
    await db('admin_users').insert({
      user_id: adminId,
      email: adminEmail,
      role_key: 'SUPER_ADMIN',
      is_active: 1,
      created_at: new Date(),
    })

    // Create active standard user
    const [userId] = await db('users').insert({
      email: userEmail,
      name: 'Analytics Test User',
      role: 'user',
      status: 'ACTIVE',
      base_currency: 'USD',
      country: 'IN',
      timezone: 'Asia/Kolkata',
      analytics_consent: 1,
      created_at: new Date(),
      updated_at: new Date(),
    })

    // Create opted-out user
    const [optOutUserId] = await db('users').insert({
      email: optOutEmail,
      name: 'Opt Out User',
      role: 'user',
      status: 'ACTIVE',
      base_currency: 'EUR',
      country: 'DE',
      analytics_consent: 0,
      created_at: new Date(),
      updated_at: new Date(),
    })

    function hashToken(tok) {
      return crypto.createHash('sha256').update(tok).digest('hex')
    }

    // Create auth tokens
    const adminToken = `tok_admin_${Date.now()}`
    await db('auth_sessions').insert({
      user_id: adminId,
      token_hash: hashToken(adminToken),
      expires_at: new Date(Date.now() + 86400000),
      created_at: new Date(),
    })

    const userToken = `tok_user_${Date.now()}`
    await db('auth_sessions').insert({
      user_id: userId,
      token_hash: hashToken(userToken),
      expires_at: new Date(Date.now() + 86400000),
      created_at: new Date(),
    })

    const optOutToken = `tok_optout_${Date.now()}`
    await db('auth_sessions').insert({
      user_id: optOutUserId,
      token_hash: hashToken(optOutToken),
      expires_at: new Date(Date.now() + 86400000),
      created_at: new Date(),
    })

    console.log('✅ Test users & admin session tokens initialized.')

    // -----------------------------------------------------------------
    // TEST 1: Public Event Ingestion Endpoint (POST /api/events)
    // -----------------------------------------------------------------
    console.log('\n--- Test 1: Event Ingestion (POST /api/events) ---')
    const anonId1 = `anon_test_${Date.now()}`
    const ingestRes = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-ipcountry': 'GB',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        anonymousId: anonId1,
        events: [
          {
            name: 'landing_viewed',
            properties: { ref: 'google_ad', revenue: 1500, user_password: 'secret123' },
            timezone: 'Europe/London',
            utmSource: 'google',
            utmMedium: 'cpc',
            utmCampaign: 'launch2026',
          },
          {
            name: 'registration_started',
            properties: { step: 1 },
          },
        ],
      }),
    })

    const ingestJson = await ingestRes.json()
    assert.equal(ingestRes.status, 200, 'POST /api/events should return 200')
    assert.equal(ingestJson.success, true)
    assert.equal(ingestJson.accepted, 2)

    // Verify DB insertion & sanitization
    const storedEvents = await db('analytics_events')
      .where({ anonymous_id: anonId1 })
      .orderBy('id', 'asc')

    assert.equal(storedEvents.length, 2, 'Two events should be stored in analytics_events')
    assert.equal(storedEvents[0].country, 'GB', 'Country should be extracted from cf-ipcountry header')
    assert.equal(storedEvents[0].device_type, 'desktop')
    assert.equal(storedEvents[0].os, 'Windows')
    assert.equal(storedEvents[0].browser, 'Chrome')
    assert.equal(storedEvents[0].is_bot, 0)
    assert.equal(storedEvents[0].utm_source, 'google')

    const props0 = typeof storedEvents[0].properties === 'string'
      ? JSON.parse(storedEvents[0].properties)
      : storedEvents[0].properties

    assert.equal(props0.revenue_bucket, '1k-5k', 'Financial amount should be bucketized')
    assert.equal(props0.user_password, undefined, 'Sensitive field user_password should be stripped')
    console.log('✅ Event ingestion, header geo-parsing, and PII/financial sanitization verified.')

    // -----------------------------------------------------------------
    // TEST 2: Anonymous to User ID Merge
    // -----------------------------------------------------------------
    console.log('\n--- Test 2: Anonymous ID to User ID Merge ---')
    const mergeRes = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        anonymousId: anonId1,
        events: [
          {
            name: 'onboarding_step_completed',
            properties: { step_number: 2 },
          },
        ],
      }),
    })

    const mergeJson = await mergeRes.json()
    assert.equal(mergeJson.success, true)

    // Verify mapping table and retroactive user_id update
    const mapping = await db('analytics_anonymous_mappings')
      .where({ anonymous_id: anonId1, user_id: userId })
      .first()
    assert.ok(mapping, 'anonymous_id should be mapped to user_id in analytics_anonymous_mappings')

    const previouslyAnon = await db('analytics_events').where({ anonymous_id: anonId1 })
    assert.ok(previouslyAnon.every(e => e.user_id === userId), 'All events with anonymous_id should now have user_id attached')
    console.log('✅ Anonymous to User ID merge and retroactive linkage verified.')

    // -----------------------------------------------------------------
    // TEST 3: Consent Opt-Out Enforcement
    // -----------------------------------------------------------------
    console.log('\n--- Test 3: Consent Opt-Out Enforcement ---')
    const optOutRes = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${optOutToken}`,
      },
      body: JSON.stringify({
        events: [
          { name: 'pricing_calculator_used', properties: { target: 5000 } },
          { name: 'account_deleted', properties: { reason: 'leaving' } }, // essential event
        ],
      }),
    })

    const optOutJson = await optOutRes.json()
    assert.equal(optOutJson.success, true)
    assert.equal(optOutJson.accepted, 1, 'Only the essential event should be accepted for opted-out user')
    assert.equal(optOutJson.dropped, 1, 'Non-essential event should be dropped')

    const optOutDbEvents = await db('analytics_events').where({ user_id: optOutUserId })
    assert.equal(optOutDbEvents.length, 1)
    assert.equal(optOutDbEvents[0].name, 'account_deleted')
    console.log('✅ Analytics consent opt-out strictly enforced.')

    // -----------------------------------------------------------------
    // TEST 4: Bot & Crawler Detection
    // -----------------------------------------------------------------
    console.log('\n--- Test 4: Bot & Crawler Detection ---')
    const botRes = await fetch(`${BASE_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
      },
      body: JSON.stringify({
        name: 'landing_viewed',
      }),
    })
    assert.equal(botRes.status, 200)

    const botEvent = await db('analytics_events')
      .where({ name: 'landing_viewed', is_bot: 1 })
      .first()
    assert.ok(botEvent, 'Bot event should have is_bot = 1')
    assert.equal(botEvent.device_type, 'bot')
    console.log('✅ Bot and automated crawler filtering verified.')

    // -----------------------------------------------------------------
    // TEST 5: Configurable DB-Driven Funnel Engine
    // -----------------------------------------------------------------
    console.log('\n--- Test 5: Configurable DB-Driven Funnel Engine ---')
    // Seed events for the user to step through the funnel
    const now = new Date()
    await db('analytics_events').insert([
      { user_id: userId, name: 'otp_verified', timestamp: new Date(now.getTime() - 5000), created_at: now, is_bot: 0, is_internal: 0 },
      { user_id: userId, name: 'profile_completed', timestamp: new Date(now.getTime() - 4000), created_at: now, is_bot: 0, is_internal: 0 },
      { user_id: userId, name: 'client_created', timestamp: new Date(now.getTime() - 3000), created_at: now, is_bot: 0, is_internal: 0 },
      { user_id: userId, name: 'timer_started', timestamp: new Date(now.getTime() - 2000), created_at: now, is_bot: 0, is_internal: 0 },
      { user_id: userId, name: 'payment_logged', timestamp: new Date(now.getTime() - 1000), created_at: now, is_bot: 0, is_internal: 0 },
    ])

    const funnelRes = await fetch(`${BASE_URL}/api/admin/analytics/funnel?slug=default_activation_funnel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const funnelJson = await funnelRes.json()

    assert.equal(funnelRes.status, 200)
    assert.equal(funnelJson.success, true)
    assert.equal(funnelJson.steps.length, 9, 'Default activation funnel should contain 9 configured steps')
    assert.equal(funnelJson.steps[0].stepKey, 'registration_started')
    assert.equal(funnelJson.steps[1].stepKey, 'otp_verified')
    assert.equal(funnelJson.steps[2].stepKey, 'profile_completed')
    assert.equal(funnelJson.steps[3].stepKey, 'first_entity')
    assert.equal(funnelJson.steps[4].stepKey, 'first_timer_or_session')
    assert.equal(funnelJson.steps[5].stepKey, 'first_payment')
    assert.ok(funnelJson.summary.totalStarted >= 1)
    console.log('✅ Configurable DB-driven activation funnel evaluated accurately.')

    // -----------------------------------------------------------------
    // TEST 6: Idempotent Daily Rollups
    // -----------------------------------------------------------------
    console.log('\n--- Test 6: Idempotent Daily Rollups ---')
    const todayStr = now.toISOString().split('T')[0]

    // Create sample work session and payment for today
    const [projId] = await db('projects').insert({
      user_id: userId,
      name: 'Rollup Project',
      status: 'in_progress',
      created_at: now,
      updated_at: now,
    })

    await db('work_sessions').insert({
      user_id: userId,
      project_id: projId,
      title: 'Analytics coding',
      started_at: now,
      ended_at: new Date(now.getTime() + 7200000),
      duration_seconds: 7200, // 2 hours
      payment_type: 'paid',
      created_at: now,
      updated_at: now,
    })

    await db('payments').insert({
      user_id: userId,
      project_id: projId,
      amount: 450.00,
      currency: 'USD',
      paid_date: todayStr,
      created_at: now,
      updated_at: now,
    })

    // Trigger rollup run via admin API
    const rollupRun1 = await fetch(`${BASE_URL}/api/admin/analytics/rollups/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ date: todayStr }),
    })
    const run1Json = await rollupRun1.json()
    assert.equal(run1Json.success, true)

    const rollups1 = await db('analytics_daily_rollups').where({ rollup_date: todayStr, country: 'ALL', category: 'ALL', platform: 'ALL' }).first()
    assert.ok(rollups1, 'Global daily rollup should exist')
    assert.ok(Number(rollups1.hours_tracked) >= 2.0, 'Hours tracked should reflect session')
    assert.ok(Number(rollups1.revenue_tracked_usd) >= 450.0, 'Revenue should reflect payment')

    // Run a second time to guarantee IDEMPOTENCY
    const rollupRun2 = await fetch(`${BASE_URL}/api/admin/analytics/rollups/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ date: todayStr }),
    })
    const run2Json = await rollupRun2.json()
    assert.equal(run2Json.success, true)

    const rollups2 = await db('analytics_daily_rollups').where({ rollup_date: todayStr, country: 'ALL', category: 'ALL', platform: 'ALL' })
    assert.equal(rollups2.length, 1, 'Idempotency: exactly 1 global rollup row must exist after multiple runs')
    assert.equal(Number(rollups2[0].hours_tracked), Number(rollups1.hours_tracked), 'Hours tracked should remain identical on rerun')
    console.log('✅ Daily rollups calculation and idempotency verified.')

    // -----------------------------------------------------------------
    // TEST 7: Cohort Retention Matrix
    // -----------------------------------------------------------------
    console.log('\n--- Test 7: Cohort Retention Matrix ---')
    const cohortsRes = await fetch(`${BASE_URL}/api/admin/analytics/cohorts?type=weekly`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const cohortsJson = await cohortsRes.json()
    assert.equal(cohortsRes.status, 200)
    assert.equal(cohortsJson.success, true)
    assert.ok(Array.isArray(cohortsJson.cohorts))
    assert.ok(cohortsJson.cohorts.length > 0)
    assert.equal(cohortsJson.cohorts[0].retentionSteps[0].periodNumber, 0)
    assert.equal(cohortsJson.cohorts[0].retentionSteps[0].retentionRate, 100)
    console.log('✅ Retention cohort matrix computed and returned correctly.')

    // -----------------------------------------------------------------
    // TEST 8: User Summaries, Activation & Metrics
    // -----------------------------------------------------------------
    console.log('\n--- Test 8: User Summaries & Metrics ---')
    const userSummary = await db('analytics_user_summaries').where({ user_id: userId }).first()
    assert.ok(userSummary, 'User summary record should exist')
    assert.equal(userSummary.is_activated, 1, 'User should be marked activated after entity + session + payment')
    assert.ok(userSummary.time_to_activate_hours !== null)

    const metricsRes = await fetch(`${BASE_URL}/api/admin/analytics/metrics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const metricsJson = await metricsRes.json()
    assert.equal(metricsRes.status, 200)
    assert.equal(metricsJson.success, true)
    assert.ok(metricsJson.activity.dau >= 1)
    assert.ok(metricsJson.activation.activationRatePercent > 0)
    assert.ok(metricsJson.adoption.timeTrackingAdoption.usersCount >= 1)
    console.log('✅ User lifecycle summaries, DAU/WAU/MAU, and adoption metrics verified.')

    // -----------------------------------------------------------------
    // TEST 9: Admin Overview Aggregation
    // -----------------------------------------------------------------
    console.log('\n--- Test 9: Admin Analytics Overview ---')
    const overviewRes = await fetch(`${BASE_URL}/api/admin/analytics/overview?range=30days`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const overviewJson = await overviewRes.json()
    assert.equal(overviewRes.status, 200)
    assert.equal(overviewJson.success, true)
    assert.ok(overviewJson.kpis.totalUsers >= 2)
    assert.ok(overviewJson.kpis.activeUsers >= 1)
    assert.ok(overviewJson.kpis.stickinessPercent >= 0)
    assert.ok(Array.isArray(overviewJson.dailyTrend))
    assert.ok(Array.isArray(overviewJson.geography))
    console.log('✅ Admin analytics overview returned pre-aggregated KPIs correctly.')

    // -----------------------------------------------------------------
    // TEST 10: Performance Benchmark (10,000+ synthetic events < 300ms)
    // -----------------------------------------------------------------
    console.log('\n--- Test 10: Performance Benchmark (10,000+ Events) ---')
    console.log('Generating and inserting 10,000 synthetic analytics events...')

    const bulkEvents = []
    const countries = ['US', 'IN', 'GB', 'DE', 'CA', 'AU', 'SG']
    const eventNames = [
      'landing_viewed', 'registration_started', 'otp_verified', 'profile_completed',
      'timer_started', 'session_logged', 'payment_logged', 'rate_viewed', 'invoice_created'
    ]

    const benchmarkStart = Date.now()
    for (let i = 0; i < 10000; i++) {
      const ts = new Date(benchmarkStart - Math.floor(Math.random() * 20 * 86400000))
      const c = countries[i % countries.length]
      const name = eventNames[i % eventNames.length]
      bulkEvents.push({
        user_id: i % 10 === 0 ? userId : null,
        name,
        event_name: name,
        timestamp: ts,
        created_at: ts,
        country: c,
        is_pwa: i % 4 === 0 ? 1 : 0,
        device_type: i % 3 === 0 ? 'mobile' : 'desktop',
        os: 'Windows',
        browser: 'Chrome',
        properties: JSON.stringify({ index: i, amount_bucket: '<100' }),
        is_bot: 0,
        is_internal: 0,
      })
    }

    // Insert in chunks of 500
    for (let i = 0; i < bulkEvents.length; i += 500) {
      await db('analytics_events').insert(bulkEvents.slice(i, i + 500))
    }
    console.log('Inserted 10,000 synthetic events into database.')

    // Recalculate daily rollups
    await db('analytics_daily_rollups').truncate()
    for (let d = 0; d < 7; d++) {
      const dStr = new Date(benchmarkStart - d * 86400000).toISOString().split('T')[0]
      await fetch(`${BASE_URL}/api/admin/analytics/rollups/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ date: dStr }),
      })
    }

    // Benchmark query response time on pre-aggregated tables
    const qStart = performance.now()
    const benchmarkRes = await fetch(`${BASE_URL}/api/admin/analytics/overview?range=30days`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const qEnd = performance.now()
    const queryDurationMs = Math.round(qEnd - qStart)

    assert.equal(benchmarkRes.status, 200)
    console.log(`⏱️ Query Execution Time with 10k+ events: ${queryDurationMs}ms (Threshold: <300ms)`)
    assert.ok(queryDurationMs < 300, `Query execution time must be under 300ms (was ${queryDurationMs}ms)`)

    console.log('✅ Performance benchmark passed with flying colors!\n')
    console.log('🎉 ALL 10 TEST SUITES PASSED SUCCESSFULLY!')
  } finally {
    await db.destroy()
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err)
  process.exit(1)
})
