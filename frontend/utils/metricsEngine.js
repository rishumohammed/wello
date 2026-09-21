// frontend/utils/metricsEngine.js
// Single Authoritative Metrics Engine for Wello Frontend
// Direct companion to backend/utils/metricsEngine.ts for instant offline calculations and UI previews

import { getCurrencyDecimals, roundToCurrencyDecimals } from './currencyUtils.js'
import {
  getUserToday,
  getUserDayRange,
  getUserWeekRange,
  getUserMonthRange,
  isValidTimezone,
  dayjs,
} from './dateUtils.js'

// ─── UNPAID TAXONOMY DEFINITION ─────────────────────────────────────────────

export const UNPAID_TAXONOMY = {
  // Unpaid Client Friction
  scope_creep: {
    key: 'scope_creep',
    label: 'Scope Creep & Extra Requests',
    category: 'unpaid_client',
    description: 'Work done beyond initial agreement without additional compensation',
  },
  revisions_beyond_scope: {
    key: 'revisions_beyond_scope',
    label: 'Excessive Revisions',
    category: 'unpaid_client',
    description: 'Rework beyond agreed round limits',
  },
  pitching: {
    key: 'pitching',
    label: 'Pitching & Proposal Prep',
    category: 'unpaid_client',
    description: 'Unbilled discovery, proposal drafting & scoping',
  },
  client_friction: {
    key: 'client_friction',
    label: 'Client Friction & Delays',
    category: 'unpaid_client',
    description: 'Idle meetings, waiting on assets, communication churn',
  },
  admin_overhead: {
    key: 'admin_overhead',
    label: 'Project Admin & Billing',
    category: 'unpaid_client',
    description: 'Contract review, invoicing logistics, setup',
  },
  uncollectible: {
    key: 'uncollectible',
    label: 'Disputed / Uncollectible',
    category: 'unpaid_client',
    description: 'Written-off or disputed client time',
  },

  // Intentional Unpaid (Value Creation)
  learning: {
    key: 'learning',
    label: 'Learning & Skill Development',
    category: 'intentional_unpaid',
    description: 'Deliberate upskilling and experimentation during project',
  },
  portfolio: {
    key: 'portfolio',
    label: 'Portfolio & Showcase',
    category: 'intentional_unpaid',
    description: 'Building showcase assets for future client marketing',
  },
  charity: {
    key: 'charity',
    label: 'Pro-Bono & Charity',
    category: 'intentional_unpaid',
    description: 'Purpose-driven free contribution',
  },
  strategic: {
    key: 'strategic',
    label: 'Strategic & Equity',
    category: 'intentional_unpaid',
    description: 'Unpaid partnership or strategic relationship building',
  },
  personal: {
    key: 'personal',
    label: 'Personal Exploration',
    category: 'intentional_unpaid',
    description: 'Creative exploration and internal tooling',
  },
}

export const INTENTIONAL_UNPAID_KEYS = new Set([
  'learning', 'portfolio', 'charity', 'strategic', 'personal', 'upskilling', 'open_source'
])

export function categorizeUnpaidReason(reason) {
  if (!reason) return 'unpaid_client'
  const normalized = reason.toLowerCase().trim().replace(/[\s-]/g, '_')
  if (INTENTIONAL_UNPAID_KEYS.has(normalized)) return 'intentional_unpaid'
  if (UNPAID_TAXONOMY[normalized]?.category === 'intentional_unpaid') return 'intentional_unpaid'
  return 'unpaid_client'
}

export const classifyUnpaidReason = categorizeUnpaidReason

// ─── HOURS COMPUTATION ──────────────────────────────────────────────────────

