// backend/api/webhooks/resend.post.ts
import { defineEventHandler, readBody } from 'h3'
import { getDb } from '../../utils/authService'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body) return { received: true }

  const db = getDb()
  const eventType = body.type // 'email.delivered', 'email.opened', 'email.bounced', 'email.complained'
  const data = body.data || {}
  const emailId = data.email_id || data.id

  if (!emailId) {
    return { received: true, processed: false, reason: 'missing_email_id' }
  }

  const updates: Record<string, any> = {
    updated_at: new Date(),
  }

  const now = new Date(data.created_at || Date.now())

  if (eventType === 'email.delivered') {
    updates.delivered_at = now
    updates.status = 'DELIVERED'
  } else if (eventType === 'email.opened') {
    updates.opened_at = now
  } else if (eventType === 'email.bounced') {
    updates.bounced_at = now
    updates.status = 'BOUNCED'
  } else if (eventType === 'email.complained') {
    updates.complained_at = now
    updates.status = 'COMPLAINED'
  }

  try {
    // Attempt lookup by resend_id or matching recipient
    await db('email_logs')
      .where(function () {
        this.where('metadata', 'like', `%"email_id":"${emailId}"%`)
          .orWhere('metadata', 'like', `%"resend_id":"${emailId}"%`)
          .orWhere('id', typeof emailId === 'number' ? emailId : 0)
      })
      .update(updates)

    return { received: true, processed: true }
  } catch (err: any) {
    console.error('[Resend Webhook Error]', err)
    return { received: true, error: err.message }
  }
})
