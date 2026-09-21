// backend/api/import/preview.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { generateImportPreview } from '../../utils/importService'
import { sendError, formatZodError } from '../../utils/apiResponse'

const previewSchema = z.object({
  csvText: z.string().min(1, 'CSV content is required.'),
  targetEntity: z.enum(['sessions', 'payments', 'clients']).optional(),
  mapping: z.record(z.string()).optional(),
})

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody(event).catch(() => ({}))

  const parsed = previewSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { csvText, targetEntity, mapping } = parsed.data
  const preview = generateImportPreview(csvText, targetEntity, mapping)

  return {
    success: true,
    data: preview,
    ...preview,
  }
})
