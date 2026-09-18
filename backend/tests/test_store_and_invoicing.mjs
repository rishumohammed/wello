// test_store_and_invoicing.mjs
// Wello Store & Basic Invoicing Addon Integration Test Suite

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

async function runTests() {
  console.log('====================================================')
  console.log('🧪 WELLO STORE & BASIC INVOICING ADDON TEST SUITE')
  console.log('====================================================\n')

  let passCount = 0
  let failCount = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`)
      passCount++
    } else {
      console.error(`  ❌ FAIL: ${message}`)
      failCount++
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: User Wello Store Catalog & Addons List
    // ----------------------------------------------------
    console.log('📌 Testing 1: User Store Catalog (/api/store/addons)')
    const catalogRes = await fetch(`${BASE_URL}/api/store/addons?userId=u1`)
    assert(catalogRes.status === 200, 'GET /api/store/addons returns 200 OK')

    const catalogData = await catalogRes.json()
    assert(Array.isArray(catalogData.addons), 'Addons catalog array returned')

    const invoicingAddon = catalogData.addons.find(a => a.slug === 'basic-invoicing')
    assert(Boolean(invoicingAddon), 'Basic Invoicing Addon exists in store')
    assert(invoicingAddon?.isFree === true, 'Basic Invoicing Addon is 100% FREE')
    assert(invoicingAddon?.isActivated === true, 'Basic Invoicing is activated for demo user')

    // ----------------------------------------------------
    // TEST 2: Addon Activation & Toggle
    // ----------------------------------------------------
    console.log('\n📌 Testing 2: Addon Activation & Toggle (/api/store/addons/activate)')
    const toggleRes = await fetch(`${BASE_URL}/api/store/addons/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', addonId: 'addon_invoicing' })
    })
    assert(toggleRes.status === 200, 'POST /api/store/addons/activate returns 200 OK')
    const toggleData = await toggleRes.json()
    assert(toggleData.success === true, 'Addon status toggled successfully')

    // Reactivate for subsequent tests
    await fetch(`${BASE_URL}/api/store/addons/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', addonId: 'addon_invoicing' })
    })

    // ----------------------------------------------------
    // TEST 3: User Invoices List & Analytics
    // ----------------------------------------------------
    console.log('\n📌 Testing 3: Invoices Directory (/api/invoices)')
    const invoicesRes = await fetch(`${BASE_URL}/api/invoices?userId=u1`)
    assert(invoicesRes.status === 200, 'GET /api/invoices returns 200 OK')

    const invoicesData = await invoicesRes.json()
    assert(Array.isArray(invoicesData.invoices), 'Invoices list returned')
    assert(Boolean(invoicesData.analytics), 'Invoice analytics metrics returned')

    // ----------------------------------------------------
    // TEST 4: Create Draft Invoice & Edit
    // ----------------------------------------------------
    console.log('\n📌 Testing 4: Create Invoice & Save Draft (/api/invoices)')
    const createInvRes = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'u1',
        customerName: 'Starlight Media Pvt Ltd',
        customerContact: 'finance@starlight.com',
        customerAddress: 'Building 5, Business Bay, Pune, Maharashtra - 411006',
        serviceDescription: 'Brand Strategy & Graphic Assets Package',
        items: [
          { description: 'Brand Identity & Guidelines', quantity: 1, rate: 15000 },
          { description: 'Social Media Templates (10 sets)', quantity: 2, rate: 2500 }
        ],
        discount: 1000,
        taxPercent: 18,
        notes: 'Payment terms 15 days.',
        status: 'DRAFT'
      })
    })

    assert(createInvRes.status === 200, 'POST /api/invoices returns 200 OK')
    const createInvData = await createInvRes.json()
    assert(createInvData.success === true, 'Draft invoice created successfully')
    assert(createInvData.invoice.status === 'DRAFT', 'Invoice status is DRAFT')
    assert(createInvData.invoice.total > 0, `Invoice calculated total: ₹${createInvData.invoice.total}`)

    const createdInvId = createInvData.invoice.id

    // Edit invoice
    const editInvRes = await fetch(`${BASE_URL}/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: createdInvId,
        userId: 'u1',
        discount: 2000,
      })
    })
    assert(editInvRes.status === 200, 'Edit invoice POST /api/invoices returns 200 OK')
    const editInvData = await editInvRes.json()
    assert(editInvData.invoice.discount === 2000, 'Invoice discount updated to ₹2000')

    // ----------------------------------------------------
    // TEST 5: Single Invoice View & Details
    // ----------------------------------------------------
    console.log('\n📌 Testing 5: Single Invoice View (/api/invoices/:id)')
    const getInvRes = await fetch(`${BASE_URL}/api/invoices/${createdInvId}`)
    assert(getInvRes.status === 200, 'GET /api/invoices/:id returns 200 OK')
    const getInvData = await getInvRes.json()
    assert(getInvData.invoice.customerName === 'Starlight Media Pvt Ltd', 'Retrieved exact invoice details')

    // ----------------------------------------------------
    // TEST 6: Manual Payment Status Transition
    // ----------------------------------------------------
    console.log('\n📌 Testing 6: Manual Payment Status Transition (/api/invoices/status)')
    const statusRes = await fetch(`${BASE_URL}/api/invoices/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: createdInvId, status: 'PAID' })
    })

    assert(statusRes.status === 200, 'POST /api/invoices/status returns 200 OK')
    const statusData = await statusRes.json()
    assert(statusData.invoice.status === 'PAID', 'Invoice status manually updated to PAID')

    // ----------------------------------------------------
    // TEST 7: Generate Invoice from Completed Wello Job
    // ----------------------------------------------------
    console.log('\n📌 Testing 7: Generate Invoice from Completed Wello Job (/api/invoices/from-job)')
    const fromJobRes = await fetch(`${BASE_URL}/api/invoices/from-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: 'p1',
        jobName: 'Enterprise Cloud Migration',
        jobDescription: 'Migrate legacy infrastructure to serverless node services',
        clientName: 'Nexus Global Systems',
        clientContact: 'billing@nexusglobal.com',
        quoteAmount: 45000,
        hoursWorked: 30,
        rate: 1500,
        userId: 'u1'
      })
    })

    assert(fromJobRes.status === 200, 'POST /api/invoices/from-job returns 200 OK')
    const fromJobData = await fromJobRes.json()
    assert(fromJobData.success === true, 'Invoice generated from Wello Job')
    assert(fromJobData.invoice.customerName === 'Nexus Global Systems', 'Customer info populated from job')
    assert(fromJobData.invoice.projectId === 'p1', 'Invoice linked to Wello project ID')

    // ----------------------------------------------------
    // TEST 8: Admin Store Addon Management & Adoption
    // ----------------------------------------------------
    console.log('\n📌 Testing 8: Admin Store Addon Management (/api/admin/store/addons)')
    const adminGetRes = await fetch(`${BASE_URL}/api/admin/store/addons?role=admin`)
    assert(adminGetRes.status === 200, 'GET /api/admin/store/addons returns 200 OK for Admin')

    const adminGetData = await adminGetRes.json()
    assert(Array.isArray(adminGetData.addons), 'Admin addons array returned')
    assert(Boolean(adminGetData.analytics.adoptionMap), 'Per-addon user adoption stats calculated')

    // Create new addon via Admin API
    const adminPostRes = await fetch(`${BASE_URL}/api/admin/store/addons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'admin',
        adminEmail: 'admin@wello.com',
        action: 'CREATE',
        name: 'Advanced Client Portal',
        slug: 'advanced-client-portal',
        description: 'Provide clients with dedicated project progress portals and asset sharing.',
        category: 'Collaboration',
        version: '1.0.0',
        isFree: true,
        status: 'PUBLISHED',
        features: ['Real-time client progress view', 'File sharing repository']
      })
    })

    assert(adminPostRes.status === 200, 'Admin POST /api/admin/store/addons returns 200 OK')
    const adminPostData = await adminPostRes.json()
    assert(adminPostData.success === true, 'Admin successfully created new Store Addon')

    // ----------------------------------------------------
    // TEST 9: Admin Security Check & Unauthorized Access Block
    // ----------------------------------------------------
    console.log('\n📌 Testing 9: Admin Security & Authorization Guard')
    const unauthorizedRes = await fetch(`${BASE_URL}/api/admin/store/addons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'user', // Standard user attempting admin mutation
        action: 'CREATE',
        name: 'Malicious Addon'
      })
    })

    assert(unauthorizedRes.status === 403, 'Unauthorized non-admin request blocked with 403 Forbidden')

    // ----------------------------------------------------
    // TEST 10: Audit Logs Verification
    // ----------------------------------------------------
    console.log('\n📌 Testing 10: Wello Audit Logs Integration (/api/admin/audit-logs)')
    const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?role=admin`)
    assert(auditRes.status === 200, 'GET /api/admin/audit-logs returns 200 OK')

    const auditData = await auditRes.json()
    const addonAudit = (auditData.logs || []).find(l => l.action === 'ADDON_CREATED' || l.module === 'Wello Store')
    assert(Boolean(addonAudit), 'Admin Store action recorded in system Audit Log')

    // ----------------------------------------------------
    // TEST 11: Store & Invoicing Analytics Overview
    // ----------------------------------------------------
    console.log('\n📌 Testing 11: Aggregated Store Analytics (/api/admin/store/analytics)')
    const analyticsRes = await fetch(`${BASE_URL}/api/admin/store/analytics?role=admin`)
    assert(analyticsRes.status === 200, 'GET /api/admin/store/analytics returns 200 OK')

    const analyticsData = await analyticsRes.json()
    assert(analyticsData.storeAnalytics.totalAddons >= 2, 'Analytics includes newly created addon')
    assert(Array.isArray(analyticsData.usageTrends), 'Monthly usage trends returned')

    console.log('\n====================================================')
    console.log(`🏁 STORE & INVOICING SUITE COMPLETE: ${passCount} PASSED, ${failCount} FAILED`)
    console.log('====================================================\n')

    process.exit(failCount === 0 ? 0 : 1)
  } catch (err) {
    console.error('Test execution error:', err)
    process.exit(1)
  }
}

runTests()
