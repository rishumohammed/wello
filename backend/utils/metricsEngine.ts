// backend/utils/metricsEngine.ts
// Single Authoritative Metrics Engine for Wello
// Enforces mathematical definitions for Dual-Rate System, Earned vs Collected, Rolling Windows, and Intelligence Insights

import { getCurrencyDecimals, roundToCurrencyDecimals } from './currencyUtils'
import {
  getUserToday,
  getUserDayRange,
  getUserWeekRange,
  getUserMonthRange,
  isValidTimezone,
  dayjs,
} from './dateUtils'

// ─── UNPAID TAXONOMY DEFINITION ─────────────────────────────────────────────

export interface UnpaidReasonDefinition {
  key: string
  label: string
  category: 'unpaid_client' | 'intentional_unpaid'
  description: string
}

export const UNPAID_TAXONOMY: Record<string, UnpaidReasonDefinition> = {
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

export function categorizeUnpaidReason(reason?: string | null): 'unpaid_client' | 'intentional_unpaid' {
  if (!reason) return 'unpaid_client'
  const normalized = reason.toLowerCase().trim().replace(/[\s-]/g, '_')
  if (INTENTIONAL_UNPAID_KEYS.has(normalized)) return 'intentional_unpaid'
  if (UNPAID_TAXONOMY[normalized]?.category === 'intentional_unpaid') return 'intentional_unpaid'
  return 'unpaid_client'
}

export const classifyUnpaidReason = categorizeUnpaidReason

// ─── CORE DATA TYPES ────────────────────────────────────────────────────────

export interface SessionData {
  id?: number | string
  projectId?: number | string | null
  incomeSourceId?: number | string | null
  income_source_id?: number | string | null
  clientId?: number | string | null
  type?: 'work' | 'travel' | 'commute' | 'admin' | 'learning' | string
  startedAt: string | Date
  endedAt?: string | Date | null
  durationMin?: number
  durationMinutes?: number
  durationSeconds?: number
  duration_seconds?: number
  paymentType?: 'paid' | 'unpaid' | 'partial' | string
  unpaidReason?: string | null
  unpaidCategory?: 'unpaid_client' | 'intentional_unpaid' | null
}

export interface PaymentData {
  id?: number | string
  projectId?: number | string | null
  incomeSourceId?: number | string | null
  income_source_id?: number | string | null
  amount: number
  currency?: string
  baseAmount?: number
  base_amount?: number
  paymentDate?: string | Date
  payment_date?: string | Date
  status?: 'expected' | 'received' | 'overdue' | 'cancelled' | string
  isExpected?: boolean
  is_expected?: boolean
  createdAt?: string | Date
}

export interface ExpenseData {
  id?: number | string
  projectId?: number | string | null
  amount: number
  currency?: string
  baseAmount?: number
  base_amount?: number
  expenseDate?: string | Date
  expense_date?: string | Date
  createdAt?: string | Date
}

export interface OverheadData {
  id?: number | string
  userId?: number | string
  incomeSourceId?: number | string | null
  income_source_id?: number | string | null
  category?: 'commute' | 'tools' | 'phone_internet' | 'equipment' | 'uniforms' | 'licences' | 'workspace' | 'other' | string
  name?: string
  amount: number
  currency?: string
  baseAmount?: number
  base_amount?: number
  expenseDate?: string | Date
  expense_date?: string | Date
  frequency?: 'one_off' | 'daily' | 'weekly' | 'monthly' | 'annual' | string
  allocationRule?: 'none' | 'per_hour_worked' | 'per_period' | 'per_source' | string
  allocation_rule?: 'none' | 'per_hour_worked' | 'per_period' | 'per_source' | string
}

export interface IncomeSourceData {
  id: number | string
  userId?: number | string
  type: 'project' | 'salary' | 'hourly_wage' | 'daily_wage' | 'retainer' | 'gig' | 'other' | string
  name: string
  currency?: string
  payFrequency: 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | 'per_job' | 'one_off' | string
  pay_frequency?: string
  expectedAmount?: number | null
  expected_amount?: number | null
  expectedHoursPerPeriod?: number | null
  expected_hours_per_period?: number | null
  status?: 'active' | 'archived' | string
  isArchived?: boolean
  is_archived?: boolean
  notes?: string | null
  createdAt?: string | Date
}

export interface ProjectData {
  id: number | string
  clientId?: number | string | null
  name: string
  status: 'potential' | 'quoted' | 'approved' | 'in_progress' | 'completed' | 'lost' | string
  isJob?: boolean
  serviceCategory?: string
  currency?: string
  quoteAmount?: number | null
  quoteEstHours?: number | null
  quoteStatus?: string | null
  invoicedTotal?: number
  createdAt?: string | Date
}

// ─── HOURS COMPUTATION ──────────────────────────────────────────────────────

export interface HoursBreakdown {
  paidMinutes: number
  paidHours: number
  unpaidClientMinutes: number
  unpaidClientHours: number
  intentionalUnpaidMinutes: number
  intentionalUnpaidHours: number
  commuteMinutes?: number
  commuteHours?: number
  totalClientMinutes: number
  totalClientHours: number
  clientWorkMinutes?: number
  clientWorkHours?: number
  totalAllMinutes: number
  totalAllHours: number
  unpaidRatioPct: number
}

export function computeSessionHours(sessions: SessionData[]): HoursBreakdown {
  let paidMin = 0
  let unpaidClientMin = 0
  let intentionalUnpaidMin = 0
  let commuteMin = 0

  for (const s of sessions) {
    let dur = Number(
      s.durationMin ||
      s.durationMinutes ||
      (s.durationSeconds ? s.durationSeconds / 60 : 0) ||
      ((s as any).duration_seconds ? (s as any).duration_seconds / 60 : 0) ||
      0
    )
    if (dur <= 0 && s.startedAt && s.endedAt) {
      const diffMs = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()
      dur = Math.max(0, Math.round(diffMs / 60000))
    }

    const sessionType = (s.type || '').toLowerCase()
    const isCommute = sessionType === 'travel' || sessionType === 'commute' || s.unpaidReason === 'commute'
    if (isCommute) {
      commuteMin += dur
    }

    const payType = s.paymentType || (s as any).payment_type
    const isUnpaid = Boolean(
      s.isUnpaid ??
      (s as any).is_unpaid ??
      (payType === 'unpaid' || payType === 'intentional_unpaid' || payType === 'partial')
    )
    if (!isUnpaid) {
      paidMin += dur
    } else {
      const cat = s.unpaidCategory || (s as any).unpaid_category || categorizeUnpaidReason(s.unpaidReason || (s as any).unpaid_reason)
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
    commuteMinutes: commuteMin,
    commuteHours: Math.round((commuteMin / 60) * 100) / 100,
    totalClientMinutes: totalClientMin,
    totalClientHours: Math.round((totalClientMin / 60) * 100) / 100,
    clientWorkMinutes: totalClientMin,
    clientWorkHours: Math.round((totalClientMin / 60) * 100) / 100,
    totalAllMinutes: totalAllMin,
    totalAllHours: Math.round((totalAllMin / 60) * 100) / 100,
    unpaidRatioPct: totalAllMin > 0 ? Math.round((unpaidTotalMin / totalAllMin) * 100) : 0,
  }
}

// ─── REVENUE & FINANCIAL COMPUTATION ────────────────────────────────────────

export interface FinancialsBreakdown {
  collectedRevenue: number
  earnedRevenue: number
  expectedRevenue: number
  directExpenses: number
  allocatedOverhead: number
  commuteExpenses: number
  collectedNetIncome: number
  earnedNetIncome: number
  outstandingRevenue: number
  isOverheadIncluded: boolean
}

export function computeFinancials(
  payments: PaymentData[],
  expenses: ExpenseData[],
  projects: ProjectData[] = [],
  overheads: OverheadData[] = [],
  baseCurrency: string = 'USD',
  options: { includeOverhead?: boolean } = {}
): FinancialsBreakdown {
  const includeOverhead = options.includeOverhead !== false

  let collected = 0
  let expected = 0
  for (const p of payments) {
    const isExp = p.isExpected || (p as any).is_expected || p.status === 'expected'
    const amt = Number(p.baseAmount !== undefined && p.baseAmount !== null ? p.baseAmount : (p.base_amount !== undefined && p.base_amount !== null ? p.base_amount : p.amount)) || 0
    if (isExp) {
      expected += amt
    } else {
      collected += amt
    }
  }

  let directExp = 0
  for (const e of expenses) {
    const amt = Number(e.baseAmount !== undefined && e.baseAmount !== null ? e.baseAmount : (e.base_amount !== undefined && e.base_amount !== null ? e.base_amount : e.amount)) || 0
    directExp += amt
  }

  let totalOverhead = 0
  let commuteExp = 0
  for (const o of overheads) {
    const amt = Number(o.baseAmount !== undefined && o.baseAmount !== null ? o.baseAmount : (o.base_amount !== undefined && o.base_amount !== null ? o.base_amount : o.amount)) || 0
    totalOverhead += amt
    if (o.category === 'commute') {
      commuteExp += amt
    }
  }

  // Compute Earned Revenue:
  // For each project, earned is the maximum of (invoicedTotal, accepted quote valuation, collected revenue)
  let earned = 0
  const projectPaymentMap = new Map<string, number>()
  for (const p of payments) {
    const isExp = p.isExpected || (p as any).is_expected || p.status === 'expected'
    const projId = p.projectId || (p as any).project_id
    if (!isExp && projId) {
      const pid = String(projId)
      const amt = Number(p.baseAmount !== undefined && p.baseAmount !== null ? p.baseAmount : (p.base_amount !== undefined && p.base_amount !== null ? p.base_amount : p.amount)) || 0
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

  // If earned total is less than collected total across all sources, earned defaults to at least collected
  if (earned < collected) {
    earned = collected
  }

  collected = roundToCurrencyDecimals(collected, baseCurrency)
  expected = roundToCurrencyDecimals(expected, baseCurrency)
  earned = roundToCurrencyDecimals(earned, baseCurrency)
  directExp = roundToCurrencyDecimals(directExp, baseCurrency)
  totalOverhead = roundToCurrencyDecimals(totalOverhead, baseCurrency)
  commuteExp = roundToCurrencyDecimals(commuteExp, baseCurrency)

  const effectiveOverhead = includeOverhead ? totalOverhead : 0
  const collectedNet = roundToCurrencyDecimals(collected - directExp - effectiveOverhead, baseCurrency)
  const earnedNet = roundToCurrencyDecimals(earned - directExp - effectiveOverhead, baseCurrency)
  const outstanding = roundToCurrencyDecimals(Math.max(0, earned - collected), baseCurrency)

  return {
    collectedRevenue: collected,
    earnedRevenue: earned,
    expectedRevenue: expected,
    directExpenses: directExp,
    allocatedOverhead: totalOverhead,
    commuteExpenses: commuteExp,
    collectedNetIncome: collectedNet,
    earnedNetIncome: earnedNet,
    outstandingRevenue: outstanding,
    isOverheadIncluded: includeOverhead,
  }
}

// ─── DUAL RATE COMPUTATION ──────────────────────────────────────────────────

export interface DualRatesResult {
  clientWorkRate: number
  allInRate: number
  earnedClientWorkRate: number
  earnedAllInRate: number
  headlineRate: number
  isZeroHours: boolean
  hasClientHours: boolean
  hasAllHours: boolean
  isTargetMet: boolean
  targetDeltaPct: number
}

export function computeDualRates(
  financials: FinancialsBreakdown,
  hours: HoursBreakdown,
  targetHourlyRate: number = 0,
  headlinePreference: 'client_work' | 'all_in' = 'client_work',
  baseCurrency: string = 'USD'
): DualRatesResult {
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

// ─── INCOME SOURCE & NON-PROJECT WORKER METRICS ────────────────────────────

export interface IncomeSourceMetricItem {
  id: number | string
  name: string
  type: string
  payFrequency: string
  currency: string
  status: string
  hours: HoursBreakdown
  collectedRevenue: number
  expectedRevenue: number
  directExpenses: number
  allocatedOverhead: number
  netIncome: number
  effectiveHourlyRate: number
  expectedHourlyRate: number
  rateVariance: number
  notes?: string | null
}

export interface SalariedCommuteSummary {
  hasSalariedSource: boolean
  sourceId?: number | string
  sourceName?: string
  salaryCollected: number
  workHours: number
  commuteHours: number
  commuteMinutes?: number
  totalTimeHours: number
  commuteExpenses: number
  nominalHourlyRate: number
  nominalRate?: number
  trueHourlyRate: number
  trueRate?: number
  commuteDragPct: number
  monthlyCommuteCost: number
}

export interface MultiEmployerComparisonItem {
  id: number | string
  name: string
  type: string
  payFrequency: string
  currency: string
  hoursWorked: number
  netEarned: number
  effectiveHourlyRate: number
  yieldRank: number
}

export function computeIncomeSourceMetrics(
  incomeSources: IncomeSourceData[] = [],
  sessions: SessionData[] = [],
  payments: PaymentData[] = [],
  expenses: ExpenseData[] = [],
  overheads: OverheadData[] = [],
  baseCurrency: string = 'USD',
  options: { includeOverhead?: boolean } = {}
): IncomeSourceMetricItem[] {
  const safeSources = Array.isArray(incomeSources) ? incomeSources : []
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const safePayments = Array.isArray(payments) ? payments : []
  const safeExpenses = Array.isArray(expenses) ? expenses : []
  const safeOverheads = Array.isArray(overheads) ? overheads : []
  const includeOverhead = options?.includeOverhead !== false

  const totalAllSessionHours = safeSessions.reduce((acc, s) => {
    const dur = Number(s.durationMin || s.durationMinutes || (s.durationSeconds ? s.durationSeconds / 60 : 0) || ((s as any).duration_seconds ? (s as any).duration_seconds / 60 : 0)) || 0
    return acc + dur / 60
  }, 0)

  return safeSources.map(src => {
    const srcIdStr = String(src.id)
    const srcSessions = safeSessions.filter(s => String(s.incomeSourceId || (s as any).income_source_id) === srcIdStr)
    const srcPayments = safePayments.filter(p => String(p.incomeSourceId || (p as any).income_source_id) === srcIdStr)
    const srcExpenses = safeExpenses.filter(e => String((e as any).incomeSourceId || (e as any).income_source_id) === srcIdStr)

    // Direct overheads assigned to this source
    const directOverheads = safeOverheads.filter(o => String(o.incomeSourceId || (o as any).income_source_id) === srcIdStr)
    let allocatedOverhead = directOverheads.reduce((acc, o) => acc + (Number(o.baseAmount ?? (o as any).base_amount ?? o.amount) || 0), 0)

    // Proportional split of general overheads if allocated per hour worked
    const srcHrs = computeSessionHours(srcSessions)
    if (totalAllSessionHours > 0 && srcHrs.totalAllHours > 0) {
      const generalHourOverheads = safeOverheads.filter(o => (!o.incomeSourceId && !(o as any).income_source_id) && ((o.allocationRule || (o as any).allocation_rule) === 'per_hour_worked'))
      const generalHourSum = generalHourOverheads.reduce((acc, o) => acc + (Number(o.baseAmount ?? (o as any).base_amount ?? o.amount) || 0), 0)
      allocatedOverhead += (generalHourSum * (srcHrs.totalAllHours / totalAllSessionHours))
    }

    const fin = computeFinancials(srcPayments, srcExpenses, [], [], baseCurrency, { includeOverhead })
    const netIncome = roundToCurrencyDecimals(fin.collectedRevenue - fin.directExpenses - (includeOverhead ? allocatedOverhead : 0), baseCurrency)
    const effRate = srcHrs.totalAllHours > 0
      ? roundToCurrencyDecimals(netIncome / srcHrs.totalAllHours, baseCurrency)
      : 0

    // Expected hourly rate calculation
    const expAmt = Number(src.expectedAmount ?? (src as any).expected_amount) || 0
    const expHrs = Number(src.expectedHoursPerPeriod ?? (src as any).expected_hours_per_period) || 0
    const expHourly = (expAmt > 0 && expHrs > 0)
      ? roundToCurrencyDecimals(expAmt / expHrs, baseCurrency)
      : 0

    const rateVariance = expHourly > 0 ? roundToCurrencyDecimals(effRate - expHourly, baseCurrency) : 0

    return {
      id: src.id,
      name: src.name,
      type: src.type,
      payFrequency: src.payFrequency || (src as any).pay_frequency || 'monthly',
      currency: src.currency || baseCurrency,
      status: src.status || ((src.isArchived || (src as any).is_archived) ? 'archived' : 'active'),
      hours: srcHrs,
      collectedRevenue: fin.collectedRevenue,
      expectedRevenue: fin.expectedRevenue,
      directExpenses: fin.directExpenses,
      allocatedOverhead: roundToCurrencyDecimals(allocatedOverhead, baseCurrency),
      netIncome,
      effectiveHourlyRate: effRate,
      expectedHourlyRate: expHourly,
      rateVariance,
      notes: src.notes,
    }
  })
}

export function computeSalariedCommuteAnalysis(
  incomeSources: IncomeSourceData[] = [],
  sessions: SessionData[] = [],
  payments: PaymentData[] = [],
  overheads: OverheadData[] = [],
  baseCurrency: string = 'USD'
): SalariedCommuteSummary {
  const safeSources = Array.isArray(incomeSources) ? incomeSources : []
  const safeSessions = Array.isArray(sessions) ? sessions : []
  const safePayments = Array.isArray(payments) ? payments : []
  const safeOverheads = Array.isArray(overheads) ? overheads : []

  const salarySource = safeSources.find(s => s.type === 'salary')
  if (!salarySource) {
    return {
      hasSalariedSource: false,
      salaryCollected: 0,
      workHours: 0,
      commuteHours: 0,
      totalTimeHours: 0,
      commuteExpenses: 0,
      nominalHourlyRate: 0,
      nominalRate: 0,
      trueHourlyRate: 0,
      trueRate: 0,
      commuteDragPct: 0,
      monthlyCommuteCost: 0,
    }
  }

  const srcIdStr = String(salarySource.id)
  const salarySessions = safeSessions.filter(s => !s.incomeSourceId || String(s.incomeSourceId || (s as any).income_source_id) === srcIdStr)
  const salaryPayments = safePayments.filter(p => !p.incomeSourceId || String(p.incomeSourceId || (p as any).income_source_id) === srcIdStr)

  let salaryCollected = 0
  for (const p of salaryPayments) {
    const isExp = p.isExpected || (p as any).is_expected || p.status === 'expected'
    if (!isExp) {
      salaryCollected += Number(p.baseAmount ?? (p as any).base_amount ?? p.amount) || 0
    }
  }

  let workMin = 0
  let commuteMin = 0
  for (const s of salarySessions) {
    let dur = Number(s.durationMin || s.durationMinutes || (s.durationSeconds ? s.durationSeconds / 60 : 0) || ((s as any).duration_seconds ? (s as any).duration_seconds / 60 : 0)) || 0
    if (dur <= 0 && s.startedAt && s.endedAt) {
      const diffMs = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()
      dur = Math.max(0, Math.round(diffMs / 60000))
    }
    const sessionType = (s.type || '').toLowerCase()
    if (sessionType === 'travel' || sessionType === 'commute' || s.unpaidReason === 'commute') {
      commuteMin += dur
    } else {
      workMin += dur
    }
  }

  const workHours = Math.round((workMin / 60) * 100) / 100
  const commuteHours = Math.round((commuteMin / 60) * 100) / 100
  const totalTimeHours = Math.round((workHours + commuteHours) * 100) / 100

  // Commute expenses
  const commuteOverheads = overheads.filter(o => o.category === 'commute')
  const commuteExpenses = commuteOverheads.reduce((acc, o) => acc + (Number(o.baseAmount ?? (o as any).base_amount ?? o.amount) || 0), 0)

  // Nominal rate = Salary / Work Hours
  const nominalRate = workHours > 0 ? roundToCurrencyDecimals(salaryCollected / workHours, baseCurrency) : 0

  // True rate = (Salary - Commute Expenses) / (Work Hours + Commute Hours)
  const trueRate = totalTimeHours > 0
    ? roundToCurrencyDecimals(Math.max(0, salaryCollected - commuteExpenses) / totalTimeHours, baseCurrency)
    : 0

  const commuteDragPct = nominalRate > 0
    ? Math.round(((nominalRate - trueRate) / nominalRate) * 100)
    : 0

  return {
    hasSalariedSource: true,
    sourceId: salarySource.id,
    sourceName: salarySource.name,
    salaryCollected: roundToCurrencyDecimals(salaryCollected, baseCurrency),
    workHours,
    commuteHours,
    totalTimeHours,
    commuteExpenses: roundToCurrencyDecimals(commuteExpenses, baseCurrency),
    nominalHourlyRate: nominalRate,
    nominalRate,
    trueHourlyRate: trueRate,
    trueRate,
    commuteMinutes: Math.round(commuteHours * 60),
    commuteDragPct,
    monthlyCommuteCost: roundToCurrencyDecimals(commuteExpenses, baseCurrency),
  }
}

export function computeMultiEmployerComparison(
  incomeSources: IncomeSourceData[] = [],
  incomeSourceMetrics: IncomeSourceMetricItem[] = [],
  baseCurrency: string = 'USD'
): MultiEmployerComparisonItem[] {
  const safeSources = Array.isArray(incomeSources) ? incomeSources : []
  const safeMetrics = Array.isArray(incomeSourceMetrics) ? incomeSourceMetrics : []

  const wageSources = safeMetrics.filter(m => ['hourly_wage', 'daily_wage', 'gig', 'retainer', 'other'].includes(m.type) || (safeSources.length > 1))
  const items = wageSources.map(w => ({
    id: w.id,
    name: w.name,
    type: w.type,
    payFrequency: w.payFrequency,
    currency: w.currency || baseCurrency,
    hoursWorked: w.hours?.totalAllHours || 0,
    netEarned: w.netIncome || 0,
    effectiveHourlyRate: w.effectiveHourlyRate || 0,
    yieldRank: 0,
  })).sort((a, b) => b.effectiveHourlyRate - a.effectiveHourlyRate)

  items.forEach((it, idx) => {
    it.yieldRank = idx + 1
  })

  return items
}

// ─── ROLLING WINDOW SUMMARY METRICS ─────────────────────────────────────────

export interface MetricWindowSummary {
  rangeKey: string
  rangeLabel: string
  startDateStr: string
  endDateStr: string
  hours: HoursBreakdown
  financials: FinancialsBreakdown
  rates: DualRatesResult
  incomeSourcesBreakdown: IncomeSourceMetricItem[]
  salariedSummary: SalariedCommuteSummary
  salariedCommuteAnalysis?: SalariedCommuteSummary
  multiEmployerSummary: MultiEmployerComparisonItem[]
  multiEmployerComparison?: MultiEmployerComparisonItem[]
  sessionsCount: number
  activeProjectsCount: number
  activeIncomeSourcesCount: number
}

export function filterByDateRange<T extends { date?: string | Date; startedAt?: string | Date; paymentDate?: string | Date; expenseDate?: string | Date; createdAt?: string | Date }>(
  items: T[],
  startUtc: Date,
  endUtc: Date,
  dateFieldExtractor?: (item: T) => string | Date | undefined
): T[] {
  const startMs = startUtc.getTime()
  const endMs = endUtc.getTime()

  return items.filter((item) => {
    const rawDate = dateFieldExtractor
      ? dateFieldExtractor(item)
      : (item.startedAt ||
         (item as any).started_at ||
         (item as any).sessionDate ||
         (item as any).session_date ||
         item.paymentDate ||
         (item as any).payment_date ||
         item.expenseDate ||
         (item as any).expense_date ||
         item.date ||
         item.createdAt ||
         (item as any).created_at)
    if (!rawDate) return false
    const itemMs = new Date(rawDate).getTime()
    return itemMs >= startMs && itemMs <= endMs
  })
}

export function computeUnifiedMetricsSummary(
  sessions: SessionData[] = [],
  payments: PaymentData[] = [],
  expenses: ExpenseData[] = [],
  projects: ProjectData[] = [],
  overheadsOrOptions: OverheadData[] | any = [],
  incomeSourcesOrOptions: IncomeSourceData[] | any = [],
  optionsOrUndefined: {
    range?: 'today' | '7d' | '30d' | '90d' | 'ytd' | 'all' | 'custom'
    from?: string
    to?: string
    timezone?: string
    baseCurrency?: string
    targetHourly?: number
    headlinePreference?: 'client_work' | 'all_in'
    includeOverhead?: boolean
  } = {}
): MetricWindowSummary {
  let overheads = Array.isArray(overheadsOrOptions) ? overheadsOrOptions : []
  let incomeSources = Array.isArray(incomeSourcesOrOptions) ? incomeSourcesOrOptions : []
  let options: any = {}

  if (optionsOrUndefined && typeof optionsOrUndefined === 'object' && !Array.isArray(optionsOrUndefined)) {
    options = { ...optionsOrUndefined }
  }

  // If 5th argument is options object (e.g. computeUnifiedMetricsSummary(sess, pay, exp, proj, { range: '30d' }))
  if (overheadsOrOptions && typeof overheadsOrOptions === 'object' && !Array.isArray(overheadsOrOptions)) {
    options = { ...overheadsOrOptions, ...options }
    overheads = []
  }

  // If 6th argument is options object (e.g. computeUnifiedMetricsSummary(sess, pay, exp, proj, overheads, { range: '30d' }))
  if (incomeSourcesOrOptions && typeof incomeSourcesOrOptions === 'object' && !Array.isArray(incomeSourcesOrOptions)) {
    options = { ...incomeSourcesOrOptions, ...options }
    incomeSources = []
  }

  const safeSessions = Array.isArray(sessions) ? sessions : []
  const safePayments = Array.isArray(payments) ? payments : []
  const safeExpenses = Array.isArray(expenses) ? expenses : []
  const safeProjects = Array.isArray(projects) ? projects : []
  const safeOverheads = Array.isArray(overheads) ? overheads : []
  const safeIncomeSources = Array.isArray(incomeSources) ? incomeSources : []

  const tz = isValidTimezone(options.timezone || '') ? (options.timezone as string) : 'UTC'
  const baseCurrency = (options.baseCurrency || 'USD').toUpperCase().slice(0, 3)
  const targetHourly = Number(options.targetHourly) || 0
  const headlinePref = options.headlinePreference || 'client_work'
  const range = options.range || '30d'
  const includeOverhead = options.includeOverhead !== false

  const userTodayStr = getUserToday(tz)
  let startUtc: Date
  let endUtc: Date
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

  // Filter within date range
  const filteredSessions = range === 'all' ? safeSessions : filterByDateRange(safeSessions, startUtc, endUtc)
  const filteredPayments = range === 'all' ? safePayments : filterByDateRange(safePayments, startUtc, endUtc)
  const filteredExpenses = range === 'all' ? safeExpenses : filterByDateRange(safeExpenses, startUtc, endUtc)
  const filteredOverheads = range === 'all' ? safeOverheads : filterByDateRange(safeOverheads, startUtc, endUtc)

  const activeProjectIds = new Set(filteredSessions.map(s => s.projectId || (s as any).project_id).filter(Boolean).map(String))
  const filteredProjects = range === 'all' ? safeProjects : safeProjects.filter(p => activeProjectIds.has(String(p.id)))

  const hours = computeSessionHours(filteredSessions)
  const financials = computeFinancials(filteredPayments, filteredExpenses, filteredProjects, filteredOverheads, baseCurrency, { includeOverhead })
  const rates = computeDualRates(financials, hours, targetHourly, headlinePref, baseCurrency)

  const incomeSourcesBreakdown = computeIncomeSourceMetrics(safeIncomeSources, filteredSessions, filteredPayments, filteredExpenses, filteredOverheads, baseCurrency, { includeOverhead })
  const salariedSummary = computeSalariedCommuteAnalysis(safeIncomeSources, filteredSessions, filteredPayments, filteredOverheads, baseCurrency)
  const multiEmployerSummary = computeMultiEmployerComparison(safeIncomeSources, incomeSourcesBreakdown, baseCurrency)

  const activeIncomeSourceIds = new Set(filteredSessions.map(s => s.incomeSourceId || (s as any).income_source_id).filter(Boolean))

  return {
    rangeKey: range,
    rangeLabel,
    startDateStr,
    endDateStr,
    hours,
    financials,
    rates,
    incomeSourcesBreakdown,
    salariedSummary,
    salariedCommuteAnalysis: salariedSummary,
    multiEmployerSummary,
    multiEmployerComparison: multiEmployerSummary,
    sessionsCount: filteredSessions.length,
    activeProjectsCount: activeProjectIds.size,
    activeIncomeSourcesCount: activeIncomeSourceIds.size,
  }
}

// ─── INTELLIGENCE & VALUE INSIGHTS ──────────────────────────────────────────

export interface TimeToMoneyVelocity {
  avgDaysToPayment: number
  fastestPaymentDays: number
  slowestPaymentDays: number
  completedCycleCount: number
  unpaidAwaitingPaymentCount: number
}

export interface UnpaidLeakageBreakdownItem {
  reasonKey: string
  label: string
  category: 'unpaid_client' | 'intentional_unpaid'
  hours: number
  minutes: number
  pctOfUnpaid: number
  estimatedOpportunityCost: number
}

export interface ClientProfitabilityItem {
  clientId: number | string
  clientName: string
  company?: string
  currency: string
  collectedRevenue: number
  earnedRevenue: number
  directExpenses: number
  netIncome: number
  paidHours: number
  unpaidClientHours: number
  intentionalUnpaidHours: number
  clientWorkRate: number
  allInRate: number
  marginPct: number
  profitabilityRank: number
}

export interface CategoryYieldItem {
  category: string
  projectCount: number
  totalRevenue: number
  netIncome: number
  totalHours: number
  effectiveHourlyRate: number
  yieldRank: number
}

export interface ProposalWinRateItem {
  totalQuotes: number
  wonQuotes: number
  lostQuotes: number
  draftQuotes: number
  winRatePct: number
  wonTotalValue: number
  lostTotalValue: number
  lostPitchHours: number
  lostPitchValue: number
}

export interface EffortQuoteVarianceItem {
  projectId: number | string
  projectName: string
  estimatedHours: number
  actualHours: number
  varianceHours: number
  variancePct: number
  isOverBudget: boolean
}

export interface IntelligenceInsightsSummary {
  timeToMoney: TimeToMoneyVelocity
  unpaidLeakage: UnpaidLeakageBreakdownItem[]
  clientProfitability: ClientProfitabilityItem[]
  categoryYield: CategoryYieldItem[]
  proposalWinRate: ProposalWinRateItem
  effortQuoteVariance: EffortQuoteVarianceItem[]
}

export function computeIntelligenceInsights(
  sessions: SessionData[],
  payments: PaymentData[],
  expenses: ExpenseData[],
  projects: ProjectData[],
  clients: Array<{ id: number | string; name: string; company?: string; currency?: string }> = [],
  targetHourly: number = 100,
  baseCurrency: string = 'USD'
): IntelligenceInsightsSummary {
  const target = Number(targetHourly) || 100

  // 1. Time to Money Velocity
  const paymentDays: number[] = []
  for (const p of payments) {
    const rawPaymentDate = p.paymentDate || (p as any).payment_date || (p as any).paidDate || (p as any).date || p.createdAt || (p as any).created_at
    const projId = p.projectId || (p as any).project_id
    if (projId && rawPaymentDate) {
      const projSessions = sessions.filter(s => String(s.projectId || (s as any).project_id) === String(projId) && (s.startedAt || (s as any).started_at))
      if (projSessions.length > 0) {
        const firstSessionMs = new Date(projSessions[0].startedAt || (projSessions[0] as any).started_at).getTime()
        const paymentMs = new Date(rawPaymentDate).getTime()
        const days = Math.max(0, Math.round((paymentMs - firstSessionMs) / (86400 * 1000)))
        paymentDays.push(days)
      }
    }
  }

  const avgDays = paymentDays.length > 0 ? Math.round(paymentDays.reduce((a, b) => a + b, 0) / paymentDays.length) : 0
  const fastestDays = paymentDays.length > 0 ? Math.min(...paymentDays) : 0
  const slowestDays = paymentDays.length > 0 ? Math.max(...paymentDays) : 0
  const unpaidAwaitingCount = sessions.filter(s => s.paymentType === 'unpaid' || (s as any).payment_type === 'unpaid' || (s as any).is_unpaid).length

  const timeToMoney: TimeToMoneyVelocity = {
    avgDaysToPayment: avgDays,
    fastestPaymentDays: fastestDays,
    slowestPaymentDays: slowestDays,
    completedCycleCount: paymentDays.length,
    unpaidAwaitingPaymentCount: unpaidAwaitingCount,
  }

  // 2. Unpaid Leakage by Reason
  const leakageMap = new Map<string, number>()
  let totalUnpaidMin = 0

  for (const s of sessions) {
    const payType = s.paymentType || (s as any).payment_type
    const isUnpaid = s.isUnpaid || (s as any).is_unpaid || payType === 'unpaid' || payType === 'partial'
    if (isUnpaid) {
      const dur = Number(
        s.durationMin ||
        s.durationMinutes ||
        (s.durationSeconds ? s.durationSeconds / 60 : 0) ||
        ((s as any).duration_seconds ? (s as any).duration_seconds / 60 : 0) ||
        0
      )
      totalUnpaidMin += dur
      const reasonKey = (s.unpaidReason || (s as any).unpaid_reason || 'client_friction').toLowerCase().trim().replace(/[\s-]/g, '_')
      leakageMap.set(reasonKey, (leakageMap.get(reasonKey) || 0) + dur)
    }
  }

  const unpaidLeakage: UnpaidLeakageBreakdownItem[] = Array.from(leakageMap.entries())
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
  const clientProfitability: ClientProfitabilityItem[] = clients.map((c) => {
    const clientProjects = projects.filter(p => String(p.clientId || (p as any).client_id) === String(c.id))
    const clientProjectIds = new Set(clientProjects.map(p => String(p.id)))

    const clientSessions = sessions.filter(s => clientProjectIds.has(String(s.projectId || (s as any).project_id)) || String(s.clientId || (s as any).client_id) === String(c.id))
    const clientPayments = payments.filter(p => clientProjectIds.has(String(p.projectId || (p as any).project_id)))
    const clientExpenses = expenses.filter(e => clientProjectIds.has(String(e.projectId || (e as any).project_id)))

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
  const categoryMap = new Map<string, { projects: number; revenue: number; expenses: number; hours: number }>()
  for (const p of projects) {
    const cat = p.serviceCategory || (p as any).service_category || 'General'
    const cur = categoryMap.get(cat) || { projects: 0, revenue: 0, expenses: 0, hours: 0 }
    cur.projects += 1

    const projPayments = payments.filter(pm => String(pm.projectId || (pm as any).project_id) === String(p.id))
    const projExpenses = expenses.filter(ex => String(ex.projectId || (ex as any).project_id) === String(p.id))
    const projSessions = sessions.filter(se => String(se.projectId || (se as any).project_id) === String(p.id))

    const fin = computeFinancials(projPayments, projExpenses, [p], [], baseCurrency)
    const hrs = computeSessionHours(projSessions)

    cur.revenue += fin.collectedRevenue || fin.earnedRevenue
    cur.expenses += fin.directExpenses
    cur.hours += hrs.totalAllHours
    categoryMap.set(cat, cur)
  }

  const categoryYield: CategoryYieldItem[] = Array.from(categoryMap.entries())
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
  const allQuoted = projects.filter(p => {
    const qAmt = p.quoteAmount !== null && p.quoteAmount !== undefined ? p.quoteAmount : (p as any).quote_amount
    return qAmt !== null && qAmt !== undefined && Number(qAmt) > 0
  })
  const wonQuotes = allQuoted.filter(p => p.isJob || (p as any).is_job || ['approved', 'in_progress', 'completed'].includes(p.status))
  const lostQuotes = allQuoted.filter(p => p.status === 'lost')
  const draftQuotes = allQuoted.filter(p => p.status === 'potential' || p.status === 'quoted')

  let lostPitchMin = 0
  for (const lp of lostQuotes) {
    const lostSessions = sessions.filter(s => String(s.projectId || (s as any).project_id) === String(lp.id))
    for (const ls of lostSessions) {
      lostPitchMin += Number(
        ls.durationMin ||
        ls.durationMinutes ||
        (ls.durationSeconds ? ls.durationSeconds / 60 : 0) ||
        ((ls as any).duration_seconds ? (ls as any).duration_seconds / 60 : 0) ||
        0
      )
    }
  }

  const wonTotalVal = wonQuotes.reduce((acc, q) => acc + (Number(q.quoteAmount) || 0), 0)
  const lostTotalVal = lostQuotes.reduce((acc, q) => acc + (Number(q.quoteAmount) || 0), 0)
  const lostPitchHours = Math.round((lostPitchMin / 60) * 100) / 100

  const decidedCount = wonQuotes.length + lostQuotes.length
  const winRatePct = decidedCount > 0 ? Math.round((wonQuotes.length / decidedCount) * 100) : (wonQuotes.length > 0 ? 100 : 0)

  const proposalWinRate: ProposalWinRateItem = {
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
  const effortQuoteVariance: EffortQuoteVarianceItem[] = projects
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
