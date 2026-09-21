// backend/api/fx/convert.post.ts
import { defineEventHandler, readBody } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { sendSuccess, sendError, formatZodError } from '../../utils/apiResponse'
import { convertToBase, getFxRate } from '../../utils/fxService'

const convertSchema = z.object({
  amount: z.number(),
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3).optional(),
  date: z.string().optional(),
  manualFxRate: z.number().optional().nullable(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  const parsed = convertSchema.safeParse(body)
  if (!parsed.success) {
    const formatted = formatZodError(parsed.error)
    return sendError(event, 400, formatted.code, formatted.message, formatted.details)
  }

  const { amount, fromCurrency, toCurrency, date, manualFxRate } = parsed.data
  const targetCurrency = toCurrency || user.base_currency || 'USD'

  const result = await convertToBase(amount, fromCurrency, targetCurrency, date, manualFxRate)

  return sendSuccess(event, {
    originalAmount: amount,
    fromCurrency: fromCurrency.toUpperCase(),
    toCurrency: targetCurrency.toUpperCase(),
    convertedAmount: result.convertedAmount,
    rateUsed: result.rateUsed,
    date: date || new Date().toISOString().slice(0, 10),
  })
})
