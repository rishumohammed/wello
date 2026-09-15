// server/api/store/addons/activate.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { activateUserAddon, getAddonById } from '../../../utils/storeEngine'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = body?.userId || 'u1'
  const addonId = body?.addonId

  if (!addonId) {
    throw createError({ statusCode: 400, statusMessage: 'Addon ID is required.' })
  }

  const addon = getAddonById(addonId)
  if (!addon) {
    throw createError({ statusCode: 404, statusMessage: 'Addon not found.' })
  }

  const userAddon = activateUserAddon(userId, addonId)

  return {
    success: true,
    message: `Addon ${addon.name} is now ${userAddon.status === 'ACTIVATED' ? 'activated' : 'disabled'}.`,
    userAddon,
  }
})
