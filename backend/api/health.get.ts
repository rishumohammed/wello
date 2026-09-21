// backend/api/health.get.ts
import { defineEventHandler } from 'h3'

const startTime = Date.now()

export default defineEventHandler(() => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000)
  const memUsage = process.memoryUsage()

  return {
    status: 'healthy',
    uptimeSeconds,
    nodeVersion: process.version,
    memory: {
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  }
})
