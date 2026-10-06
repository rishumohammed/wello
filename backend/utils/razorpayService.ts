// backend/utils/razorpayService.ts
// Razorpay Subscriptions & Recurring Mandate Service for Wello SaaS

import crypto from 'node:crypto'
import { logger } from './logger'

export interface RazorpayConfig {
  keyId: string
  keySecret: string
  planId: string
  baseAmount: number
  taxRatePct: number
  taxAmount: number
  gatewayFeeRatePct: number
  gatewayFeeAmount: number
  amount: number
  currency: string
  webhookSecret: string
}

export function getRazorpayConfig(): RazorpayConfig {
  const baseAmount = Number(process.env.RAZORPAY_BASE_AMOUNT) || 1.00
  const currency = process.env.RAZORPAY_CURRENCY || 'USD'
  
  // Tax (e.g. 18% standard GST / digital service VAT)
  const taxRatePct = Number(process.env.RAZORPAY_TAX_RATE_PCT) || 18.0
  const taxAmount = Number(((baseAmount * taxRatePct) / 100).toFixed(2))

  // Payment gateway charge (2% processing fee with $0.03 minimum)
  const gatewayFeeRatePct = Number(process.env.RAZORPAY_GATEWAY_FEE_PCT) || 2.0
  const rawFee = (baseAmount * gatewayFeeRatePct) / 100
  const gatewayFeeAmount = Number(Math.max(0.03, Number(rawFee.toFixed(2))))

  const totalAmount = Number((baseAmount + taxAmount + gatewayFeeAmount).toFixed(2))

  return {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_wello_mock_key',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_wello_mock_secret',
    planId: process.env.RAZORPAY_PLAN_ID || 'plan_wello_monthly_pro',
    baseAmount,
    taxRatePct,
    taxAmount,
    gatewayFeeRatePct,
    gatewayFeeAmount,
    amount: Number(process.env.RAZORPAY_AMOUNT) || totalAmount,
    currency,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'wello_webhook_secret_key_123',
  }
}

export function isRazorpayConfigured(): boolean {
  const cfg = getRazorpayConfig()
  return Boolean(
    process.env.RAZORPAY_KEY_ID && 
    process.env.RAZORPAY_KEY_SECRET &&
    !process.env.RAZORPAY_KEY_ID.includes('mock')
  )
}

/**
 * Verifies Razorpay Webhook HMAC-SHA256 signature
 */
export function verifyWebhookSignature(payload: string, signature: string, secret?: string): boolean {
  const webhookSecret = secret || getRazorpayConfig().webhookSecret
  if (!signature || !payload) return false
  
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex')
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))
  } catch (err) {
    logger.error('Error verifying Razorpay webhook signature', { error: err })
    return false
  }
}

/**
 * Creates or fetches a customer on Razorpay
 */
export async function createRazorpayCustomer(params: { name: string; email: string; phone?: string; userId: string | number }) {
  const config = getRazorpayConfig()
  
  if (!isRazorpayConfigured()) {
    logger.info('Razorpay not configured with live credentials. Returning simulated customer ID', { userId: params.userId })
    return {
      id: `cust_mock_${params.userId}_${Date.now().toString(36)}`,
      name: params.name,
      email: params.email,
    }
  }

  const authHeader = 'Basic ' + Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')
  
  try {
    const response = await fetch('https://api.razorpay.com/v1/customers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        contact: params.phone || undefined,
        notes: {
          wello_user_id: String(params.userId),
        },
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      logger.error('Failed to create Razorpay customer', { status: response.status, errorData })
      throw new Error(errorData?.error?.description || 'Failed to create customer on Razorpay')
    }

    return await response.json()
  } catch (err: any) {
    logger.error('Razorpay customer creation error', { error: err.message })
    throw err
  }
}

/**
 * Creates a subscription mandate on Razorpay
 */
export async function createRazorpaySubscription(params: {
  customerId?: string
  planId?: string
  totalCount?: number
  quantity?: number
  userId: string | number
  notes?: Record<string, string>
}) {
  const config = getRazorpayConfig()
  const planId = params.planId || config.planId
  const totalCount = params.totalCount || 120 // 10 years of monthly billing

  if (!isRazorpayConfigured()) {
    const mockSubId = `sub_mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
    logger.info('Simulated Razorpay subscription creation', { mockSubId, userId: params.userId })
    return {
      id: mockSubId,
      entity: 'subscription',
      plan_id: planId,
      customer_id: params.customerId || `cust_mock_${params.userId}`,
      status: 'created',
      current_start: null,
      current_end: null,
      ended_at: null,
      quantity: params.quantity || 1,
      charge_at: Math.floor(Date.now() / 1000),
      total_count: totalCount,
      paid_count: 0,
      remaining_count: totalCount,
      short_url: `https://rzp.io/i/mock_${params.userId}`,
    }
  }

  const authHeader = 'Basic ' + Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')

  try {
    const payload: Record<string, any> = {
      plan_id: planId,
      total_count: totalCount,
      quantity: params.quantity || 1,
      customer_notify: 1,
      notes: {
        wello_user_id: String(params.userId),
        ...(params.notes || {}),
      },
    }

    if (params.customerId) {
      payload.customer_id = params.customerId
    }

    const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json()
      logger.error('Failed to create Razorpay subscription', { status: response.status, errorData })
      throw new Error(errorData?.error?.description || 'Failed to create subscription on Razorpay')
    }

    return await response.json()
  } catch (err: any) {
    logger.error('Razorpay subscription creation error', { error: err.message })
    throw err
  }
}

/**
 * Cancels a subscription on Razorpay
 */
export async function cancelRazorpaySubscription(subscriptionId: string, cancelAtCycleEnd: boolean = true) {
  const config = getRazorpayConfig()

  if (!isRazorpayConfigured() || subscriptionId.startsWith('sub_mock_')) {
    logger.info('Simulated Razorpay subscription cancellation', { subscriptionId, cancelAtCycleEnd })
    return {
      id: subscriptionId,
      status: cancelAtCycleEnd ? 'active' : 'cancelled',
      cancel_at_cycle_end: cancelAtCycleEnd,
    }
  }

  const authHeader = 'Basic ' + Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')

  try {
    const response = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      logger.error('Failed to cancel Razorpay subscription', { subscriptionId, errorData })
      throw new Error(errorData?.error?.description || 'Failed to cancel subscription on Razorpay')
    }

    return await response.json()
  } catch (err: any) {
    logger.error('Razorpay subscription cancellation error', { error: err.message })
    throw err
  }
}
