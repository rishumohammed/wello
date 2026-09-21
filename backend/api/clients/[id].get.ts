// backend/api/clients/[id].get.ts
import { defineEventHandler, getRouterParam } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { getDb } from '../../utils/authService'
import { sendSuccess, sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const idParam = getRouterParam(event, 'id')
  const clientId = Number(idParam)

  if (!clientId || isNaN(clientId)) {
    return sendError(event, 400, 'INVALID_ID', 'Invalid client ID parameter.')
  }

  const db = getDb()
  const client = await db('clients')
    .where({ id: clientId, user_id: user.id })
    .whereNull('deleted_at')
    .first()

  if (!client) {
    return sendError(event, 404, 'CLIENT_NOT_FOUND', 'Client not found.')
  }

  // Fetch linked projects
  const projects = await db('projects')
    .where({ client_id: clientId, user_id: user.id })
    .whereNull('deleted_at')
    .orderBy('updated_at', 'desc')

  // Financial summary
  const [financials] = await db('payments')
    .where({ client_id: clientId, user_id: user.id })
    .whereNull('deleted_at')
    .select(db.raw('COUNT(id) as total_payments, COALESCE(SUM(amount), 0) as total_paid'))

  return sendSuccess(event, {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone_e164,
    company: client.company,
    country: client.country,
    notes: client.notes,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      isJob: Boolean(p.is_job),
      quoteAmount: p.quote_amount !== null ? Number(p.quote_amount) : null,
      currency: p.currency,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    })),
    stats: {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => ['in_progress', 'approved'].includes(p.status)).length,
      totalPayments: Number(financials?.total_payments || 0),
      totalPaid: Number(financials?.total_paid || 0),
    },
    createdAt: client.created_at,
    updatedAt: client.updated_at,
  })
})
