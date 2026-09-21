// server/api/admin/test-email.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import {
  sendEmailViaResend,
  logAuthEvent,
  getResendConfig,
} from '../../utils/authConfig'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'email.manage')
  const body = await readBody(event)
  const toEmail = (body?.to || body?.email || '').trim().toLowerCase()

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!toEmail || !emailRegex.test(toEmail)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please provide a valid recipient email address.',
    })
  }

  const config = getResendConfig()
  const timestamp = new Date().toLocaleString()

  const subject = `Wello Resend API Test — ${timestamp}`
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background: #F8FAFC; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #FFF; padding: 32px; border-radius: 12px; border: 1px solid #E2E8F0;">
    <h2 style="color: #7A3FF6; margin-top: 0;">✓ Resend Integration Active!</h2>
    <p style="color: #334155; font-size: 14px; line-height: 1.6;">
      This test message confirms that your Wello application is connected to the Resend REST API.
    </p>
    <div style="background: #F1F5F9; padding: 16px; border-radius: 8px; font-size: 12px; color: #475569;">
      <div><strong>Sender:</strong> ${config.fromName} &lt;${config.fromEmail}&gt;</div>
      <div><strong>Recipient:</strong> ${toEmail}</div>
      <div><strong>Dispatched at:</strong> ${timestamp}</div>
      <div><strong>Status:</strong> HTTP 200 OK</div>
    </div>
    <p style="color: #94A3B8; font-size: 11px; margin-top: 24px; margin-bottom: 0;">
      Wello Work Value & Income Management · System Test
    </p>
  </div>
</body>
</html>
  `

  const result = await sendEmailViaResend({
    to: toEmail,
    subject,
    html,
  })

  logAuthEvent({
    type: 'test_email',
    email: toEmail,
    status: result.success ? 'success' : 'failed',
    details: result.success
      ? `Test email sent successfully to ${toEmail} via Resend REST API.`
      : `Test email failed to ${toEmail}: ${result.error}`,
    providerResponse: result.data || result.error,
  })

  if (!result.success) {
    throw createError({
      statusCode: 422,
      statusMessage: result.error || 'Failed to dispatch test email via Resend API.',
      data: result.data,
    })
  }

  return {
    success: true,
    message: `Test email dispatched successfully to ${toEmail}!`,
    data: result.data,
  }
})
