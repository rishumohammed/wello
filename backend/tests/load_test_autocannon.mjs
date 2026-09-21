// backend/tests/load_test_autocannon.mjs
/**
 * Production Load & Stress Testing Benchmark for Wello
 * Benchmarks high concurrency throughput & latency percentiles (p50, p95, p99) on:
 * 1. GET /api/health (Liveness Probe)
 * 2. GET /api/ready (Database Pool Readiness)
 * 3. POST /api/quick-entry (Timer Execution Engine)
 * 4. GET /api/admin/stats (Admin Dashboard Aggregations)
 * 5. GET /api/admin/analytics/overview (Full Analytics Layer)
 */

import http from 'node:http'
import knex from 'knex'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'
const urlObj = new URL(BASE_URL)
const HOST = urlObj.hostname
const PORT = Number(urlObj.port) || 3001

const db = knex({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wello',
  },
})

function makeRequest(path, options = {}) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint()
    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          const end = process.hrtime.bigint()
          const durationMs = Number(end - start) / 1e6
          resolve({
            statusCode: res.statusCode,
            durationMs,
            success: res.statusCode >= 200 && res.statusCode < 400,
          })
        })
      }
    )

    req.on('error', (err) => {
      const end = process.hrtime.bigint()
      const durationMs = Number(end - start) / 1e6
      resolve({
        statusCode: 500,
        durationMs,
        success: false,
        error: err.message,
      })
    })

    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    req.end()
  })
}

async function runBenchmark(name, path, options = {}, totalRequests = 100, concurrency = 10) {
  process.stdout.write(`⚡ Benchmarking ${name} (${totalRequests} requests, ${concurrency} concurrent)... `)

  const latencies = []
  let errors = 0
  let index = 0

  const startTime = Date.now()

  async function worker() {
    while (index < totalRequests) {
      index++
      const res = await makeRequest(path, options)
      latencies.push(res.durationMs)
      if (!res.success) {
        errors++
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker())
  await Promise.all(workers)

  const totalTimeSec = (Date.now() - startTime) / 1000
  const rps = Math.round(totalRequests / totalTimeSec)

  latencies.sort((a, b) => a - b)
  const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(2)
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2)
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2)
  const min = latencies[0].toFixed(2)
  const max = latencies[latencies.length - 1].toFixed(2)

  console.log(`\n    Throughput: ${rps} req/sec | Latencies: min: ${min}ms, p50: ${p50}ms, p95: ${p95}ms, p99: ${p99}ms | Errors: ${errors}/${totalRequests}`)

  return {
    name,
    totalRequests,
    concurrency,
    rps,
    p50,
    p95,
    p99,
    errors,
  }
}

async function startLoadTest() {
  console.log('\n🚀 STARTING WELLO PRODUCTION LOAD TEST SUITE')
  console.log(`Target: ${BASE_URL}\n`)

  try {
    // Setup test auth session
    const crypto = await import('node:crypto')
    const adminUser = await db('users').where({ role: 'admin' }).first()
    const testToken = 'bench_tok_' + Date.now()
    const testTokenHash = crypto.createHash('sha256').update(testToken).digest('hex')
    if (adminUser) {
      await db('auth_sessions').insert({
        user_id: adminUser.id,
        token_hash: testTokenHash,
        expires_at: new Date(Date.now() + 14400000),
        ip_address: '127.0.0.1',
      })
    }

    const results = []

    // 1. Health Probe
    results.push(await runBenchmark('Liveness Probe (/api/health)', '/api/health', {}, 100, 10))

    // 2. Ready Probe (Database Query)
    results.push(await runBenchmark('Readiness Probe (/api/ready)', '/api/ready', {}, 100, 10))

    // 3. Active Timer Status
    results.push(
      await runBenchmark(
        'Active Timer Status (/api/timer/active)',
        '/api/timer/active',
        {
          headers: { Authorization: `Bearer ${testToken}` },
        },
        100,
        10
      )
    )

    // 4. Admin Dashboard Stats
    results.push(
      await runBenchmark(
        'Admin Dashboard Stats (/api/admin/stats)',
        '/api/admin/stats',
        {
          headers: { Authorization: `Bearer ${testToken}` },
        },
        50,
        5
      )
    )

    // 5. Admin Analytics Overview
    results.push(
      await runBenchmark(
        'Analytics Overview (/api/admin/analytics/overview)',
        '/api/admin/analytics/overview',
        {
          headers: { Authorization: `Bearer ${testToken}` },
        },
        50,
        5
      )
    )

    // Clean up
    if (adminUser) {
      await db('auth_sessions').where({ token_hash: testTokenHash }).delete()
    }

    console.log('\n====================================================')
    console.log('📊 LOAD BENCHMARK RESULTS SUMMARY TABLE')
    console.log('====================================================')
    console.table(
      results.map((r) => ({
        Endpoint: r.name,
        'Req/Sec': r.rps,
        'p50 (ms)': r.p50,
        'p95 (ms)': r.p95,
        'p99 (ms)': r.p99,
        'Error Rate': `${r.errors}/${r.totalRequests}`,
      }))
    )

    await db.destroy()
    process.exit(0)
  } catch (err) {
    console.error('❌ Load test failed:', err)
    await db.destroy().catch(() => {})
    process.exit(1)
  }
}

startLoadTest()
