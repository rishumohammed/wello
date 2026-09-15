// server/api/categories/index.get.ts
import { defineEventHandler } from 'h3'
import { getAllCategories } from '../../utils/categoryStore'

export default defineEventHandler(() => {
  const categories = getAllCategories()
  return {
    success: true,
    categories,
  }
})
