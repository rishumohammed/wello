// server/api/admin/funnel.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { evaluateFunnel } from '../../utils/analyticsRollupService'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'analytics.view')
  const query = getQuery(event)
  const startDate = query?.startDate as string | undefined
  const endDate = query?.endDate as string | undefined
  const country = query?.country as string | undefined
  const slug = (query?.slug || 'default_activation_funnel').toString()

  const result = await evaluateFunnel(slug, { startDate, endDate, country })

  const legacyFunnel = result.steps.map(s => ({
    stageKey: s.stepKey,
    stageName: s.stepName,
    count: s.count,
    conversionRate: s.conversionRate,
    dropOffRate: s.dropOffRate,
  }))

  return {
    success: true,
    funnel: legacyFunnel,
    steps: result.steps,
    definition: result.funnel,
    summary: result.summary,
  }
})
