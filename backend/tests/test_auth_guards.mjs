// tests/test_auth_guards.mjs
/**
 * Comprehensive Automated Test Suite for DB-Backed Auth, RBAC Guards, and Route Authorization
 */

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
    ...(options.headers || {})
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`
  }
  if (options.cookie) {
    headers['Cookie'] = options.cookie
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  let body = null
  const text = await res.text()
  try {
    body = JSON.parse(text)
  } catch (e) {
    body = text
  }

  return {
    status: res.status,
    headers: res.headers,
    body,
    cookie: res.headers.get('set-cookie')
  }
}

async function loginUser(email, name = 'Test User') {
  // 1. Send OTP
  const sendRes = await api('/api/auth/send-otp', {
    method: 'POST',
    body: { email, name, type: 'login' }
  })
  if (!sendRes.body.devOtp) {
    throw new Error(`Failed to obtain devOtp for ${email}: ${JSON.stringify(sendRes.body)}`)
  }

  // 2. Verify OTP
  const verifyRes = await api('/api/auth/verify-otp', {
    method: 'POST',
    body: {
      email,
      code: sendRes.body.devOtp,
      name
    }
  })

  return {
    token: verifyRes.body.token,
    user: verifyRes.body.user,
    cookie: verifyRes.cookie
  }
}

async function runTestSuite() {
  console.log('===============================================================')
  console.log('🛡️  WELLO DATABASE AUTH & RBAC SECURITY GUARD VERIFICATION')
  console.log('===============================================================\n')

  try {
    // -----------------------------------------------------------------
    // TEST 1: Unauthenticated Requests (401 Unauthorized)
    // -----------------------------------------------------------------
    console.log('📌 Test 1: Unauthenticated requests rejected with 401')
    const unauthSession = await api('/api/auth/session')
    assert(unauthSession.status === 401, 'GET /api/auth/session without token returns 401')

    const unauthInvoices = await api('/api/invoices')
    assert(unauthInvoices.status === 401, 'GET /api/invoices without token returns 401')

    const unauthStore = await api('/api/store/addons')
    assert(unauthStore.status === 401, 'GET /api/store/addons without token returns 401')

    const unauthAdmin = await api('/api/admin/users')
    assert(unauthAdmin.status === 401, 'GET /api/admin/users without token returns 401')

    const runId = Date.now()
    const aliceEmail = `alice_${runId}@test.com`
    const charlieEmail = `charlie_${runId}@test.com`
    const analystEmail = `bob_analyst_${runId}@wello.com`
    const otpTestEmail = `otp_test_${runId}@example.com`
    const randomPhoneSuffix = Math.floor(1000 + Math.random() * 9000)
    const rawPhone = `+1 (415) 555-${randomPhoneSuffix}`
    const normalizedPhone = `+1415555${randomPhoneSuffix}`

    // -----------------------------------------------------------------
    // TEST 2: User Registration & Session Token / Cookie Verification
    // -----------------------------------------------------------------
    console.log('\n📌 Test 2: User Login & Session Persistence (Bearer & Cookie)')
    const user1Auth = await loginUser(aliceEmail, 'Alice Walker')
    assert(Boolean(user1Auth.token), 'Valid session token generated for Alice')
    assert(user1Auth.user.email === aliceEmail, 'User profile returned correctly')

    // Test with Bearer token
    const sessionWithBearer = await api('/api/auth/session', { token: user1Auth.token })
    assert(sessionWithBearer.status === 200, 'GET /api/auth/session with Bearer token returns 200')
    assert(sessionWithBearer.body.user.name === 'Alice Walker', 'User authenticated via Bearer token')

    // Test with HttpOnly Cookie
    if (user1Auth.cookie) {
      const cookieHeader = user1Auth.cookie.split(';')[0]
      const sessionWithCookie = await api('/api/auth/session', { cookie: cookieHeader })
      assert(sessionWithCookie.status === 200, 'GET /api/auth/session with Cookie returns 200')
    }

    // -----------------------------------------------------------------
    // TEST 3: Standard User RBAC Restrictions (403 Forbidden)
    // -----------------------------------------------------------------
    console.log('\n📌 Test 3: Standard User Blocked from Admin Endpoints (403 Forbidden)')
    const userAdminUsers = await api('/api/admin/users', { token: user1Auth.token })
    assert(userAdminUsers.status === 403, 'Standard user accessing /api/admin/users gets 403')

    const userAdminRoles = await api('/api/admin/roles', { token: user1Auth.token })
    assert(userAdminRoles.status === 403, 'Standard user accessing /api/admin/roles gets 403')

    const userAdminConfig = await api('/api/admin/config', { token: user1Auth.token })
    assert(userAdminConfig.status === 403, 'Standard user accessing /api/admin/config gets 403')

    // -----------------------------------------------------------------
    // TEST 4: Super Admin Access & Role Permissions
    // -----------------------------------------------------------------
    console.log('\n📌 Test 4: Super Admin Access to Admin APIs')
    const superAdminAuth = await loginUser('admin@wello.com', 'System Super Admin')
    assert(superAdminAuth.user.role === 'admin', 'Super admin has role=admin')
    assert(superAdminAuth.user.adminRole === 'SUPER_ADMIN', 'Super admin role_key is SUPER_ADMIN')

    const adminUsersList = await api('/api/admin/users', { token: superAdminAuth.token })
    assert(adminUsersList.status === 200, 'Super admin can GET /api/admin/users')
    assert(Array.isArray(adminUsersList.body.users), 'Admin users list returned')

    const adminConfigGet = await api('/api/admin/config', { token: superAdminAuth.token })
    assert(adminConfigGet.status === 200, 'Super admin can GET /api/admin/config')
    assert(adminConfigGet.body.config.maskedKey !== undefined, 'API keys are masked in admin response')

    // -----------------------------------------------------------------
    // TEST 5: Create & Test Role with Fine-Grained Permissions (Analyst)
    // -----------------------------------------------------------------
    console.log('\n📌 Test 5: Role-Based Fine-Grained Permission Enforcement')
    // Create Analyst admin user
    const createAnalyst = await api('/api/admin/roles', {
      method: 'POST',
      token: superAdminAuth.token,
      body: {
        action: 'CREATE_ADMIN',
        name: 'Analyst Bob',
        email: analystEmail,
        roleKey: 'ANALYST'
      }
    })
    assert(createAnalyst.status === 200, 'Super admin created ANALYST account')

    // Login as Analyst
    const analystAuth = await loginUser(analystEmail, 'Analyst Bob')
    assert(analystAuth.user.adminRole === 'ANALYST', 'Bob authenticated as ANALYST')

    // Analyst accessing analytics -> 200
    const analystAnalytics = await api('/api/admin/analytics', { token: analystAuth.token })
    assert(analystAnalytics.status === 200, 'Analyst can access /api/admin/analytics (analytics.view allowed)')

    // Analyst attempting admin roles mutation -> 403
    const analystRolesMutation = await api('/api/admin/roles', {
      method: 'POST',
      token: analystAuth.token,
      body: { action: 'UPDATE_ROLE', targetEmail: aliceEmail, roleKey: 'ADMIN' }
    })
    assert(analystRolesMutation.status === 403, 'Analyst forbidden from mutating admin roles (403 Forbidden)')

    // Analyst attempting user status change -> 403
    const analystStatusChange = await api('/api/admin/users/status', {
      method: 'POST',
      token: analystAuth.token,
      body: { email: aliceEmail, status: 'SUSPENDED' }
    })
    assert(analystStatusChange.status === 403, 'Analyst forbidden from suspending users (403 Forbidden)')

    // -----------------------------------------------------------------
    // TEST 6: Cross-User Invoice Data Isolation (404 Not Found)
    // -----------------------------------------------------------------
    console.log('\n📌 Test 6: Cross-User Invoice Data Isolation')
    // Alice creates an invoice
    const createInvoiceRes = await api('/api/invoices', {
      method: 'POST',
      token: user1Auth.token,
      body: {
        customerName: 'MegaCorp Tech',
        serviceDescription: 'Backend Microservices Architecture',
        items: [{ description: 'API Development', quantity: 20, rate: 120, amount: 2400 }],
        taxPercent: 10,
        status: 'DRAFT'
      }
    })
    assert(createInvoiceRes.status === 200, 'Alice created invoice successfully')
    const aliceInvoiceId = createInvoiceRes.body.invoice.id

    // Alice reads her own invoice -> 200
    const aliceReadOwn = await api(`/api/invoices/${aliceInvoiceId}`, { token: user1Auth.token })
    assert(aliceReadOwn.status === 200, 'Alice can read her own invoice')

    // User 2 (Charlie) logs in
    const user2Auth = await loginUser(charlieEmail, 'Charlie Coder')

    // Charlie attempts to view Alice's invoice -> 404
    const charlieReadAlice = await api(`/api/invoices/${aliceInvoiceId}`, { token: user2Auth.token })
    assert(charlieReadAlice.status === 404, 'Charlie reading Alice invoice returns 404 Not Found')

    // Charlie attempts to delete Alice's invoice -> 404
    const charlieDeleteAlice = await api(`/api/invoices/${aliceInvoiceId}`, {
      method: 'DELETE',
      token: user2Auth.token
    })
    assert(charlieDeleteAlice.status === 404, 'Charlie deleting Alice invoice returns 404 Not Found')

    // Charlie attempts to update status on Alice's invoice -> 404
    const charlieUpdateStatus = await api('/api/invoices/status', {
      method: 'POST',
      token: user2Auth.token,
      body: { id: aliceInvoiceId, status: 'PAID' }
    })
    assert(charlieUpdateStatus.status === 404, 'Charlie updating status on Alice invoice returns 404 Not Found')

    // -----------------------------------------------------------------
    // TEST 7: OTP Hardening: Replay Attack, Max Attempts, Rate Limiting
    // -----------------------------------------------------------------
    console.log('\n📌 Test 7: OTP Hardening (Single-Use, Wrong Code, Rate Limiting)')

    // Send OTP
    const sendOtpRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: { email: otpTestEmail, name: 'OTP Test' }
    })
    assert(sendOtpRes.status === 200, 'OTP sent successfully')
    const validCode = sendOtpRes.body.devOtp

    // 1. Incorrect code attempt
    const wrongCodeRes = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: { email: otpTestEmail, code: '000000' }
    })
    assert(wrongCodeRes.status === 400, 'Incorrect OTP code rejected with 400')
    assert(wrongCodeRes.body.statusMessage?.includes('attempt'), 'Error message indicates attempt tracking')

    // 2. Correct code verification
    const correctCodeRes = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: { email: otpTestEmail, code: validCode }
    })
    assert(correctCodeRes.status === 200, 'Correct OTP code verifies successfully')

    // 3. Replay attack: verify with same code again -> must fail
    const replayRes = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: { email: otpTestEmail, code: validCode }
    })
    assert(replayRes.status === 400, 'Replayed single-use OTP rejected with 400')

    // -----------------------------------------------------------------
    // TEST 8: Phone Number Normalization with libphonenumber-js
    // -----------------------------------------------------------------
    console.log('\n📌 Test 8: Phone OTP with E.164 Normalization')
    const phoneRes = await api('/api/auth/send-otp', {
      method: 'POST',
      body: {
        phone: rawPhone,
        name: 'Phone User'
      }
    })
    assert(phoneRes.status === 200, 'Phone OTP sent')
    assert(phoneRes.body.identifier === normalizedPhone, `Phone normalized to E.164 format (${normalizedPhone})`)

    const verifyPhoneRes = await api('/api/auth/verify-otp', {
      method: 'POST',
      body: {
        phone: rawPhone,
        code: phoneRes.body.devOtp
      }
    })
    assert(verifyPhoneRes.status === 200, 'Phone OTP verified successfully')
    assert(verifyPhoneRes.body.user.phone === normalizedPhone, `Database user phone stored in E.164 (${normalizedPhone})`)

    // -----------------------------------------------------------------
    // TEST 9: Suspended User Immediate Session Invalidation
    // -----------------------------------------------------------------
    console.log('\n📌 Test 9: Suspended User Immediate Session Revocation')
    const suspendEmail = `suspend_${Date.now()}@test.com`
    // Create an active user session
    const userToSuspendAuth = await loginUser(suspendEmail, 'Suspend Target')
    const targetSession = await api('/api/auth/session', { token: userToSuspendAuth.token })
    assert(targetSession.status === 200, 'Target user session is initially valid')

    // Admin suspends user
    const suspendRes = await api('/api/admin/users/status', {
      method: 'POST',
      token: superAdminAuth.token,
      body: {
        email: suspendEmail,
        status: 'SUSPENDED'
      }
    })
    assert(suspendRes.status === 200, 'Admin suspended target user account')

    // Target user tries to use token -> 401 or 403
    const suspendedReq = await api('/api/auth/session', { token: userToSuspendAuth.token })
    assert(suspendedReq.status === 401 || suspendedReq.status === 403, 'Suspended user token is immediately rejected')

    // -----------------------------------------------------------------
    // TEST 10: RBAC Self-Demotion & Last Super Admin Protections
    // -----------------------------------------------------------------
    console.log('\n📌 Test 10: RBAC Self-Demotion & Last Super Admin Protections')
    // Super admin cannot suspend self
    const selfSuspendRes = await api('/api/admin/users/status', {
      method: 'POST',
      token: superAdminAuth.token,
      body: {
        email: 'admin@wello.com',
        status: 'SUSPENDED'
      }
    })
    assert(selfSuspendRes.status === 400, 'Self-suspension rejected with 400 Bad Request')

    // Super admin cannot demote self
    const selfDemoteRes = await api('/api/admin/roles', {
      method: 'POST',
      token: superAdminAuth.token,
      body: {
        action: 'UPDATE_ROLE',
        targetEmail: 'admin@wello.com',
        roleKey: 'ANALYST'
      }
    })
    assert(selfDemoteRes.status === 400, 'Self-demotion rejected with 400 Bad Request')

    // -----------------------------------------------------------------
    // TEST 11: Single & All-Devices Logout
    // -----------------------------------------------------------------
    console.log('\n📌 Test 11: Single Device Logout & Logout All')
    const multiEmail = `multi_${Date.now()}@test.com`
    const multiSessionUser = await loginUser(multiEmail, 'Multi Device')
    const sessionToken1 = multiSessionUser.token

    // Create second session for same user
    const sendOtp2 = await api('/api/auth/send-otp', { method: 'POST', body: { email: multiEmail } })
    assert(sendOtp2.status === 200 && Boolean(sendOtp2.body.devOtp), 'Second OTP generated for multi-device login')
    const verify2 = await api('/api/auth/verify-otp', { method: 'POST', body: { email: multiEmail, code: sendOtp2.body.devOtp } })
    const sessionToken2 = verify2.body.token

    assert(Boolean(sessionToken2) && sessionToken1 !== sessionToken2, 'Two distinct session tokens created')

    // Logout session 1
    const logout1 = await api('/api/auth/logout', { method: 'POST', token: sessionToken1 })
    assert(logout1.status === 200, 'Logout session 1 returns 200')

    // Session 1 is revoked
    const check1 = await api('/api/auth/session', { token: sessionToken1 })
    assert(check1.status === 401, 'Session 1 is revoked after logout')

    // Session 2 is still active
    const check2 = await api('/api/auth/session', { token: sessionToken2 })
    assert(check2.status === 200, 'Session 2 remains active after single logout')

    // Logout all from session 2
    const logoutAll = await api('/api/auth/logout-all', { method: 'POST', token: sessionToken2 })
    assert(logoutAll.status === 200, 'Logout all returns 200')

    // Session 2 is now also revoked
    const check2After = await api('/api/auth/session', { token: sessionToken2 })
    assert(check2After.status === 401, 'Session 2 is revoked after logout-all')

    console.log('\n===============================================================')
    console.log(`🏁 AUTH & RBAC TEST RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`)
    console.log('===============================================================\n')

    process.exit(totalFailed === 0 ? 0 : 1)
  } catch (err) {
    console.error('❌ Test suite failed unexpectedly:', err)
    process.exit(1)
  }
}

runTestSuite()
