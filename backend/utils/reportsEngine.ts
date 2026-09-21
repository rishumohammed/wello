// backend/utils/reportsEngine.ts
/**
 * Authoritative Reports & Export Engine for Wello
 * Computes Daily, Weekly, and Monthly business metrics, CSV exports, and Vector PDF documents.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'
import { getDb } from './db'
import { computeUnifiedMetricsSummary, computeIntelligenceInsights } from './metricsEngine'
import { generateReportPdf, ReportPdfData } from './pdfGenerator'
import { getUserToday, getUserDayRange } from './dateUtils'

dayjs.extend(utc)
dayjs.extend(timezonePlugin)

export interface ReportSummaryOptions {
  userId: number
  range: 'daily' | 'weekly' | 'monthly' | '30d' | '90d' | 'ytd' | 'all'
  date?: string // YYYY-MM-DD anchor date
  timezone?: string
  currency?: string
}

export interface ReportSummaryResult {
  range: string
  rangeLabel: string
  periodDates: string
  startDateStr: string
  endDateStr: string
  user: {
    id: number
    name: string
    email: string
    baseCurrency: string
    timezone: string
    targetHourly: number
  }
  hours: {
    paidHours: number
    unpaidClientHours: number
    intentionalUnpaidHours: number
    commuteHours: number
    totalAllHours: number
    unpaidRatioPct: number
  }
  financials: {
    collectedRevenue: number
    earnedRevenue: number
    directExpenses: number
    allocatedOverhead: number
    commuteExpenses: number
    collectedNetIncome: number
    earnedNetIncome: number
    outstandingRevenue: number
  }
  rates: {
    clientWorkRate: number
    allInRate: number
    earnedClientWorkRate: number
    earnedAllInRate: number
    targetHourlyRate: number
    targetDeltaPct: number
    isTargetMet: boolean
  }
  topLeakageReasons: Array<{
    reasonKey: string
    label: string
    category: string
    hours: number
    minutes: number
    pctOfUnpaid: number
    estimatedOpportunityCost: number
  }>
  clientRankings: Array<{
    clientId: number | string
    clientName: string
    company?: string
    hours: number
    netIncome: number
    collectedRevenue: number
    effectiveHourlyRate: number
    marginPct: number
  }>
  categoryYield: Array<{
    category: string
    projects: number
    hours: number
    netIncome: number
    effectiveHourly: number
  }>
  bestClient?: { name: string; rate: number }
  worstClient?: { name: string; rate: number }
  bestCategory?: { name: string; rate: number }
  worstCategory?: { name: string; rate: number }
}

export async function generateReportSummary(options: ReportSummaryOptions): Promise<ReportSummaryResult> {
  const db = getDb()
  const user = await db('users').where({ id: options.userId }).first()
  if (!user) throw new Error('User not found.')

  const tz = options.timezone || user.timezone || 'UTC'
  const baseCurrency = (options.currency || user.base_currency || 'USD').toUpperCase().slice(0, 3)
  const targetHourly = Number(user.target_hourly || 100)
  const anchorDateStr = options.date || getUserToday(tz)

  let startUtc: Date
  let endUtc: Date
  let startDateStr: string
  let endDateStr: string
  let rangeLabel: string

  const anchor = dayjs.tz(anchorDateStr, tz)

  if (options.range === 'daily') {
    const dayRange = getUserDayRange(anchorDateStr, tz)
    startUtc = dayRange.startUtc
    endUtc = dayRange.endUtc
    startDateStr = dayRange.startDateStr
    endDateStr = dayRange.endDateStr
    rangeLabel = `Daily Report (${anchor.format('MMM D, YYYY')})`
  } else if (options.range === 'weekly') {
    const weekRange = getUserWeekRange(anchorDateStr, tz)
    startDateStr = weekRange.startDateStr
    endDateStr = weekRange.endDateStr
    startUtc = weekRange.startUtc
    endUtc = weekRange.endUtc
    const monday = dayjs.tz(startDateStr, tz)
    const sunday = dayjs.tz(endDateStr, tz)
    rangeLabel = `Weekly Report (${monday.format('MMM D')} - ${sunday.format('MMM D, YYYY')})`
  } else if (options.range === 'monthly') {
    const monthRange = getUserMonthRange(anchorDateStr, tz)
    startDateStr = monthRange.startDateStr
    endDateStr = monthRange.endDateStr
    startUtc = monthRange.startUtc
    endUtc = monthRange.endUtc
    rangeLabel = `Monthly Report (${anchor.format('MMMM YYYY')})`
  } else {
    // 30d default
    const startRange = anchor.subtract(29, 'day')
    startDateStr = startRange.format('YYYY-MM-DD')
    endDateStr = anchor.format('YYYY-MM-DD')
    startUtc = new Date(startRange.startOf('day').toISOString())
    endUtc = new Date(anchor.endOf('day').toISOString())
    rangeLabel = `Last 30 Days (${startRange.format('MMM D')} - ${anchor.format('MMM D, YYYY')})`
  }

  // Load user data records
  const sessions = await db('work_sessions').where({ user_id: user.id }).whereNull('deleted_at')
  const payments = await db('payments').where({ user_id: user.id }).whereNull('deleted_at')
  const expenses = await db('project_expenses').where({ user_id: user.id }).whereNull('deleted_at')
  const projects = await db('projects').where({ user_id: user.id }).whereNull('deleted_at')
  const clients = await db('clients').where({ user_id: user.id }).whereNull('deleted_at')
  const overheads = await db('overhead_expenses').where({ user_id: user.id }).whereNull('deleted_at')
  const incomeSources = await db('income_sources').where({ user_id: user.id }).whereNull('deleted_at')

  const summary = computeUnifiedMetricsSummary(
    sessions,
    payments,
    expenses,
    projects,
    overheads,
    incomeSources,
    {
      range: 'custom',
      from: startDateStr,
      to: endDateStr,
      timezone: tz,
      baseCurrency,
      targetHourly,
      headlinePreference: user.headline_rate_metric || 'client_work',
      includeOverhead: user.include_overhead_in_metrics !== false,
    }
  )

  const intelligence = computeIntelligenceInsights(
    sessions,
    payments,
    expenses,
    projects,
    clients,
    targetHourly,
    baseCurrency
  )

  const topLeakage = (intelligence.unpaidLeakage || []).slice(0, 5)
  const clientRankings = (intelligence.clientProfitability || []).map(cp => ({
    clientId: cp.clientId,
    clientName: cp.clientName,
    company: cp.company,
    hours: cp.paidHours + cp.unpaidClientHours,
    netIncome: cp.netIncome,
    collectedRevenue: cp.collectedRevenue,
    effectiveHourlyRate: cp.clientWorkRate,
    marginPct: cp.marginPct,
  }))

  const categoryYield = (intelligence.categoryYield || []).map(cy => ({
    category: cy.category,
    projects: cy.projects,
    hours: cy.hours,
    netIncome: cy.netIncome,
    effectiveHourly: cy.effectiveHourly,
  }))

  const validClients = clientRankings.filter(c => c.effectiveHourlyRate > 0)
  const bestClient = validClients.length > 0 ? { name: validClients[0].clientName, rate: validClients[0].effectiveHourlyRate } : undefined
  const worstClient = validClients.length > 1 ? { name: validClients[validClients.length - 1].clientName, rate: validClients[validClients.length - 1].effectiveHourlyRate } : undefined

  const validCats = categoryYield.filter(c => c.effectiveHourly > 0)
  const bestCategory = validCats.length > 0 ? { name: validCats[0].category, rate: validCats[0].effectiveHourly } : undefined
  const worstCategory = validCats.length > 1 ? { name: validCats[validCats.length - 1].category, rate: validCats[validCats.length - 1].effectiveHourly } : undefined

  return {
    range: options.range,
    rangeLabel,
    periodDates: `${startDateStr} to ${endDateStr}`,
    startDateStr,
    endDateStr,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      baseCurrency,
      timezone: tz,
      targetHourly,
    },
    totalHours: summary.hours.totalAllHours,
    paidHours: summary.hours.paidHours,
    unpaidHours: summary.hours.unpaidClientHours,
    collectedRevenue: summary.financials.collectedRevenue,
    earnedRevenue: summary.financials.earnedRevenue,
    netIncome: summary.financials.collectedNetIncome,
    clientWorkRate: summary.rates.clientWorkRate,
    allInRate: summary.rates.allInRate,
    valueLeakage: Math.round(summary.hours.unpaidClientHours * targetHourly),
    hours: {
      paidHours: summary.hours.paidHours,
      unpaidClientHours: summary.hours.unpaidClientHours,
      intentionalUnpaidHours: summary.hours.intentionalUnpaidHours,
      commuteHours: summary.hours.commuteHours,
      totalAllHours: summary.hours.totalAllHours,
      unpaidRatioPct: summary.hours.unpaidRatioPct,
    },
    financials: {
      collectedRevenue: summary.financials.collectedRevenue,
      earnedRevenue: summary.financials.earnedRevenue,
      directExpenses: summary.financials.directExpenses,
      allocatedOverhead: summary.financials.allocatedOverhead,
      commuteExpenses: summary.financials.commuteExpenses,
      collectedNetIncome: summary.financials.collectedNetIncome,
      earnedNetIncome: summary.financials.earnedNetIncome,
      outstandingRevenue: summary.financials.outstandingRevenue,
    },
    rates: {
      clientWorkRate: summary.rates.clientWorkRate,
      allInRate: summary.rates.allInRate,
      earnedClientWorkRate: summary.rates.earnedClientWorkRate,
      earnedAllInRate: summary.rates.earnedAllInRate,
      targetHourlyRate: targetHourly,
      targetDeltaPct: summary.rates.targetDeltaPct,
      isTargetMet: summary.rates.isTargetMet,
    },
    topLeakageReasons: topLeakage,
    clientRankings,
    categoryYield,
    bestClient,
    worstClient,
    bestCategory,
    worstCategory,
  }
}

/**
 * Builds RFC 4180 compliant CSV export for a report summary.
 */
