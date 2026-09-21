// backend/api/export/csv.get.ts
import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { exportEntityCsv } from '../../utils/exportService'
import { sendError } from '../../utils/apiResponse'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const entity = (query.entity as string) || 'sessions'

  try {
    const csvContent = await exportEntityCsv(user.id, entity)
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `wello-${entity}-${timestamp}.csv`

    setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

    return csvContent
  } catch (err: any) {
    return sendError(event, 400, 'EXPORT_FAILED', err?.message || 'Failed to generate entity CSV export.')
  }
})