export function computeSessionHours(sessions = []) {
  let paidMin = 0
  let unpaidClientMin = 0
  let intentionalUnpaidMin = 0

  for (const s of sessions) {
    let dur = Number(
      s.durationMin ||
      s.durationMinutes ||
      (s.durationSeconds ? s.durationSeconds / 60 : 0) ||
      (s.duration_seconds ? s.duration_seconds / 60 : 0) ||
      0
    )
    if (dur <= 0 && s.startedAt && s.endedAt) {
      const diffMs = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()
      dur = Math.max(0, Math.round(diffMs / 60000))
    }

    const payType = (s.paymentType || 'paid').toLowerCase()
    if (payType === 'paid') {
      paidMin += dur
    } else {
      const cat = s.unpaidCategory || categorizeUnpaidReason(s.unpaidReason)
      if (cat === 'intentional_unpaid') {
        intentionalUnpaidMin += dur
      } else {
        unpaidClientMin += dur
      }
    }
  }

  const totalClientMin = paidMin + unpaidClientMin
  const totalAllMin = totalClientMin + intentionalUnpaidMin
  const unpaidTotalMin = unpaidClientMin + intentionalUnpaidMin

  return {
    paidMinutes: paidMin,
    paidHours: Math.round((paidMin / 60) * 100) / 100,
    unpaidClientMinutes: unpaidClientMin,
    unpaidClientHours: Math.round((unpaidClientMin / 60) * 100) / 100,
    intentionalUnpaidMinutes: intentionalUnpaidMin,
    intentionalUnpaidHours: Math.round((intentionalUnpaidMin / 60) * 100) / 100,
    totalClientMinutes: totalClientMin,
    totalClientHours: Math.round((totalClientMin / 60) * 100) / 100,
    clientWorkMinutes: totalClientMin,
    clientWorkHours: Math.round((totalClientMin / 60) * 100) / 100,
    totalAllMinutes: totalAllMin,
    totalAllHours: Math.round((totalAllMin / 60) * 100) / 100,
    unpaidRatioPct: totalAllMin > 0 ? Math.round((unpaidTotalMin / totalAllMin) * 100) : 0,
  }
}

// ─── FINANCIAL COMPUTATION ──────────────────────────────────────────────────

export function computeFinancials(
  payments = [],
  expenses = [],
  projects = [],
  overheads = [],
  baseCurrency = 'USD'
) {
  let collected = 0
  for (const p of payments) {
    const amt = Number(p.baseAmount !== undefined && p.baseAmount !== null ? p.baseAmount : p.amount) || 0
    collected += amt
  }

  let directExp = 0
  for (const e of expenses) {
    const amt = Number(e.baseAmount !== undefined && e.baseAmount !== null ? e.baseAmount : e.amount) || 0
    directExp += amt
  }

  let totalOverhead = 0
  for (const o of overheads) {
    const amt = Number(o.baseAmount !== undefined && o.baseAmount !== null ? o.baseAmount : o.amount) || 0
    totalOverhead += amt
  }

  let earned = 0
  const projectPaymentMap = new Map()
  for (const p of payments) {
    if (p.projectId) {
      const pid = String(p.projectId)
      const amt = Number(p.baseAmount !== undefined && p.baseAmount !== null ? p.baseAmount : p.amount) || 0
      projectPaymentMap.set(pid, (projectPaymentMap.get(pid) || 0) + amt)
    }
  }

  for (const proj of projects) {
    const pid = String(proj.id)
    const projCollected = projectPaymentMap.get(pid) || 0
    const invoiced = Number(proj.invoicedTotal || 0)
    const quoteVal = (proj.quoteStatus === 'accepted' || proj.status === 'approved' || proj.status === 'in_progress' || proj.status === 'completed' || proj.isJob)
      ? Number(proj.quoteAmount || 0)
      : 0

    const projEarned = Math.max(projCollected, invoiced, quoteVal)
    earned += projEarned
  }

  if (earned < collected) {
    earned = collected
  }

  collected = roundToCurrencyDecimals(collected, baseCurrency)
  earned = roundToCurrencyDecimals(earned, baseCurrency)
  directExp = roundToCurrencyDecimals(directExp, baseCurrency)
  totalOverhead = roundToCurrencyDecimals(totalOverhead, baseCurrency)

  const collectedNet = roundToCurrencyDecimals(collected - directExp - totalOverhead, baseCurrency)
  const earnedNet = roundToCurrencyDecimals(earned - directExp - totalOverhead, baseCurrency)
  const outstanding = roundToCurrencyDecimals(Math.max(0, earned - collected), baseCurrency)

  return {
    collectedRevenue: collected,
    earnedRevenue: earned,
    directExpenses: directExp,
    allocatedOverhead: totalOverhead,
    collectedNetIncome: collectedNet,
    earnedNetIncome: earnedNet,
    outstandingRevenue: outstanding,
  }
}

