// backend/api/invoices/[id].delete.ts
import { defineEventHandler } from 'h3'
import { requireAddon } from '../../utils/addonService'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const idStr = event.context.params?.id
  if (!idStr) {
    return sendError(event, 400, 'MISSING_ID', 'Invoice ID is required.')
  }

  const db = getDb()
  const invoice = await db('invoices')
    .where({ id: Number(idStr), user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!invoice) {
    return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
  }

  if (invoice.is_immutable && !['draft', 'void', 'cancelled'].includes(invoice.status)) {
    return sendError(
      event,
      409,
      'INVOICE_IMMUTABLE',
      'Issued invoices cannot be deleted. Please void the invoice or issue a credit note.'
    )
  }

  await db('invoices')
    .where({ id: invoice.id })
    .update({
      deleted_at: new Date(),
      updated_at: new Date(),
    })

  return sendSuccess(event, {
    message: `Invoice ${invoice.invoice_number} deleted successfully.`,
  })
})
