// backend/api/reports/summary.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requireAddon } from '../../utils/addonService'
import { sendSuccess } from '../../utils/apiResponse'
import { generateReportSummary } from '../../utils/reportsEngine'

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'executive-reports')
  const query = getQuery(event)

  const rawRange = query.range || query.period
  const range = (rawRange === 'daily' || rawRange === 'weekly' || rawRange === 'monthly' || rawRange === '90d' || rawRange === 'ytd' || rawRange === 'all')
    ? rawRange
    : 'weekly'

  const dateStr = typeof query.date === 'string' ? query.date : undefined

  const report = await generateReportSummary({
    userId: user.id,
    range,
    date: dateStr,
    timezone: user.timezone,
    currency: user.base_currency,
  })

  return sendSuccess(event, report)
})
