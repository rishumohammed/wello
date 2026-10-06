// backend/api/webhooks/resend.post.ts
import { defineEventHandler, readBody, getHeader, createError } from 'h3'
import crypto from 'node:crypto'
import { getDb } from '../../utils/authService'

export default defineEventHandler(async (event) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET || ''
  const svixId = getHeader(event, 'svix-id') || getHeader(event, 'x-resend-id')
  const svixTimestamp = getHeader(event, 'svix-timestamp') || getHeader(event, 'x-resend-timestamp')
  const svixSignature = getHeader(event, 'svix-signature') || getHeader(event, 'x-resend-signature')

  const body = await readBody(event)
  if (!body) return { received: true }

  // Verify signature if secret is configured
  if (secret && svixSignature) {
    try {
      const payloadString = JSON.stringify(body)
      const toSign = `${svixId || ''}.${svixTimestamp || ''}.${payloadString}`
      const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret
      const expectedSig = crypto
        .createHmac('sha256', Buffer.from(cleanSecret, 'base64'))
        .update(toSign)
        .digest('base64')

      const signatureParts = svixSignature.split(',').map(s => s.trim().replace(/^v1=/, ''))
      const matches = signatureParts.some(sig => {
        try {
          return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
        } catch {
          return sig === expectedSig
        }
      })

      if (!matches && process.env.NODE_ENV === 'production') {
        throw createError({
          statusCode: 401,
          statusMessage: 'Invalid Resend webhook signature.',
        })
      }
    } catch (err: any) {
      if (err.statusCode) throw err
      console.warn('[Resend Webhook] Signature verification notice:', err.message)
    }
  }

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

    return { received: true, processed: true, eventType }
  } catch (err: any) {
    console.error('[Resend Webhook Error]', err)
    return { received: true, error: err.message }
  }
})

