// backend/api/invoices/evaluate-overdue.post.ts
import { defineEventHandler } from 'h3'
import { requireAddon } from '../../utils/addonService'
import { getDb } from '../../utils/db'
import { sendSuccess } from '../../utils/apiResponse'
import { evaluateAndFlipOverdueInvoices } from '../../utils/invoiceOverdueService'

export default defineEventHandler(async (event) => {
  await requireAddon(event, 'basic-invoicing')
  const db = getDb()
  const flippedCount = await evaluateAndFlipOverdueInvoices(db)

  return sendSuccess(event, {
    message: `Evaluated overdue invoices. ${flippedCount} invoice(s) flipped to OVERDUE.`,
    flippedCount,
  })
})
