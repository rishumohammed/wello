// frontend/utils/dateUtils.js
// Universal date & timezone engine for Wello frontend

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
import isBetween from 'dayjs/plugin/isBetween.js'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(isBetween)

export { dayjs }

export function getBrowserTimezone() {
  if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch (e) {}
  }
  return 'UTC'
}

export function isValidTimezone(tz) {
  if (!tz) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch (e) {
    return false
  }
}

export function getUserToday(userTz = 'UTC') {
  const tz = userTz || getBrowserTimezone()
  return dayjs().tz(tz).format('YYYY-MM-DD')
}

export function getUserDayRange(dateStr, userTz = 'UTC') {
  const tz = userTz || getBrowserTimezone()
  const target = dateStr || getUserToday(tz)
  const start = dayjs.tz(target, tz).startOf('day')
  const end = dayjs.tz(target, tz).endOf('day')

  return {
    startDateStr: target,
    endDateStr: target,
    startUtc: start.utc().toDate(),
    endUtc: end.utc().toDate(),
  }
}

export function getUserWeekRange(dateStr, userTz = 'UTC') {
  const tz = userTz || getBrowserTimezone()
  const target = dateStr || getUserToday(tz)
  const current = dayjs.tz(target, tz)

  const dayOfWeek = current.day()
  const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const monday = current.subtract(daysFromMon, 'day').startOf('day')
  const sunday = monday.add(6, 'day').endOf('day')

  return {
    startDateStr: monday.format('YYYY-MM-DD'),
    endDateStr: sunday.format('YYYY-MM-DD'),
    startUtc: monday.utc().toDate(),
    endUtc: sunday.utc().toDate(),
  }
}

export function getUserMonthRange(dateStr, userTz = 'UTC') {
  const tz = userTz || getBrowserTimezone()
  const target = dateStr || getUserToday(tz)
  const current = dayjs.tz(target, tz)

  const firstDay = current.startOf('month').startOf('day')
  const lastDay = current.endOf('month').endOf('day')

  return {
    startDateStr: firstDay.format('YYYY-MM-DD'),
    endDateStr: lastDay.format('YYYY-MM-DD'),
    startUtc: firstDay.utc().toDate(),
    endUtc: lastDay.utc().toDate(),
  }
}

export function formatInTimezone(date, userTz = 'UTC', formatStr = 'YYYY-MM-DD HH:mm') {
  if (!date) return ''
  const tz = userTz || getBrowserTimezone()
  return dayjs(date).tz(tz).format(formatStr)
}

export function formatDateIntl(date, options = {}, userTz = 'UTC', locale = 'en') {
  if (!date) return ''
  const tz = userTz || getBrowserTimezone()
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: tz, ...options }).format(d)
  } catch (e) {
    return dayjs(date).tz(tz).format('YYYY-MM-DD')
  }
}

