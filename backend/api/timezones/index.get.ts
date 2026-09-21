// backend/api/timezones/index.get.ts
import { defineEventHandler } from 'h3'
import { sendSuccess } from '../../utils/apiResponse'
import { IANA_TIMEZONES, getUserToday } from '../../utils/dateUtils'

export default defineEventHandler(async (event) => {
  return sendSuccess(event, {
    timezones: IANA_TIMEZONES,
    serverTimeUtc: new Date().toISOString(),
  })
})
