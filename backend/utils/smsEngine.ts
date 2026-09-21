// server/utils/smsEngine.ts
/**
 * Pluggable SMS Provider Engine for Wello
 * Supports Twilio REST API integration with development sandbox fallback
 */

export interface SmsSendOptions {
  to: string // E.164 format (+14155550199)
  body: string
}

export interface SmsSendResult {
  success: boolean
  providerMsgId?: string
  error?: string
}

export interface TwilioConfig {
  accountSid: string
  authToken: string
  fromNumber: string
}

export function getTwilioConfig(): TwilioConfig {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    fromNumber: process.env.TWILIO_PHONE_NUMBER || '',
  }
}

/**
 * Dispatches an SMS message using Twilio REST API or local sandbox mock
 */
export async function sendSmsViaProvider(options: SmsSendOptions): Promise<SmsSendResult> {
  const config = getTwilioConfig()
  const { to, body } = options

  if (!config.accountSid || !config.authToken || !config.fromNumber) {
    // Sandbox / Dev mock mode
    console.log(`[Wello SMS Dev Sandbox] To: ${to} | Message: ${body}`)
    return {
      success: true,
      providerMsgId: `sm_dev_${Math.random().toString(36).slice(2, 9)}`,
    }
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`
    const authHeader = 'Basic ' + Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')

    const params = new URLSearchParams()
    params.append('To', to)
    params.append('From', config.fromNumber)
    params.append('Body', body)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const errorMsg = data?.message || `Twilio dispatch failed with status ${response.status}`
      return { success: false, error: errorMsg }
    }

    return {
      success: true,
      providerMsgId: data?.sid || `sm_${Math.random().toString(36).slice(2, 9)}`,
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error while contacting Twilio SMS API',
    }
  }
}

/**
 * Standard English-only SMS OTP template
 */
export function formatOtpSmsBody(code: string, expiryMinutes: number = 10): string {
  return `Your Wello verification code is: ${code}. Valid for ${expiryMinutes} minutes. Do not share this code.`
}
