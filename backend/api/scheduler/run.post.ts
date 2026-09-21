// backend/api/scheduler/run.post.ts
import { defineEventHandler } from 'h3'
import { sendSuccess } from '../../utils/apiResponse'
import { runScheduledJobs } from '../../utils/schedulerEngine'

export default defineEventHandler(async (event) => {
  const result = await runScheduledJobs('manual_api_trigger')
  return sendSuccess(event, {
    message: result.acquiredLock ? 'Scheduled jobs executed successfully.' : 'Scheduler skipped (lock currently held by another worker).',
    ...result,
  })
})
