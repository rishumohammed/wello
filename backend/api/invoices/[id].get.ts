// backend/api/invoices/[id].get.ts
import { defineEventHandler } from 'h3'
import { requireAddon } from '../../utils/addonService'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError } from '../../utils/apiResponse'
import { deriveInvoiceStatus } from '../../utils/invoiceOverdueService'

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const idStr = event.context.params?.id
  if (!idStr) {
    return sendError(event, 400, 'MISSING_ID', 'Invoice ID is required.')
  }

  const db = getDb()
  let query = db('invoices')
    .whereNull('deleted_at')

  if (!isNaN(Number(idStr))) {
    query = query.where({ id: Number(idStr) })
  } else {
    query = query.where({ invoice_number: idStr })
  }

  if (user.role !== 'admin') {
    query = query.where({ user_id: user.id })
  }

  const inv = await query.first()
  if (!inv) {
    return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
  }

  const items = await db('invoice_items').where({ invoice_id: inv.id }).orderBy('display_order', 'asc')
  const taxes = await db('invoice_taxes').where({ invoice_id: inv.id })
  const payments = await db('payments').where({ invoice_id: inv.id }).whereNull('deleted_at').orderBy('paid_date', 'asc')
  const creditNotes = await db('credit_notes').where({ invoice_id: inv.id }).whereNull('deleted_at')

  const activeStatus = deriveInvoiceStatus(inv)
  const total = Number(inv.total)
  const amountPaid = Number(inv.amount_paid || 0)
  const balanceDue = Number(inv.balance_due !== null ? inv.balance_due : Math.max(0, total - amountPaid))

  const invoice = {
    id: inv.id,
    userId: inv.user_id,
    projectId: inv.project_id,
    clientId: inv.client_id,
    invoiceNumber: inv.invoice_number,
    invoiceDate: inv.invoice_date,
    dueDate: inv.due_date,
    paymentTerms: inv.payment_terms || 'net_14',
    customerName: inv.customer_name,
    customerEmail: inv.customer_email,
    customerContact: inv.customer_contact,
    customerAddress: inv.customer_address,
    serviceDescription: inv.service_description,
    currency: inv.currency || 'USD',
    currencyCode: inv.currency || 'USD',
    baseCurrency: inv.base_currency || user.base_currency || 'USD',
    fxRate: Number(inv.fx_rate || 1.0),
    baseTotal: Number(inv.base_total || total),
    sellerName: inv.seller_name || user.business_name || user.name,
    sellerLogo: inv.seller_logo || user.logo_url,
    sellerAddress: inv.seller_address || user.business_address,
    sellerEmail: inv.seller_email || user.business_email || user.email,
    sellerPhone: inv.seller_phone || user.business_phone,
    sellerTaxId: inv.seller_tax_id || user.tax_id,
    taxIdLabel: inv.tax_id_label || user.tax_id_label || 'Tax ID / VAT Reg',
    taxMode: inv.tax_mode || 'exclusive',
    isReverseCharge: Boolean(inv.is_reverse_charge),
    items: items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      rate: Number(it.unit_price),
      amount: Number(it.amount),
      taxRate: it.tax_rate !== null ? Number(it.tax_rate) : null,
      taxName: it.tax_name,
      taxAmount: Number(it.tax_amount || 0),
    })),
    taxes: taxes.map((tx) => ({
      id: tx.id,
      taxName: tx.tax_name,
      taxPercent: Number(tx.tax_percent),
      taxAmount: Number(tx.tax_amount),
      isInclusive: Boolean(tx.is_inclusive),
      isReverseCharge: Boolean(tx.is_reverse_charge),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      currency: p.currency,
      paidDate: p.paid_date,
      status: p.status,
      notes: p.notes,
    })),
    creditNotes: creditNotes.map((cn) => ({
      id: cn.id,
      creditNoteNumber: cn.credit_note_number,
      creditNoteDate: cn.credit_note_date,
      amount: Number(cn.total),
      reason: cn.reason,
    })),
    discount: Number(inv.discount),
    taxPercent: Number(inv.tax_percent),
    taxAmount: Number(inv.tax_amount),
    subtotal: Number(inv.subtotal),
    total,
    amountPaid,
    balanceDue,
    notes: inv.notes,
    status: activeStatus,
    publicToken: inv.public_token,
    pdfTemplate: inv.pdf_template || 'modern_clean',
    sentAt: inv.sent_at,
    viewedAt: inv.viewed_at,
    paidAt: inv.paid_at,
    remindersEnabled: Boolean(inv.reminders_enabled),
    paymentLinkUrl: inv.payment_link_url,
    paymentLinkProvider: inv.payment_link_provider,
    isImmutable: Boolean(inv.is_immutable),
    createdAt: inv.created_at,
    updatedAt: inv.updated_at,
  }

  return sendSuccess(event, { invoice })
})
