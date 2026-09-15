// server/api/admin/category-requests.get.ts
import { defineEventHandler } from 'h3'
import { getAllCategoryRequests } from '../../utils/categoryStore'

export default defineEventHandler(() => {
  const requests = getAllCategoryRequests()
  return {
    success: true,
    requests,
  }
})
