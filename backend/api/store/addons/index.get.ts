// server/api/store/addons/index.get.ts
import { defineEventHandler, getQuery } from 'h3'
import { getAvailableAddons, getUserAddons, recordStoreVisit } from '../../../utils/storeEngine'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = (query?.userId as string) || 'u1'

  // Increment store visits for analytics
  recordStoreVisit()

  const available = getAvailableAddons(false)
  const userAddons = getUserAddons(userId)

  const catalog = available.map(addon => {
    const userActivation = userAddons.find(ua => ua.addonId === addon.id)
    return {
      ...addon,
      isInstalled: Boolean(userActivation),
      isActivated: userActivation ? userActivation.status === 'ACTIVATED' : false,
      userStatus: userActivation ? userActivation.status : 'NOT_INSTALLED',
      lastUsedAt: userActivation ? userActivation.lastUsedAt : null,
    }
  })

  return {
    success: true,
    addons: catalog,
  }
})
