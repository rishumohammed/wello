// backend/api/import/execute.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { executeImport } from '../../utils/importService'
import { sendError, formatZodError } from '../../utils/apiResponse'
import { logAnalyticsEvent } from '../../utils/analyticsService'

const executeSchema = z.object({
  csvText: z.string().min(1, 'CSV content is required.'),
  entityType: z.enum(['sessions', 'payments', 'clients']),
  mapping: z.record(z.string()),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event).catch(() => ({}))

  const parsed = executeSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { csvText, entityType, mapping } = parsed.data
  const result = await executeImport(user.id, csvText, entityType, mapping)

  // Log analytics event
  await logAnalyticsEvent(user.id, 'data_imported', {
    entityType,
    importedCount: result.importedCount,
    skippedCount: result.skippedCount,
  })

  return {
    success: true,
    message: `Successfully imported ${result.importedCount} ${entityType}.`,
    data: result,
    ...result,
  }
})
