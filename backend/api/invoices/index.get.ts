// server/api/invoices/index.get.ts
import { defineEventHandler, getQuery, createError } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { getInvoicesForUser, getInvoiceAnalytics } from '../../utils/invoiceStore'

const querySchema = z.object({
  status: z.string().optional().default('ALL'),
  q: z.string().optional().default(''),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const query = getQuery(event)
  const parseResult = querySchema.safeParse(query)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors[0]?.message || 'Invalid query parameters.',
    })
  }

  const { status: statusFilter, q: searchQuery } = parseResult.data

  const invoices = getInvoicesForUser(String(user.id), statusFilter, searchQuery)
  const analytics = getInvoiceAnalytics()

  return {
    success: true,
    invoices,
    analytics,
  }
})
