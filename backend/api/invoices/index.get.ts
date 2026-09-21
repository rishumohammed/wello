// backend/api/invoices/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { requireAddon } from '../../utils/addonService'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { deriveInvoiceStatus, evaluateAndFlipOverdueInvoices } from '../../utils/invoiceOverdueService'

const querySchema = z.object({
  status: z.string().optional().default('ALL'),
  q: z.string().optional().default(''),
  clientId: z.string().optional(),
  projectId: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  const query = getQuery(event)
  const parsed = querySchema.safeParse(query)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { status: statusFilter, q: searchQuery, clientId, projectId } = parsed.data
  const db = getDb()

  // Run periodic overdue evaluation
  await evaluateAndFlipOverdueInvoices(db)

  let baseQuery = db('invoices')
    .where({ user_id: user.id })
    .whereNull('deleted_at')

  if (clientId) {
    baseQuery = baseQuery.where({ client_id: Number(clientId) })
  }

  if (projectId) {
    baseQuery = baseQuery.where({ project_id: Number(projectId) })
  }

  if (searchQuery && searchQuery.trim()) {
    const q = `%${searchQuery.trim().toLowerCase()}%`
    baseQuery = baseQuery.where((builder) => {
      builder
        .whereRaw('LOWER(invoice_number) LIKE ?', [q])
        .orWhereRaw('LOWER(customer_name) LIKE ?', [q])
        .orWhereRaw('LOWER(service_description) LIKE ?', [q])
    })
  }

  const rawInvoices = await baseQuery.orderBy('created_at', 'desc')

  // Fetch all items and taxes for these invoices
  const invoiceIds = rawInvoices.map((i) => i.id)
  const allItems = invoiceIds.length > 0 ? await db('invoice_items').whereIn('invoice_id', invoiceIds).orderBy('display_order', 'asc') : []
  const allTaxes = invoiceIds.length > 0 ? await db('invoice_taxes').whereIn('invoice_id', invoiceIds) : []

  const itemsByInvoice = new Map<number, any[]>()
  for (const item of allItems) {
    const list = itemsByInvoice.get(item.invoice_id) || []
    list.push({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unit_price),
      rate: Number(item.unit_price),
      amount: Number(item.amount),
      taxRate: item.tax_rate !== null ? Number(item.tax_rate) : null,
      taxName: item.tax_name,
      taxAmount: Number(item.tax_amount || 0),
    })
    itemsByInvoice.set(item.invoice_id, list)
  }

  const taxesByInvoice = new Map<number, any[]>()
  for (const tax of allTaxes) {
    const list = taxesByInvoice.get(tax.invoice_id) || []
    list.push({
      id: tax.id,
      taxName: tax.tax_name,
      taxPercent: Number(tax.tax_percent),
      taxAmount: Number(tax.tax_amount),
      isInclusive: Boolean(tax.is_inclusive),
      isReverseCharge: Boolean(tax.is_reverse_charge),
    })
    taxesByInvoice.set(tax.invoice_id, list)
  }

  const today = new Date()
  const invoices = rawInvoices.map((inv) => {
    const activeStatus = deriveInvoiceStatus(inv, today)
    const total = Number(inv.total)
    const amountPaid = Number(inv.amount_paid || 0)
    const balanceDue = Number(inv.balance_due !== null ? inv.balance_due : Math.max(0, total - amountPaid))

    return {
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
      items: itemsByInvoice.get(inv.id) || [],
      taxes: taxesByInvoice.get(inv.id) || [],
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
      recurringProfileId: inv.recurring_profile_id,
      isImmutable: Boolean(inv.is_immutable),
      createdAt: inv.created_at,
      updatedAt: inv.updated_at,
    }
  })

  // Apply optional status filter
  let filteredInvoices = invoices
  if (statusFilter && statusFilter.toUpperCase() !== 'ALL') {
    const filterLower = statusFilter.toLowerCase()
    filteredInvoices = invoices.filter((i) => i.status.toLowerCase() === filterLower)
  }

  // Compute analytics
  const paidInvoices = invoices.filter((i) => i.status === 'paid')
  const overdueInvoices = invoices.filter((i) => i.status === 'overdue')
  const sentInvoices = invoices.filter((i) => ['sent', 'viewed', 'partially_paid'].includes(i.status))
  const draftInvoices = invoices.filter((i) => i.status === 'draft')

  const totalBilled = paidInvoices.reduce((sum, i) => sum + i.total, 0)
  const totalOutstanding = invoices
    .filter((i) => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + i.balanceDue, 0)

  const analytics = {
    totalInvoices: invoices.length,
    draftCount: draftInvoices.length,
    sentCount: sentInvoices.length,
    paidCount: paidInvoices.length,
    overdueCount: overdueInvoices.length,
    totalBilled,
    totalOutstanding,
  }

  return sendSuccess(event, {
    invoices: filteredInvoices,
    analytics,
  })
})
