// backend/api/ready.get.ts
import { defineEventHandler, setResponseStatus } from 'h3'
import { getDb } from '../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const db = getDb()
    const result = await db.raw('SELECT 1 as alive')

    if (!result) {
      setResponseStatus(event, 503)
      return {
        status: 'unavailable',
        database: 'unresponsive',
        timestamp: new Date().toISOString(),
      }
    }

    return {
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    }
  } catch (err: any) {
    setResponseStatus(event, 503)
    return {
      status: 'unavailable',
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    }
  }
})
