// backend/api/invoices/index.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import crypto from 'crypto'
import { requireAddon } from '../../utils/addonService'
import { requireFairUseLimit } from '../../utils/fairUseService'
import { getDb } from '../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { getNextInvoiceNumber } from '../../utils/invoiceSequenceService'
import { getFxRate } from '../../utils/fxService'
import { recordAddonUsage } from '../../utils/storeEngine'
import { logAnalyticsEvent } from '../../utils/analyticsService'

const invoiceTaxSchema = z.object({
  taxName: z.string().min(1),
  taxPercent: z.number().min(0).max(100),
  taxAmount: z.number().optional(),
  isInclusive: z.boolean().optional().default(false),
  isReverseCharge: z.boolean().optional().default(false),
})

const invoiceItemSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  description: z.string().min(1, 'Item description is required.'),
  quantity: z.number().min(0).optional().default(1),
  unitPrice: z.number().min(0).optional(),
  rate: z.number().min(0).optional(),
  amount: z.number().optional(),
  taxRate: z.number().min(0).max(100).nullable().optional(),
  taxName: z.string().nullable().optional(),
})

const invoicePostSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  projectId: z.number().int().positive().nullable().optional(),
  clientId: z.number().int().positive().nullable().optional(),
  customerName: z.string().min(1, 'Customer name is required.'),
  customerEmail: z.string().email().nullable().optional().or(z.literal('')),
  customerContact: z.string().nullable().optional(),
  customerAddress: z.string().nullable().optional(),
  serviceDescription: z.string().nullable().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  paymentTerms: z.string().optional().default('net_14'),
  currency: z.string().length(3).optional().default('USD'),
  currencyCode: z.string().length(3).optional(),
  taxMode: z.enum(['exclusive', 'inclusive', 'no_tax']).optional().default('exclusive'),
  taxPercent: z.number().min(0).max(100).optional().default(0),
  taxes: z.array(invoiceTaxSchema).optional().default([]),
  notes: z.string().nullable().optional(),
  items: z.array(invoiceItemSchema).optional().default([]),
  discount: z.number().min(0).optional().default(0),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  discountAmount: z.number().min(0).optional().default(0),
  taxIdLabel: z.string().optional(),
  isReverseCharge: z.boolean().optional().default(false),
  status: z.enum(['draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void', 'DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional().default('draft'),
  pdfTemplate: z.enum(['modern_clean', 'classic_executive']).optional().default('modern_clean'),
  sellerName: z.string().nullable().optional(),
  sellerLogo: z.string().nullable().optional(),
  sellerAddress: z.string().nullable().optional(),
  sellerEmail: z.string().nullable().optional(),
  sellerPhone: z.string().nullable().optional(),
  sellerTaxId: z.string().nullable().optional(),
  remindersEnabled: z.boolean().optional().default(true),
  paymentLinkUrl: z.string().nullable().optional().or(z.literal('')),
  paymentLinkProvider: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'basic-invoicing')
  await requireFairUseLimit(event, 'invoices_per_day')
  const body = await readBody(event)
  const parseResult = invoicePostSchema.safeParse(body)
  if (!parseResult.success) {
    const formatted = formatZodError(parseResult.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parseResult.data
  const db = getDb()

  const currency = (data.currencyCode || data.currency || 'USD').toUpperCase().slice(0, 3)
  const baseCurrency = (user.base_currency || 'USD').toUpperCase().slice(0, 3)
  const fxRate = await getFxRate(currency, baseCurrency)

  // Calculate items and subtotal
  const rawItems = data.items.length > 0 ? data.items : [
    { description: data.serviceDescription || 'Professional Services', quantity: 1, unitPrice: 0 }
  ]

  const items = rawItems.map((it, idx) => {
    const qty = Number(it.quantity !== undefined ? it.quantity : 1)
    const price = Number(it.unitPrice !== undefined ? it.unitPrice : (it.rate !== undefined ? it.rate : 0))
    const amt = it.amount !== undefined ? Number(it.amount) : Math.round(qty * price * 10000) / 10000
    return {
      description: it.description,
      quantity: qty,
      unit_price: price,
      amount: amt,
      tax_rate: it.taxRate !== undefined ? it.taxRate : null,
      tax_name: it.taxName || null,
      tax_amount: it.taxRate ? Math.round((amt * it.taxRate / 100) * 10000) / 10000 : 0,
      display_order: idx + 1,
    }
  })

  const subtotal = items.reduce((sum, it) => sum + it.amount, 0)
  const discount = Number(data.discount || data.discountAmount || (data.discountPercent ? (subtotal * data.discountPercent / 100) : 0)) || 0
  const afterDiscount = Math.max(0, subtotal - discount)

  // Calculate taxes
  let taxAmount = 0
  const calculatedTaxes: any[] = []

  if (data.taxes && data.taxes.length > 0) {
    for (const t of data.taxes) {
      const pct = Number(t.taxPercent) || 0
      const isInc = Boolean(t.isInclusive)
      const isRev = Boolean(t.isReverseCharge)
      let amt = 0
      if (!isRev && pct > 0) {
        amt = isInc ? afterDiscount - (afterDiscount / (1 + pct / 100)) : (afterDiscount * pct) / 100
        amt = Math.round(amt * 10000) / 10000
        if (!isInc) {
          taxAmount += amt
        }
      }
      calculatedTaxes.push({
        tax_name: t.taxName,
        tax_percent: pct,
        tax_amount: amt,
        is_inclusive: isInc,
        is_reverse_charge: isRev,
      })
    }
  } else if ((data.taxPercent || 0) > 0) {
    const pct = Number(data.taxPercent)
    const isInc = data.taxMode === 'inclusive'
    const isRev = Boolean(data.isReverseCharge)
    let amt = 0
    if (!isRev && pct > 0) {
      amt = isInc ? afterDiscount - (afterDiscount / (1 + pct / 100)) : (afterDiscount * pct) / 100
      amt = Math.round(amt * 10000) / 10000
      if (!isInc) {
        taxAmount += amt
      }
    }
    calculatedTaxes.push({
      tax_name: data.taxIdLabel || 'Tax',
      tax_percent: pct,
      tax_amount: amt,
      is_inclusive: isInc,
      is_reverse_charge: isRev,
    })
  } else {
    // Check if line items have tax rates
    const itemTaxes = items.filter((it) => (it.tax_rate || 0) > 0)
    if (itemTaxes.length > 0 && !data.isReverseCharge) {
      const isInc = data.taxMode === 'inclusive'
      let itemTaxSum = 0
      for (const it of itemTaxes) {
        const itemAmt = it.amount
        const pct = it.tax_rate || 0
        let amt = isInc ? itemAmt - (itemAmt / (1 + pct / 100)) : (itemAmt * pct) / 100
        amt = Math.round(amt * 10000) / 10000
        itemTaxSum += amt
        calculatedTaxes.push({
          tax_name: it.tax_name || 'Item Tax',
          tax_percent: pct,
          tax_amount: amt,
          is_inclusive: isInc,
          is_reverse_charge: false,
        })
      }
      if (!isInc) {
        if (discount > 0 && subtotal > 0) {
          taxAmount = Math.round((itemTaxSum * (afterDiscount / subtotal)) * 10000) / 10000
        } else {
          taxAmount = itemTaxSum
        }
      }
    }
  }

  const total = data.taxMode === 'inclusive' ? afterDiscount : afterDiscount + taxAmount
  const baseTotal = Math.round(total * fxRate * 10000) / 10000
  const statusLower = (data.status || 'draft').toLowerCase()

  // UPDATE EXISTING INVOICE
  if (data.id) {
    const existing = await db('invoices')
      .where({ id: Number(data.id), user_id: user.id })
      .whereNull('deleted_at')
      .first()

    if (!existing) {
      return sendError(event, 404, 'INVOICE_NOT_FOUND', 'Invoice not found.')
    }

    // Check immutability: issued invoices cannot change commercial amounts directly
    if (existing.is_immutable && !['draft', 'void'].includes(existing.status)) {
      // Allow only status updates, notes, or payment links
      const isContentChange = Number(existing.total) !== total || existing.currency !== currency
      if (isContentChange) {
        return sendError(
          event,
          409,
          'INVOICE_IMMUTABLE',
          'Issued invoices cannot be edited. Please issue a credit note to adjust commercial balances.'
        )
      }
    }

    const amountPaid = Number(existing.amount_paid || 0)
    const balanceDue = Math.max(0, total - amountPaid)

    await db.transaction(async (trx) => {
      await trx('invoices')
        .where({ id: existing.id })
        .update({
          project_id: data.projectId || existing.project_id,
          client_id: data.clientId || existing.client_id,
          customer_name: data.customerName,
          customer_email: data.customerEmail || null,
          customer_contact: data.customerContact || null,
          customer_address: data.customerAddress || null,
          service_description: data.serviceDescription || null,
          invoice_date: data.invoiceDate ? new Date(data.invoiceDate) : existing.invoice_date,
          due_date: data.dueDate ? new Date(data.dueDate) : existing.due_date,
          payment_terms: data.paymentTerms || existing.payment_terms,
          currency,
          base_currency: baseCurrency,
          fx_rate: fxRate,
          subtotal,
          discount,
          tax_mode: data.taxMode,
          tax_percent: data.taxPercent || 0,
          tax_amount: taxAmount,
          is_reverse_charge: Boolean(data.isReverseCharge),
          tax_id_label: data.taxIdLabel || 'Tax ID / VAT Reg',
          total,
          base_total: baseTotal,
          balance_due: balanceDue,
          notes: data.notes || null,
          pdf_template: data.pdfTemplate || existing.pdf_template,
          reminders_enabled: Boolean(data.remindersEnabled),
          payment_link_url: data.paymentLinkUrl !== undefined ? (data.paymentLinkUrl || null) : existing.payment_link_url,
          payment_link_provider: data.paymentLinkProvider || existing.payment_link_provider,
          updated_at: new Date(),
        })

      // Replace line items
      await trx('invoice_items').where({ invoice_id: existing.id }).delete()
      if (items.length > 0) {
        await trx('invoice_items').insert(
          items.map((it) => ({
            invoice_id: existing.id,
            ...it,
            created_at: new Date(),
          }))
        )
      }

      // Replace taxes
      await trx('invoice_taxes').where({ invoice_id: existing.id }).delete()
      if (calculatedTaxes.length > 0) {
        await trx('invoice_taxes').insert(
          calculatedTaxes.map((tx) => ({
            invoice_id: existing.id,
            ...tx,
            created_at: new Date(),
          }))
        )
      }
    })

    const updated = await db('invoices').where({ id: existing.id }).first()
    return sendSuccess(event, {
      message: `Invoice ${updated.invoice_number} updated successfully.`,
      invoice: {
        ...updated,
        invoiceNumber: updated.invoice_number,
        total: Number(updated.total),
        balanceDue: Number(updated.balance_due),
        status: updated.status,
      },
    })
  }

  // CREATE NEW INVOICE
  const publicToken = crypto.randomBytes(32).toString('hex')
  const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
  const defaultInvDate = new Date().toISOString().slice(0, 10)

  let createdInvoice: any = null

  await db.transaction(async (trx) => {
    let invoiceNumber = data.invoiceNumber
    if (!invoiceNumber || invoiceNumber.trim() === '') {
      const seq = await getNextInvoiceNumber(user.id, undefined, trx)
      invoiceNumber = seq.invoiceNumber
    }

    const [newId] = await trx('invoices').insert({
      user_id: user.id,
      project_id: data.projectId || null,
      client_id: data.clientId || null,
      invoice_number: invoiceNumber,
      invoice_date: data.invoiceDate ? new Date(data.invoiceDate) : new Date(defaultInvDate),
      due_date: data.dueDate ? new Date(data.dueDate) : new Date(defaultDueDate),
      payment_terms: data.paymentTerms || 'net_14',
      customer_name: data.customerName,
      customer_email: data.customerEmail || null,
      customer_contact: data.customerContact || null,
      customer_address: data.customerAddress || null,
      service_description: data.serviceDescription || null,
      currency,
      base_currency: baseCurrency,
      fx_rate: fxRate,
      seller_name: data.sellerName || user.business_name || user.name,
      seller_logo: data.sellerLogo || user.logo_url || null,
      seller_address: data.sellerAddress || user.business_address || null,
      seller_email: data.sellerEmail || user.business_email || user.email,
      seller_phone: data.sellerPhone || user.business_phone || null,
      seller_tax_id: data.sellerTaxId || user.tax_id || null,
      tax_id_label: data.taxIdLabel || user.tax_id_label || 'Tax ID / VAT Reg',
      subtotal,
      discount,
      tax_mode: data.taxMode,
      tax_percent: data.taxPercent || 0,
      tax_amount: taxAmount,
      is_reverse_charge: Boolean(data.isReverseCharge),
      total,
      base_total: baseTotal,
      amount_paid: 0.0000,
      balance_due: total,
      notes: data.notes || null,
      status: statusLower,
      public_token: publicToken,
      pdf_template: data.pdfTemplate || 'modern_clean',
      reminders_enabled: Boolean(data.remindersEnabled),
      payment_link_url: data.paymentLinkUrl || null,
      payment_link_provider: data.paymentLinkProvider || null,
      is_immutable: false,
      created_at: new Date(),
      updated_at: new Date(),
    })

    if (items.length > 0) {
      await trx('invoice_items').insert(
        items.map((it) => ({
          invoice_id: newId,
          ...it,
          created_at: new Date(),
        }))
      )
    }

    if (calculatedTaxes.length > 0) {
      await trx('invoice_taxes').insert(
        calculatedTaxes.map((tx) => ({
          invoice_id: newId,
          ...tx,
          created_at: new Date(),
        }))
      )
    }

    createdInvoice = await trx('invoices').where({ id: newId }).first()
  })

  recordAddonUsage(String(user.id), 'basic-invoicing')

  // Emit trusted analytics event
  await logAnalyticsEvent(user.id, 'invoice_created', {
    invoice_id: createdInvoice.id,
    currency: createdInvoice.currency,
    total: Number(createdInvoice.total),
    items_count: data.items?.length || 0,
  })

  return sendSuccess(
    event,
    {
      message: `Invoice ${createdInvoice.invoice_number} created successfully.`,
      invoiceNumber: createdInvoice.invoice_number,
      invoice: {
        id: createdInvoice.id,
        invoiceNumber: createdInvoice.invoice_number,
        invoiceDate: createdInvoice.invoice_date,
        dueDate: createdInvoice.due_date,
        currency: createdInvoice.currency,
        subtotal: Number(createdInvoice.subtotal),
        discount: Number(createdInvoice.discount),
        taxPercent: Number(createdInvoice.tax_percent),
        taxAmount: Number(createdInvoice.tax_amount),
        isReverseCharge: Boolean(createdInvoice.is_reverse_charge),
        total: Number(createdInvoice.total),
        amountPaid: Number(createdInvoice.amount_paid || 0),
        balanceDue: Number(createdInvoice.balance_due),
        publicToken: createdInvoice.public_token,
        paymentLinkUrl: createdInvoice.payment_link_url,
        payment_link_url: createdInvoice.payment_link_url,
        status: createdInvoice.status,
      },
    },
    undefined,
    201
  )
})
