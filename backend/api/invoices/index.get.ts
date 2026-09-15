// server/api/invoices/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { getInvoicesForUser, getInvoiceAnalytics } from '../../utils/invoiceStore'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = (query?.userId as string) || 'u1'
  const statusFilter = (query?.status as string) || 'ALL'
  const searchQuery = (query?.q as string) || ''

  const invoices = getInvoicesForUser(userId, statusFilter, searchQuery)
  const analytics = getInvoiceAnalytics()

  return {
    success: true,
    invoices,
    analytics,
  }
})
