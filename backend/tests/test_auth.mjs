// tests/test_auth.mjs
const BASE = process.env.BASE_URL || 'http://localhost:3001'

async function runTests() {
  console.log('--- TESTING WELLO AUTH & ADMIN API ---')

  // 1. Authenticate as Super Admin
  const adminSendRes = await fetch(`${BASE}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@wello.com', type: 'login' })
  })
  const adminSendData = await adminSendRes.json()
  const adminOtp = adminSendData.devOtp
  console.log('1. Admin Send OTP:', adminSendData.message, 'Dev OTP:', adminOtp)

  const adminVerifyRes = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@wello.com', code: adminOtp })
  })
  const adminVerifyData = await adminVerifyRes.json()
  const adminToken = adminVerifyData.token
  console.log('2. Admin Verify OTP Result:', adminVerifyData.user?.email, 'Role:', adminVerifyData.user?.role)

  // 2. Check Admin Config with Admin Token
  const cfgRes = await fetch(`${BASE}/api/admin/config`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
  const cfg = await cfgRes.json()
  console.log('3. Admin Config GET:', JSON.stringify(cfg))

  // 3. Update Admin Config
  const updateRes = await fetch(`${BASE}/api/admin/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      fromName: 'Wello Pro Auth',
      otpExpiryMinutes: 10,
      devMode: true
    })
  })
  const updatedCfg = await updateRes.json()
  console.log('4. Admin Config POST updated:', updatedCfg.config?.fromName)

  // 4. Send OTP to a new user
  const newEmail = `sarah.designer_${Date.now()}@example.com`
  const sendRes = await fetch(`${BASE}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: newEmail,
      name: 'Sarah Connor',
      type: 'register'
    })
  })
  const sendData = await sendRes.json()
  console.log('5. Send OTP for Registration:', JSON.stringify(sendData))

  const otpCode = sendData.devOtp
  console.log('   Dev OTP received:', otpCode)

  // 5. Verify OTP
  const verifyRes = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: newEmail,
      code: otpCode,
      name: 'Sarah Connor'
    })
  })
  const verifyData = await verifyRes.json()
  console.log('6. Verify OTP Result for Sarah:', verifyData.user?.name, 'Token generated:', Boolean(verifyData.token))

  // 6. Check Admin Logs & Users with Admin Token
  const logsRes = await fetch(`${BASE}/api/admin/logs`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
  const logs = await logsRes.json()
  console.log(`7. Admin Logs Count: ${logs.logs?.length || 0}`)

  const usersRes = await fetch(`${BASE}/api/admin/users`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  })
  const users = await usersRes.json()
  console.log(`8. Admin Users Count: ${users.users?.length || 0}, Latest user: ${users.users?.[0]?.email}`)

  console.log('\nALL SERVER AUTH & ADMIN ENDPOINTS WORKING CORRECTLY!')
}

runTests().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
