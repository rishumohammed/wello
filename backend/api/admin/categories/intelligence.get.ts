// server/api/admin/categories/intelligence.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../../utils/authGuard'
import { getCategoryIntelligenceMetrics } from '../../../utils/categoryStore'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'categories.view')
  const metrics = getCategoryIntelligenceMetrics()
  return {
    success: true,
    intelligence: metrics,
  }
})
