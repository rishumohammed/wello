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
              if (serverUpdated > clientBaseline + 1000 && Number(existing.amount) !== Number(payload.amount)) {
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
        if (entityType === 'project' || action.includes('PROJECT')) {
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
