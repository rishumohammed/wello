// backend/utils/pricingCalculator.ts
/**
 * Authoritative Pricing & Quote Calculator for Wello
 * Computes minimum (breakeven on target rate + overhead + buffer) and target quotes
 * with historical similar-job benchmarking and one-click quote generation.
 */

import { getDb } from './db'
import { roundToCurrencyDecimals } from './currencyUtils'
import { computeSessionHours, computeFinancials } from './metricsEngine'

export interface PricingCalculatorInput {
  userId: number
  targetHourlyRate?: number
  estimatedHours: number
  unpaidBufferPct?: number | null
  expectedOverhead?: number
  directExpenses?: number
  currency?: string
  serviceCategory?: string
  marginPct?: number
}

export interface SimilarJobSummary {
  id: number
  name: string
  clientName?: string
  serviceCategory?: string
  totalHours: number
  revenue: number
  expenses: number
  netIncome: number
  effectiveHourlyRate: number
  quoteAmount?: number
  createdAt: string
}

export interface PricingCalculatorResult {
  estimatedHours: number
  historicalUnpaidRatioPct: number
  appliedUnpaidBufferPct: number
  totalEffectiveHours: number
  targetHourlyRate: number
  expectedOverhead: number
  directExpenses: number
  marginPct: number
  currency: string
  laborCostBase: number
  minimumQuote: number
  targetQuote: number
  effectiveHourlyAtMinimum: number
  effectiveHourlyAtTarget: number
  similarJobs: SimilarJobSummary[]
  similarJobsAvgHourlyRate: number
  similarJobsCount: number
}

