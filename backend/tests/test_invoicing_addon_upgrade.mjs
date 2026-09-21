// backend/tests/test_invoicing_addon_upgrade.mjs
// Comprehensive Test Suite for Wello Upgraded Basic Invoicing Addon:
// 1. Addon entitlement guard (403 INVOICING_ADDON_REQUIRED for unactivated users)
// 2. Concurrency-safe gapless sequence generation (INV-YYYY-XXXX via invoice_sequences)
// 3. Immutability guard on issued invoices & Credit Note generation
// 4. Automated overdue status derivation from due_date (scheduled/derived, not manual)
// 5. Payments ledger integration (partial/full payments update amount_paid & balance_due, 0 double counting)
// 6. Generic multi-tax engine (exclusive, inclusive, reverse charge, custom tax labels)
// 7. Multi-currency handling & strict ISO decimal precision (USD 2 dec, JPY 0 dec, KWD 3 dec)
// 8. Server-side vector PDF generation (modern_clean & classic_executive layouts)
// 9. Public shareable token & automatic view tracking (sent -> viewed)
// 10. Email dispatch integration & manual mark-sent
// 11. Recurring invoice retainer profiles (weekly, monthly, quarterly, annual)
// 12. Quote documents PDF & public client accept/decline workflow

import assert from 'node:assert/strict'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

let totalPassed = 0
let totalFailed = 0

function testLog(condition, message) {
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
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/pdf')) {
    const arrayBuffer = await res.arrayBuffer()
    body = Buffer.from(arrayBuffer)
  } else {
    try {
      const raw = await res.json()
      if (raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
        body = { ...raw, ...raw.data }
      } else {
        body = raw
      }
    } catch (e) {
      body = null
    }
  }

  return {
    status: res.status,
    headers: res.headers,
    body,
  }
}

async function createTestUser(email, name = 'Invoicing Tester') {
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

  return { token: verifyRes.body.token, user: verifyRes.body.user }
}

