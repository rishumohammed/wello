// backend/api/sync.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../utils/authGuard'
import { getDb } from '../utils/authService'
import { sendSuccess, sendError, formatZodError } from '../utils/apiResponse'

const mutationSchema = z.object({
  id: z.string(),
  idempotencyKey: z.string(),
  action: z.string(),
  endpoint: z.string(),
  method: z.enum(['POST', 'PUT', 'DELETE', 'PATCH']),
  payload: z.record(z.any()).optional().default({}),
  entityType: z.string().optional().default('generic'),
  localId: z.union([z.string(), z.number()]).nullable().optional(),
  baselineUpdatedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
})

const syncPostSchema = z.object({
  mutations: z.array(mutationSchema).optional().default([]),
  since: z.string().optional(),
})

const MONEY_ENTITY_TYPES = new Set([
  'payment',
  'expense',
  'project_expense',
  'overhead',
  'overhead_expense',
  'income_source',
  'invoice',
  'quote',
  'project_quote',
  'recurring_profile',
  'recurring_invoice_profile',
])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  const parseResult = syncPostSchema.safeParse(body)
  if (!parseResult.success) {
    const formatted = formatZodError(parseResult.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { mutations, since } = parseResult.data
  const db = getDb()

  const acknowledgedIds: string[] = []
  const conflicts: any[] = []

  // Execute mutations in transaction
  await db.transaction(async (trx) => {
    for (const m of mutations) {
      try {
        const { action, method, payload, entityType, localId, baselineUpdatedAt } = m

        // 1. PAYMENT MUTATIONS
        if (entityType === 'payment' || action.includes('PAYMENT')) {
          if (method === 'POST') {
            const [newId] = await trx('payments').insert({
              user_id: user.id,
              project_id: payload.projectId || null,
              income_source_id: payload.incomeSourceId || null,
              client_id: payload.clientId || null,
              amount: Number(payload.amount || 0),
              currency: payload.currency || user.base_currency || 'USD',
              paid_date: payload.paidDate ? new Date(payload.paidDate) : new Date(),
              is_expected: Boolean(payload.isExpected),
              status: payload.status || 'paid',
              notes: payload.notes || null,
              created_at: new Date(),
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          } else if (method === 'PUT' && payload.id) {
            const existing = await trx('payments').where({ id: payload.id, user_id: user.id }).whereNull('deleted_at').first()
            if (existing) {
              const serverUpdated = new Date(existing.updated_at).getTime()
              const clientBaseline = baselineUpdatedAt ? new Date(baselineUpdatedAt).getTime() : 0

              // Conflict check on money row
              if (baselineUpdatedAt && serverUpdated > clientBaseline + 1000 && Number(existing.amount) !== Number(payload.amount)) {
                conflicts.push({
                  mutationId: m.id,
                  entityType: 'payment',
                  recordId: existing.id,
                  serverRecord: {
                    id: existing.id,
                    amount: Number(existing.amount),
                    currency: existing.currency,
                    paidDate: existing.paid_date,
                    notes: existing.notes,
                    updatedAt: existing.updated_at,
                  },
                  clientPayload: payload,
                  message: `Payment #${existing.id} was updated on another device (${existing.currency} ${existing.amount}).`,
                })
                continue
              }

              await trx('payments').where({ id: payload.id }).update({
                amount: payload.amount !== undefined ? Number(payload.amount) : existing.amount,
                currency: payload.currency || existing.currency,
                paid_date: payload.paidDate ? new Date(payload.paidDate) : existing.paid_date,
                status: payload.status || existing.status,
                notes: payload.notes !== undefined ? payload.notes : existing.notes,
                updated_at: new Date(),
              })
            }
            acknowledgedIds.push(m.id)
          } else if (method === 'DELETE' && (payload.id || localId)) {
            const pId = payload.id || localId
            await trx('payments').where({ id: pId, user_id: user.id }).update({
              deleted_at: new Date(),
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          }
          continue
        }

        // 2. WORK SESSION MUTATIONS
        if (entityType === 'session' || entityType === 'work_session' || action.includes('SESSION')) {
          if (method === 'POST') {
            const durSeconds = payload.durationSeconds !== undefined
              ? Number(payload.durationSeconds)
              : (payload.durationMinutes ? Number(payload.durationMinutes) * 60 : (payload.durationMin ? Number(payload.durationMin) * 60 : 3600))

            const started = payload.startedAt ? new Date(payload.startedAt) : new Date(Date.now() - durSeconds * 1000)
            const ended = payload.endedAt ? new Date(payload.endedAt) : new Date(started.getTime() + durSeconds * 1000)

            await trx('work_sessions').insert({
              user_id: user.id,
              project_id: payload.projectId || null,
              income_source_id: payload.incomeSourceId || null,
              title: payload.title || 'Work session',
              type: payload.type || 'production',
              payment_type: payload.paymentType || 'paid',
              unpaid_reason: payload.unpaidReason || null,
              unpaid_category: payload.unpaidCategory || null,
              started_at: started,
              ended_at: ended,
              duration_seconds: durSeconds,
              paused_seconds: Number(payload.pausedSeconds || 0),
              notes: payload.notes || null,
              created_at: new Date(),
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          } else if (method === 'PUT' && payload.id) {
            const durSeconds = payload.durationSeconds !== undefined
              ? Number(payload.durationSeconds)
              : (payload.durationMinutes ? Number(payload.durationMinutes) * 60 : undefined)

            await trx('work_sessions').where({ id: payload.id, user_id: user.id }).update({
              title: payload.title,
              type: payload.type,
              payment_type: payload.paymentType,
              unpaid_reason: payload.unpaidReason,
              unpaid_category: payload.unpaidCategory,
              started_at: payload.startedAt ? new Date(payload.startedAt) : undefined,
              ended_at: payload.endedAt ? new Date(payload.endedAt) : undefined,
              duration_seconds: durSeconds,
              notes: payload.notes,
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          } else if (method === 'DELETE' && (payload.id || localId)) {
            await trx('work_sessions').where({ id: payload.id || localId, user_id: user.id }).update({
              deleted_at: new Date(),
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          }
          continue
        }

        // 3. EXPENSE MUTATIONS
        if (entityType === 'expense' || entityType === 'project_expense' || action.includes('EXPENSE')) {
          if (method === 'POST') {
            await trx('project_expenses').insert({
              user_id: user.id,
              project_id: payload.projectId || null,
              category: payload.category || 'General',
              amount: Number(payload.amount || 0),
              currency: payload.currency || user.base_currency || 'USD',
              expense_date: payload.expenseDate ? new Date(payload.expenseDate) : new Date(),
              notes: payload.notes || null,
              created_at: new Date(),
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          } else if (method === 'DELETE' && (payload.id || localId)) {
            await trx('project_expenses').where({ id: payload.id || localId, user_id: user.id }).update({
              deleted_at: new Date(),
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          }
          continue
        }

        // 4. OVERHEAD MUTATIONS
        if (entityType === 'overhead' || entityType === 'overhead_expense' || action.includes('OVERHEAD')) {
          if (method === 'POST') {
            await trx('overhead_expenses').insert({
              user_id: user.id,
              description: payload.description || payload.name || 'Overhead',
              category: payload.category || 'Software & Tools',
              amount: Number(payload.amount || 0),
              currency: payload.currency || user.base_currency || 'USD',
              expense_date: payload.expenseDate ? new Date(payload.expenseDate) : new Date(),
              is_recurring: Boolean(payload.isRecurring),
              recurring_period: payload.recurringPeriod || payload.frequency || 'monthly',
              notes: payload.notes || null,
              created_at: new Date(),
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          }
          continue
        }

        // 5. PROJECT MUTATIONS
        if ((entityType === 'project' || action.includes('PROJECT')) && !action.includes('QUOTE') && entityType !== 'quote' && entityType !== 'project_quote') {
          if (method === 'POST') {
            await trx('projects').insert({
              user_id: user.id,
              client_id: payload.clientId || null,
              category_id: payload.categoryId || null,
              name: payload.name || 'Untitled Project',
              description: payload.description || null,
              service_category: payload.serviceCategory || 'General',
              status: payload.status || 'potential',
              is_job: Boolean(payload.isJob),
              currency: payload.currency || user.base_currency || 'USD',
              quote_amount: payload.quoteAmount !== undefined ? Number(payload.quoteAmount) : null,
              quote_est_hours: payload.quoteEstHours !== undefined ? Number(payload.quoteEstHours) : null,
              created_at: new Date(),
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          } else if (method === 'PUT' && payload.id) {
            await trx('projects').where({ id: payload.id, user_id: user.id }).update({
              name: payload.name,
              description: payload.description,
              service_category: payload.serviceCategory,
              status: payload.status,
              is_job: payload.isJob !== undefined ? Boolean(payload.isJob) : undefined,
              currency: payload.currency,
              quote_amount: payload.quoteAmount !== undefined ? Number(payload.quoteAmount) : undefined,
              quote_est_hours: payload.quoteEstHours !== undefined ? Number(payload.quoteEstHours) : undefined,
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          }
          continue
        }

        // 6. CLIENT MUTATIONS
        if (entityType === 'client' || action.includes('CLIENT')) {
          if (method === 'POST') {
            await trx('clients').insert({
              user_id: user.id,
              name: payload.name || 'New Client',
              email: payload.email || null,
              company: payload.company || null,
              phone_e164: payload.phone || payload.phone_e164 || null,
              country: payload.country || null,
              notes: payload.notes || null,
              created_at: new Date(),
              updated_at: new Date(),
            })
            acknowledgedIds.push(m.id)
          } else if (method === 'PUT' && payload.id) {
            await trx('clients').where({ id: payload.id, user_id: user.id }).update({
              name: payload.name,
              email: payload.email,
              company: payload.company,
              phone_e164: payload.phone || payload.phone_e164,
              country: payload.country,
              notes: payload.notes,
              updated_at: new Date(),
            })
          acknowledgedIds.push(m.id)
        }
        continue
      }

      // 7. PROJECT QUOTE MUTATIONS
      if (entityType === 'quote' || entityType === 'project_quote' || action.includes('QUOTE')) {
        const quoteAmount = payload.quoteAmount !== undefined ? Number(payload.quoteAmount) : (payload.amount !== undefined ? Number(payload.amount) : 0)
        const estHours = payload.estHours !== undefined ? Number(payload.estHours) : (payload.estimatedHours !== undefined ? Number(payload.estimatedHours) : null)
        const quoteDate = payload.quoteDate ? new Date(payload.quoteDate) : new Date()

        if (method === 'POST') {
          await trx('project_quotes').insert({
            user_id: user.id,
            project_id: payload.projectId || null,
            version: payload.version || 1,
            quote_amount: quoteAmount,
            currency: payload.currency || user.base_currency || 'USD',
            est_hours: estHours,
            quote_date: quoteDate,
            valid_until: payload.validUntil ? new Date(payload.validUntil) : null,
            status: payload.status || 'draft',
            notes: payload.notes || null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        } else if (method === 'PUT' && payload.id) {
          const existing = await trx('project_quotes').where({ id: payload.id, user_id: user.id }).whereNull('deleted_at').first()
          if (existing) {
            const serverUpdated = new Date(existing.updated_at).getTime()
            const clientBaseline = baselineUpdatedAt ? new Date(baselineUpdatedAt).getTime() : 0

            if (baselineUpdatedAt && serverUpdated > clientBaseline + 1000 && Number(existing.quote_amount) !== quoteAmount) {
              conflicts.push({
                mutationId: m.id,
                entityType: 'project_quote',
                recordId: existing.id,
                serverRecord: existing,
                clientPayload: payload,
                message: `Quote #${existing.id} was updated on another device (${existing.currency} ${existing.quote_amount}).`,
              })
              continue
            }

            await trx('project_quotes').where({ id: payload.id }).update({
              quote_amount: quoteAmount,
              currency: payload.currency || existing.currency,
              est_hours: estHours !== null ? estHours : existing.est_hours,
              status: payload.status || existing.status,
              notes: payload.notes !== undefined ? payload.notes : existing.notes,
              updated_at: new Date(),
            })
          }
          acknowledgedIds.push(m.id)
        } else if (method === 'DELETE' && (payload.id || localId)) {
          await trx('project_quotes').where({ id: payload.id || localId, user_id: user.id }).update({
            deleted_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        }
        continue
      }

      // 8. RECURRING INVOICE PROFILE MUTATIONS
      if (entityType === 'recurring_profile' || entityType === 'recurring_invoice_profile' || action.includes('RECURRING')) {
        const title = payload.title || payload.profileName || 'Retainer'
        const total = payload.total !== undefined ? Number(payload.total) : (payload.amount !== undefined ? Number(payload.amount) : 0)
        const subtotal = payload.subtotal !== undefined ? Number(payload.subtotal) : total
        const templateData = typeof payload.templateData === 'object'
          ? JSON.stringify(payload.templateData)
          : (typeof payload.templateData === 'string' ? payload.templateData : JSON.stringify({ items: [], notes: payload.notes || '' }))

        if (method === 'POST') {
          await trx('recurring_invoice_profiles').insert({
            user_id: user.id,
            client_id: payload.clientId || null,
            project_id: payload.projectId || null,
            income_source_id: payload.incomeSourceId || null,
            title,
            frequency: payload.frequency || 'monthly',
            interval_days: payload.intervalDays !== undefined ? Number(payload.intervalDays) : null,
            next_issue_date: payload.nextIssueDate ? new Date(payload.nextIssueDate) : new Date(),
            payment_terms: payload.paymentTerms || 'net_14',
            currency: payload.currency || user.base_currency || 'USD',
            subtotal,
            tax_amount: Number(payload.taxAmount || 0),
            total,
            is_active: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
            auto_send: payload.autoSend !== undefined ? Boolean(payload.autoSend) : false,
            template_data: templateData,
            created_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        } else if ((method === 'PUT' || method === 'PATCH') && (payload.id || localId)) {
          const recId = payload.id || localId
          const existing = await trx('recurring_invoice_profiles').where({ id: recId, user_id: user.id }).whereNull('deleted_at').first()
          if (existing) {
            const serverUpdated = new Date(existing.updated_at).getTime()
            const clientBaseline = baselineUpdatedAt ? new Date(baselineUpdatedAt).getTime() : 0

            if (baselineUpdatedAt && serverUpdated > clientBaseline + 1000 && (Number(existing.total) !== total || (payload.isActive !== undefined && Boolean(existing.is_active) !== Boolean(payload.isActive)))) {
              conflicts.push({
                mutationId: m.id,
                entityType: 'recurring_profile',
                recordId: existing.id,
                serverRecord: existing,
                clientPayload: payload,
                message: `Recurring profile #${existing.id} was modified on another device (${existing.title}).`,
              })
              continue
            }

            const updateObj: Record<string, any> = {
              updated_at: new Date(),
            }
            if (payload.clientId !== undefined) updateObj.client_id = payload.clientId
            if (payload.project_id !== undefined || payload.projectId !== undefined) updateObj.project_id = payload.projectId !== undefined ? payload.projectId : payload.project_id
            if (payload.incomeSourceId !== undefined) updateObj.income_source_id = payload.incomeSourceId
            if (payload.title || payload.profileName) updateObj.title = payload.title || payload.profileName
            if (payload.frequency !== undefined) updateObj.frequency = payload.frequency
            if (payload.intervalDays !== undefined) updateObj.interval_days = payload.intervalDays
            if (payload.paymentTerms !== undefined) updateObj.payment_terms = payload.paymentTerms
            if (payload.total !== undefined || payload.amount !== undefined) updateObj.total = total
            if (payload.subtotal !== undefined) updateObj.subtotal = Number(payload.subtotal)
            if (payload.taxAmount !== undefined) updateObj.tax_amount = Number(payload.taxAmount)
            if (payload.currency) updateObj.currency = payload.currency
            if (payload.nextIssueDate) updateObj.next_issue_date = new Date(payload.nextIssueDate)
            if (payload.isActive !== undefined) updateObj.is_active = Boolean(payload.isActive)
            if (payload.autoSend !== undefined) updateObj.auto_send = Boolean(payload.autoSend)
            if (payload.templateData !== undefined) updateObj.template_data = typeof payload.templateData === 'object' ? JSON.stringify(payload.templateData) : payload.templateData

            await trx('recurring_invoice_profiles').where({ id: recId }).update(updateObj)
          }
          acknowledgedIds.push(m.id)
        } else if (method === 'DELETE' && (payload.id || localId)) {
          await trx('recurring_invoice_profiles').where({ id: payload.id || localId, user_id: user.id }).update({
            deleted_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        }
        continue
      }

      // 9. INCOME SOURCE MUTATIONS
      if (entityType === 'income_source' || action.includes('INCOME_SOURCE')) {
        if (method === 'POST') {
          await trx('income_sources').insert({
            user_id: user.id,
            name: payload.name || 'Income Source',
            type: payload.type || 'other',
            amount: Number(payload.amount || payload.expectedAmount || 0),
            currency: payload.currency || user.base_currency || 'USD',
            frequency: payload.frequency || payload.payFrequency || 'monthly',
            is_active: payload.isActive !== undefined ? Boolean(payload.isActive) : (payload.status === 'archived' ? false : true),
            notes: payload.notes || null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        } else if ((method === 'PUT' || method === 'PATCH') && (payload.id || localId)) {
          const incId = payload.id || localId
          await trx('income_sources').where({ id: incId, user_id: user.id }).update({
            name: payload.name,
            type: payload.type,
            amount: payload.amount !== undefined ? Number(payload.amount) : (payload.expectedAmount !== undefined ? Number(payload.expectedAmount) : undefined),
            currency: payload.currency,
            frequency: payload.frequency || payload.payFrequency,
            is_active: payload.isActive !== undefined ? Boolean(payload.isActive) : (payload.status !== undefined ? payload.status !== 'archived' : undefined),
            notes: payload.notes,
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        } else if (method === 'DELETE' && (payload.id || localId)) {
          await trx('income_sources').where({ id: payload.id || localId, user_id: user.id }).update({
            deleted_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        }
        continue
      }

      // 10. TAX RATE MUTATIONS
      if (entityType === 'tax_rate' || action.includes('TAX_RATE')) {
        if (method === 'POST') {
          const pct = payload.percentage !== undefined ? Number(payload.percentage) : (payload.ratePercent !== undefined ? Number(payload.ratePercent) : 0)
          await trx('tax_rates').insert({
            user_id: user.id,
            name: payload.name || 'Tax Rate',
            percentage: pct,
            is_inclusive: Boolean(payload.isInclusive),
            is_compound: Boolean(payload.isCompound),
            is_default: Boolean(payload.isDefault),
            is_reverse_charge: Boolean(payload.isReverseCharge),
            is_zero_rated: Boolean(payload.isZeroRated),
            description: payload.description || null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        } else if ((method === 'PUT' || method === 'PATCH') && (payload.id || localId)) {
          const tId = payload.id || localId
          const pct = payload.percentage !== undefined ? Number(payload.percentage) : (payload.ratePercent !== undefined ? Number(payload.ratePercent) : undefined)
          await trx('tax_rates').where({ id: tId, user_id: user.id }).update({
            name: payload.name,
            percentage: pct,
            is_inclusive: payload.isInclusive !== undefined ? Boolean(payload.isInclusive) : undefined,
            is_compound: payload.isCompound !== undefined ? Boolean(payload.isCompound) : undefined,
            is_default: payload.isDefault !== undefined ? Boolean(payload.isDefault) : undefined,
            description: payload.description,
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        } else if (method === 'DELETE' && (payload.id || localId)) {
          await trx('tax_rates').where({ id: payload.id || localId, user_id: user.id }).update({
            deleted_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        }
        continue
      }

      // 11. INVOICE MUTATIONS
      if (entityType === 'invoice' || action.includes('INVOICE')) {
        if (method === 'POST') {
          await trx('invoices').insert({
            user_id: user.id,
            project_id: payload.projectId || null,
            client_id: payload.clientId || null,
            invoice_number: payload.invoiceNumber || `INV-${Date.now()}`,
            invoice_date: payload.invoiceDate ? new Date(payload.invoiceDate) : new Date(),
            due_date: payload.dueDate ? new Date(payload.dueDate) : new Date(Date.now() + 14 * 86400000),
            customer_name: payload.customerName || 'Customer',
            customer_email: payload.customerEmail || null,
            currency: payload.currency || user.base_currency || 'USD',
            subtotal: Number(payload.subtotal || 0),
            discount: Number(payload.discount || 0),
            tax_percent: Number(payload.taxPercent || 0),
            tax_amount: Number(payload.taxAmount || 0),
            total: Number(payload.total || 0),
            notes: payload.notes || null,
            status: (payload.status || 'DRAFT').toUpperCase(),
            created_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        } else if ((method === 'PUT' || method === 'PATCH') && (payload.id || localId)) {
          const invId = payload.id || localId
          const existing = await trx('invoices').where({ id: invId, user_id: user.id }).whereNull('deleted_at').first()
          if (existing) {
            const serverUpdated = new Date(existing.updated_at).getTime()
            const clientBaseline = baselineUpdatedAt ? new Date(baselineUpdatedAt).getTime() : 0

            if (baselineUpdatedAt && serverUpdated > clientBaseline + 1000 && Number(existing.total) !== Number(payload.total)) {
              conflicts.push({
                mutationId: m.id,
                entityType: 'invoice',
                recordId: existing.id,
                serverRecord: existing,
                clientPayload: payload,
                message: `Invoice #${existing.invoice_number} was modified on another device.`,
              })
              continue
            }

            await trx('invoices').where({ id: invId }).update({
              notes: payload.notes !== undefined ? payload.notes : existing.notes,
              status: payload.status !== undefined ? payload.status.toUpperCase() : existing.status,
              updated_at: new Date(),
            })
          }
          acknowledgedIds.push(m.id)
        } else if (method === 'DELETE' && (payload.id || localId)) {
          await trx('invoices').where({ id: payload.id || localId, user_id: user.id }).update({
            deleted_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
        }
        continue
      }

      // 12. OFFLINE TIMER EVENT MUTATIONS (Single-Active-Timer Rule)
      if (entityType === 'timer' || action.startsWith('TIMER_')) {
        const timerAction = action.toUpperCase()

        if (timerAction === 'TIMER_START' || timerAction === 'START' || (entityType === 'timer' && method === 'POST' && timerAction === '')) {
          // Check for active server timer
          const existingActive = await trx('work_sessions')
            .where({ user_id: user.id })
            .whereNull('ended_at')
            .whereNull('deleted_at')
            .first()

          if (existingActive && existingActive.id !== payload.sessionId && !payload.forceSwitch) {
            conflicts.push({
              mutationId: m.id,
              entityType: 'timer',
              code: 'ACTIVE_TIMER_CONFLICT',
              status: 409,
              serverRecord: {
                id: existingActive.id,
                title: existingActive.title,
                startedAt: existingActive.started_at,
                projectId: existingActive.project_id,
              },
              clientPayload: payload,
              message: 'An active timer is already running on another device.',
              options: ['DISCARD_LOCAL', 'FORCE_STOP_SERVER'],
            })
            continue
          }

          // If force switch, close running server timer
          if (existingActive && payload.forceSwitch) {
            await trx('work_sessions').where({ id: existingActive.id }).update({
              ended_at: new Date(),
              updated_at: new Date(),
            })
          }

          const started = payload.startedAt ? new Date(payload.startedAt) : new Date()
          await trx('work_sessions').insert({
            user_id: user.id,
            project_id: payload.projectId || null,
            income_source_id: payload.incomeSourceId || null,
            title: payload.title || 'Work session',
            type: payload.type || 'production',
            payment_type: payload.paymentType || 'paid',
            unpaid_reason: payload.unpaidReason || null,
            started_at: started,
            ended_at: null,
            duration_seconds: 0,
            paused_seconds: 0,
            notes: payload.notes || null,
            created_at: new Date(),
            updated_at: new Date(),
          })
          acknowledgedIds.push(m.id)
          continue
        }

        if (timerAction === 'TIMER_PAUSE' || timerAction === 'PAUSE') {
          const active = await trx('work_sessions')
            .where({ user_id: user.id })
            .whereNull('ended_at')
            .whereNull('deleted_at')
            .first()

          if (active) {
            await trx('work_session_pauses').insert({
              work_session_id: active.id,
              paused_at: payload.pausedAt ? new Date(payload.pausedAt) : new Date(),
              pause_duration_seconds: 0,
              created_at: new Date(),
            })
          }
          acknowledgedIds.push(m.id)
          continue
        }

        if (timerAction === 'TIMER_RESUME' || timerAction === 'RESUME') {
          const active = await trx('work_sessions')
            .where({ user_id: user.id })
            .whereNull('ended_at')
            .whereNull('deleted_at')
            .first()

          if (active) {
            const activePause = await trx('work_session_pauses')
              .where({ work_session_id: active.id })
              .whereNull('resumed_at')
              .orderBy('paused_at', 'desc')
              .first()

            if (activePause) {
              const resumeTime = payload.resumedAt ? new Date(payload.resumedAt) : new Date()
              const pauseSec = Math.max(0, Math.floor((resumeTime.getTime() - new Date(activePause.paused_at).getTime()) / 1000))

              await trx('work_session_pauses').where({ id: activePause.id }).update({
                resumed_at: resumeTime,
                pause_duration_seconds: pauseSec,
              })

              await trx('work_sessions').where({ id: active.id }).update({
                paused_seconds: (Number(active.paused_seconds) || 0) + pauseSec,
                updated_at: new Date(),
              })
            }
          }
          acknowledgedIds.push(m.id)
          continue
        }

        if (timerAction === 'TIMER_STOP' || timerAction === 'STOP') {
          const active = await trx('work_sessions')
            .where({ user_id: user.id })
            .whereNull('ended_at')
            .whereNull('deleted_at')
            .orderBy('started_at', 'desc')
            .first()

          if (active) {
            const stopTime = payload.endedAt ? new Date(payload.endedAt) : new Date()
            const totalElapsed = Math.max(0, Math.floor((stopTime.getTime() - new Date(active.started_at).getTime()) / 1000))
            const netDuration = Math.max(0, totalElapsed - (Number(active.paused_seconds) || 0))

            await trx('work_sessions').where({ id: active.id }).update({
              ended_at: stopTime,
              duration_seconds: payload.durationSeconds !== undefined ? Number(payload.durationSeconds) : netDuration,
              updated_at: new Date(),
            })
          }
          acknowledgedIds.push(m.id)
          continue
        }
      }

      // Default acknowledge for other generic mutations
      acknowledgedIds.push(m.id)
    } catch (mutationErr) {
      console.error(`[Sync Engine] Error executing mutation ${m.id}:`, mutationErr)
    }
    }
  })

  // Fetch updated delta payload since the client's baseline
  const serverTime = new Date()
  let sinceDate: Date | null = null
  if (since && !isNaN(new Date(since).getTime())) {
    sinceDate = new Date(since)
  }

  const paymentsQuery = db('payments').where({ user_id: user.id }).whereNull('deleted_at')
  const sessionsQuery = db('work_sessions').where({ user_id: user.id }).whereNull('deleted_at')
  const projectsQuery = db('projects').where({ user_id: user.id }).whereNull('deleted_at')
  const clientsQuery = db('clients').where({ user_id: user.id }).whereNull('deleted_at')
  const expensesQuery = db('project_expenses').where({ user_id: user.id }).whereNull('deleted_at')

  if (sinceDate) {
    paymentsQuery.where('updated_at', '>', sinceDate)
    sessionsQuery.where('updated_at', '>', sinceDate)
    projectsQuery.where('updated_at', '>', sinceDate)
    clientsQuery.where('updated_at', '>', sinceDate)
    expensesQuery.where('updated_at', '>', sinceDate)
  }

  const [deltaPayments, deltaSessions, deltaProjects, deltaClients, deltaExpenses] = await Promise.all([
    paymentsQuery,
    sessionsQuery,
    projectsQuery,
    clientsQuery,
    expensesQuery,
  ])

  return sendSuccess(event, {
    acknowledgedIds,
    conflicts,
    delta: {
      payments: deltaPayments,
      sessions: deltaSessions,
      projects: deltaProjects,
      clients: deltaClients,
      expenses: deltaExpenses,
    },
    serverTime: serverTime.toISOString(),
  })
})
