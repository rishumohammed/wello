// backend/api/admin/retention/run.post.ts
import { defineEventHandler } from 'h3'
import { requireAdmin } from '../../../utils/authGuard'
import { runDataRetentionPurge } from '../../../utils/dataRetentionService'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const summary = await runDataRetentionPurge()

  return {
    success: true,
    message: 'Data retention cleanup executed successfully.',
    data: {
      summary,
    },
    summary,
  }
})