// ─── DUAL RATE COMPUTATION ──────────────────────────────────────────────────

export function computeDualRates(
  financials,
  hours,
  targetHourlyRate = 0,
  headlinePreference = 'client_work',
  baseCurrency = 'USD'
) {
  const clientHours = Number(hours.totalClientHours || hours.clientWorkHours || 0)
  const allHours = Number(hours.totalAllHours || 0)
  const hasClient = clientHours > 0
  const hasAll = allHours > 0

  const clientWorkRate = hasClient
    ? roundToCurrencyDecimals(financials.collectedNetIncome / clientHours, baseCurrency)
    : 0

  const allInRate = hasAll
    ? roundToCurrencyDecimals(financials.collectedNetIncome / allHours, baseCurrency)
    : 0

  const earnedClientWorkRate = hasClient
    ? roundToCurrencyDecimals(financials.earnedNetIncome / clientHours, baseCurrency)
    : 0

  const earnedAllInRate = hasAll
    ? roundToCurrencyDecimals(financials.earnedNetIncome / allHours, baseCurrency)
    : 0

  const headlineRate = headlinePreference === 'all_in' ? allInRate : clientWorkRate
  const target = Number(targetHourlyRate) || 0
  const isTargetMet = target > 0 && headlineRate >= target
  const targetDeltaPct = target > 0 && hasClient
    ? Math.round(((headlineRate - target) / target) * 100)
    : 0

  return {
    clientWorkRate,
    allInRate,
    earnedClientWorkRate,
    earnedAllInRate,
    headlineRate,
    isZeroHours: !hasAll,
    hasClientHours: hasClient,
    hasAllHours: hasAll,
    isTargetMet,
    targetDeltaPct,
  }
}

// ─── ROLLING WINDOW SUMMARY METRICS ─────────────────────────────────────────

export function filterByDateRange(items = [], startUtc, endUtc, dateExtractor) {
  const startMs = startUtc.getTime()
  const endMs = endUtc.getTime()

  return items.filter((item) => {
    const rawDate = dateExtractor ? dateExtractor(item) : (item.startedAt || item.paymentDate || item.expenseDate || item.date || item.createdAt)
    if (!rawDate) return false
    const itemMs = new Date(rawDate).getTime()
    return itemMs >= startMs && itemMs <= endMs
  })
}

