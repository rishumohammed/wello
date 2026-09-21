// server/api/admin/category-requests.get.ts
import { defineEventHandler } from 'h3'
import { requirePermission } from '../../utils/authGuard'
import { getAllCategoryRequests } from '../../utils/categoryStore'

export default defineEventHandler(async (event) => {
  await requirePermission(event, 'category_requests.manage')
  const requests = getAllCategoryRequests()
  return {
    success: true,
    requests,
  }
})
