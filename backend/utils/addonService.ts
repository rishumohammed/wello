// backend/utils/addonService.ts
import { H3Event, createError } from 'h3'
import { getDb } from './authService'
import { requireUser } from './authGuard'
import { activateUserAddon as activateMemoryAddon, isAddonActiveForUser as isMemoryAddonActive } from './storeEngine'

export interface AddonDTO {
  id: number | string
  key: string
  slug: string
  name: string
  description: string
  category: string
  icon: string
  version: string
  status: string
  isFree: boolean
  defaultEnabled: boolean
  dependsOn: string[]
  sortOrder: number
  isKilled: boolean
  isActivated?: boolean
  activatedAt?: string | null
  deactivatedAt?: string | null
}

/**
 * Check if a user has an active addon entitlement.
 */
export async function hasAddon(user: any, keyOrSlug: string): Promise<boolean> {
  if (!user || !user.id) return false
  const db = getDb()

  // 1. Fetch addon definition
  const addon = await db('addons')
    .where({ key: keyOrSlug })
    .orWhere({ slug: keyOrSlug })
    .first()

  if (!addon) {
    // Check in-memory storeEngine as fallback
    return isMemoryAddonActive(String(user.id), keyOrSlug)
  }

  // Global kill switch takes precedence over all activations
  if (Boolean(addon.is_killed)) {
    return false
  }

  // Admin users bypass non-killed addon gates
  if (user.role === 'admin' || user.adminRole) {
    return true
  }

  // Default enabled addons are active for everyone
  if (Boolean(addon.default_enabled)) {
    return true
  }

  // 2. Query user_addons
  const userAddon = await db('user_addons')
    .where({ user_id: user.id, addon_id: addon.id })
    .first()

  if (!userAddon) {
    return false
  }

  // Active if deactivated_at is null and status is ACTIVATED/INSTALLED
  const isActive = !userAddon.deactivated_at && (userAddon.status === 'ACTIVATED' || userAddon.status === 'INSTALLED')
  if (!isActive) {
    return false
  }

  // 3. Verify dependencies
  let dependsOn: string[] = []
  if (addon.depends_on) {
    dependsOn = typeof addon.depends_on === 'string' ? JSON.parse(addon.depends_on) : addon.depends_on
  }

  for (const depKey of dependsOn) {
    const hasDep = await hasAddon(user, depKey)
    if (!hasDep) return false
  }

  return true
}

/**
 * Server-side route guard to enforce addon requirement.
 * Throws 403 ADDON_NOT_ACTIVATED or ADDON_GLOBALLY_DISABLED.
 */
export async function requireAddon(event: H3Event, keyOrSlug: string): Promise<any> {
  const user = await requireUser(event)
  const db = getDb()

  const addon = await db('addons')
    .where({ key: keyOrSlug })
    .orWhere({ slug: keyOrSlug })
    .first()

  if (addon && Boolean(addon.is_killed)) {
    throw createError({
      statusCode: 403,
      statusMessage: `The ${addon.name} addon has been temporarily disabled by platform administrators.`,
      data: {
        code: 'ADDON_GLOBALLY_DISABLED',
        addonKey: addon.key || addon.slug,
        addonName: addon.name,
      },
    })
  }

  const active = await hasAddon(user, keyOrSlug)
  if (!active) {
    const addonName = addon ? addon.name : keyOrSlug
    const addonKey = addon ? (addon.key || addon.slug) : keyOrSlug

    throw createError({
      statusCode: 403,
      statusMessage: `The free ${addonName} addon is required to access this feature. Please activate it in the Wello Store.`,
      data: {
        code: 'ADDON_NOT_ACTIVATED',
        addonKey,
        addonName,
        isFree: true,
      },
    })
  }

  return user
}

/**
 * Activate an addon for a user, automatically resolving dependencies.
 */
