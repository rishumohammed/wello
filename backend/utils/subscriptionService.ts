// backend/utils/subscriptionService.ts
// SaaS Subscription Management & Trial Lifecycle Service for Wello

import { db } from './db'
import { logger } from './logger'
import {
  getRazorpayConfig,
  createRazorpayCustomer,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
} from './razorpayService'
import { recordAuditLog } from './auditStore'

export interface UserSubscriptionDetails {
  status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'
  isTrialActive: boolean
  isSubscriptionActive: boolean
  isComped: boolean
  isSoftLocked: boolean
  daysLeftInTrial: number
  trialEndsAt: string | null
  plan: {
    planId: string
    baseAmount: number
    taxRatePct: number
    taxAmount: number
    gatewayFeeRatePct: number
    gatewayFeeAmount: number
    amount: number
    currency: string
    interval: string
  }
  subscription: Record<string, any> | null
  invoices: Array<Record<string, any>>
}

/**
 * Returns complete SaaS status, trial countdown, active subscription and billing history
 */
export async function getUserSubscriptionDetails(userId: string | number): Promise<UserSubscriptionDetails> {
  const user = await db('users')
    .where({ id: userId })
    .select('id', 'name', 'email', 'trial_ends_at', 'subscription_status', 'is_comped', 'comped_at', 'created_at')
    .first()

  if (!user) {
    throw new Error('User not found')
  }

  const now = new Date()
  let trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null

  // If user has no trial_ends_at set, default to 90 days from account creation
  if (!trialEndsAt && user.created_at) {
    trialEndsAt = new Date(new Date(user.created_at).getTime() + 90 * 24 * 60 * 60 * 1000)
    await db('users')
      .where({ id: userId })
      .update({
        trial_ends_at: trialEndsAt.toISOString(),
        subscription_status: trialEndsAt > now ? 'trialing' : 'expired',
      })
  }

  const isTrialActive = Boolean(trialEndsAt && trialEndsAt > now)
  const daysLeftInTrial = isTrialActive
    ? Math.max(0, Math.ceil((trialEndsAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const sub = await db('user_subscriptions')
    .where({ user_id: userId })
    .first()

  const isSubscriptionActive = Boolean(
    sub && (sub.status === 'active' || sub.status === 'authenticated')
  )

  const isComped = Boolean(user.is_comped)
  
  // Status resolution
  let effectiveStatus = user.subscription_status || 'trialing'
  if (isComped) {
    effectiveStatus = 'active'
  } else if (isSubscriptionActive) {
    effectiveStatus = sub.cancel_at_period_end ? 'cancelled' : 'active'
  } else if (isTrialActive) {
    effectiveStatus = 'trialing'
  } else {
    effectiveStatus = 'expired'
  }

  // Soft lock is active if trial has expired AND user has no active subscription and is not comped
  const isSoftLocked = !isComped && !isSubscriptionActive && !isTrialActive

  // Fetch recent billing receipts
  const invoices = await db('subscription_invoices')
    .where({ user_id: userId })
    .orderBy('created_at', 'desc')
    .limit(20)

  const config = getRazorpayConfig()

  return {
    status: effectiveStatus,
    isTrialActive,
    isSubscriptionActive,
    isComped,
    isSoftLocked,
    daysLeftInTrial,
    trialEndsAt: trialEndsAt ? trialEndsAt.toISOString() : null,
    plan: {
      planId: sub?.razorpay_plan_id || config.planId,
      baseAmount: config.baseAmount,
      taxRatePct: config.taxRatePct,
      taxAmount: config.taxAmount,
      gatewayFeeRatePct: config.gatewayFeeRatePct,
      gatewayFeeAmount: config.gatewayFeeAmount,
      amount: sub?.amount ? Number(sub.amount) : config.amount,
      currency: sub?.currency || config.currency,
      interval: 'month',
    },
    subscription: sub ? {
      id: sub.id,
      razorpaySubscriptionId: sub.razorpay_subscription_id,
      status: sub.status,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
      cancelledAt: sub.cancelled_at,
    } : null,
    invoices: invoices.map(inv => ({
      id: inv.id,
      invoiceId: inv.razorpay_invoice_id,
      paymentId: inv.razorpay_payment_id,
      amount: Number(inv.amount),
      currency: inv.currency,
      status: inv.status,
      receiptUrl: inv.receipt_url,
      paidAt: inv.paid_at,
      createdAt: inv.created_at,
    })),
  }
}

/**
 * Initializes Razorpay checkout payload (customer + subscription ID)
 */
export async function initiateSubscriptionCheckout(userId: string | number) {
  const user = await db('users').where({ id: userId }).first()
  if (!user) throw new Error('User not found')

  const config = getRazorpayConfig()

  // 1. Check or create customer
  let sub = await db('user_subscriptions').where({ user_id: userId }).first()
  let customerId = sub?.razorpay_customer_id

  if (!customerId) {
    const customer = await createRazorpayCustomer({
      name: user.name || 'Wello User',
      email: user.email,
      phone: user.phone_e164 || undefined,
      userId,
    })
    customerId = customer.id
  }

  // 2. Create subscription on Razorpay
  const rzpSub = await createRazorpaySubscription({
    customerId,
    userId,
    planId: config.planId,
  })

  // 3. Upsert into database
  if (sub) {
    await db('user_subscriptions')
      .where({ id: sub.id })
      .update({
        razorpay_customer_id: customerId,
        razorpay_subscription_id: rzpSub.id,
        razorpay_plan_id: config.planId,
        status: rzpSub.status || 'created',
        amount: config.amount,
        currency: config.currency,
        updated_at: db.fn.now(3),
      })
  } else {
    await db('user_subscriptions').insert({
      user_id: userId,
      razorpay_customer_id: customerId,
      razorpay_subscription_id: rzpSub.id,
      razorpay_plan_id: config.planId,
      status: rzpSub.status || 'created',
      amount: config.amount,
      currency: config.currency,
      created_at: db.fn.now(3),
      updated_at: db.fn.now(3),
    })
  }

  logger.info('Initiated Razorpay subscription for user', { userId, meta: { subscriptionId: rzpSub.id } })

  return {
    subscriptionId: rzpSub.id,
    keyId: config.keyId,
    baseAmount: config.baseAmount,
    taxAmount: config.taxAmount,
    gatewayFeeAmount: config.gatewayFeeAmount,
    amount: config.amount,
    currency: config.currency,
    name: 'Wello Pro Subscription',
    description: `Monthly Pro Membership ($${config.baseAmount.toFixed(2)} + Tax + Gateway Fee)`,
    prefill: {
      name: user.name || '',
      email: user.email || '',
      contact: user.phone_e164 || '',
    },
  }
}

/**
 * Cancels recurring billing at the end of current cycle
 */
export async function cancelUserSubscription(userId: string | number) {
  const sub = await db('user_subscriptions').where({ user_id: userId }).first()
  if (!sub || !sub.razorpay_subscription_id) {
    throw new Error('No active subscription found for user')
  }

  await cancelRazorpaySubscription(sub.razorpay_subscription_id, true)

  await db('user_subscriptions')
    .where({ id: sub.id })
    .update({
      cancel_at_period_end: true,
      cancelled_at: db.fn.now(3),
      updated_at: db.fn.now(3),
    })

  await db('users')
    .where({ id: userId })
    .update({
      subscription_status: 'cancelled',
      updated_at: db.fn.now(3),
    })

  logger.info('Subscription scheduled for cancellation at period end', { userId, meta: { subscriptionId: sub.razorpay_subscription_id } })

  return { success: true, message: 'Subscription will cancel at the end of the current billing cycle.' }
}

/**
 * Resumes a subscription marked for cancellation
 */
export async function resumeUserSubscription(userId: string | number) {
  const sub = await db('user_subscriptions').where({ user_id: userId }).first()
  if (!sub || !sub.cancel_at_period_end) {
    throw new Error('Subscription is not scheduled for cancellation')
  }

  await db('user_subscriptions')
    .where({ id: sub.id })
    .update({
      cancel_at_period_end: false,
      cancelled_at: null,
      status: 'active',
      updated_at: db.fn.now(3),
    })

  await db('users')
    .where({ id: userId })
    .update({
      subscription_status: 'active',
      updated_at: db.fn.now(3),
    })

  logger.info('Subscription resumed for user', { userId, meta: { subscriptionId: sub.razorpay_subscription_id } })

  return { success: true, message: 'Subscription successfully resumed.' }
}

/**
 * Verifies and applies Razorpay Webhook Events
 */
export async function processRazorpayWebhook(event: string, payload: any) {
  logger.info('Processing Razorpay webhook event', { meta: { event } })
  const subEntity = payload?.subscription?.entity || payload?.payment?.entity || {}
  const rzpSubId = subEntity.subscription_id || subEntity.id

  if (!rzpSubId) {
    logger.warn('No subscription ID found in webhook payload', { meta: { event } })
    return { received: true, ignored: true }
  }

  const sub = await db('user_subscriptions')
    .where({ razorpay_subscription_id: rzpSubId })
    .first()

  if (!sub) {
    logger.warn('Subscription record not found in local DB for webhook', { meta: { rzpSubId, event } })
    return { received: true, not_found: true }
  }

  const periodStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : null
  const periodEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : null

  switch (event) {
    case 'subscription.authenticated':
    case 'subscription.activated':
      await db('user_subscriptions')
        .where({ id: sub.id })
        .update({
          status: 'active',
          current_period_start: periodStart,
          current_period_end: periodEnd,
          updated_at: db.fn.now(3),
        })

      await db('users')
        .where({ id: sub.user_id })
        .update({
          subscription_status: 'active',
          updated_at: db.fn.now(3),
        })
      break

    case 'subscription.charged': {
      const paymentEntity = payload?.payment?.entity || {}
      const invoiceEntity = payload?.payment?.entity?.invoice || {}
      const amountPaid = paymentEntity.amount ? Number(paymentEntity.amount) / 100 : Number(sub.amount)
      const currency = paymentEntity.currency || sub.currency || 'INR'

      await db('subscription_invoices').insert({
        user_id: sub.user_id,
        subscription_id: sub.id,
        razorpay_invoice_id: invoiceEntity.id || paymentEntity.invoice_id || `inv_${Date.now().toString(36)}`,
        razorpay_payment_id: paymentEntity.id || `pay_${Date.now().toString(36)}`,
        amount: amountPaid,
        currency,
        status: 'paid',
        receipt_url: paymentEntity.receipt || null,
        paid_at: db.fn.now(3),
        created_at: db.fn.now(3),
      })

      await db('user_subscriptions')
        .where({ id: sub.id })
        .update({
          status: 'active',
          current_period_start: periodStart,
          current_period_end: periodEnd,
          updated_at: db.fn.now(3),
        })

      await db('users')
        .where({ id: sub.user_id })
        .update({
          subscription_status: 'active',
          updated_at: db.fn.now(3),
        })
      break
    }

    case 'subscription.halted':
      await db('user_subscriptions')
        .where({ id: sub.id })
        .update({
          status: 'halted',
          updated_at: db.fn.now(3),
        })

      await db('users')
        .where({ id: sub.user_id })
        .update({
          subscription_status: 'past_due',
          updated_at: db.fn.now(3),
        })
      break

    case 'subscription.cancelled':
      await db('user_subscriptions')
        .where({ id: sub.id })
        .update({
          status: 'cancelled',
          cancelled_at: db.fn.now(3),
          updated_at: db.fn.now(3),
        })

      await db('users')
        .where({ id: sub.user_id })
        .update({
          subscription_status: 'expired',
          updated_at: db.fn.now(3),
        })
      break

    default:
      logger.info('Unhandled subscription webhook event', { meta: { event } })
  }

  return { received: true, processed: true }
}

/**
 * Admin: Extend user trial by N days
 */
export async function adminExtendUserTrial(adminUserId: string | number, targetUserId: string | number, days: number, reason: string) {
  const user = await db('users').where({ id: targetUserId }).first()
  if (!user) throw new Error('Target user not found')

  const baseDate = user.trial_ends_at && new Date(user.trial_ends_at) > new Date()
    ? new Date(user.trial_ends_at)
    : new Date()

  const newTrialEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000)

  await db('users')
    .where({ id: targetUserId })
    .update({
      trial_ends_at: newTrialEnd.toISOString(),
      subscription_status: 'trialing',
      updated_at: db.fn.now(3),
    })

  await recordAuditLog({
    adminEmail: 'admin@wello.local',
    actorId: Number(adminUserId),
    action: 'TRIAL_EXTENDED',
    module: 'SUBSCRIPTION',
    target: `user:${targetUserId}`,
    targetType: 'user',
    targetId: String(targetUserId),
    reason: reason || `Extended trial by ${days} days`,
    diffJson: {
      daysAdded: days,
      newTrialEnd: newTrialEnd.toISOString(),
    },
  })

  return { success: true, newTrialEnd: newTrialEnd.toISOString() }
}

/**
 * Admin: Grant/revoke permanent comped VIP access
 */
export async function adminCompUserSubscription(adminUserId: string | number, targetUserId: string | number, isComped: boolean, reason: string) {
  const user = await db('users').where({ id: targetUserId }).first()
  if (!user) throw new Error('Target user not found')

  await db('users')
    .where({ id: targetUserId })
    .update({
      is_comped: isComped,
      comped_at: isComped ? db.fn.now(3) : null,
      subscription_status: isComped ? 'active' : 'expired',
      updated_at: db.fn.now(3),
    })

  await recordAuditLog({
    adminEmail: 'admin@wello.local',
    actorId: Number(adminUserId),
    action: isComped ? 'SUBSCRIPTION_COMP_GRANTED' : 'SUBSCRIPTION_COMP_REVOKED',
    module: 'SUBSCRIPTION',
    target: `user:${targetUserId}`,
    targetType: 'user',
    targetId: String(targetUserId),
    reason: reason || (isComped ? 'Comped VIP subscription granted' : 'Comped subscription revoked'),
    diffJson: { isComped },
  })

  return { success: true, isComped }
}
