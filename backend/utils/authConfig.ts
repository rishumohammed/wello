// server/utils/authConfig.ts
// Shared server-side store for Resend configuration, OTP verification, and auth activity logs

export interface ResendConfig {
  apiKey: string
  fromEmail: string
  fromName: string
  otpExpiryMinutes: number
  requireOtp: boolean
  devMode: boolean
}

export interface OtpRecord {
  email: string
  code: string
  type: 'login' | 'register'
  name?: string
  expiresAt: number
  attempts: number
  createdAt: number
}

export interface AuthLog {
  id: string
  timestamp: string
  type: 'send_otp' | 'verify_otp' | 'login_success' | 'register_success' | 'verify_failed' | 'test_email'
  email: string
  status: 'success' | 'failed' | 'pending'
  details: string
  providerResponse?: any
}

export interface RegisteredUser {
  id: string
  name: string
  email: string
  avatarInitials: string
  targetHourly: number
  currencyCode: string
  timezone: string
  countryCode?: string
  role: 'user' | 'admin'
  serviceCategory?: string
  createdAt: string
  lastLoginAt: string
}

// Global server in-memory storage (persists across requests during server runtime)
const globalConfig: ResendConfig = {
  apiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  fromName: process.env.RESEND_FROM_NAME || 'Wello',
  otpExpiryMinutes: 10,
  requireOtp: true,
  devMode: true,
}

const otpStore = new Map<string, OtpRecord>()
const authLogs: AuthLog[] = []
const registeredUsers = new Map<string, RegisteredUser>()

// Seed initial demo user (standard user) and dedicated admin user
registeredUsers.set('rahul@mehtatech.in', {
  id: 'u1',
  name: 'Rahul Mehta',
  email: 'rahul@mehtatech.in',
  avatarInitials: 'RM',
  targetHourly: 350,
  currencyCode: 'USD',
  timezone: 'UTC',
  countryCode: 'US',
  role: 'user',
  serviceCategory: 'Independent Professional',
  createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  lastLoginAt: new Date().toISOString(),
})

registeredUsers.set('admin@wello.com', {
  id: 'u_admin',
  name: 'System Admin',
  email: 'admin@wello.com',
  avatarInitials: 'SA',
  targetHourly: 500,
  currencyCode: 'USD',
  timezone: 'UTC',
  countryCode: 'US',
  role: 'admin',
  serviceCategory: 'System Administrator',
  createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  lastLoginAt: new Date().toISOString(),
})

export function getResendConfig(): ResendConfig {
  return { ...globalConfig }
}

export function updateResendConfig(newConfig: Partial<ResendConfig>): ResendConfig {
  if (newConfig.apiKey !== undefined) globalConfig.apiKey = newConfig.apiKey.trim()
  if (newConfig.fromEmail !== undefined) globalConfig.fromEmail = newConfig.fromEmail.trim()
  if (newConfig.fromName !== undefined) globalConfig.fromName = newConfig.fromName.trim()
  if (newConfig.otpExpiryMinutes !== undefined) globalConfig.otpExpiryMinutes = Number(newConfig.otpExpiryMinutes) || 10
  if (newConfig.requireOtp !== undefined) globalConfig.requireOtp = Boolean(newConfig.requireOtp)
  if (newConfig.devMode !== undefined) globalConfig.devMode = Boolean(newConfig.devMode)
  return getResendConfig()
}

export function createOtp(email: string, type: 'login' | 'register', name?: string): OtpRecord {
  const normalizedEmail = email.toLowerCase().trim()
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + globalConfig.otpExpiryMinutes * 60 * 1000

  const record: OtpRecord = {
    email: normalizedEmail,
    code,
    type,
    name,
    expiresAt,
    attempts: 0,
    createdAt: Date.now(),
  }

  otpStore.set(normalizedEmail, record)
  return record
}

export function getOtp(email: string): OtpRecord | null {
  const normalizedEmail = email.toLowerCase().trim()
  const record = otpStore.get(normalizedEmail)
  if (!record) return null
  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail)
    return null
  }
  return record
}

export function verifyOtpCode(email: string, code: string): { valid: boolean; error?: string; record?: OtpRecord } {
  const normalizedEmail = email.toLowerCase().trim()
  const record = otpStore.get(normalizedEmail)

  if (!record) {
    return { valid: false, error: 'No active OTP found. Please request a new code.' }
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(normalizedEmail)
    return { valid: false, error: 'Verification code has expired. Please request a new one.' }
  }

  record.attempts++
  if (record.attempts > 5) {
    otpStore.delete(normalizedEmail)
    return { valid: false, error: 'Too many incorrect attempts. Please request a new code.' }
  }

  if (record.code !== code.trim()) {
    return { valid: false, error: 'Incorrect 6-digit code. Please check and try again.' }
  }

  // Valid OTP -> remove from store to prevent reuse
  otpStore.delete(normalizedEmail)
  return { valid: true, record }
}

