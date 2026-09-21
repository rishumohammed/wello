// backend/api/invoices/recurring/index.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireAddon } from '../../../utils/addonGuard'
import { getDb } from '../../../utils/db'
import { sendSuccess, sendError, formatZodError } from '../../../utils/apiResponse'

const recurringProfileSchema = z.object({
  id: z.number().optional(),
  title: z.string().min(1, 'Title is required.'),
  clientId: z.number().nullable().optional(),
  projectId: z.number().nullable().optional(),
  incomeSourceId: z.number().nullable().optional(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annual', 'custom_days']).default('monthly'),
  intervalDays: z.number().nullable().optional(),
  nextIssueDate: z.string().optional(),
  paymentTerms: z.string().optional().default('net_14'),
  currency: z.string().length(3).optional().default('USD'),
  subtotal: z.number().min(0).optional().default(0),
  taxAmount: z.number().min(0).optional().default(0),
  total: z.number().min(0).optional().default(0),
  autoSend: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  templateData: z.object({
    customerName: z.string().optional(),
    customerEmail: z.string().optional(),
    items: z.array(z.any()).optional().default([]),
    taxes: z.array(z.any()).optional().default([]),
    notes: z.string().optional(),
  }).optional().default({}),
})

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'recurring-retainers')
  const body = await readBody(event)
  const parsed = recurringProfileSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const data = parsed.data
  const db = getDb()

  const defaultNextDate = data.nextIssueDate ? new Date(data.nextIssueDate) : new Date(Date.now() + 30 * 86400000)

  if (data.id) {
    const existing = await db('recurring_invoice_profiles')
      .where({ id: data.id, user_id: user.id })
      .whereNull('deleted_at')
      .first()

    if (!existing) {
      return sendError(event, 404, 'PROFILE_NOT_FOUND', 'Recurring invoice profile not found.')
    }

    await db('recurring_invoice_profiles')
      .where({ id: data.id })
      .update({
        title: data.title,
        client_id: data.clientId !== undefined ? data.clientId : existing.client_id,
        project_id: data.projectId !== undefined ? data.projectId : existing.project_id,
        income_source_id: data.incomeSourceId !== undefined ? data.incomeSourceId : existing.income_source_id,
        frequency: data.frequency,
        interval_days: data.intervalDays !== undefined ? data.intervalDays : existing.interval_days,
        next_issue_date: data.nextIssueDate ? new Date(data.nextIssueDate) : existing.next_issue_date,
        payment_terms: data.paymentTerms || existing.payment_terms,
        currency: (data.currency || existing.currency).toUpperCase().slice(0, 3),
        subtotal: data.subtotal !== undefined ? data.subtotal : existing.subtotal,
        tax_amount: data.taxAmount !== undefined ? data.taxAmount : existing.tax_amount,
        total: data.total !== undefined ? data.total : existing.total,
        auto_send: data.autoSend !== undefined ? Boolean(data.autoSend) : existing.auto_send,
        is_active: data.isActive !== undefined ? Boolean(data.isActive) : existing.is_active,
        template_data: JSON.stringify(data.templateData || {}),
        updated_at: new Date(),
      })

    const updated = await db('recurring_invoice_profiles').where({ id: data.id }).first()
    return sendSuccess(event, { profile: updated })
  }

  const [newId] = await db('recurring_invoice_profiles').insert({
    user_id: user.id,
    client_id: data.clientId || null,
    project_id: data.projectId || null,
    income_source_id: data.incomeSourceId || null,
    title: data.title,
    frequency: data.frequency,
    interval_days: data.intervalDays || null,
    next_issue_date: defaultNextDate,
    payment_terms: data.paymentTerms,
    currency: (data.currency || 'USD').toUpperCase().slice(0, 3),
    subtotal: data.subtotal,
    tax_amount: data.taxAmount,
    total: data.total,
    auto_send: Boolean(data.autoSend),
    is_active: Boolean(data.isActive),
    template_data: JSON.stringify(data.templateData || {}),
    created_at: new Date(),
    updated_at: new Date(),
  })

  const created = await db('recurring_invoice_profiles').where({ id: newId }).first()
  return sendSuccess(event, { profile: created }, undefined, 201)
})
