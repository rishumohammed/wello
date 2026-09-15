// server/utils/storeEngine.ts
// Wello Store & Addon Registry Architecture

export type AddonStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED'
export type UserAddonStatus = 'INSTALLED' | 'ACTIVATED' | 'DISABLED' | 'UNINSTALLED'

export interface AddonRecord {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  version: string
  category: string
  features: string[]
  isFree: boolean
  status: AddonStatus
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export interface UserAddonRecord {
  id: string
  userId: string
  addonId: string
  status: UserAddonStatus
  activatedAt: string
  lastUsedAt: string
  usageCount: number
}

// In-memory persistent stores (for runtime server session)
const addonStore = new Map<string, AddonRecord>()
const userAddonStore = new Map<string, UserAddonRecord>()
let storeVisitsCount = 142 // Initial baseline for analytics

// Seed initial Basic Invoicing FREE Addon
const initialInvoicingAddon: AddonRecord = {
  id: 'addon_invoicing',
  slug: 'basic-invoicing',
  name: 'Basic Invoicing',
  description: 'Create, manage, print, and export professional invoices directly from your completed Wello jobs and clients.',
  icon: 'IconReceipt',
  version: '1.0.0',
  category: 'Finance & Billing',
  features: [
    'Itemized billing lines with tax & discounts',
    'Generate invoice directly from completed Wello jobs',
    'Print & PDF download optimization',
    'Manual payment status tracking (Draft, Sent, Paid, Overdue, Cancelled)',
    '100% Free forever with no payment processing fees'
  ],
  isFree: true,
  status: 'PUBLISHED',
  displayOrder: 1,
  createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  updatedAt: new Date().toISOString(),
}

addonStore.set(initialInvoicingAddon.id, initialInvoicingAddon)

// Pre-activate Basic Invoicing for standard users by default
userAddonStore.set('u1_addon_invoicing', {
  id: 'u1_addon_invoicing',
  userId: 'u1',
  addonId: 'addon_invoicing',
  status: 'ACTIVATED',
  activatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  lastUsedAt: new Date().toISOString(),
  usageCount: 12,
})

userAddonStore.set('u_admin_addon_invoicing', {
  id: 'u_admin_addon_invoicing',
  userId: 'u_admin',
  addonId: 'addon_invoicing',
  status: 'ACTIVATED',
  activatedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  lastUsedAt: new Date().toISOString(),
  usageCount: 8,
})

// Store Functions
export function getAvailableAddons(includeDrafts = false): AddonRecord[] {
  const addons = Array.from(addonStore.values())
  if (!includeDrafts) {
    return addons.filter(a => a.status === 'PUBLISHED').sort((a, b) => a.displayOrder - b.displayOrder)
  }
  return addons.sort((a, b) => a.displayOrder - b.displayOrder)
}

export function getAddonById(id: string): AddonRecord | null {
  return addonStore.get(id) || null
}

export function getAddonBySlug(slug: string): AddonRecord | null {
  for (const addon of addonStore.values()) {
    if (addon.slug === slug) return addon
  }
  return null
}

export function getUserAddons(userId: string): UserAddonRecord[] {
  const list: UserAddonRecord[] = []
  for (const ua of userAddonStore.values()) {
    if (ua.userId === userId) list.push({ ...ua })
  }
  return list
}

export function isAddonActiveForUser(userId: string, addonSlug: string): boolean {
  const addon = getAddonBySlug(addonSlug)
  if (!addon) return false
  
  const key = `${userId}_${addon.id}`
  const ua = userAddonStore.get(key)
  return ua ? ua.status === 'ACTIVATED' : false
}

export function activateUserAddon(userId: string, addonId: string): UserAddonRecord {
  const key = `${userId}_${addonId}`
  let ua = userAddonStore.get(key)
  const now = new Date().toISOString()

  if (ua) {
    ua.status = ua.status === 'ACTIVATED' ? 'DISABLED' : 'ACTIVATED'
    ua.lastUsedAt = now
  } else {
    ua = {
      id: key,
      userId,
      addonId,
      status: 'ACTIVATED',
      activatedAt: now,
      lastUsedAt: now,
      usageCount: 1,
    }
  }

  userAddonStore.set(key, ua)
  return { ...ua }
}

export function recordAddonUsage(userId: string, addonSlug: string): void {
  const addon = getAddonBySlug(addonSlug)
  if (!addon) return
  const key = `${userId}_${addon.id}`
  const ua = userAddonStore.get(key)
  if (ua) {
    ua.usageCount += 1
    ua.lastUsedAt = new Date().toISOString()
  }
}

export function createOrUpdateAddon(data: Partial<AddonRecord>): AddonRecord {
  const now = new Date().toISOString()
  const id = data.id || 'addon_' + Math.random().toString(36).slice(2, 9)
  const existing = addonStore.get(id)

  const record: AddonRecord = {
    id,
    slug: data.slug || data.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'new-addon',
    name: data.name || 'New Addon',
    description: data.description || '',
    icon: data.icon || 'IconPackage',
    version: data.version || '1.0.0',
    category: data.category || 'Utilities',
    features: data.features || [],
    isFree: data.isFree !== undefined ? data.isFree : true,
    status: data.status || 'PUBLISHED',
    displayOrder: data.displayOrder || addonStore.size + 1,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  }

  addonStore.set(id, record)
  return record
}

export function recordStoreVisit(): number {
  storeVisitsCount += 1
  return storeVisitsCount
}

export function getStoreAnalytics() {
  const allAddons = Array.from(addonStore.values())
  const published = allAddons.filter(a => a.status === 'PUBLISHED')
  const drafts = allAddons.filter(a => a.status === 'DRAFT')
  const userAddonsList = Array.from(userAddonStore.values())
  const activeActivations = userAddonsList.filter(ua => ua.status === 'ACTIVATED')

  // Per addon adoption breakdown
  const adoptionMap: Record<string, { totalUsers: number, activeUsers: number, usageCount: number }> = {}
  allAddons.forEach(a => {
    const uaForAddon = userAddonsList.filter(ua => ua.addonId === a.id)
    adoptionMap[a.id] = {
      totalUsers: uaForAddon.length,
      activeUsers: uaForAddon.filter(ua => ua.status === 'ACTIVATED').length,
      usageCount: uaForAddon.reduce((acc, curr) => acc + (curr.usageCount || 0), 0),
    }
  })

  return {
    storeVisits: storeVisitsCount,
    totalAddons: allAddons.length,
    publishedAddons: published.length,
    draftAddons: drafts.length,
    totalActivations: activeActivations.length,
    adoptionMap,
  }
}