export async function calculateProjectPricing(input: PricingCalculatorInput): Promise<PricingCalculatorResult> {
  const db = getDb()
  const user = await db('users').where({ id: input.userId }).first()
  if (!user) throw new Error('User not found.')

  const currency = (input.currency || user.base_currency || 'USD').toUpperCase().slice(0, 3)
  const targetHourlyRate = Number(input.targetHourlyRate ?? user.target_hourly ?? 100) || 100
  const estimatedHours = Math.max(0.1, Number(input.estimatedHours) || 1)
  const expectedOverhead = Math.max(0, Number(input.expectedOverhead) || 0)
  const directExpenses = Math.max(0, Number(input.directExpenses) || 0)
  const marginPct = Number(input.marginPct != null ? input.marginPct : 20) || 20

  // 1. Compute User's Historical Unpaid Ratio from Sessions
  const allUserSessions = await db('work_sessions')
    .where({ user_id: input.userId })
    .whereNull('deleted_at')
    .select('*')

  const sessionHrs = computeSessionHours(allUserSessions)
  const totalMin = sessionHrs.totalAllMinutes || 0
  const unpaidMin = (sessionHrs.unpaidClientMinutes || 0) + (sessionHrs.intentionalUnpaidMinutes || 0)

  let historicalUnpaidRatioPct = 15 // Default 15% if no sessions logged yet
  if (totalMin > 60) {
    historicalUnpaidRatioPct = Math.min(60, Math.max(0, Math.round((unpaidMin / totalMin) * 100)))
  }

  const appliedUnpaidBufferPct = input.unpaidBufferPct != null
    ? Math.max(0, Math.min(100, Number(input.unpaidBufferPct)))
    : historicalUnpaidRatioPct

  // 2. Mathematical Quote Computation
  // Effective labor hours = Estimated Billable Hours * (1 + Unpaid Buffer Pct / 100)
  const totalEffectiveHours = Math.round(estimatedHours * (1 + appliedUnpaidBufferPct / 100) * 100) / 100
  const baseLaborCost = roundToCurrencyDecimals(estimatedHours * targetHourlyRate, currency)
  const bufferHours = Math.round((totalEffectiveHours - estimatedHours) * 100) / 100
  const bufferCost = roundToCurrencyDecimals(bufferHours * targetHourlyRate, currency)
  const laborCostBase = baseLaborCost + bufferCost

  // Minimum Quote = Labor Cost (Base + Buffer) + Allocated Overhead + Direct Expenses
  const minimumQuote = roundToCurrencyDecimals(laborCostBase + expectedOverhead + directExpenses, currency)

  // Target Quote = Minimum Quote + (Minimum Quote * Margin Pct / 100)
  const targetQuote = roundToCurrencyDecimals(
    minimumQuote * (1 + marginPct / 100),
    currency
  )

  const effectiveHourlyAtMinimum = totalEffectiveHours > 0
    ? roundToCurrencyDecimals(Math.max(0, minimumQuote - directExpenses - expectedOverhead) / totalEffectiveHours, currency)
    : targetHourlyRate

  const effectiveHourlyAtTarget = totalEffectiveHours > 0
    ? roundToCurrencyDecimals(Math.max(0, targetQuote - directExpenses - expectedOverhead) / totalEffectiveHours, currency)
    : targetHourlyRate

  // 3. Benchmarking: Find last 5 similar completed / in-progress projects
  let projectQuery = db('projects')
    .where({ user_id: input.userId })
    .whereNull('deleted_at')
    .orderBy('created_at', 'desc')

  if (input.serviceCategory && input.serviceCategory !== 'All' && input.serviceCategory !== 'General') {
    projectQuery = projectQuery.where({ service_category: input.serviceCategory })
  }

  const candidateProjects = await projectQuery.limit(10)
  const projectIds = candidateProjects.map(p => p.id)

  const relatedSessions = projectIds.length > 0
    ? await db('work_sessions').whereIn('project_id', projectIds).whereNull('deleted_at')
    : []
  const relatedPayments = projectIds.length > 0
    ? await db('payments').whereIn('project_id', projectIds).whereNull('deleted_at')
    : []
  const relatedExpenses = projectIds.length > 0
    ? await db('project_expenses').whereIn('project_id', projectIds).whereNull('deleted_at')
    : []
  const clientIds = candidateProjects.map(p => p.client_id).filter(Boolean)
  const relatedClients = clientIds.length > 0
    ? await db('clients').whereIn('id', clientIds)
    : []
  const clientMap = new Map(relatedClients.map(c => [c.id, c.name]))

  const similarJobs: SimilarJobSummary[] = []
  let sumRate = 0
  let validRateCount = 0

  for (const proj of candidateProjects) {
    if (similarJobs.length >= 5) break
    const pSessions = relatedSessions.filter(s => s.project_id === proj.id)
    const pPayments = relatedPayments.filter(p => p.project_id === proj.id)
    const pExpenses = relatedExpenses.filter(e => e.project_id === proj.id)

    const pHrs = computeSessionHours(pSessions)
    const pFin = computeFinancials(pPayments, pExpenses, [proj], [], currency)

    const totalHours = pHrs.totalAllHours
    const netIncome = pFin.collectedNetIncome > 0 ? pFin.collectedNetIncome : pFin.earnedNetIncome
    const effectiveHourlyRate = totalHours > 0 ? roundToCurrencyDecimals(netIncome / totalHours, currency) : 0

    if (totalHours > 0 || pFin.collectedRevenue > 0 || Number(proj.quote_amount) > 0) {
      similarJobs.push({
        id: proj.id,
        name: proj.name,
        clientName: proj.client_id ? clientMap.get(proj.client_id) : undefined,
        serviceCategory: proj.service_category,
        totalHours,
        revenue: pFin.collectedRevenue,
        expenses: pFin.directExpenses,
        netIncome,
        effectiveHourlyRate,
        quoteAmount: proj.quote_amount ? Number(proj.quote_amount) : undefined,
        createdAt: proj.created_at,
      })

      if (effectiveHourlyRate > 0) {
        sumRate += effectiveHourlyRate
        validRateCount++
      }
    }
  }

  const similarJobsAvgHourlyRate = validRateCount > 0
    ? roundToCurrencyDecimals(sumRate / validRateCount, currency)
    : targetHourlyRate

  return {
    estimatedHours,
    historicalUnpaidRatioPct,
    appliedUnpaidBufferPct,
    totalEffectiveHours,
    targetHourlyRate,
    expectedOverhead,
    directExpenses,
    marginPct,
    currency,
    laborCostBase,
    baseLaborCost,
    bufferHours,
    bufferCost,
    minimumQuote,
    suggestedMinQuote: minimumQuote,
    targetQuote,
    suggestedTargetQuote: targetQuote,
    effectiveHourlyAtMinimum,
    effectiveHourlyAtTarget,
    similarJobs,
    similarJobsAvgHourlyRate,
    similarJobsCount: similarJobs.length,
    similarJobsBenchmark: {
      sampleSize: similarJobs.length,
      medianHourlyEarned: similarJobsAvgHourlyRate,
      jobs: similarJobs,
    },
  }
}
