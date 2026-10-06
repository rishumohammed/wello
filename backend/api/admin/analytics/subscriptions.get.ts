// backend/api/admin/analytics/subscriptions.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { db } from '../../../utils/db'
import { getRazorpayConfig } from '../../../utils/razorpayService'
import { sendSuccess, sendError } from '../../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  try {
    await requirePermission(event, 'analytics.view')
    const config = getRazorpayConfig()
    const now = new Date()

    // Query high level user subscription distribution
    const totalUsersRow = await db('users').whereNull('deleted_at').count('id as count').first()
    const totalUsers = Number(totalUsersRow?.count || 0)

    const trialingRow = await db('users')
      .whereNull('deleted_at')
      .where('trial_ends_at', '>', now)
      .where('is_comped', false)
      .whereNotExists(function () {
        this.select('*').from('user_subscriptions')
          .whereRaw('user_subscriptions.user_id = users.id')
          .whereIn('status', ['active', 'authenticated'])
      })
      .count('id as count')
      .first()
    const activeTrialing = Number(trialingRow?.count || 0)

    const activePaidRow = await db('user_subscriptions')
      .whereIn('status', ['active', 'authenticated'])
      .count('id as count')
      .first()
    const activePaidSubscribers = Number(activePaidRow?.count || 0)

    const compedRow = await db('users').whereNull('deleted_at').where('is_comped', true).count('id as count').first()
    const compedUsers = Number(compedRow?.count || 0)

    const expiredRow = await db('users')
      .whereNull('deleted_at')
      .where('is_comped', false)
      .where(function () {
        this.where('trial_ends_at', '<=', now).orWhereNull('trial_ends_at')
      })
      .whereNotExists(function () {
        this.select('*').from('user_subscriptions')
          .whereRaw('user_subscriptions.user_id = users.id')
          .whereIn('status', ['active', 'authenticated'])
      })
      .count('id as count')
      .first()
    const expiredUsers = Number(expiredRow?.count || 0)

    // Calculate MRR & ARR
    const monthlyPrice = config.amount
    const mrr = activePaidSubscribers * monthlyPrice
    const arr = mrr * 12

    // Recent invoices
    const recentInvoices = await db('subscription_invoices')
      .join('users', 'subscription_invoices.user_id', 'users.id')
      .select(
        'subscription_invoices.id',
        'subscription_invoices.razorpay_invoice_id',
        'subscription_invoices.razorpay_payment_id',
        'subscription_invoices.amount',
        'subscription_invoices.currency',
        'subscription_invoices.status',
        'subscription_invoices.paid_at',
        'subscription_invoices.created_at',
        'users.name as user_name',
        'users.email as user_email'
      )
      .orderBy('subscription_invoices.created_at', 'desc')
      .limit(20)

    return sendSuccess(event, {
      kpis: {
        totalUsers,
        activeTrialing,
        activePaidSubscribers,
        compedUsers,
        expiredUsers,
        mrr,
        arr,
        currency: config.currency,
        planPrice: monthlyPrice,
        conversionRate: totalUsers > 0 ? Number(((activePaidSubscribers / totalUsers) * 100).toFixed(1)) : 0,
      },
      recentInvoices,
    })
  } catch (err: any) {
    return sendError(event, 500, 'SUBSCRIPTION_ANALYTICS_FAILED', err.message || 'Failed to fetch subscription metrics')
  }
})