export function computeUnifiedMetricsSummary(
  sessions = [],
  payments = [],
  expenses = [],
  projects = [],
  overheads = [],
  options = {}
) {
  const tz = isValidTimezone(options.timezone || '') ? options.timezone : 'UTC'
  const baseCurrency = (options.baseCurrency || 'USD').toUpperCase().slice(0, 3)
  const targetHourly = Number(options.targetHourly) || 0
  const headlinePref = options.headlinePreference || 'client_work'
  const range = options.range || '30d'

  const userTodayStr = getUserToday(tz)
  let startUtc
  let endUtc
  let rangeLabel = 'Last 30 Days'
  let startDateStr = userTodayStr
  let endDateStr = userTodayStr

  if (range === 'today') {
    const dayRange = getUserDayRange(userTodayStr, tz)
    startUtc = dayRange.startUtc
    endUtc = dayRange.endUtc
    rangeLabel = 'Today'
    startDateStr = dayRange.startDateStr
    endDateStr = dayRange.endDateStr
  } else if (range === '7d') {
    const endRange = getUserDayRange(userTodayStr, tz)
    endUtc = endRange.endUtc
    const startRange = getUserDayRange(dayjs().tz(tz).subtract(6, 'day').format('YYYY-MM-DD'), tz)
    startUtc = startRange.startUtc
    rangeLabel = 'Last 7 Days'
    startDateStr = startRange.startDateStr
    endDateStr = endRange.endDateStr
  } else if (range === '30d') {
    const endRange = getUserDayRange(userTodayStr, tz)
    endUtc = endRange.endUtc
    const startRange = getUserDayRange(dayjs().tz(tz).subtract(29, 'day').format('YYYY-MM-DD'), tz)
    startUtc = startRange.startUtc
    rangeLabel = 'Last 30 Days'
    startDateStr = startRange.startDateStr
    endDateStr = endRange.endDateStr
  } else if (range === '90d') {
    const endRange = getUserDayRange(userTodayStr, tz)
    endUtc = endRange.endUtc
    const startRange = getUserDayRange(dayjs().tz(tz).subtract(89, 'day').format('YYYY-MM-DD'), tz)
    startUtc = startRange.startUtc
    rangeLabel = 'Last 90 Days'
    startDateStr = startRange.startDateStr
    endDateStr = endRange.endDateStr
  } else if (range === 'ytd') {
    const endRange = getUserDayRange(userTodayStr, tz)
    endUtc = endRange.endUtc
    const yearStartStr = `${dayjs().tz(tz).year()}-01-01`
    const startRange = getUserDayRange(yearStartStr, tz)
    startUtc = startRange.startUtc
    rangeLabel = 'Year to Date'
    startDateStr = startRange.startDateStr
    endDateStr = endRange.endDateStr
  } else if (range === 'custom' && options.from && options.to) {
    const startRange = getUserDayRange(options.from, tz)
    const endRange = getUserDayRange(options.to, tz)
    startUtc = startRange.startUtc
    endUtc = endRange.endUtc
    rangeLabel = `${options.from} to ${options.to}`
    startDateStr = options.from
    endDateStr = options.to
  } else {
    // All time
    startUtc = new Date('2020-01-01T00:00:00.000Z')
    endUtc = new Date(Date.now() + 86400000 * 365)
    rangeLabel = 'All Time'
    startDateStr = '2020-01-01'
    endDateStr = userTodayStr
  }

  const filteredSessions = range === 'all' ? sessions : filterByDateRange(sessions, startUtc, endUtc, s => s.startedAt)
  const filteredPayments = range === 'all' ? payments : filterByDateRange(payments, startUtc, endUtc, p => p.paymentDate || p.createdAt)
  const filteredExpenses = range === 'all' ? expenses : filterByDateRange(expenses, startUtc, endUtc, e => e.expenseDate || e.createdAt)
  const filteredOverheads = range === 'all' ? overheads : filterByDateRange(overheads, startUtc, endUtc, o => o.expenseDate)

  const activeProjectIds = new Set(filteredSessions.map(s => s.projectId).filter(Boolean))
  const filteredProjects = range === 'all' ? projects : projects.filter(p => activeProjectIds.has(p.id))

  const hours = computeSessionHours(filteredSessions)
  const financials = computeFinancials(filteredPayments, filteredExpenses, filteredProjects, filteredOverheads, baseCurrency)
  const rates = computeDualRates(financials, hours, targetHourly, headlinePref, baseCurrency)

  return {
    rangeKey: range,
    rangeLabel,
    startDateStr,
    endDateStr,
    hours,
    financials,
    rates,
    sessionsCount: filteredSessions.length,
    activeProjectsCount: activeProjectIds.size,
  }
}

// ─── INTELLIGENCE & VALUE INSIGHTS ──────────────────────────────────────────

