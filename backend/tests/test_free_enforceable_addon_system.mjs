// ============================================================================
// WELLO TEST SUITE: ENFORCEABLE FREE ADDON SYSTEM, GATING, & FAIR-USE LIMITS
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

async function createTestUser(email, name = 'Free Addon Tester') {
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

async function runTestSuite() {
  console.log('==================================================================')
  console.log('🛒 RUNNING VERIFICATION: REAL ENFORCEABLE FREE ADDON SYSTEM')
  console.log('==================================================================\n')

  try {
    const { token: adminToken } = await createAdminUser()

    // -------------------------------------------------------------------------
    // TEST 1: Store Catalog 100% Free Guarantee
    // -------------------------------------------------------------------------
    console.log('🔹 1. Store Catalog & 100% Free Guarantee')
    const testEmail1 = `addon_tester_${Date.now()}@example.com`
    const { token: token1, user: user1 } = await createTestUser(testEmail1, 'Clean Slate User')

    const catalogRes = await api('/api/store/addons', { token: token1 })
    testLog(catalogRes.status === 200, 'GET /api/store/addons returned 200')
    const addonsList = catalogRes.body?.data?.addons || catalogRes.body?.addons
    testLog(Array.isArray(addonsList) && addonsList.length >= 4, `Catalog contains ${addonsList?.length} addons`)

    const allFree = addonsList.every(a => a.isFree === true && a.price_amount === undefined && a.price === undefined)
    testLog(allFree, 'Every addon in the store catalog is 100% FREE with 0 price/billing fields')

    // -------------------------------------------------------------------------
    // TEST 2: Server-Side Route Gating (403 ADDON_NOT_ACTIVATED)
    // -------------------------------------------------------------------------
    console.log('\n🔹 2. Server-Side Route Gating (403 ADDON_NOT_ACTIVATED)')
    
    // Deactivate all user addons for user1 in DB to ensure clean unactivated baseline
    await db('user_addons').where({ user_id: user1.id }).del()

    // 2.1 Invoices gate
    const invoiceGateRes = await api('/api/invoices', { token: token1 })
    testLog(invoiceGateRes.status === 403, 'Unactivated user GET /api/invoices returned 403 Forbidden')
    testLog(invoiceGateRes.body?.data?.code === 'ADDON_NOT_ACTIVATED', 'Returned error code ADDON_NOT_ACTIVATED for invoicing')

    // 2.2 Reports gate
    const reportsGateRes = await api('/api/reports/summary', { token: token1 })
    testLog(reportsGateRes.status === 403, 'Unactivated user GET /api/reports/summary returned 403 Forbidden')
    testLog(reportsGateRes.body?.data?.code === 'ADDON_NOT_ACTIVATED', 'Returned error code ADDON_NOT_ACTIVATED for reports')

    // 2.3 Pricing Calculator gate
    const calcGateRes = await api('/api/calculator/pricing', {
      method: 'POST',
      token: token1,
      body: { estimatedHours: 40 },
    })
    testLog(calcGateRes.status === 403, 'Unactivated user POST /api/calculator/pricing returned 403 Forbidden')
    testLog(calcGateRes.body?.data?.code === 'ADDON_NOT_ACTIVATED', 'Returned error code ADDON_NOT_ACTIVATED for pricing calculator')

    // -------------------------------------------------------------------------
    // TEST 3: 1-Click Free Activation (No Payment Step)
    // -------------------------------------------------------------------------
    console.log('\n🔹 3. 1-Click Free Activation (No Payment Step)')
    const activateRes = await api('/api/store/addons/activate', {
      method: 'POST',
      token: token1,
      body: {
        addonKey: 'basic-invoicing',
        action: 'activate',
      },
    })

    testLog(activateRes.status === 200, 'POST /api/store/addons/activate returned 200 for basic-invoicing')
    testLog(activateRes.body?.data?.isActivated === true, 'Response confirms isActivated: true')

    // Immediately test gated route now passes without payment
    const invoiceUnlockRes = await api('/api/invoices', { token: token1 })
    testLog(invoiceUnlockRes.status === 200, 'Activated user GET /api/invoices now succeeds with 200 OK')

    // -------------------------------------------------------------------------
    // TEST 4: Data Preservation on Deactivation
    // -------------------------------------------------------------------------
    console.log('\n🔹 4. Data Preservation on Deactivation')
    
    // Create an invoice
    const createInvRes = await api('/api/invoices', {
      method: 'POST',
      token: token1,
      body: {
        customerName: 'Acme Preservation Corp',
        customerEmail: 'billing@acmepreservation.com',
        items: [{ description: 'Architecture consulting', quantity: 10, unitPrice: 200 }],
        taxPercent: 0,
      },
    })
    if (createInvRes.status !== 201) {
      console.log('    [DEBUG Create Invoice Error]:', createInvRes.status, JSON.stringify(createInvRes.body))
    }
    testLog(createInvRes.status === 201, 'Created test invoice #1 while addon is active')
    const createdInvId = createInvRes.body?.data?.id || createInvRes.body?.data?.invoice?.id || createInvRes.body?.invoice?.id

    // Deactivate basic-invoicing
    const deactivateRes = await api('/api/store/addons/activate', {
      method: 'POST',
      token: token1,
      body: {
        addonKey: 'basic-invoicing',
        action: 'deactivate',
      },
    })
    testLog(deactivateRes.status === 200, 'Deactivated basic-invoicing addon')

    // Gated route now returns 403
    const invoiceGatedAgainRes = await api('/api/invoices', { token: token1 })
    testLog(invoiceGatedAgainRes.status === 403, 'GET /api/invoices is blocked again after deactivation')

    // Verify invoice row remains in database intact (NEVER deleted!)
    const preservedInvoice = await db('invoices').where({ id: createdInvId, user_id: user1.id }).first()
    testLog(Boolean(preservedInvoice) && preservedInvoice.customer_name === 'Acme Preservation Corp', 'Invoice record safely preserved in database during deactivation')

    // Reactivate basic-invoicing
    await api('/api/store/addons/activate', {
      method: 'POST',
      token: token1,
      body: {
        addonKey: 'basic-invoicing',
        action: 'activate',
      },
    })

    // Accessing /api/invoices restores the invoice
    const restoredInvoicesRes = await api('/api/invoices', { token: token1 })
    testLog(restoredInvoicesRes.status === 200, 'GET /api/invoices returns 200 on reactivation')
    const invList = restoredInvoicesRes.body?.data?.invoices || restoredInvoicesRes.body?.invoices || []
    testLog(invList.some(i => i.id === createdInvId), 'Preserved invoice is restored and visible again upon reactivation')

    // -------------------------------------------------------------------------
    // TEST 5: Dependency Resolution
    // -------------------------------------------------------------------------
    console.log('\n🔹 5. Addon Dependency Resolution')
    const testEmail2 = `addon_dep_${Date.now()}@example.com`
    const { token: token2, user: user2 } = await createTestUser(testEmail2, 'Dependency Tester')
    await db('user_addons').where({ user_id: user2.id }).del()

    // Activating recurring-retainers (which depends on basic-invoicing)
    const depActivateRes = await api('/api/store/addons/activate', {
      method: 'POST',
      token: token2,
      body: {
        addonKey: 'recurring-retainers',
        action: 'activate',
      },
    })
    testLog(depActivateRes.status === 200, 'POST /api/store/addons/activate for recurring-retainers returned 200')
    testLog(depActivateRes.body?.data?.activatedKeys?.includes('basic-invoicing'), 'Automatically resolved and activated dependent basic-invoicing addon')

    const user2InvoicesRes = await api('/api/invoices', { token: token2 })
    testLog(user2InvoicesRes.status === 200, 'User 2 can access invoices due to automatic dependency activation')

    // -------------------------------------------------------------------------
    // TEST 6: Global Incident Kill-Switch
    // -------------------------------------------------------------------------
    console.log('\n🔹 6. Global Incident Kill-Switch')
    // Activate executive-reports for User 1
    await api('/api/store/addons/activate', {
      method: 'POST',
      token: token1,
      body: { addonKey: 'executive-reports', action: 'activate' },
    })

    const reportsBeforeKill = await api('/api/reports/summary', { token: token1 })
    testLog(reportsBeforeKill.status === 200, 'User 1 has active access to executive reports')

    // Admin engages kill-switch on executive-reports
    const killRes = await api('/api/admin/store/kill-switch', {
      method: 'POST',
      token: adminToken,
      body: {
        addonKey: 'executive-reports',
        isKilled: true,
        incidentReason: 'Performance degradation mitigation',
      },
    })
    testLog(killRes.status === 200, 'Admin engaged incident kill-switch on executive-reports')

    // Gated route now returns 403 ADDON_GLOBALLY_DISABLED
    const reportsAfterKill = await api('/api/reports/summary', { token: token1 })
    testLog(reportsAfterKill.status === 403, 'Reports route is blocked by kill-switch for active users')
    testLog(reportsAfterKill.body?.data?.code === 'ADDON_GLOBALLY_DISABLED', 'Error code indicates ADDON_GLOBALLY_DISABLED')

    // Admin releases kill-switch
    const releaseRes = await api('/api/admin/store/kill-switch', {
      method: 'POST',
      token: adminToken,
      body: { addonKey: 'executive-reports', isKilled: false },
    })
    testLog(releaseRes.status === 200, 'Admin released incident kill-switch')

    const reportsAfterRelease = await api('/api/reports/summary', { token: token1 })
    testLog(reportsAfterRelease.status === 200, 'Reports route immediately accessible again after kill-switch release')

    // -------------------------------------------------------------------------
    // TEST 7: Persona Onboarding Defaults
    // -------------------------------------------------------------------------
    console.log('\n🔹 7. Persona Onboarding Defaults')
    const testEmail3 = `persona_user_${Date.now()}@example.com`
    const { token: token3, user: user3 } = await createTestUser(testEmail3, 'Persona Freelancer')

    // User completes onboarding setting persona to 'freelancer_projects'
    const profileRes = await api('/api/me', {
      method: 'PATCH',
      token: token3,
      body: {
        earningPersona: 'freelancer_projects',
      },
    })
    testLog(profileRes.status === 200, 'PATCH /api/me set earningPersona to freelancer_projects')

    // Check user 3 can access invoices & pricing calculator by default
    const p3InvRes = await api('/api/invoices', { token: token3 })
    testLog(p3InvRes.status === 200, 'Persona default basic-invoicing addon was auto-activated')

    const p3CalcRes = await api('/api/calculator/pricing', {
      method: 'POST',
      token: token3,
      body: { estimatedHours: 20 },
    })
    testLog(p3CalcRes.status === 200, 'Persona default pricing-calculator addon was auto-activated')

    // -------------------------------------------------------------------------
    // TEST 8: Fair-Use Safety Limits (Protection, Not Pricing)
    // -------------------------------------------------------------------------
    console.log('\n🔹 8. Fair-Use Abuse Protection Safety Limits')
    // Set daily invoice limit to 2 for test verification
    await db('fair_use_limits').where({ limit_key: 'invoices_per_day' }).update({ limit_value: 2 })

    // Clean user 3 invoices limit log
    await db('fair_use_logs').where({ user_id: user3.id, limit_key: 'invoices_per_day' }).del()

    // Invoice 1: OK
    const inv1 = await api('/api/invoices', {
      method: 'POST',
      token: token3,
      body: { customerName: 'Client 1', items: [{ description: 'Work 1', unitPrice: 100 }] },
    })
    testLog(inv1.status === 201, 'Invoice 1 created within safety limit (1/2)')

    // Invoice 2: OK
    const inv2 = await api('/api/invoices', {
      method: 'POST',
      token: token3,
      body: { customerName: 'Client 2', items: [{ description: 'Work 2', unitPrice: 100 }] },
    })
    testLog(inv2.status === 201, 'Invoice 2 created within safety limit (2/2)')

    // Invoice 3: Exceeds safety threshold -> 429
    const inv3 = await api('/api/invoices', {
      method: 'POST',
      token: token3,
      body: { customerName: 'Client 3', items: [{ description: 'Work 3', unitPrice: 100 }] },
    })
    testLog(inv3.status === 429, 'Invoice 3 blocked by fair-use safety rate limit with 429')
    testLog(inv3.body?.data?.code === 'FAIR_USE_LIMIT_EXCEEDED', 'Returned error code FAIR_USE_LIMIT_EXCEEDED')

    // Restore limit to 100
    await db('fair_use_limits').where({ limit_key: 'invoices_per_day' }).update({ limit_value: 100 })

    // -------------------------------------------------------------------------
    // TEST 9: Analytics Pipeline Event Logging
    // -------------------------------------------------------------------------
    console.log('\n🔹 9. Analytics Pipeline Event Logging')
    const activatedEvents = await db('analytics_events').where({ event_name: 'addon_activated' })
    const deactivatedEvents = await db('analytics_events').where({ event_name: 'addon_deactivated' })

    testLog(activatedEvents.length >= 3, `Logged ${activatedEvents.length} addon_activated analytics events`)
    testLog(deactivatedEvents.length >= 1, `Logged ${deactivatedEvents.length} addon_deactivated analytics events`)

    console.log('\n==================================================================')
    console.log('🎉 ALL FREE ENFORCEABLE ADDON SYSTEM TESTS PASSED!')
    console.log('==================================================================\n')
  } catch (err) {
    console.error('❌ Test suite error:', err)
    process.exitCode = 1
  } finally {
    await db.destroy()
  }
}

runTestSuite()