export function generateReportCsv(report: ReportSummaryResult): string {
  const lines: string[] = []

  // Header
  lines.push(`"WELLO BUSINESS PERFORMANCE REPORT"`)
  lines.push(`"Report Period","${report.rangeLabel}","Dates","${report.periodDates}"`)
  lines.push(`"User","${report.user.name}","Email","${report.user.email}","Base Currency","${report.user.baseCurrency}"`)
  lines.push(``)

  // Section 1: Key Rates & Valuation
  lines.push(`"--- HOURLY VALUATION & RATE PERFORMANCE ---"`)
  lines.push(`"Metric","Value (${report.user.baseCurrency})","Target","Target Delta %","Status"`)
  lines.push(`"Client-Work Hourly Rate","${report.rates.clientWorkRate}","${report.rates.targetHourlyRate}","${report.rates.targetDeltaPct}%","${report.rates.isTargetMet ? 'MET' : 'BELOW_TARGET'}"`)
  lines.push(`"All-In Real Hourly Rate","${report.rates.allInRate}","${report.rates.targetHourlyRate}","${report.rates.targetDeltaPct}%","${report.rates.isTargetMet ? 'MET' : 'BELOW_TARGET'}"`)
  lines.push(``)

  // Section 2: Hours Distribution
  lines.push(`"--- HOURS DISTRIBUTION ---"`)
  lines.push(`"Time Category","Hours"`)
  lines.push(`"Paid Client Hours","${report.hours.paidHours}"`)
  lines.push(`"Unpaid Client Friction Hours","${report.hours.unpaidClientHours}"`)
  lines.push(`"Intentional Non-Client Hours","${report.hours.intentionalUnpaidHours}"`)
  lines.push(`"Commute Time Hours","${report.hours.commuteHours}"`)
  lines.push(`"Total Elapsed Hours Tracked","${report.hours.totalAllHours}"`)
  lines.push(`"Unpaid Time Ratio %","${report.hours.unpaidRatioPct}%"`)
  lines.push(``)

  // Section 3: Financial Summary
  lines.push(`"--- FINANCIAL SUMMARY ---"`)
  lines.push(`"Financial Item","Amount (${report.user.baseCurrency})"`)
  lines.push(`"Collected Revenue","${report.financials.collectedRevenue}"`)
  lines.push(`"Earned Valuation Revenue","${report.financials.earnedRevenue}"`)
  lines.push(`"Direct Project Expenses","${report.financials.directExpenses}"`)
  lines.push(`"Allocated Overhead Expenses","${report.financials.allocatedOverhead}"`)
  lines.push(`"Commute Expenses","${report.financials.commuteExpenses}"`)
  lines.push(`"Collected Net Income","${report.financials.collectedNetIncome}"`)
  lines.push(`"Earned Net Income","${report.financials.earnedNetIncome}"`)
  lines.push(`"Outstanding Uncollected Revenue","${report.financials.outstandingRevenue}"`)
  lines.push(``)

  // Section 4: Top Unpaid Leakage
  lines.push(`"--- TOP UNPAID TIME LEAKAGE BREAKDOWN ---"`)
  lines.push(`"Reason","Category","Hours","Estimated Opportunity Cost (${report.user.baseCurrency})"`)
  if (report.topLeakageReasons.length === 0) {
    lines.push(`"No unpaid leakage recorded","N/A","0","0"`)
  } else {
    for (const l of report.topLeakageReasons) {
      lines.push(`"${l.label}","${l.category}","${l.hours}","${l.estimatedOpportunityCost}"`)
    }
  }
  lines.push(``)

  // Section 5: Client Yield Matrix
  lines.push(`"--- CLIENT & EMPLOYER YIELD MATRIX ---"`)
  lines.push(`"Client / Employer","Total Hours","Net Collected (${report.user.baseCurrency})","Effective Rate/Hour (${report.user.baseCurrency})","Margin %"`)
  if (report.clientRankings.length === 0) {
    lines.push(`"No client data recorded","0","0","0","0%"`)
  } else {
    for (const c of report.clientRankings) {
      lines.push(`"${c.clientName}","${c.hours}","${c.netIncome}","${c.effectiveHourlyRate}","${c.marginPct}%"`)
    }
  }

  return lines.join('\r\n')
}

/**
 * Builds vector PDF buffer for a report summary.
 */
export function generateReportPdfBuffer(report: ReportSummaryResult): Buffer {
  const pdfData: ReportPdfData = {
    userName: report.user.name,
    userEmail: report.user.email,
    reportTitle: report.rangeLabel,
    rangeLabel: report.range,
    periodDates: report.periodDates,
    currency: report.user.baseCurrency,
    targetHourlyRate: report.rates.targetHourlyRate,
    hours: report.hours,
    financials: report.financials,
    rates: report.rates,
    topLeakageReasons: report.topLeakageReasons.map(l => ({
      label: l.label,
      category: l.category,
      hours: l.hours,
      estimatedOpportunityCost: l.estimatedOpportunityCost,
    })),
    clientRankings: report.clientRankings.map(c => ({
      clientName: c.clientName,
      hours: c.hours,
      netIncome: c.netIncome,
      effectiveHourlyRate: c.effectiveHourlyRate,
    })),
  }

  return generateReportPdf(pdfData)
}