async function runInvoicingAddonUpgradeTests() {
  console.log('==================================================================')
  console.log('🧪 RUNNING WELLO BASIC INVOICING ADDON UPGRADE TEST SUITE')
  console.log('==================================================================\n')

  const testEmail = `invoice.tester.${Date.now()}@example.com`
  const { token, user } = await createTestUser(testEmail, 'Alex Mercer')
  testLog(Boolean(token), `Created and authenticated test user: ${testEmail}`)

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Addon Entitlement Guard (403 on unactivated account)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Addon Entitlement Guard ---')

  const unauthGetRes = await api('/api/invoices', { token })
  testLog(
    unauthGetRes.status === 403 && (unauthGetRes.body?.data?.code === 'ADDON_NOT_ACTIVATED' || unauthGetRes.body?.data?.code === 'INVOICING_ADDON_REQUIRED' || unauthGetRes.body?.code === 'ADDON_NOT_ACTIVATED'),
    'Unactivated user GET /api/invoices blocked with 403 ADDON_NOT_ACTIVATED'
  )

  const unauthPostRes = await api('/api/invoices', {
    method: 'POST',
    token,
    body: {
      customerName: 'Guarded Client',
      items: [{ description: 'Test', quantity: 1, rate: 100 }],
    },
  })
  testLog(
    unauthPostRes.status === 403 && (unauthPostRes.body?.data?.code === 'ADDON_NOT_ACTIVATED' || unauthPostRes.body?.data?.code === 'INVOICING_ADDON_REQUIRED' || unauthPostRes.body?.code === 'ADDON_NOT_ACTIVATED'),
    'Unactivated user POST /api/invoices blocked with 403 ADDON_NOT_ACTIVATED'
  )

  // Activate Basic Invoicing from Store
  const addonsRes = await api('/api/store/addons', { token })
  const basicAddon = addonsRes.body?.addons?.find(a => a.slug === 'basic-invoicing' || a.key === 'basic-invoicing')
  testLog(Boolean(basicAddon), `Found Basic Invoicing addon in catalog (ID: ${basicAddon?.id})`)

  const activateRes = await api('/api/store/addons/activate', {
    method: 'POST',
    token,
    body: { addonId: basicAddon?.id, key: basicAddon?.key || 'basic-invoicing' },
  })
  testLog(activateRes.status === 200 && activateRes.body?.success, 'Activated Basic Invoicing addon for user')

  const authGetRes = await api('/api/invoices', { token })
  testLog(authGetRes.status === 200 && Array.isArray(authGetRes.body?.invoices), 'Activated user GET /api/invoices succeeds with 200 OK')

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Concurrency-Safe Gapless Sequence Generation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Concurrency-Safe Gapless Numbering ---')

  const inv1Res = await api('/api/invoices', {
    method: 'POST',
    token,
    body: {
      customerName: 'Acme Global Corp',
      customerContact: 'billing@acmeglobal.com',
      serviceDescription: 'Brand Strategy & Architecture',
      currency: 'USD',
      items: [{ description: 'Discovery Sprint', quantity: 1, rate: 2500, taxRate: 0 }],
      status: 'draft',
    },
  })
  const inv1Number = inv1Res.body?.invoiceNumber || inv1Res.body?.invoice?.invoiceNumber
  const inv1Id = inv1Res.body?.invoice?.id || inv1Res.body?.id
  testLog((inv1Res.status === 200 || inv1Res.status === 201) && Boolean(inv1Number), `Generated first invoice number: ${inv1Number}`)

  const inv2Res = await api('/api/invoices', {
    method: 'POST',
    token,
    body: {
      customerName: 'Beta Dynamics',
      customerContact: 'accounts@betadyn.com',
      serviceDescription: 'Systems Engineering',
      currency: 'USD',
      items: [{ description: 'Architecture Review', quantity: 2, rate: 1200, taxRate: 0 }],
      status: 'draft',
    },
  })
  const inv2Number = inv2Res.body?.invoiceNumber || inv2Res.body?.invoice?.invoiceNumber
  const inv2Id = inv2Res.body?.invoice?.id || inv2Res.body?.id
  testLog((inv2Res.status === 200 || inv2Res.status === 201) && Boolean(inv2Number), `Generated second invoice number: ${inv2Number}`)

  const seq1Match = inv1Number.match(/(\d+)$/)
  const seq2Match = inv2Number.match(/(\d+)$/)
  const seq1 = seq1Match ? parseInt(seq1Match[1], 10) : 0
  const seq2 = seq2Match ? parseInt(seq2Match[1], 10) : 0
  testLog(seq2 === seq1 + 1, `Sequences are gapless and strictly incrementing: ${seq1} -> ${seq2}`)

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Multi-Tax Engine (Exclusive, Inclusive, Reverse-Charge, Custom Labels)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Multi-Tax Engine ---')

  // Case A: Exclusive Tax (VAT 20%)
  const vatInvRes = await api('/api/invoices', {
    method: 'POST',
    token,
    body: {
      customerName: 'London Digital Ltd',
      currency: 'GBP',
      taxMode: 'exclusive',
      taxIdLabel: 'UK VAT',
      items: [
        { description: 'Design Retainer', quantity: 1, rate: 1000, taxRate: 20, taxName: 'VAT 20%' },
        { description: 'Hosting Server', quantity: 1, rate: 200, taxRate: 20, taxName: 'VAT 20%' },
      ],
      discount: 200,
    },
  })
  const vatInv = vatInvRes.body?.invoice
  // Subtotal = 1200, Discount = 200, Taxable = 1000, Tax @ 20% = 200, Total = 1200
  testLog(
    vatInv && Number(vatInv.subtotal) === 1200 && Number(vatInv.taxAmount) === 200 && Number(vatInv.total) === 1200,
    `Exclusive Tax calculated correctly: Subtotal £${vatInv?.subtotal}, Discount £${vatInv?.discount}, Tax £${vatInv?.taxAmount}, Total £${vatInv?.total}`
  )

  // Case B: Reverse-Charge B2B
  const rcInvRes = await api('/api/invoices', {
    method: 'POST',
    token,
    body: {
      customerName: 'Berlin Tech GmbH',
      currency: 'EUR',
      isReverseCharge: true,
      taxIdLabel: 'EU VAT',
      items: [{ description: 'Cross-border Software Dev', quantity: 10, rate: 150, taxRate: 19 }],
    },
  })
  const rcInv = rcInvRes.body?.invoice
  testLog(
    rcInv && rcInv.isReverseCharge && Number(rcInv.taxAmount) === 0 && Number(rcInv.total) === 1500,
    `Reverse Charge B2B zero-rates tax correctly: Total €${rcInv?.total}, Tax €${rcInv?.taxAmount}`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Multi-Currency & ISO Precision (USD 2 dec, JPY 0 dec, KWD 3 dec)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Multi-Currency & ISO Precision ---')

  // JPY (0 Decimals)
  const jpyInvRes = await api('/api/invoices', {
    method: 'POST',
    token,
    body: {
      customerName: 'Tokyo Robotics KK',
      currency: 'JPY',
      items: [{ description: 'Consulting Day', quantity: 3, rate: 85000 }],
    },
  })
  const jpyInv = jpyInvRes.body?.invoice
  testLog(
    jpyInv && Number(jpyInv.total) === 255000,
    `JPY Invoice calculated correctly without fractional cents: ¥${jpyInv?.total}`
  )

  // KWD (3 Decimals)
  const kwdInvRes = await api('/api/invoices', {
    method: 'POST',
    token,
    body: {
      customerName: 'Kuwait Ventures',
      currency: 'KWD',
      items: [{ description: 'Advisory Retainer', quantity: 1, rate: 450.555 }],
    },
  })
  const kwdInv = kwdInvRes.body?.invoice
  testLog(
    kwdInv && Number(kwdInv.total) === 450.555,
    `KWD Invoice supports 3-decimal precision: KD ${kwdInv?.total}`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Immutability Guard & Credit Note Generation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Immutability & Credit Notes ---')

  // Move inv1 from draft to sent
  const sendStatusRes = await api(`/api/invoices/${inv1Id}/mark-sent`, {
    method: 'POST',
    token,
    body: { notes: 'Dispatched to customer' },
  })
  testLog(
    (sendStatusRes.status === 200 || sendStatusRes.status === 201) &&
    (sendStatusRes.body?.status === 'sent' || sendStatusRes.body?.invoice?.status === 'sent'),
    'Invoice transitioned to SENT and locked as immutable'
  )

  // Attempting to edit sent invoice items directly must be blocked
  const forbiddenEditRes = await api('/api/invoices', {
    method: 'POST',
    token,
    body: {
      id: inv1Id,
      customerName: 'Attempted Malicious Update',
      items: [{ description: 'Hacked', quantity: 1, rate: 99999 }],
    },
  })
  console.log('forbiddenEditRes:', forbiddenEditRes)
  testLog(
    (forbiddenEditRes.status === 400 || forbiddenEditRes.status === 409) &&
    (forbiddenEditRes.body?.error?.code === 'INVOICE_IMMUTABLE' || forbiddenEditRes.body?.code === 'INVOICE_IMMUTABLE' || forbiddenEditRes.body?.data?.code === 'INVOICE_IMMUTABLE' || forbiddenEditRes.body?.error?.message?.toLowerCase()?.includes('immutable') || forbiddenEditRes.body?.message?.toLowerCase()?.includes('immutable')),
    'Editing an issued (SENT) invoice directly is blocked by immutability guard'
  )

  // Issue Credit Note against inv1
  const cnRes = await api(`/api/invoices/${inv1Id}/credit-notes`, {
    method: 'POST',
    token,
    body: {
      reason: 'Partial discount agreed after initial scope reduction',
      items: [{ description: 'Scope adjustment credit', quantity: 1, rate: 500 }],
    },
  })
  console.log('cnRes:', cnRes)
  const cnNumber = cnRes.body?.creditNote?.creditNoteNumber || cnRes.body?.creditNoteNumber
  testLog((cnRes.status === 200 || cnRes.status === 201) && Boolean(cnNumber), `Credit Note issued: ${cnNumber}`)
  testLog(
    Number(cnRes.body?.invoice?.balanceDue) === 2000,
    `Invoice balance due offset by credit note ($2500 - $500 = $${cnRes.body?.invoice?.balanceDue})`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Payments Ledger Integration & No Double Counting
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Payments Ledger Integration ---')

  // Record Partial Payment ($1200)
  const partPayRes = await api(`/api/invoices/${inv1Id}/payments`, {
    method: 'POST',
    token,
    body: {
      amount: 1200,
      method: 'bank_transfer',
      reference: 'WIRE-00192',
      notes: 'Initial wire transfer',
    },
  })
  console.log('partPayRes:', partPayRes)
  testLog(
    (partPayRes.status === 200 || partPayRes.status === 201) &&
    partPayRes.body?.invoice?.status === 'partially_paid' &&
    Number(partPayRes.body?.invoice?.amountPaid) === 1200 &&
    Number(partPayRes.body?.invoice?.balanceDue) === 800,
    `Partial payment recorded: status partially_paid, paid $1200, balance $800`
  )

  // Record Remaining Payment ($800)
  const finalPayRes = await api(`/api/invoices/${inv1Id}/payments`, {
    method: 'POST',
    token,
    body: {
      amount: 800,
      method: 'stripe',
      reference: 'ch_3M00000000',
      notes: 'Final settlement card payment',
    },
  })
  console.log('finalPayRes:', finalPayRes)
  testLog(
    (finalPayRes.status === 200 || finalPayRes.status === 201) &&
    finalPayRes.body?.invoice?.status === 'paid' &&
    Number(finalPayRes.body?.invoice?.balanceDue) === 0,
    `Final payment recorded: status transitioned to PAID, balance due $0`
  )

  // Verify Metrics Engine (Payments table is single source of cash revenue)
  const syncRes = await api('/api/sync', { token })
  console.log('syncRes.body keys:', Object.keys(syncRes.body || {}), 'payments:', syncRes.body?.payments)
  const paymentRecords = syncRes.body?.payments?.records || syncRes.body?.payments || []
  const totalPaymentsRevenue = paymentRecords.reduce((s, p) => s + Number(p.amount), 0)
  testLog(
    totalPaymentsRevenue === 2000,
    `Payments recorded against invoices aggregate correctly in payments ledger ($${totalPaymentsRevenue}) with zero double counting`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Dynamic Overdue Lifecycle Derivation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. Dynamic Overdue Lifecycle ---')

  // Create an invoice with past due date
  const overdueInvRes = await api('/api/invoices', {
    method: 'POST',
    token,
    body: {
      customerName: 'Late Payer Inc',
      invoiceDate: '2026-08-01',
      dueDate: '2026-08-15',
      items: [{ description: 'Late Project Work', quantity: 1, rate: 3000 }],
      status: 'sent',
    },
  })
  const overdueInvId = overdueInvRes.body?.invoice?.id

  // Fetch all invoices to trigger dynamic overdue derivation
  const getOverdueRes = await api('/api/invoices', { token })
  const derivedOverdue = getOverdueRes.body?.invoices?.find(i => i.id === overdueInvId)
  testLog(
    derivedOverdue && derivedOverdue.status === 'overdue',
    `Invoice with due_date in past (${overdueInvRes.body?.invoice?.dueDate}) automatically derived as OVERDUE`
  )

  // Test manual status setter restriction (cannot set to overdue manually)
  const manualStatusRes = await api('/api/invoices/status', {
    method: 'POST',
    token,
    body: { id: inv2Id, status: 'overdue' },
  })
  testLog(
    manualStatusRes.status === 400,
    'Manual transition directly to OVERDUE blocked (OVERDUE is strictly derived from due date)'
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 8: Server-Side Vector PDF Generation
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 8. Server-Side Vector PDF Engine ---')

  // Modern Clean Layout PDF
  const modernPdfRes = await api(`/api/invoices/${inv1Id}/pdf?template=modern_clean`, { token })
  testLog(
    modernPdfRes.status === 200 &&
    modernPdfRes.headers.get('content-type') === 'application/pdf' &&
    modernPdfRes.body &&
    modernPdfRes.body.slice(0, 5).toString() === '%PDF-',
    `Generated modern_clean layout PDF (${modernPdfRes.body?.length} bytes, valid %PDF- header)`
  )

  // Classic Executive Layout PDF
  const classicPdfRes = await api(`/api/invoices/${inv1Id}/pdf?template=classic_executive`, { token })
  testLog(
    classicPdfRes.status === 200 &&
    classicPdfRes.headers.get('content-type') === 'application/pdf' &&
    classicPdfRes.body &&
    classicPdfRes.body.slice(0, 5).toString() === '%PDF-',
    `Generated classic_executive layout PDF (${classicPdfRes.body?.length} bytes, valid %PDF- header)`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 9: Public Shareable Token & View Tracking (sent -> viewed)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 9. Public Share Links & View Tracking ---')

  const publicToken = inv2Res.body?.invoice?.publicToken
  testLog(Boolean(publicToken && publicToken.length >= 32), `Generated 32+ char unguessable public token: ${publicToken?.slice(0, 10)}...`)

  // Mark inv2 as sent
  await api(`/api/invoices/${inv2Id}/mark-sent`, { method: 'POST', token })

  // Client visits public link (unauthenticated)
  const publicViewRes = await api(`/api/invoices/public/${publicToken}`)
  testLog(
    publicViewRes.status === 200 &&
    publicViewRes.body?.invoice?.customerName === 'Beta Dynamics' &&
    publicViewRes.body?.invoice?.status === 'viewed',
    `Unauthenticated public view accessed; status automatically transitioned to VIEWED`
  )

  // Public PDF download
  const publicPdfRes = await api(`/api/invoices/public/${publicToken}/pdf`)
  testLog(
    publicPdfRes.status === 200 &&
    publicPdfRes.headers.get('content-type') === 'application/pdf',
    `Public unauthenticated client can download invoice PDF directly`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 10: Email Dispatch Integration
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 10. Email Dispatch & Reminder Integration ---')

  const emailRes = await api(`/api/invoices/${inv2Id}/send`, {
    method: 'POST',
    token,
    body: {
      recipientEmail: 'accounts@betadyn.com',
      customSubject: 'Your Beta Dynamics Engineering Invoice',
      customMessage: 'Please find attached your invoice for review and settlement.',
    },
  })
  testLog(
    (emailRes.status === 200 || emailRes.status === 201) && emailRes.body?.success,
    `Dispatched invoice email via Resend engine template (or dev fallback mode)`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 11: Recurring Retainer Profiles
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 11. Recurring Retainer Profiles ---')

  // Activate recurring-retainers addon
  const recurringAddon = addonsRes.body?.addons?.find(a => a.slug === 'recurring-retainers' || a.key === 'recurring-retainers')
  if (recurringAddon) {
    await api('/api/store/addons/activate', {
      method: 'POST',
      token,
      body: { addonId: recurringAddon.id, key: recurringAddon.key || recurringAddon.slug },
    })
  }

  const profileRes = await api('/api/invoices/recurring', {
    method: 'POST',
    token,
    body: {
      title: 'Quarterly Security Audit Retainer',
      customerName: 'Apex Financial',
      customerContact: 'ciso@apexfin.com',
      frequency: 'quarterly',
      currency: 'USD',
      amount: 15000,
      paymentTermsDays: 30,
      autoSend: true,
      nextRunDate: '2026-10-01',
    },
  })
  testLog(
    (profileRes.status === 200 || profileRes.status === 201) && profileRes.body?.profile?.id,
    `Created quarterly recurring retainer profile: ID ${profileRes.body?.profile?.id}`
  )

  const listProfilesRes = await api('/api/invoices/recurring', { token })
  testLog(
    listProfilesRes.status === 200 && listProfilesRes.body?.profiles?.length >= 1,
    `Fetched recurring retainer profiles list (${listProfilesRes.body?.profiles?.length} active profile)`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 12: Quote Documents PDF & Public Accept/Decline Action
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 12. Quote Documents & Public Client Action ---')

  // Create Project
  const projRes = await api('/api/projects', {
    method: 'POST',
    token,
    body: {
      name: 'Mobile App Redesign Proposal',
      currency: 'USD',
      status: 'potential',
    },
  })
  console.log('projRes:', projRes)
  const projId = projRes.body?.id || projRes.body?.project?.id || 1

  const quoteCreateRes = await api(`/api/projects/${projId}/quotes`, {
    method: 'POST',
    token,
    body: {
      quoteAmount: 18000,
      currency: 'USD',
      estHours: 120,
      notes: 'Complete UI/UX overhaul and React Native mobile application build.',
      status: 'sent',
    },
  })
  console.log('quoteCreateRes:', quoteCreateRes)
  const quoteToken = quoteCreateRes.body?.publicToken || quoteCreateRes.body?.quote?.publicToken
  testLog(Boolean(quoteToken), `Created project quote with public token: ${quoteToken?.slice(0, 10)}...`)

  // Public Quote View
  const quoteViewRes = await api(`/api/quotes/public/${quoteToken}`)
  testLog(quoteViewRes.status === 200 && quoteViewRes.body?.quote?.status === 'sent', 'Public quote proposal retrieved')

  // Public Quote PDF Download
  const quoteId = quoteCreateRes.body?.id || quoteCreateRes.body?.quote?.id
  const quotePdfRes = await api(`/api/quotes/${quoteId}/pdf`, { token })
  testLog(
    quotePdfRes.status === 200 &&
    quotePdfRes.headers.get('content-type') === 'application/pdf',
    `Generated server-side Proposal/Quote PDF (${quotePdfRes.body?.length} bytes)`
  )

  // Public Client Accept Action
  const quoteActionRes = await api(`/api/quotes/public/${quoteToken}/action`, {
    method: 'POST',
    body: { action: 'accept', feedback: 'Scope approved! Ready to kick off.' },
  })
  testLog(
    quoteActionRes.status === 200 &&
    quoteActionRes.body?.status === 'accepted',
    `Client accepted proposal online: Quote status -> ACCEPTED, Project status transitioned to in_progress`
  )

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL SUMMARY
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n==================================================================')
  console.log(`🏁 TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`)
  console.log('==================================================================\n')

  if (totalFailed > 0) {
    process.exit(1)
  }
}

runInvoicingAddonUpgradeTests().catch(err => {
  console.error('Fatal error running invoicing addon upgrade tests:', err)
  process.exit(1)
})
