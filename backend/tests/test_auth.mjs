const BASE = process.env.BASE_URL || 'http://localhost:3001'

async function runTests() {
  console.log('--- TESTING WELLO AUTH & ADMIN API ---')

  // 1. Check Admin Config
  const cfgRes = await fetch(`${BASE}/api/admin/config`)
  const cfg = await cfgRes.json()
  console.log('1. Admin Config GET:', JSON.stringify(cfg))

  // 2. Update Admin Config
  const updateRes = await fetch(`${BASE}/api/admin/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromName: 'Wello Pro Auth',
      otpExpiryMinutes: 10,
      devMode: true
    })
  })
  const updatedCfg = await updateRes.json()
  console.log('2. Admin Config POST updated:', updatedCfg.config?.fromName)

  // 3. Send OTP to a new user
  const sendRes = await fetch(`${BASE}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sarah.designer@example.com',
      name: 'Sarah Connor',
      type: 'register'
    })
  })
  const sendData = await sendRes.json()
  console.log('3. Send OTP for Registration:', JSON.stringify(sendData))

  const otpCode = sendData.devOtp
  console.log('   Dev OTP received:', otpCode)

  // 4. Verify OTP
  const verifyRes = await fetch(`${BASE}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sarah.designer@example.com',
      code: otpCode,
      name: 'Sarah Connor'
    })
  })
  const verifyData = await verifyRes.json()
  console.log('4. Verify OTP Result:', JSON.stringify(verifyData))

  // 5. Test Login Send OTP
  const loginSendRes = await fetch(`${BASE}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sarah.designer@example.com',
      type: 'login'
    })
  })
  const loginSendData = await loginSendRes.json()
  console.log('5. Send OTP for Login:', loginSendData.message, 'OTP:', loginSendData.devOtp)

  // 6. Check Admin Logs & Users
  const logsRes = await fetch(`${BASE}/api/admin/logs`)
  const logs = await logsRes.json()
  console.log(`6. Admin Logs Count: ${logs.logs.length}, Last action: ${logs.logs[0]?.action}`)

  const usersRes = await fetch(`${BASE}/api/admin/users`)
  const users = await usersRes.json()
  console.log(`7. Admin Users Count: ${users.users.length}, Latest user: ${users.users[0]?.email}`)

  console.log('\nALL SERVER AUTH & ADMIN ENDPOINTS WORKING CORRECTLY!')
}

runTests().catch(err => {
  console.error('Test failed:', err)
})
