// backend/api/health/details.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getDb } from '../../utils/db'

const startTime = Date.now()

export default defineEventHandler(async (event) => {
  // Protected endpoint for authenticated admins with system.view permission
  await requirePermission(event, 'system.view')

  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000)
  const memUsage = process.memoryUsage()
  const db = getDb()

  let dbStatus = 'connected'
  try {
    await db.raw('SELECT 1')
  } catch {
    dbStatus = 'disconnected'
  }

  return {
    status: 'healthy',
    uptimeSeconds,
    nodeVersion: process.version,
    database: dbStatus,
    memory: {
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  }
})
