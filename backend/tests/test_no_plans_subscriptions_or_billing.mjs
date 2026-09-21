// ============================================================================
// WELLO TEST SUITE: NO PLANS, SUBSCRIPTIONS, OR WELLO BILLING (FREE ADDONS)
// ============================================================================

import knex from 'knex'
import knexConfig from '../knexfile.cjs'

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

async function createTestUser(email, name = 'Free Addons Tester') {
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
  console.log('🧪 RUNNING VERIFICATION: FREE ADDONS & NO WELLO BILLING')
  console.log('==================================================================\n')

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // 1. Database Schema Checks (Knex Inspection)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- 1. Database Tables & Column Audits ---')
    
    const tablesRaw = await db.raw('SHOW TABLES')
    const tableKey = Object.keys(tablesRaw[0][0])[0]
    const tables = tablesRaw[0].map(row => row[tableKey])

    testLog(!tables.includes('plans'), 'Table `plans` is dropped and absent from database')
    testLog(!tables.includes('subscriptions'), 'Table `subscriptions` is dropped and absent from database')
    testLog(!tables.includes('billing_events'), 'Table `billing_events` is dropped and absent from database')

    const addonsColsRaw = await db.raw('SHOW COLUMNS FROM addons')
    const addonCols = addonsColsRaw[0].map(c => c.Field)

    testLog(!addonCols.includes('price_amount'), 'Column `price_amount` is removed from `addons`')
    testLog(!addonCols.includes('price_currency'), 'Column `price_currency` is removed from `addons`')
    testLog(!addonCols.includes('is_pro'), 'Column `is_pro` is absent from `addons`')

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Addon Catalog in Store API
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Store Addons Catalog API ---')
    const testEmail = `free.addons.tester.${Date.now()}@example.com`
    const { token, user } = await createTestUser(testEmail)
    testLog(Boolean(token), `Created authenticated test user: ${testEmail}`)

    const storeRes = await api('/api/store/addons', { token })
    testLog(storeRes.status === 200, 'GET /api/store/addons returns 200 OK')
    testLog(Array.isArray(storeRes.body?.addons), 'Store addons list returned as array')

    const hasPaidFields = storeRes.body?.addons?.some(a => 'price_amount' in a || 'price_currency' in a)
    testLog(!hasPaidFields, 'Store addons catalog contains no price or paid subscription fields')

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Addon Gating & Free Activation Workflow
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. Route Gating & Free Activation ---')

    // Try accessing protected Invoicing route before activation
    const unauthInvoices = await api('/api/invoices', { token })
    testLog(
      unauthInvoices.status === 403 &&
      (unauthInvoices.body?.data?.code === 'ADDON_NOT_ACTIVATED' || unauthInvoices.body?.code === 'ADDON_NOT_ACTIVATED'),
      'Unactivated user GET /api/invoices returns 403 ADDON_NOT_ACTIVATED'
    )

    // Activate basic-invoicing (100% free)
    const basicAddon = storeRes.body?.addons?.find(a => a.slug === 'basic-invoicing')
    testLog(Boolean(basicAddon), `Found Basic Invoicing addon (ID: ${basicAddon?.id})`)

    const activateRes = await api('/api/store/addons/activate', {
      method: 'POST',
      token,
      body: { addonId: basicAddon.id },
    })
    testLog(activateRes.status === 200 && activateRes.body?.success, 'POST /api/store/addons/activate succeeds (free activation)')

    // Try accessing invoices route again
    const authInvoices = await api('/api/invoices', { token })
    const invoicesList = authInvoices.body?.invoices || authInvoices.body?.data?.invoices
    testLog(authInvoices.status === 200 && Array.isArray(invoicesList), 'Activated user GET /api/invoices returns 200 OK')

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Notification Preferences (No subscription_event topic)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. Notification Preferences & Topics ---')

    const prefRes = await api('/api/notifications/preferences', { token })
    testLog(prefRes.status === 200, 'GET /api/notifications/preferences returns 200 OK')
    const prefList = prefRes.body?.preferences || prefRes.body?.data?.preferences || []
    const hasSubEvent = prefList.some(p => p.topic === 'subscription_event')
    testLog(!hasSubEvent, '`subscription_event` is completely absent from user notification preferences')

    // ──────────────────────────────────────────────────────────────────────────
    // 5. Client Invoice Payment Links (Preserved feature for user clients)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 5. User Client Invoice Stripe / Payment Links (Preserved) ---')

    const createInvRes = await api('/api/invoices', {
      method: 'POST',
      token,
      body: {
        customerName: 'Acme Client Corp',
        customerEmail: 'billing@acme.com',
        paymentLinkUrl: 'https://buy.stripe.com/test_client_payment_link_123',
        items: [
          { description: 'Design Sprint Consulting', quantity: 10, rate: 150 },
        ],
      },
    })
    const createdInv = createInvRes.body?.invoice || createInvRes.body?.data?.invoice
    testLog((createInvRes.status === 200 || createInvRes.status === 201) && Boolean(createdInv?.id), 'Created client invoice with user payment link')
    testLog(
      createdInv?.payment_link_url === 'https://buy.stripe.com/test_client_payment_link_123',
      'Client invoice accurately retains user-provided Stripe payment link'
    )

    console.log('\n==================================================================')
    if (process.exitCode === 1) {
      console.error('❌ SOME TESTS FAILED')
    } else {
      console.log('🎉 ALL FREE ADDON & NO WELLO BILLING TESTS PASSED SUCCESSFULLY')
    }
    console.log('==================================================================\n')
  } catch (err) {
    console.error('Test execution error:', err)
    process.exitCode = 1
  } finally {
    await db.destroy()
  }
}

runTestSuite()
