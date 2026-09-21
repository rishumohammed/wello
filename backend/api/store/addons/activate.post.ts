// server/api/store/addons/activate.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../../utils/authGuard'
import { activateUserAddon, getAddonById } from '../../../utils/storeEngine'

const activateSchema = z.object({
  addonId: z.string().min(1, 'Addon ID is required.'),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const parseResult = activateSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors[0]?.message || 'Addon ID is required.',
    })
  }

  const { addonId } = parseResult.data
  const userId = String(user.id)

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