export async function activateAddonForUser(
  userId: number,
  keyOrSlug: string,
  source: 'store' | 'onboarding' | 'admin' = 'store'
): Promise<{ activatedKeys: string[] }> {
  const db = getDb()
  const now = new Date()

  const addon = await db('addons')
    .where({ key: keyOrSlug })
    .orWhere({ slug: keyOrSlug })
    .first()

  if (!addon) {
    throw createError({
      statusCode: 404,
      statusMessage: `Addon '${keyOrSlug}' not found in catalog.`,
    })
  }

  if (Boolean(addon.is_killed)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Addon '${addon.name}' is currently disabled by incident kill-switch.`,
    })
  }

  const activatedKeys: string[] = []

  // Resolve and activate dependencies first
  let dependsOn: string[] = []
  if (addon.depends_on) {
    dependsOn = typeof addon.depends_on === 'string' ? JSON.parse(addon.depends_on) : addon.depends_on
  }

  for (const depKey of dependsOn) {
    const depRes = await activateAddonForUser(userId, depKey, source)
    activatedKeys.push(...depRes.activatedKeys)
  }

  // Activate primary addon in user_addons
  const existing = await db('user_addons')
    .where({ user_id: userId, addon_id: addon.id })
    .first()

  if (existing) {
    await db('user_addons')
      .where({ id: existing.id })
      .update({
        status: 'ACTIVATED',
        activated_at: now,
        deactivated_at: null,
        updated_at: now,
      })
  } else {
    await db('user_addons').insert({
      user_id: userId,
      addon_id: addon.id,
      status: 'ACTIVATED',
      activated_at: now,
      deactivated_at: null,
      last_used_at: now,
      usage_count: 0,
      created_at: now,
      updated_at: now,
    })
  }

  // Sync memory store
  activateMemoryAddon(String(userId), addon.slug || String(addon.id))

  // Emit analytics event
  try {
    const userRow = await db('users').where({ id: userId }).select('email').first()
    await db('analytics_events').insert({
      user_id: userId,
      email: userRow?.email || null,
      event_name: 'addon_activated',
      stage: source,
      metadata: JSON.stringify({
        addonKey: addon.key || addon.slug,
        addonName: addon.name,
        source,
        timestamp: now.toISOString(),
      }),
      created_at: now,
    })
  } catch (err) {
    console.warn('[Analytics] Failed to log addon_activated event:', err)
  }

  activatedKeys.push(addon.key || addon.slug)
  return { activatedKeys }
}

/**
 * Deactivate an addon for a user. NEVER deletes user data!
 */
export async function deactivateAddonForUser(
  userId: number,
  keyOrSlug: string,
  source: 'store' | 'admin' = 'store'
): Promise<{ deactivatedKey: string; dependentsWarned: string[] }> {
  const db = getDb()
  const now = new Date()

  const addon = await db('addons')
    .where({ key: keyOrSlug })
    .orWhere({ slug: keyOrSlug })
    .first()

  if (!addon) {
    throw createError({
      statusCode: 404,
      statusMessage: `Addon '${keyOrSlug}' not found in catalog.`,
    })
  }

  // Check for active dependents
  const allAddons = await db('addons').select('*')
  const dependentsWarned: string[] = []

  for (const other of allAddons) {
    if (other.id === addon.id) continue
    let deps: string[] = []
    if (other.depends_on) {
      deps = typeof other.depends_on === 'string' ? JSON.parse(other.depends_on) : other.depends_on
    }
    if (deps.includes(addon.key) || deps.includes(addon.slug)) {
      const isOtherActive = await hasAddon({ id: userId }, other.key || other.slug)
      if (isOtherActive) {
        dependentsWarned.push(other.name)
      }
    }
  }

  // Deactivate record in user_addons (Keep row intact!)
  await db('user_addons')
    .where({ user_id: userId, addon_id: addon.id })
    .update({
      status: 'DISABLED',
      deactivated_at: now,
      updated_at: now,
    })

  // Emit analytics event
  try {
    const userRow = await db('users').where({ id: userId }).select('email').first()
    await db('analytics_events').insert({
      user_id: userId,
      email: userRow?.email || null,
      event_name: 'addon_deactivated',
      stage: source,
      metadata: JSON.stringify({
        addonKey: addon.key || addon.slug,
        addonName: addon.name,
        source,
        dependentsWarned,
        timestamp: now.toISOString(),
      }),
      created_at: now,
    })
  } catch (err) {
    console.warn('[Analytics] Failed to log addon_deactivated event:', err)
  }

  return {
    deactivatedKey: addon.key || addon.slug,
    dependentsWarned,
  }
}

/**
 * Apply default persona addons during registration / onboarding.
 */
export async function applyPersonaDefaults(userId: number, persona: string): Promise<string[]> {
  const db = getDb()
  const personaRow = await db('addon_persona_defaults').where({ persona }).first() ||
                     await db('addon_persona_defaults').where({ persona: 'default' }).first()

  if (!personaRow) return []

  let keys: string[] = []
  if (personaRow.default_addon_keys) {
    keys = typeof personaRow.default_addon_keys === 'string'
      ? JSON.parse(personaRow.default_addon_keys)
      : personaRow.default_addon_keys
  }

  const activated: string[] = []
  for (const key of keys) {
    try {
      await activateAddonForUser(userId, key, 'onboarding')
      activated.push(key)
    } catch (err) {
      console.warn(`[Onboarding Defaults] Failed to auto-activate ${key} for user ${userId}:`, err)
    }
  }

  return activated
}
