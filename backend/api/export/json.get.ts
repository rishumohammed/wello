// backend/api/export/json.get.ts
import { defineEventHandler, setResponseHeader } from 'h3'
import { requireUser } from '../../utils/authGuard'
import { collectFullUserData } from '../../utils/exportService'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const fullData = await collectFullUserData(user.id)

  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = `wello-export-${timestamp}.json`

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename}"`)

  return fullData
})
