// backend/api/reports/export.get.ts
import { defineEventHandler, getQuery, setHeader } from 'h3'
import { requireAddon } from '../../utils/addonService'
import { requireFairUseLimit } from '../../utils/fairUseService'
import { generateReportSummary, generateReportCsv, generateReportPdfBuffer } from '../../utils/reportsEngine'

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'executive-reports')
  const query = getQuery(event)

  const rawRange = query.range || query.period
  const range = (rawRange === 'daily' || rawRange === 'weekly' || rawRange === 'monthly' || rawRange === '90d' || rawRange === 'ytd' || rawRange === 'all')
    ? rawRange
    : 'weekly'

  const format = query.format === 'pdf' ? 'pdf' : 'csv'
  const dateStr = typeof query.date === 'string' ? query.date : undefined

  if (format === 'pdf') {
    await requireFairUseLimit(event, 'pdf_exports_per_hour')
  }

  const report = await generateReportSummary({
    userId: user.id,
    range,
    date: dateStr,
    timezone: user.timezone,
    currency: user.base_currency,
  })

  const filenameDate = report.startDateStr || 'report'

  if (format === 'pdf') {
    const pdfBuffer = generateReportPdfBuffer(report)
    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(event, 'Content-Disposition', `attachment; filename="Wello-Report-${range}-${filenameDate}.pdf"`)
    setHeader(event, 'Content-Length', pdfBuffer.length)
    return pdfBuffer
  }

  const csvContent = generateReportCsv(report)
  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="Wello-Report-${range}-${filenameDate}.csv"`)
  return csvContent
})
