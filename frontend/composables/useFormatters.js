// frontend/composables/useFormatters.js
// Universal, global formatting composable for Wello

import { formatCurrencyIntl, formatNumberIntl, getCurrencyDecimals } from '~/utils/currencyUtils'
import { formatDateIntl, formatInTimezone } from '~/utils/dateUtils'
import { useWelloStore } from '~/stores/wello'

export function useFormatters() {
  const store = useWelloStore()

  function fmtCurrency(amount, currencyCode = null) {
    const code = currencyCode || store.user?.baseCurrency || store.user?.currency || store.currencyCode || 'USD'
    return formatCurrencyIntl(amount, code)
  }

  function fmtHourly(rate, currencyCode = null) {
    const formatted = fmtCurrency(rate || 0, currencyCode)
    return `${formatted}/hr`
  }

  function fmtNumber(amount, decimals) {
    return formatNumberIntl(amount, decimals)
  }

  function fmtDuration(minutes) {
    const mins = Math.max(0, Math.round(Number(minutes) || 0))
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  function fmtDate(date, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
    const tz = store.user?.timezone || 'UTC'
    return formatDateIntl(date, options, tz)
  }

  function fmtDateTime(date, options = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) {
    const tz = store.user?.timezone || 'UTC'
    return formatDateIntl(date, options, tz)
  }

  return {
    fmtCurrency,
    fmtHourly,
    fmtNumber,
    fmtDuration,
    fmtDate,
    fmtDateTime,
  }
}
