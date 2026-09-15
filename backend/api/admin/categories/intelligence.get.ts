// server/api/admin/categories/intelligence.get.ts
import { defineEventHandler } from 'h3'
import { getCategoryIntelligenceMetrics } from '../../../utils/categoryStore'

export default defineEventHandler(() => {
  const metrics = getCategoryIntelligenceMetrics()
  return {
    success: true,
    intelligence: metrics,
  }
})