export const IANA_TIMEZONES = [
  { group: 'Universal', value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { group: 'Universal', value: 'GMT', label: 'GMT (Greenwich Mean Time)' },
  { group: 'Europe', value: 'Europe/London', label: 'London, Dublin (GMT/BST, UTC+0/+1)' },
  { group: 'Europe', value: 'Europe/Berlin', label: 'Berlin, Frankfurt, Paris, Rome, Madrid (CET/CEST, UTC+1/+2)' },
  { group: 'Europe', value: 'Europe/Amsterdam', label: 'Amsterdam, Brussels (CET/CEST, UTC+1/+2)' },
  { group: 'Europe', value: 'Europe/Zurich', label: 'Zurich, Geneva (CET/CEST, UTC+1/+2)' },
  { group: 'Europe', value: 'Europe/Athens', label: 'Athens, Bucharest, Helsinki (EET/EEST, UTC+2/+3)' },
  { group: 'Europe', value: 'Europe/Istanbul', label: 'Istanbul (TRT, UTC+3)' },
  { group: 'Europe', value: 'Europe/Moscow', label: 'Moscow (MSK, UTC+3)' },
  { group: 'Middle East', value: 'Asia/Dubai', label: 'Dubai, Abu Dhabi, Muscat (GST, UTC+4)' },
  { group: 'Middle East', value: 'Asia/Riyadh', label: 'Riyadh, Kuwait, Doha, Bahrain (AST, UTC+3)' },
  { group: 'Middle East', value: 'Asia/Jerusalem', label: 'Jerusalem, Tel Aviv (IST, UTC+2/+3)' },
  { group: 'Africa', value: 'Africa/Cairo', label: 'Cairo (EET, UTC+2)' },
  { group: 'Africa', value: 'Africa/Johannesburg', label: 'Johannesburg, Cape Town (SAST, UTC+2)' },
  { group: 'Africa', value: 'Africa/Lagos', label: 'Lagos, Accra (WAT, UTC+1)' },
  { group: 'Africa', value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { group: 'Asia', value: 'Asia/Kolkata', label: 'Kolkata, Mumbai, New Delhi, Bengaluru (IST, UTC+5:30)' },
  { group: 'Asia', value: 'Asia/Colombo', label: 'Colombo (IST, UTC+5:30)' },
  { group: 'Asia', value: 'Asia/Dhaka', label: 'Dhaka (BST, UTC+6)' },
  { group: 'Asia', value: 'Asia/Karachi', label: 'Karachi, Islamabad (PKT, UTC+5)' },
  { group: 'Asia', value: 'Asia/Bangkok', label: 'Bangkok, Hanoi, Jakarta (ICT, UTC+7)' },
  { group: 'Asia', value: 'Asia/Singapore', label: 'Singapore, Kuala Lumpur (SGT, UTC+8)' },
  { group: 'Asia', value: 'Asia/Hong_Kong', label: 'Hong Kong, Beijing, Shanghai (HKT/CST, UTC+8)' },
  { group: 'Asia', value: 'Asia/Tokyo', label: 'Tokyo, Osaka (JST, UTC+9)' },
  { group: 'Asia', value: 'Asia/Seoul', label: 'Seoul (KST, UTC+9)' },
  { group: 'Pacific', value: 'Australia/Sydney', label: 'Sydney, Melbourne (AEST/AEDT, UTC+10/+11)' },
  { group: 'Pacific', value: 'Australia/Perth', label: 'Perth (AWST, UTC+8)' },
  { group: 'Pacific', value: 'Pacific/Auckland', label: 'Auckland, Wellington (NZST/NZDT, UTC+12/+13)' },
  { group: 'Americas', value: 'America/New_York', label: 'New York, Boston, Miami, Toronto (EST/EDT, UTC-5/-4)' },
  { group: 'Americas', value: 'America/Chicago', label: 'Chicago, Dallas, Houston, Mexico City (CST/CDT, UTC-6/-5)' },
  { group: 'Americas', value: 'America/Denver', label: 'Denver, Phoenix, Salt Lake City (MST/MDT, UTC-7/-6)' },
  { group: 'Americas', value: 'America/Los_Angeles', label: 'Los Angeles, San Francisco, Seattle (PST/PDT, UTC-8/-7)' },
  { group: 'Americas', value: 'America/Anchorage', label: 'Anchorage (AKST/AKDT, UTC-9/-8)' },
  { group: 'Americas', value: 'Pacific/Honolulu', label: 'Honolulu (HST, UTC-10)' },
  { group: 'Americas', value: 'America/Sao_Paulo', label: 'São Paulo, Rio de Janeiro (BRT, UTC-3)' },
  { group: 'Americas', value: 'America/Buenos_Aires', label: 'Buenos Aires (ART, UTC-3)' },
  { group: 'Americas', value: 'America/Bogota', label: 'Bogota, Lima (COT/PET, UTC-5)' },
]
