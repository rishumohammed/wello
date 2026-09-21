// server/api/admin/users/[id]/financials.get.ts
import { defineEventHandler, getRouterParam, getQuery, getRequestHeader, createError } from 'h3'
import { requirePermission, extractClientIp } from '../../../../utils/authGuard'
import { getDb } from '../../../../utils/db'
import { recordAuditLog } from '../../../../utils/auditStore'

export default defineEventHandler(async (event) => {
  // 1. Require users.financial_view permission (SUPER_ADMIN only by default)
  const admin = await requirePermission(event, 'users.financial_view')
  const rawId = getRouterParam(event, 'id')
  const userId = Number(rawId)

  if (!userId || isNaN(userId)) {
    throw createError({ statusCode: 400, statusMessage: 'Valid user ID required.' })
  }

  // 2. Enforce mandatory business justification reason
  const query = getQuery(event)
  const reason = ((query?.reason as string) || getRequestHeader(event, 'x-audit-reason') || '').trim()

  if (!reason || reason.length < 5) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid business justification reason (minimum 5 characters) is required to view personal financial records.',
    })
  }

  const db = getDb()
  const user = await db('users')
    .where('id', userId)
    .whereNull('deleted_at')
    .select('id', 'name', 'email', 'target_hourly as targetHourly', 'base_currency as currencyCode')
    .first()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found.' })
  }

  // 3. Fetch financial records
  const [quotes, invoices, payments, incomeSources] = await Promise.all([
    db('projects')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .whereNotNull('quote_amount')
      .select('id', 'name', 'quote_amount as quoteAmount', 'currency', 'status', 'created_at as createdAt')
      .orderBy('created_at', 'desc')
      .limit(50),
    db('invoices')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .select('id', 'invoice_number as invoiceNumber', 'total as totalAmount', 'currency', 'status', 'invoice_date as issueDate', 'due_date as dueDate')
      .orderBy('invoice_date', 'desc')
      .limit(50),
    db('payments')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .select('id', 'amount', 'currency', 'paid_date as paidDate', 'created_at as createdAt')
      .orderBy('paid_date', 'desc')
      .limit(50),
    db('income_sources')
      .where({ user_id: userId })
      .whereNull('deleted_at')
      .select('id', 'name', 'type', 'amount', 'currency', 'frequency', 'is_active as isActive')
      .limit(20),
  ])

  // Calculate summary totals
  const totalInvoiced = invoices.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount || 0), 0)
  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)

  // 4. Record cryptographically tamper-evident audit log
  await recordAuditLog({
    adminEmail: admin.email,
    actorId: admin.id,
    action: 'VIEW_USER_FINANCIALS',
    module: 'Users',
    permissionUsed: 'users.financial_view',
    target: `${user.email} (User ID: ${userId})`,
    reason,
    ipAddress: extractClientIp(event),
    userAgent: getRequestHeader(event, 'user-agent') || 'Admin Console',
    newValue: `Inspected personal income records: ${invoices.length} invoices ($${totalInvoiced.toFixed(2)}), ${payments.length} payments ($${totalPaid.toFixed(2)}), target rate $${user.targetHourly || 0}/hr.`,
  })

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      targetHourly: user.targetHourly,
      currencyCode: user.currencyCode,
    },
    financials: {
      targetHourly: user.targetHourly,
      currencyCode: user.currencyCode,
      summary: {
        totalInvoiced,
        totalPaid,
        invoicesCount: invoices.length,
        paymentsCount: payments.length,
        quotesCount: quotes.length,
      },
      quotes,
      invoices,
      payments,
      incomeSources,
    },
  }
})
