// backend/api/billing/webhook.post.ts
import { defineEventHandler, readRawBody, getHeader } from 'h3'
import { verifyWebhookSignature, isRazorpayConfigured } from '../../utils/razorpayService'
import { processRazorpayWebhook } from '../../utils/subscriptionService'
import { logger } from '../../utils/logger'

export default defineEventHandler(async (event) => {
  const rawBody = await readRawBody(event, 'utf8') || ''
  const signature = getHeader(event, 'x-razorpay-signature') || ''

  if (isRazorpayConfigured() && !verifyWebhookSignature(rawBody, signature)) {
    logger.warn('Invalid Razorpay webhook signature received', { signature })
    event.node.res.statusCode = 400
    return { error: 'Invalid webhook signature' }
  }

  try {
    const payload = JSON.parse(rawBody || '{}')
    const webhookEvent = payload.event || 'unknown'

    await processRazorpayWebhook(webhookEvent, payload.payload || {})
    return { status: 'ok', received: true }
  } catch (err: any) {
    logger.error('Error processing Razorpay webhook', { error: err.message })
    event.node.res.statusCode = 500
    return { error: 'Failed to process webhook' }
  }
})
