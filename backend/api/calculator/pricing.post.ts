// backend/api/calculator/pricing.post.ts
import { defineEventHandler, readBody } from 'h3'
import { requireAddon } from '../../utils/addonService'
import { sendSuccess, sendError } from '../../utils/apiResponse'
import { calculateProjectPricing } from '../../utils/pricingCalculator'

export default defineEventHandler(async (event) => {
  const user = await requireAddon(event, 'pricing-calculator')
  const body = await readBody(event).catch(() => ({}))

  const estimatedHours = Number(body.estimatedHours || body.estimated_hours || 0)
  if (estimatedHours <= 0) {
    return sendError(event, 400, 'INVALID_HOURS', 'Estimated hours must be a positive number.')
  }

  const rawBuffer = body.unpaidBufferPct ?? body.unpaidBufferPercent
  const rawMargin = body.marginPct ?? body.targetMarginPercent
  const result = await calculateProjectPricing({
    userId: user.id,
    targetHourlyRate: body.targetHourlyRate != null ? Number(body.targetHourlyRate) : undefined,
    estimatedHours,
    unpaidBufferPct: rawBuffer != null ? Number(rawBuffer) : null,
    expectedOverhead: body.expectedOverhead != null ? Number(body.expectedOverhead) : 0,
    directExpenses: body.directExpenses != null ? Number(body.directExpenses) : 0,
    currency: body.currency || user.base_currency || 'USD',
    serviceCategory: body.serviceCategory || body.service_category,
    marginPct: rawMargin != null ? Number(rawMargin) : 20,
    complexity: body.complexity || body.scopeComplexity,
    currentProjectId: body.currentProjectId || body.projectId,
  })

  return sendSuccess(event, result)
})
