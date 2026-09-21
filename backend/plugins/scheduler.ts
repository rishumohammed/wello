// backend/plugins/scheduler.ts
import { runScheduledJobs } from '../utils/schedulerEngine'

export default defineNitroPlugin((nitroApp) => {
  console.log('[Wello Scheduler Plugin] Initialized background scheduler worker.')

  // Run initial scheduler check after 5s startup delay
  setTimeout(async () => {
    try {
      await runScheduledJobs('nitro_startup_worker')
    } catch (err) {
      console.warn('[Wello Scheduler Plugin] Initial run error:', err)
    }
  }, 5000)

  // Periodic scheduler execution every 60 seconds
  const interval = setInterval(async () => {
    try {
      await runScheduledJobs('nitro_periodic_worker')
    } catch (err) {
      console.warn('[Wello Scheduler Plugin] Periodic run error:', err)
    }
  }, 60 * 1000)

  nitroApp.hooks.hook('close', () => {
    clearInterval(interval)
    console.log('[Wello Scheduler Plugin] Stopped scheduler worker.')
  })
})
