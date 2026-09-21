// backend/api/notifications/push/vapid-key.get.ts
import { defineEventHandler } from 'h3'
import { sendSuccess } from '../../../utils/apiResponse'

const DEFAULT_VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSPOEghkf_ammWV35ddtvEQgvVOPrKVGav3I'

export default defineEventHandler(async (event) => {
  return sendSuccess(event, {
    publicKey: DEFAULT_VAPID_PUBLIC_KEY,
  })
})
