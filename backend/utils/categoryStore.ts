// server/utils/categoryStore.ts
// Category Management, User Category Requests & Category Intelligence Store for Wello

export interface Category {
  id: string
  parentId?: string | null
  name: string
  slug: string
  description: string
  icon: string
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CategoryRequestStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'MERGED'

export interface CategoryRequest {
  id: string
  userId?: string
  userEmail: string
  requestedName: string
  description?: string
  reason?: string
  status: CategoryRequestStatus
  adminNotes?: string
  processedBy?: string
  processedAt?: string
  requestCount: number
  createdAt: string
}

export interface CategoryIntelligenceMetric {
  categoryId: string
  categoryName: string
  providerCount: number
  totalJobs: number
  activeJobs: number
  completedJobs: number
  cancelledJobs: number
  cancellationRate: number
  totalRequests: number
  successfulConnections: number
  growthRatePercent: number
}

// Global server in-memory categories database
const categoriesMap = new Map<string, Category>()
const categoryRequestsMap = new Map<string, CategoryRequest>()

// Seed initial default categories
const seedCategories: Category[] = [
  { id: 'cat_1', name: 'Software & Web Development', slug: 'software-web-development', description: 'Web, mobile app, and backend software engineering services', icon: 'IconFolders', displayOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_2', name: 'UI/UX & Visual Design', slug: 'ui-ux-visual-design', description: 'User experience, product design, branding, and visual assets', icon: 'IconGrid', displayOrder: 2, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_3', name: 'Content & Copywriting', slug: 'content-copywriting', description: 'Technical documentation, copywriting, marketing content, and blogs', icon: 'IconBriefcase', displayOrder: 3, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_4', name: 'Digital Marketing & SEO', slug: 'digital-marketing-seo', description: 'SEO optimization, social media marketing, and growth strategy', icon: 'IconInsights', displayOrder: 4, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'cat_5', name: 'Video Production & Animation', slug: 'video-production-animation', description: 'Video editing, motion graphics, 3D rendering, and audio production', icon: 'IconClock', displayOrder: 5, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Subcategory example
  { id: 'cat_1_sub1', parentId: 'cat_1', name: 'Frontend Vue/Nuxt Development', slug: 'frontend-vue-nuxt', description: 'Specialized Vue 3 and Nuxt single-page and SSR web development', icon: 'IconFolders', displayOrder: 1, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
]

seedCategories.forEach(c => categoriesMap.set(c.id, c))

// Seed initial Category Requests
const seedRequests: CategoryRequest[] = [
  { id: 'req_1', userEmail: 'priya.sharma@design.io', requestedName: 'AI Prompt Engineering & Fine-tuning', description: 'Specialized prompt tuning, LLM integration, and AI workflow design.', reason: 'High client demand for AI automation in current projects.', status: 'PENDING', requestCount: 5, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'req_2', userEmail: 'amit.patel@devs.in', requestedName: 'DevOps & Cloud Architecture', description: 'AWS, Kubernetes, Terraform, and CI/CD pipeline automation.', reason: 'Needed for client infrastructure setups.', status: 'UNDER_REVIEW', requestCount: 3, createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 'req_3', userEmail: 'sneha.rao@content.co', requestedName: '3D Character Animation', description: 'Blender and Maya character rigging and animation.', status: 'PENDING', requestCount: 2, createdAt: new Date(Date.now() - 7 * 86400000).toISOString() },
]

seedRequests.forEach(r => categoryRequestsMap.set(r.id, r))

export function getAllCategories(): Category[] {
  return Array.from(categoriesMap.values()).sort((a, b) => a.displayOrder - b.displayOrder)
}

export function createCategory(payload: { parentId?: string; name: string; description?: string; icon?: string }): Category {
  const slug = payload.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')
  const newCat: Category = {
    id: 'cat_' + Math.random().toString(36).slice(2, 9),
    parentId: payload.parentId || null,
    name: payload.name.trim(),
    slug,
    description: payload.description?.trim() || '',
    icon: payload.icon || 'IconBriefcase',
    displayOrder: categoriesMap.size + 1,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  categoriesMap.set(newCat.id, newCat)
  return newCat
}

export function updateCategory(id: string, updates: Partial<Category>): Category | null {
  const cat = categoriesMap.get(id)
  if (!cat) return null
  if (updates.name) {
    cat.name = updates.name.trim()
    cat.slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  }
  if (updates.description !== undefined) cat.description = updates.description
  if (updates.icon) cat.icon = updates.icon
  if (updates.isActive !== undefined) cat.isActive = updates.isActive
  if (updates.displayOrder !== undefined) cat.displayOrder = updates.displayOrder
  cat.updatedAt = new Date().toISOString()
  categoriesMap.set(id, cat)
  return cat
}

export function toggleCategoryStatus(id: string): Category | null {
  const cat = categoriesMap.get(id)
  if (!cat) return null
  cat.isActive = !cat.isActive
  cat.updatedAt = new Date().toISOString()
  return cat
}

// Category Requests
export function getAllCategoryRequests(): CategoryRequest[] {
  return Array.from(categoryRequestsMap.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function submitCategoryRequest(payload: { userEmail: string; requestedName: string; description?: string; reason?: string }): CategoryRequest {
  const normalizedName = payload.requestedName.trim()

  // Check if existing request for same name exists -> increment request count
  const existing = Array.from(categoryRequestsMap.values()).find(
    r => r.requestedName.toLowerCase() === normalizedName.toLowerCase() && r.status === 'PENDING'
  )

  if (existing) {
    existing.requestCount += 1
    categoryRequestsMap.set(existing.id, existing)
    return existing
  }

  const req: CategoryRequest = {
    id: 'req_' + Math.random().toString(36).slice(2, 9),
    userEmail: payload.userEmail.trim(),
    requestedName: normalizedName,
    description: payload.description?.trim(),
    reason: payload.reason?.trim(),
    status: 'PENDING',
    requestCount: 1,
    createdAt: new Date().toISOString(),
  }

  categoryRequestsMap.set(req.id, req)
  return req
}

export function processCategoryRequest(payload: {
  requestId: string
  action: 'APPROVE' | 'REJECT' | 'MERGE' | 'UNDER_REVIEW'
  adminEmail: string
  adminNotes?: string
  targetCategoryId?: string
}): { request: CategoryRequest; createdCategory?: Category } {
  const req = categoryRequestsMap.get(payload.requestId)
  if (!req) throw new Error('Category request not found')

  req.processedBy = payload.adminEmail
  req.processedAt = new Date().toISOString()
  req.adminNotes = payload.adminNotes

  let createdCategory: Category | undefined

  if (payload.action === 'APPROVE') {
    req.status = 'APPROVED'
    createdCategory = createCategory({
      name: req.requestedName,
      description: req.description || `Category requested by ${req.userEmail}`,
    })
  } else if (payload.action === 'REJECT') {
    req.status = 'REJECTED'
  } else if (payload.action === 'MERGE') {
    req.status = 'MERGED'
  } else if (payload.action === 'UNDER_REVIEW') {
    req.status = 'UNDER_REVIEW'
  }

  categoryRequestsMap.set(req.id, req)
  return { request: req, createdCategory }
}

export function getCategoryIntelligenceMetrics(): CategoryIntelligenceMetric[] {
  const categories = getAllCategories()

  return categories.map(cat => ({
    categoryId: cat.id,
    categoryName: cat.name,
    providerCount: Math.floor(3 + Math.random() * 8),
    totalJobs: Math.floor(5 + Math.random() * 15),
    activeJobs: Math.floor(2 + Math.random() * 5),
    completedJobs: Math.floor(3 + Math.random() * 8),
    cancelledJobs: 0,
    cancellationRate: 0.0,
    totalRequests: Math.floor(8 + Math.random() * 20),
    successfulConnections: Math.floor(4 + Math.random() * 10),
    growthRatePercent: Number((10 + Math.random() * 25).toFixed(1)),
  }))
}