function redactSecrets(text: string): string {
  if (!text) return ''
  // Mask 6-digit codes
  return text
    .replace(/\b\d{6}\b/g, '••••••')
    .replace(/re_[a-zA-Z0-9_-]{20,}/g, 're_••••••••••••••••')
    .replace(/bearer\s+[a-zA-Z0-9_.-]+/gi, 'Bearer ••••••••')
}

export function logAuthEvent(event: Omit<AuthLog, 'id' | 'timestamp'>) {
  const log: AuthLog = {
    id: 'log_' + Math.random().toString(36).slice(2, 9),
    timestamp: new Date().toISOString(),
    ...event,
    details: redactSecrets(event.details || ''),
  }
  authLogs.unshift(log)
  if (authLogs.length > 200) authLogs.pop() // keep last 200 logs
  return log
}

export function getAuthLogs(): AuthLog[] {
  return authLogs.map(l => ({
    ...l,
    details: redactSecrets(l.details),
  }))
}

export function getOrCreateUser(email: string, name?: string, serviceCategory?: string, currencyCode?: string, timezone?: string, countryCode?: string): RegisteredUser {
  const normalizedEmail = email.toLowerCase().trim()
  let user = registeredUsers.get(normalizedEmail)

  if (!user) {
    const formattedName = name || normalizedEmail.split('@')[0]
    const initials = formattedName
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'WE'

    user = {
      id: 'u_' + Math.random().toString(36).slice(2, 9),
      name: formattedName,
      email: normalizedEmail,
      avatarInitials: initials,
      targetHourly: 350,
      currencyCode: (currencyCode || 'USD').toUpperCase().trim().slice(0, 3),
      timezone: timezone || 'UTC',
      countryCode: countryCode ? countryCode.toUpperCase().trim().slice(0, 2) : undefined,
      role: (normalizedEmail.includes('admin') || registeredUsers.size === 0) ? 'admin' : 'user',
      serviceCategory: serviceCategory || 'Independent Professional',
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    }
    registeredUsers.set(normalizedEmail, user)
  } else {
    user.lastLoginAt = new Date().toISOString()
    if (name) user.name = name
    if (serviceCategory) user.serviceCategory = serviceCategory
    if (currencyCode) user.currencyCode = currencyCode.toUpperCase().trim().slice(0, 3)
    if (timezone) user.timezone = timezone
    if (countryCode) user.countryCode = countryCode.toUpperCase().trim().slice(0, 2)
  }

  return user
}

export function getAllUsers(): RegisteredUser[] {
  return Array.from(registeredUsers.values()).sort((a, b) => new Date(b.lastLoginAt).getTime() - new Date(a.lastLoginAt).getTime())
}

// ─── Branded HTML Email Template Generator ───────────────────────────────────

export function generateOtpEmailHtml(otpCode: string, recipientName: string = 'Professional'): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Wello Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F8FAFC; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="520px" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);">
          <!-- Brand Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #F1F5F9;">
              <div style="display: inline-block;">
                <span style="font-size: 28px; font-weight: 800; background: linear-gradient(135deg, #FF9F1C 0%, #FF387D 50%, #7A3FF6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #7A3FF6; letter-spacing: -0.5px;">Wello</span>
              </div>
              <div style="font-size: 12px; color: #64748B; font-weight: 500; margin-top: 4px; letter-spacing: 0.02em;">Work Value & Income Management</div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #0F172A;">Your Verification Code</h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                Hello <strong>${recipientName}</strong>,<br>
                Use the 6-digit one-time code below to authenticate into your Wello account.
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center" style="background-color: #F8FAFC; border: 2px dashed #CBD5E1; border-radius: 12px; padding: 24px;">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #7A3FF6; margin-left: 8px;">
                      ${otpCode}
                    </div>
                    <div style="font-size: 12px; color: #64748B; font-weight: 500; margin-top: 8px;">
                      Valid for <strong>${globalConfig.otpExpiryMinutes} minutes</strong> · Do not share this code
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748B; line-height: 1.5;">
                If you did not request this verification code, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #F8FAFC; border-top: 1px solid #F1F5F9; text-align: center;">
              <div style="font-size: 11px; color: #94A3B8;">
                &copy; ${new Date().getFullYear()} Wello · The Work Value Command Center
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

// ─── Resend REST API Client ──────────────────────────────────────────────────

export async function sendEmailViaResend(options: {
  to: string
  subject: string
  html: string
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const config = getResendConfig()

  if (!config.apiKey) {
    // No API key configured
    return {
      success: false,
      error: 'Resend API key is not configured. Please enter your API key in the Admin Panel.',
    }
  }

  const fromField = `${config.fromName} <${config.fromEmail}>`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromField,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `Resend API returned status ${response.status}`
      return { success: false, error: errorMsg, data }
    }

    return { success: true, data }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while contacting Resend REST API',
    }
  }
}
