// backend/api/export/all.get.ts
import { defineEventHandler, setResponseHeader } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { exportAllUserDataZip } from '../../utils/exportService'
import { logAnalyticsEvent } from '../../utils/analyticsService'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const zipBuffer = await exportAllUserDataZip(user.id)

  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `wello-backup-${timestamp}.zip`

  // Log analytics event
  await logAnalyticsEvent(user.id, 'export_downloaded', { format: 'zip' })

  setResponseHeader(event, 'Content-Type', 'application/zip')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)
  setResponseHeader(event, 'Content-Length', zipBuffer.length.toString())

  return zipBuffer
})
