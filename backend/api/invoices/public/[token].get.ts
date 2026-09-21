// backend/api/invoices/public/[token].get.ts
import { defineEventHandler } from 'h3'
import { getDb } from '../../../utils/db'
import { sendSuccess, sendError } from '../../../utils/apiResponse'
import { deriveInvoiceStatus } from '../../../utils/invoiceOverdueService'

export default defineEventHandler(async (event) => {
  const token = event.context.params?.token
  if (!token) {
    return sendError(event, 400, 'MISSING_TOKEN', 'Invoice public token is required.')
  }

  const db = getDb()
  const invoice = await db('invoices')
    .where({ public_token: token })
    .whereNull('deleted_at')
    .first()

  if (!invoice) {
    return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found or link has expired.')
  }

  // View tracking: if invoice was in 'sent' status, transition to 'viewed'
  let activeStatus = invoice.status
  let viewedAt = invoice.viewed_at

  if (activeStatus === 'sent') {
    activeStatus = 'viewed'
    viewedAt = new Date()
    await db('invoices')
      .where({ id: invoice.id })
      .update({
        status: 'viewed',
        viewed_at: viewedAt,
        updated_at: new Date(),
      })
  }

  activeStatus = deriveInvoiceStatus({ ...invoice, status: activeStatus })

  const items = await db('invoice_items').where({ invoice_id: invoice.id }).orderBy('display_order', 'asc')
  const taxes = await db('invoice_taxes').where({ invoice_id: invoice.id })
  const user = await db('users').where({ id: invoice.user_id }).first()

  const total = Number(invoice.total)
  const amountPaid = Number(invoice.amount_paid || 0)
  const balanceDue = Number(invoice.balance_due !== null ? invoice.balance_due : Math.max(0, total - amountPaid))

  return sendSuccess(event, {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date,
      paymentTerms: invoice.payment_terms || 'net_14',
      customerName: invoice.customer_name,
      customerEmail: invoice.customer_email,
      customerAddress: invoice.customer_address,
      serviceDescription: invoice.service_description,
      currency: invoice.currency,
      sellerName: invoice.seller_name || user?.business_name || user?.name || 'Verified Professional',
      sellerLogo: invoice.seller_logo || user?.logo_url || null,
      sellerAddress: invoice.seller_address || user?.business_address || null,
      sellerEmail: invoice.seller_email || user?.business_email || user?.email || null,
      sellerPhone: invoice.seller_phone || user?.business_phone || null,
      sellerTaxId: invoice.seller_tax_id || user?.tax_id || null,
      taxIdLabel: invoice.tax_id_label || user?.tax_id_label || 'Tax ID',
      taxMode: invoice.tax_mode,
      isReverseCharge: Boolean(invoice.is_reverse_charge),
      items: items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        amount: Number(it.amount),
        taxRate: it.tax_rate !== null ? Number(it.tax_rate) : null,
      })),
      taxes: taxes.map((tx) => ({
        taxName: tx.tax_name,
        taxPercent: Number(tx.tax_percent),
        taxAmount: Number(tx.tax_amount),
        isInclusive: Boolean(tx.is_inclusive),
        isReverseCharge: Boolean(tx.is_reverse_charge),
      })),
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      taxPercent: Number(invoice.tax_percent),
      taxAmount: Number(invoice.tax_amount),
      total,
      amountPaid,
      balanceDue,
      notes: invoice.notes,
      status: activeStatus,
      pdfTemplate: invoice.pdf_template,
      paymentLinkUrl: invoice.payment_link_url,
      viewedAt,
    },
  })
})
