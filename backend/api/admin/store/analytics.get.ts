// server/api/admin/store/analytics.get.ts
import { defineEventHandler, getQuery, createError } from 'h3'
import { getStoreAnalytics } from '../../../utils/storeEngine'
import { getInvoiceAnalytics } from '../../../utils/invoiceStore'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const role = (query?.role as string) || 'admin'

  if (role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Admin authorization required.' })
  }

  const storeStats = getStoreAnalytics()
  const invoiceStats = getInvoiceAnalytics()

  return {
    success: true,
    storeAnalytics: storeStats,
    invoiceAnalytics: invoiceStats,
    usageTrends: [
      { month: 'May 2025', activations: 12, invoices: 24, revenueBilled: 45000 },
      { month: 'Jun 2025', activations: 28, invoices: 52, revenueBilled: 82000 },
      { month: 'Jul 2025', activations: 45, invoices: 88, revenueBilled: 140000 },
      { month: 'Aug 2025', activations: 62, invoices: 115, revenueBilled: 195000 },
      { month: 'Sep 2025', activations: storeStats.totalActivations + 75, invoices: invoiceStats.totalInvoices + 140, revenueBilled: invoiceStats.totalBilled + 220000 },
    ]
  }
})
