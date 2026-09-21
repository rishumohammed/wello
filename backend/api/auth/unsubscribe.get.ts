// backend/api/auth/unsubscribe.get.ts
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { getDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token.trim() : ''
  const db = getDb()

  if (!token) {
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    return `
      <!DOCTYPE html>
      <html>
        <head><title>Unsubscribe — Wello</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F9FAFB; padding: 40px 20px; text-align: center;">
          <div style="max-width: 480px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 12px; border: 1px solid #E5E7EB;">
            <h2 style="color: #DC2626;">Invalid Unsubscribe Link</h2>
            <p style="color: #4B5563;">The unsubscribe link is missing or invalid. You can manage your preferences directly inside Wello Settings.</p>
            <a href="/" style="display: inline-block; margin-top: 16px; background: #6366F1; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600;">Go to Wello</a>
          </div>
        </body>
      </html>
    `
  }

  // Find user by unsubscribe_token or id
  let user = await db('users').where({ unsubscribe_token: token }).first()
  if (!user && !isNaN(Number(token))) {
    user = await db('users').where({ id: Number(token) }).first()
  }

  if (!user) {
    setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    return `
      <!DOCTYPE html>
      <html>
        <head><title>Unsubscribe — Wello</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F9FAFB; padding: 40px 20px; text-align: center;">
          <div style="max-width: 480px; margin: 0 auto; background: #fff; padding: 32px; border-radius: 12px; border: 1px solid #E5E7EB;">
            <h2 style="color: #DC2626;">User Not Found</h2>
            <p style="color: #4B5563;">Could not locate a user account associated with this unsubscribe link.</p>
            <a href="/" style="display: inline-block; margin-top: 16px; background: #6366F1; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-weight: 600;">Go to Wello</a>
          </div>
        </body>
      </html>
    `
  }

  // Mark unsubscribed
  await db('users').where({ id: user.id }).update({
    email_unsubscribed_at: db.fn.now(3),
    digest_frequency: 'disabled',
    updated_at: db.fn.now(3),
  })

  // Disable email channels in notification_preferences
  await db('notification_preferences')
    .where({ user_id: user.id, channel: 'email' })
    .update({ is_enabled: false, updated_at: db.fn.now(3) })

  const acceptsJson = (event.node?.req?.headers['accept'] || '').includes('application/json') || query.format === 'json'
  if (acceptsJson) {
    return {
      success: true,
      data: {
        email: user.email,
        unsubscribed: true,
        message: 'Successfully unsubscribed from email digests.',
      },
    }
  }

  setHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  return `
    <!DOCTYPE html>
    <html>
      <head><title>Unsubscribed Successfully — Wello</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F9FAFB; padding: 40px 20px; text-align: center;">
        <div style="max-width: 480px; margin: 0 auto; background: #fff; padding: 36px 24px; border-radius: 12px; border: 1px solid #E5E7EB; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="background: #10B981; color: #fff; width: 48px; height: 48px; border-radius: 50%; font-size: 24px; line-height: 48px; margin: 0 auto 16px auto;">✓</div>
          <h2 style="color: #111827; margin: 0 0 8px 0; font-size: 20px;">You Have Been Unsubscribed</h2>
          <p style="color: #4B5563; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
            <strong>${user.email}</strong> will no longer receive weekly digests or marketing updates from Wello.
          </p>
          <p style="font-size: 13px; color: #6B7280; margin: 0 0 24px 0;">
            You can re-enable or fine-tune your notification preferences at any time in your Settings.
          </p>
          <a href="/settings" style="display: inline-block; background: #6366F1; color: #fff; text-decoration: none; padding: 11px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">Manage Notification Settings</a>
        </div>
      </body>
    </html>
  `
})
