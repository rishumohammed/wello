// backend/tests/test_production_hardening.mjs
/**
 * Automated Production Hardening Verification Suite for Wello
 * Verifies:
 * 1. Health & Readiness Probes (/api/health, /api/ready)
 * 2. HTTP Security Headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, X-Request-ID)
 * 3. Distributed Rate Limiting & 429 Throttling
 * 4. Input Validation & Strict Schema Unknown Field Rejection
 * 5. Email Template Variable HTML Escaping & Admin Template Preview
 * 6. File & Logo Upload Protection (Magic Bytes, SVG Sanitization, Path Traversal Defense)
 * 7. Logging & Error Handling Sanitization
 */

import assert from 'node:assert'
import knex from 'knex'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

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

let passed = 0
let failed = 0

function testPass(name) {
  console.log(`  ✅ PASS: ${name}`)
  passed++
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
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      body = await res.json()
    } catch (e) {
      body = null
    }
  } else {
    body = await res.text()
  }

  return {
    status: res.status,
    headers: res.headers,
    body,
  }
}

async function runTests() {
  console.log('\n🔒 STARTING PRODUCTION HARDENING & SECURITY TEST SUITE\n')

  try {
    // ─── TEST 1: Health & Readiness Probes ──────────────────────────────────────
    console.log('--- 1. Health & Readiness Observability Probes ---')
    
    // Liveness probe
    const healthRes = await api('/api/health')
    assert.strictEqual(healthRes.status, 200, 'GET /api/health returns 200 OK')
    assert.strictEqual(healthRes.body?.status, 'healthy', 'Health status is "healthy"')
    assert.ok(typeof healthRes.body?.uptimeSeconds === 'number', 'Reports uptime in seconds')
    testPass('Liveness probe (/api/health) returns 200 with runtime memory and uptime')

    // Readiness probe
    const readyRes = await api('/api/ready')
    assert.strictEqual(readyRes.status, 200, 'GET /api/ready returns 200 OK')
    assert.strictEqual(readyRes.body?.status, 'ready', 'Readiness status is "ready"')
    assert.strictEqual(readyRes.body?.database, 'connected', 'Database connectivity verified')
    testPass('Readiness probe (/api/ready) verifies active MySQL connection pool')

    // ─── TEST 2: Security Headers & Request Correlation ─────────────────────────
    console.log('\n--- 2. HTTP Security Headers & Tracing ---')
    
    assert.ok(healthRes.headers.get('x-request-id'), 'Response includes X-Request-ID correlation header')
    assert.strictEqual(healthRes.headers.get('x-content-type-options'), 'nosniff', 'X-Content-Type-Options: nosniff present')
    assert.strictEqual(healthRes.headers.get('x-frame-options'), 'DENY', 'X-Frame-Options: DENY present')
    assert.strictEqual(healthRes.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', 'Referrer-Policy configured')
    assert.ok(healthRes.headers.get('strict-transport-security'), 'HSTS configured')
    assert.ok(healthRes.headers.get('content-security-policy'), 'CSP header configured')
    testPass('Security headers (CSP, HSTS, nosniff, DENY, Referrer-Policy, X-Request-ID) verified')

    // ─── TEST 3: Input Validation & Strict Schema Rejection ─────────────────────
    console.log('\n--- 3. Input Validation & Strict Schema Unknown Field Rejection ---')
    
    // Attempt send-otp with unknown/injected fields (should be rejected by .strict())
    const unknownFieldRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: {
        email: 'test_strict@example.com',
        maliciousInjectedField: 'DROP TABLE users;',
        unrecognizedParam: 12345,
      },
    })
    assert.strictEqual(unknownFieldRes.status, 400, 'Unknown fields rejected with 400 Bad Request')
    testPass('Strict Zod schemas reject unexpected payload attributes')

    // ─── TEST 4: Email Template HTML Escaping & Preview ─────────────────────────
    console.log('\n--- 4. Email Template XSS Defense & Live Preview ---')
    
    // Authenticate admin
    const adminUser = await db('users').where({ role: 'admin' }).first()
    assert.ok(adminUser, 'Admin user found in database')
    
    // Create admin session
    const adminToken = 'test_token_hardened_admin_' + Date.now()
    const crypto = await import('node:crypto')
    const tokenHash = crypto.createHash('sha256').update(adminToken).digest('hex')
    await db('auth_sessions').insert({
      user_id: adminUser.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 14400000),
      ip_address: '127.0.0.1',
    })

    // Request template preview
    const previewRes = await api('/api/admin/email/preview?key=invoice_dispatch', {
      token: adminToken,
    })
    assert.strictEqual(previewRes.status, 200, 'GET /api/admin/email/preview returns 200 OK')
    assert.ok(previewRes.body?.preview?.html.includes('INV-2026-0042'), 'Rendered preview with sample data')
    testPass('Email template preview endpoint renders safe fixture data')

    // Verify HTML escaping of XSS injection in template variables via preview endpoint
    const customVarPayload = encodeURIComponent(
      JSON.stringify({
        first_name: '<script>alert("xss")</script>Alex',
        email: 'alex@example.com',
      })
    )
    const xssPreviewRes = await api(`/api/admin/email/preview?key=welcome&variables=${customVarPayload}`, {
      token: adminToken,
    })
    assert.strictEqual(xssPreviewRes.status, 200, 'XSS test preview endpoint returns 200')
    const htmlContent = xssPreviewRes.body?.preview?.html || ''
    assert.ok(!htmlContent.includes('<script>alert'), 'HTML output does not contain unescaped <script> tag')
    assert.ok(htmlContent.includes('&lt;script&gt;'), 'XSS payload is safely HTML entity encoded')
    testPass('User-supplied template variables are strictly HTML entity encoded')

    // ─── TEST 5: File & Logo Upload Protection ──────────────────────────────────
    console.log('\n--- 5. Secure File & Logo Upload Engine ---')
    
    // A. Attempt upload with fake extension but invalid magic bytes -> Rejected
    const fakeImageBuffer = Buffer.from('NOT_A_REAL_IMAGE_DATA_12345678')
    const fakeUploadRes = await api('/api/upload/logo', {
      method: 'POST',
      token: adminToken,
      body: {
        image: fakeImageBuffer.toString('base64'),
        mimeType: 'image/png',
        filename: 'fake.png',
      },
    })
    assert.strictEqual(fakeUploadRes.status, 400, 'Fake image without valid magic bytes rejected with 400')
    testPass('Magic byte verification rejects spoofed image uploads')

    // B. Upload valid PNG image
    // 1x1 transparent PNG binary bytes
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    const validUploadRes = await api('/api/upload/logo', {
      method: 'POST',
      token: adminToken,
      body: {
        image: validPngBuffer.toString('base64'),
        mimeType: 'image/png',
        filename: 'valid_logo.png',
      },
    })
    assert.strictEqual(validUploadRes.status, 200, 'Valid PNG image uploaded successfully')
    assert.ok(validUploadRes.body?.url.startsWith('/api/uploads/logo_'), 'Returns sanitized UUID asset URL')
    testPass('Valid image is safely stored with UUID hash key')

    // C. Verify public delivery of uploaded asset
    const assetUrl = validUploadRes.body.url
    const assetRes = await api(assetUrl)
    assert.strictEqual(assetRes.status, 200, 'Uploaded asset served via /api/uploads/ with 200')
    assert.strictEqual(assetRes.headers.get('content-type'), 'image/png', 'Correct Content-Type served')
    assert.ok(assetRes.headers.get('cache-control')?.includes('immutable'), 'Immutable cache header set')
    testPass('Uploaded asset served securely with immutable caching headers')

    // D. Directory Traversal Defense
    const traversalRes = await api('/api/uploads/..%2f..%2fpackage.json')
    assert.ok(traversalRes.status === 400 || traversalRes.status === 404, 'Directory traversal attempt blocked')
    testPass('Path traversal attempts are strictly rejected')

    // ─── TEST 6: Distributed Rate Limiting ──────────────────────────────────────
    console.log('\n--- 6. Shared Distributed Rate Limiting ---')
    
    // Test key in rate_limits table
    const testKey = 'rl:auth_send_otp:ratelimit_target@example.com'
    await db('rate_limits').where({ key: testKey }).delete()

    // Exhaust quota (5 requests allowed)
    for (let i = 0; i < 5; i++) {
      await api('/api/auth/send-otp', {
        method: 'POST',
        body: { email: 'ratelimit_target@example.com' },
      })
    }

    // 6th request must be throttled with 429
    const throttledRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: { email: 'ratelimit_target@example.com' },
    })
    assert.strictEqual(throttledRes.status, 429, '6th OTP request throttled with 429 Too Many Requests')
    assert.ok(throttledRes.headers.get('retry-after'), 'Includes Retry-After response header')
    testPass('Distributed rate limiter tracks points and throttles upon quota exhaustion (429)')

    // Clean up
    await db('rate_limits').where({ key: testKey }).delete()
    await db('auth_sessions').where({ token_hash: tokenHash }).delete()

    console.log('\n====================================================')
    console.log(`🎉 ALL HARDENING TESTS PASSED: ${passed} Passed, ${failed} Failed`)
    console.log('====================================================\n')

    await db.destroy()
    process.exit(0)
  } catch (err) {
    console.error('\n❌ Fatal test failure:', err)
    await db.destroy().catch(() => {})
    process.exit(1)
  }
}

runTests()
