// backend/utils/invoiceOverdueService.ts
import { Knex } from 'knex'
import { getDb } from './db'

export type InvoiceStatusType = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled' | 'void'

/**
 * Derives the active invoice status based on due date.
 * OVERDUE is derived automatically when current date > due_date for unpaid/partially paid sent invoices.
 */
export function deriveInvoiceStatus(invoice: {
  status: string
  due_date?: string | Date
  dueDate?: string | Date
  amount_paid?: number | string
  amountPaid?: number | string
  total?: number | string
}, asOfDate: Date = new Date()): InvoiceStatusType {
  const rawStatus = (invoice.status || 'draft').toLowerCase() as InvoiceStatusType

  // Non-derivable terminal or draft statuses
  if (['draft', 'paid', 'cancelled', 'void'].includes(rawStatus)) {
    return rawStatus
  }

  const dueDateVal = invoice.due_date || invoice.dueDate
  if (!dueDateVal) {
    return rawStatus
  }

  const dueDate = new Date(dueDateVal)
  // Strip time for clean calendar-day comparison
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime()
  const currentDay = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), asOfDate.getDate()).getTime()

  if (currentDay > dueDay) {
    return 'overdue'
  }

  return rawStatus
}

/**
 * Batch evaluates all pending database invoices and flips overdue invoices to 'overdue'.
 */
export async function evaluateAndFlipOverdueInvoices(dbInstance?: Knex): Promise<number> {
  const db = dbInstance || getDb()
  const todayStr = new Date().toISOString().slice(0, 10)

  const updatedCount = await db('invoices')
    .whereIn('status', ['sent', 'viewed', 'partially_paid'])
    .where('due_date', '<', todayStr)
    .whereNull('deleted_at')
    .update({
      status: 'overdue',
      updated_at: new Date(),
    })

  return updatedCount
}
