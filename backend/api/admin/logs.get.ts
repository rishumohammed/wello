// server/api/admin/logs.get.ts
import { defineEventHandler } from 'h3'
import { getAuthLogs } from '../../utils/authConfig'

export default defineEventHandler(() => {
  return {
    success: true,
    logs: getAuthLogs(),
  }
})
