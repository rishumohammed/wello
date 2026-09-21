// backend/api/invoices/public/[token]/pdf.get.ts
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { getDb } from '../../../../utils/db'
import { sendError } from '../../../../utils/apiResponse'
import { generateInvoicePdf, InvoicePdfData } from '../../../../utils/pdfGenerator'
import { deriveInvoiceStatus } from '../../../../utils/invoiceOverdueService'

export default defineEventHandler(async (event) => {
  const token = event.context.params?.token
  const query = getQuery(event)
  const template = (query.template === 'classic_executive' ? 'classic_executive' : 'modern_clean') as 'modern_clean' | 'classic_executive'

  if (!token) {
    return sendError(event, 400, 'MISSING_TOKEN', 'Invoice public token is required.')
  }

  const db = getDb()
  const invoice = await db('invoices')
    .where({ public_token: token })
    .whereNull('deleted_at')
    .first()

  if (!invoice) {
    return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
  }

  const user = await db('users').where({ id: invoice.user_id }).first()
  const items = await db('invoice_items').where({ invoice_id: invoice.id }).orderBy('display_order', 'asc')
  const taxes = await db('invoice_taxes').where({ invoice_id: invoice.id })

  const pdfData: InvoicePdfData = {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    paymentTerms: invoice.payment_terms,
    status: deriveInvoiceStatus(invoice),
    currency: invoice.currency || 'USD',
    sellerName: invoice.seller_name || user?.business_name || user?.name || 'Verified Professional',
    sellerEmail: invoice.seller_email || user?.business_email || user?.email,
    sellerAddress: invoice.seller_address || user?.business_address,
    sellerPhone: invoice.seller_phone || user?.business_phone,
    sellerTaxId: invoice.seller_tax_id || user?.tax_id,
    taxIdLabel: invoice.tax_id_label || user?.tax_id_label || 'Tax ID',
    customerName: invoice.customer_name,
    customerAddress: invoice.customer_address,
    customerEmail: invoice.customer_email,
    customerContact: invoice.customer_contact,
    items: items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unit_price),
      amount: Number(it.amount),
      taxRate: it.tax_rate !== null ? Number(it.tax_rate) : undefined,
    })),
    subtotal: Number(invoice.subtotal),
    discount: Number(invoice.discount),
    taxes: taxes.map((tx) => ({
      taxName: tx.tax_name,
      taxPercent: Number(tx.tax_percent),
      taxAmount: Number(tx.tax_amount),
      isInclusive: Boolean(tx.is_inclusive),
      isReverseCharge: Boolean(tx.is_reverse_charge),
    })),
    taxPercent: Number(invoice.tax_percent),
    taxAmount: Number(invoice.tax_amount),
    total: Number(invoice.total),
    amountPaid: Number(invoice.amount_paid || 0),
    balanceDue: Number(invoice.balance_due !== null ? invoice.balance_due : invoice.total),
    isReverseCharge: Boolean(invoice.is_reverse_charge),
    notes: invoice.notes,
    template: template || invoice.pdf_template,
  }

  const pdfBuffer = generateInvoicePdf(pdfData)

  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`)
  setHeader(event, 'Content-Length', pdfBuffer.length)

  return pdfBuffer
})