export function computeIntelligenceInsights(
  sessions = [],
  payments = [],
  expenses = [],
  projects = [],
  clients = [],
  targetHourly = 100,
  baseCurrency = 'USD'
) {
  const target = Number(targetHourly) || 100

  // 1. Time to Money Velocity
  const paymentDays = []
  for (const p of payments) {
    const rawPaymentDate = p.paymentDate || p.paidDate || p.date || p.createdAt
    if (p.projectId && rawPaymentDate) {
      const projSessions = sessions.filter(s => String(s.projectId) === String(p.projectId) && s.startedAt)
      if (projSessions.length > 0) {
        const firstSessionMs = new Date(projSessions[0].startedAt).getTime()
        const paymentMs = new Date(rawPaymentDate).getTime()
        const days = Math.max(0, Math.round((paymentMs - firstSessionMs) / (86400 * 1000)))
        paymentDays.push(days)
      }
    }
  }

  const avgDays = paymentDays.length > 0 ? Math.round(paymentDays.reduce((a, b) => a + b, 0) / paymentDays.length) : 0
  const fastestDays = paymentDays.length > 0 ? Math.min(...paymentDays) : 0
  const slowestDays = paymentDays.length > 0 ? Math.max(...paymentDays) : 0
  const unpaidAwaitingCount = sessions.filter(s => s.paymentType === 'unpaid').length

  const timeToMoney = {
    avgDaysToPayment: avgDays,
    fastestPaymentDays: fastestDays,
    slowestPaymentDays: slowestDays,
    completedCycleCount: paymentDays.length,
    unpaidAwaitingPaymentCount: unpaidAwaitingCount,
  }

  // 2. Unpaid Leakage by Reason
  const leakageMap = new Map()
  let totalUnpaidMin = 0

  for (const s of sessions) {
    if (s.paymentType === 'unpaid' || s.paymentType === 'partial') {
      const dur = Number(
        s.durationMin ||
        s.durationMinutes ||
        (s.durationSeconds ? s.durationSeconds / 60 : 0) ||
        (s.duration_seconds ? s.duration_seconds / 60 : 0) ||
        0
      )
      totalUnpaidMin += dur
      const reasonKey = (s.unpaidReason || 'client_friction').toLowerCase().trim().replace(/[\s-]/g, '_')
      leakageMap.set(reasonKey, (leakageMap.get(reasonKey) || 0) + dur)
    }
  }

  const unpaidLeakage = Array.from(leakageMap.entries())
    .map(([key, min]) => {
      const def = UNPAID_TAXONOMY[key] || {
        key,
        label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        category: categorizeUnpaidReason(key),
        description: 'Unbilled project time',
      }
      const hrs = Math.round((min / 60) * 100) / 100
      return {
        reasonKey: key,
        label: def.label,
        category: def.category,
        minutes: min,
        hours: hrs,
        pctOfUnpaid: totalUnpaidMin > 0 ? Math.round((min / totalUnpaidMin) * 100) : 0,
        estimatedOpportunityCost: roundToCurrencyDecimals(hrs * target, baseCurrency),
      }
    })
    .sort((a, b) => b.minutes - a.minutes)

  // 3. Client Profitability Matrix
  const clientProfitability = clients.map((c) => {
    const clientProjects = projects.filter(p => String(p.clientId) === String(c.id))
    const clientProjectIds = new Set(clientProjects.map(p => String(p.id)))

    const clientSessions = sessions.filter(s => clientProjectIds.has(String(s.projectId)) || String(s.clientId) === String(c.id))
    const clientPayments = payments.filter(p => clientProjectIds.has(String(p.projectId)))
    const clientExpenses = expenses.filter(e => clientProjectIds.has(String(e.projectId)))

    const hrs = computeSessionHours(clientSessions)
    const fin = computeFinancials(clientPayments, clientExpenses, clientProjects, [], baseCurrency)
    const rates = computeDualRates(fin, hrs, target, 'client_work', baseCurrency)

    const marginPct = fin.collectedRevenue > 0
      ? Math.round((fin.collectedNetIncome / fin.collectedRevenue) * 100)
      : (fin.earnedRevenue > 0 ? Math.round((fin.earnedNetIncome / fin.earnedRevenue) * 100) : 0)

    return {
      clientId: c.id,
      clientName: c.name,
      company: c.company,
      currency: c.currency || baseCurrency,
      collectedRevenue: fin.collectedRevenue,
      earnedRevenue: fin.earnedRevenue,
      directExpenses: fin.directExpenses,
      netIncome: fin.collectedNetIncome,
      paidHours: hrs.paidHours,
      unpaidClientHours: hrs.unpaidClientHours,
      intentionalUnpaidHours: hrs.intentionalUnpaidHours,
      clientWorkRate: rates.clientWorkRate || rates.earnedClientWorkRate,
      allInRate: rates.allInRate || rates.earnedAllInRate,
      marginPct,
      profitabilityRank: 0,
    }
  }).sort((a, b) => b.clientWorkRate - a.clientWorkRate)

  clientProfitability.forEach((cp, idx) => {
    cp.profitabilityRank = idx + 1
  })

  // 4. Category Yield
  const categoryMap = new Map()
  for (const p of projects) {
    const cat = p.serviceCategory || 'General'
    const cur = categoryMap.get(cat) || { projects: 0, revenue: 0, expenses: 0, hours: 0 }
    cur.projects += 1

    const projPayments = payments.filter(pm => String(pm.projectId) === String(p.id))
    const projExpenses = expenses.filter(ex => String(ex.projectId) === String(p.id))
    const projSessions = sessions.filter(se => String(se.projectId) === String(p.id))

    const fin = computeFinancials(projPayments, projExpenses, [p], [], baseCurrency)
    const hrs = computeSessionHours(projSessions)

    cur.revenue += fin.collectedRevenue || fin.earnedRevenue
    cur.expenses += fin.directExpenses
    cur.hours += hrs.totalAllHours
    categoryMap.set(cat, cur)
  }

  const categoryYield = Array.from(categoryMap.entries())
    .map(([category, data]) => {
      const net = data.revenue - data.expenses
      const rate = data.hours > 0 ? roundToCurrencyDecimals(net / data.hours, baseCurrency) : 0
      return {
        category,
        projectCount: data.projects,
        totalRevenue: roundToCurrencyDecimals(data.revenue, baseCurrency),
        netIncome: roundToCurrencyDecimals(net, baseCurrency),
        totalHours: Math.round(data.hours * 100) / 100,
        effectiveHourlyRate: rate,
        yieldRank: 0,
      }
    })
    .sort((a, b) => b.effectiveHourlyRate - a.effectiveHourlyRate)

  categoryYield.forEach((cy, idx) => {
    cy.yieldRank = idx + 1
  })

  // 5. Proposal Win Rate & Cost
  const allQuoted = projects.filter(p => p.quoteAmount !== null && p.quoteAmount !== undefined && Number(p.quoteAmount) > 0)
  const wonQuotes = allQuoted.filter(p => p.isJob || ['approved', 'in_progress', 'completed'].includes(p.status))
  const lostQuotes = allQuoted.filter(p => p.status === 'lost')
  const draftQuotes = allQuoted.filter(p => p.status === 'potential' || p.status === 'quoted')

  let lostPitchMin = 0
  for (const lp of lostQuotes) {
    const lostSessions = sessions.filter(s => String(s.projectId) === String(lp.id))
    for (const ls of lostSessions) {
      lostPitchMin += Number(
        ls.durationMin ||
        ls.durationMinutes ||
        (ls.durationSeconds ? ls.durationSeconds / 60 : 0) ||
        (ls.duration_seconds ? ls.duration_seconds / 60 : 0) ||
        0
      )
    }
  }

  const wonTotalVal = wonQuotes.reduce((acc, q) => acc + (Number(q.quoteAmount) || 0), 0)
  const lostTotalVal = lostQuotes.reduce((acc, q) => acc + (Number(q.quoteAmount) || 0), 0)
  const lostPitchHours = Math.round((lostPitchMin / 60) * 100) / 100

  const decidedCount = wonQuotes.length + lostQuotes.length
  const winRatePct = decidedCount > 0 ? Math.round((wonQuotes.length / decidedCount) * 100) : (wonQuotes.length > 0 ? 100 : 0)

  const proposalWinRate = {
    totalQuotes: allQuoted.length,
    wonQuotes: wonQuotes.length,
    lostQuotes: lostQuotes.length,
    draftQuotes: draftQuotes.length,
    winRatePct,
    wonTotalValue: roundToCurrencyDecimals(wonTotalVal, baseCurrency),
    lostTotalValue: roundToCurrencyDecimals(lostTotalVal, baseCurrency),
    lostPitchHours,
    lostPitchValue: roundToCurrencyDecimals(lostPitchHours * target, baseCurrency),
  }

  // 6. Effort vs Quote Variance
  const effortQuoteVariance = projects
    .filter(p => p.quoteEstHours !== null && p.quoteEstHours !== undefined && Number(p.quoteEstHours) > 0)
    .map(p => {
      const projSessions = sessions.filter(s => String(s.projectId) === String(p.id))
      const hrs = computeSessionHours(projSessions)
      const estHrs = Number(p.quoteEstHours) || 0
      const actualHrs = hrs.totalAllHours
      const varHrs = Math.round((actualHrs - estHrs) * 100) / 100
      const varPct = estHrs > 0 ? Math.round((varHrs / estHrs) * 100) : 0

      return {
        projectId: p.id,
        projectName: p.name,
        estimatedHours: estHrs,
        actualHours: actualHrs,
        varianceHours: varHrs,
        variancePct: varPct,
        isOverBudget: varHrs > 0,
      }
    })

  return {
    timeToMoney,
    unpaidLeakage,
    clientProfitability,
    categoryYield,
    proposalWinRate,
    effortQuoteVariance,
  }
}
