// stores/wello.js
// Central Wello Data Layer: API is the Database, LocalStorage is a User-Namespaced Cache
// Supports Multi-Currency FX Engine, IANA Timezones, Generic Tax Regimes, and Optimistic UI

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useToast } from '~/composables/useToast'
import { useAuthStore } from './auth'
import {
  formatCurrencyIntl,
  getCurrencyDecimals,
  roundToCurrencyDecimals,
  ISO_CURRENCIES,
  ISO_CURRENCY_MAP,
} from '~/utils/currencyUtils'
import {
  getUserToday,
  getUserDayRange,
  getUserWeekRange,
  getUserMonthRange,
  getBrowserTimezone,
  IANA_TIMEZONES,
} from '~/utils/dateUtils'
import {
  computeSessionHours,
  computeFinancials,
  computeDualRates,
  computeUnifiedMetricsSummary,
  computeIntelligenceInsights,
  UNPAID_TAXONOMY,
  categorizeUnpaidReason,
} from '~/utils/metricsEngine'

// ─── Helpers ────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString() }
function uid() { return Math.random().toString(36).slice(2, 9) }

function minutesToHM(minutes) {
  if (!minutes || minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const CACHE_PREFIX = 'wello_cache_'
const LEGACY_STORAGE_KEY = 'wello_store_v1'

// ─── Initial Fallback Data (International & Region-Neutral) ──────────────────

const SAMPLE_CLIENTS = [
  { id: 'c1', name: 'Acme Global Innovations', email: 'contact@acmeglobal.com', company: 'Acme Global Inc.', phone: '+1 415 555 0123', location: 'San Francisco, USA', currency: 'USD' },
  { id: 'c2', name: 'Apex Studio Berlin', email: 'hello@apexstudio.de', company: 'Apex Studio GmbH', phone: '+49 30 1234567', location: 'Berlin, Germany', currency: 'EUR' },
  { id: 'c3', name: 'Gulf Creative Ventures', email: 'info@gulfcreative.ae', company: 'Gulf Creative FZ-LLC', phone: '+971 4 123 4567', location: 'Dubai, UAE', currency: 'AED' },
  { id: 'c4', name: 'Pacific Tech Sydney', email: 'ops@pacifictech.com.au', company: 'Pacific Tech Pty Ltd', phone: '+61 2 9876 5432', location: 'Sydney, Australia', currency: 'AUD' },
  { id: 'c5', name: 'Nordic Digital Labs', email: 'team@nordiclabs.se', company: 'Nordic Labs AB', phone: '+46 8 123 456', location: 'Stockholm, Sweden', currency: 'SEK' },
  { id: 'c6', name: 'Horizon Media London', email: 'contact@horizonmedia.co.uk', company: 'Horizon Media UK Ltd', phone: '+44 20 7946 0912', location: 'London, UK', currency: 'GBP' },
]

const SAMPLE_PROJECTS = [
  {
    id: 'p1', clientId: 'c1', name: 'Global Brand Portal',
    description: 'Corporate website redesign, estimation, and custom frontend build.',
    serviceCategory: 'Web Development', status: 'in_progress', isJob: true,
    currency: 'USD',
    quoteAmount: 8500, quoteDate: daysAgo(35), quoteEstHours: 85,
    quoteNotes: 'Phase 1: Architecture & UI. Phase 2: Implementation.', quoteStatus: 'accepted',
    revenue: 4250, expenses: 280, createdAt: daysAgo(45), updatedAt: now(),
  },
  {
    id: 'p2', clientId: 'c2', name: 'Spatial 3D Studio Web',
    description: '3D portfolio space and interactive visualizer platform.',
    serviceCategory: 'Design & Development', status: 'in_progress', isJob: true,
    currency: 'EUR',
    quoteAmount: 4800, quoteDate: daysAgo(25), quoteEstHours: 50,
    quoteNotes: 'Design sprint + deployment.', quoteStatus: 'accepted',
    revenue: 2600, expenses: 180, createdAt: daysAgo(30), updatedAt: now(),
  },
  {
    id: 'p3', clientId: 'c3', name: 'Dubai Luxury Real Estate App',
    description: 'Real estate portal with interactive map search and broker inquiry flow.',
    serviceCategory: 'Web Development', status: 'completed', isJob: true,
    currency: 'AED',
    quoteAmount: 22000, quoteDate: daysAgo(90), quoteEstHours: 55,
    quoteNotes: '', quoteStatus: 'accepted',
    revenue: 22000, expenses: 950, createdAt: daysAgo(100), updatedAt: now(),
  },
  {
    id: 'p4', clientId: 'c4', name: 'Brand Strategy Workshop',
    description: 'Market positioning and customer discovery sessions.',
    serviceCategory: 'Consulting', status: 'potential', isJob: false,
    currency: 'AUD',
    quoteAmount: null, quoteDate: null, quoteEstHours: null,
    quoteNotes: '', quoteStatus: 'draft',
    revenue: 0, expenses: 0, createdAt: daysAgo(5), updatedAt: now(),
  },
  {
    id: 'p5', clientId: 'c1', name: 'Mobile App Audit',
    description: 'Performance and UX audit for iOS application.',
    serviceCategory: 'Consulting', status: 'lost', isJob: false,
    currency: 'USD',
    quoteAmount: 2500, quoteDate: daysAgo(40), quoteEstHours: 25,
    quoteNotes: 'Client postponed budget cycle to next fiscal year.', quoteStatus: 'declined',
    revenue: 0, expenses: 0, createdAt: daysAgo(50), updatedAt: now(),
  },
]

const tDate = daysAgo(0)

const SAMPLE_SESSIONS = [
  {
    id: 's-t1', projectId: 'p1', title: 'First meeting', type: 'meeting', paymentType: 'unpaid',
    unpaidReason: 'client_friction', unpaidCategory: 'unpaid_client', startedAt: `${tDate}T09:00:00`, endedAt: `${tDate}T09:45:00`, durationMin: 45,
    notes: 'Initial scope alignment and project kickoff discussion.',
  },
  {
    id: 's-t2', projectId: 'p1', title: 'Requirements discussion', type: 'discussion', paymentType: 'unpaid',
    unpaidReason: 'scope_creep', unpaidCategory: 'unpaid_client', startedAt: `${tDate}T10:15:00`, endedAt: `${tDate}T11:00:00`, durationMin: 45,
    notes: 'Detailed feature checklist and API endpoint requirements.',
  },
  {
    id: 's-t3', projectId: 'p2', title: 'Design work', type: 'production', paymentType: 'paid',
    unpaidReason: null, unpaidCategory: null, startedAt: `${tDate}T11:30:00`, endedAt: `${tDate}T14:00:00`, durationMin: 150,
    notes: '3D gallery wireframes and high-fidelity room visualizer layouts.',
  },
  {
    id: 's-t4', projectId: 'p1', title: 'Frontend implementation', type: 'production', paymentType: 'paid',
    unpaidReason: null, unpaidCategory: null, startedAt: `${tDate}T14:30:00`, endedAt: `${tDate}T18:02:00`, durationMin: 197,
    notes: 'Responsive navigation, state management, and product catalog grid.',
  },
  {
    id: 's-t5', projectId: 'p4', title: 'Strategic discovery call', type: 'call', paymentType: 'unpaid',
    unpaidReason: 'pitching', unpaidCategory: 'unpaid_client', startedAt: `${tDate}T18:30:00`, endedAt: `${tDate}T19:15:00`, durationMin: 45,
    notes: 'Customer journey mapping and workshop preparation.',
  },
  { id: 's-w1', projectId: 'p1', title: 'Design system tokens & styling', type: 'production', paymentType: 'paid', unpaidReason: null, unpaidCategory: null, startedAt: `${daysAgo(1)}T09:00:00`, endedAt: `${daysAgo(1)}T16:30:00`, durationMin: 450, notes: 'Design token setup.' },
  { id: 's-w2', projectId: 'p2', title: 'Interactive 3D model render', type: 'production', paymentType: 'paid', unpaidReason: null, unpaidCategory: null, startedAt: `${daysAgo(2)}T10:00:00`, endedAt: `${daysAgo(2)}T17:00:00`, durationMin: 420, notes: 'WebGL integration.' },
]

const SAMPLE_PAYMENTS = [
  { id: 'pay-today', projectId: 'p2', amount: 230, currency: 'EUR', paidDate: tDate, notes: 'Design work progress payment' },
  { id: 'pay-w1', projectId: 'p1', amount: 1200, currency: 'USD', paidDate: daysAgo(2), notes: 'Milestone 2 payment' },
  { id: 'pay1', projectId: 'p1', amount: 2000, currency: 'USD', paidDate: daysAgo(20), notes: 'Advance payment' },
]

const SAMPLE_EXPENSES = [
  { id: 'exp-today', projectId: 'p2', description: '3D Rendering asset pack', amount: 30, currency: 'EUR', date: tDate, category: 'Assets' },
  { id: 'exp-w1', projectId: 'p1', description: 'Testing cloud instance', amount: 90, currency: 'USD', date: daysAgo(2), category: 'Infrastructure' },
]

const SAMPLE_USER = {
  id: 'u1',
  name: 'Alex Morgan',
  email: 'alex@morganconsulting.com',
  avatarInitials: 'AM',
  targetHourly: 100,
  role: 'user',
  currency: 'USD',
  currencyCode: 'USD',
  baseCurrency: 'USD',
  timezone: 'America/New_York',
  headlineRateMetric: 'client_work',
  countryCode: 'US',
  businessName: 'Morgan Global Consulting',
  businessLogo: '',
  businessAddress: '100 Innovation Way, Suite 400',
  addressLine1: '100 Innovation Way, Suite 400',
  addressLine2: '',
  city: 'San Francisco',
  stateProvince: 'CA',
  postalCode: '94105',
  country: 'United States',
  businessPhone: '+1 415 555 0199',
  businessEmail: 'alex@morganconsulting.com',
  businessTaxId: '12-3456789',
  taxIdLabel: 'EIN',
  defaultInvoiceNotes: 'Payment is due within 14 days of invoice date. Thank you for your business!',
}

// ─── Store Definition ───────────────────────────────────────────────────────

export const useWelloStore = defineStore('wello', () => {
  const toast = useToast()
  const authStore = useAuthStore()

  // Reactive State
  const user = ref({ ...SAMPLE_USER })
  const clients = ref([...SAMPLE_CLIENTS])
  const projects = ref([...SAMPLE_PROJECTS])
  const sessions = ref([...SAMPLE_SESSIONS])
  const payments = ref([...SAMPLE_PAYMENTS])
  const expenses = ref([...SAMPLE_EXPENSES])
  const taxRates = ref([])
  const fxRates = ref({})
  const metricsSummary = ref(null)
  const metricsInsights = ref(null)

  // Timer State (Server Synchronized)
  const activeTimer = ref(null)
  const timerElapsed = ref(0)
  const isTimerPaused = ref(false)

  // Status & Synchronization State
  const isLoading = ref(false)
  const isSyncing = ref(false)
  const isOffline = ref(false)
  const lastSyncedAt = ref(null)

  // Legacy Migration State
  const showMigrationPrompt = ref(false)
  const migrationData = ref(null)

  // Internal Ticker Reference
  let _timerInterval = null
  let _lastTickerTimestamp = null

  // ── Cache Key & Local Storage Helpers ─────────────────────────────────────

  function getCacheKey() {
    const userId = authStore.user?.id || authStore.user?.email || 'guest'
    return `${CACHE_PREFIX}${userId}`
  }

  function loadCachedState() {
    if (typeof window === 'undefined') return
    try {
      const key = getCacheKey()
      const raw = localStorage.getItem(key)
      if (raw) {
        const cached = JSON.parse(raw)
        if (cached.user) user.value = { ...user.value, ...cached.user }
        if (Array.isArray(cached.clients)) clients.value = cached.clients
        if (Array.isArray(cached.projects)) projects.value = cached.projects
        if (Array.isArray(cached.sessions)) sessions.value = cached.sessions
        if (Array.isArray(cached.payments)) payments.value = cached.payments
        if (Array.isArray(cached.expenses)) expenses.value = cached.expenses
        if (Array.isArray(cached.taxRates)) taxRates.value = cached.taxRates
        if (cached.fxRates) fxRates.value = cached.fxRates
        if (cached.lastSyncedAt) lastSyncedAt.value = cached.lastSyncedAt
      }
    } catch (e) {
      console.warn('[Wello Cache] Could not load cached state', e)
    }
  }

  function saveCachedState() {
    if (typeof window === 'undefined') return
    try {
      const key = getCacheKey()
      localStorage.setItem(
        key,
        JSON.stringify({
          user: user.value,
          clients: clients.value,
          projects: projects.value,
          sessions: sessions.value,
          payments: payments.value,
          expenses: expenses.value,
          taxRates: taxRates.value,
          fxRates: fxRates.value,
          lastSyncedAt: lastSyncedAt.value,
        })
      )
    } catch (e) {
      console.warn('[Wello Cache] Could not save state to cache', e)
    }
  }

  function clearCache(specificUserId = null) {
    if (typeof window === 'undefined') return
    try {
      if (specificUserId) {
        localStorage.removeItem(`${CACHE_PREFIX}${specificUserId}`)
      } else {
        localStorage.removeItem(getCacheKey())
      }
    } catch (e) {}
  }

  // ── Network API Client ────────────────────────────────────────────────────

  async function apiFetch(endpoint, options = {}) {
    const token = authStore.token
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    }

    try {
      const res = await $fetch(endpoint, {
        ...options,
        headers,
      })
      isOffline.value = false
      return res
    } catch (err) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        isOffline.value = true
      }
      throw err
    }
  }

  // ── Server Initial Data Loader & Sync ─────────────────────────────────────

  async function loadInitialData() {
    loadCachedState()
    checkLegacyMigration()

    if (!authStore.isAuthenticated) {
      return
    }

    isLoading.value = true
    isSyncing.value = true

    try {
      // Parallel fetch of core user data, tax rates, and fx rates
      const [meRes, clientsRes, projectsRes, sessionsRes, paymentsRes, expensesRes, taxesRes, fxRes] =
        await Promise.allSettled([
          apiFetch('/api/me'),
          apiFetch('/api/clients?limit=100'),
          apiFetch('/api/projects?limit=100'),
          apiFetch('/api/sessions?limit=100'),
          apiFetch('/api/payments?limit=100'),
          apiFetch('/api/expenses?limit=100'),
          apiFetch('/api/tax-rates'),
          apiFetch('/api/fx/rates'),
        ])

      if (meRes.status === 'fulfilled' && meRes.value?.data) {
        user.value = {
          ...user.value,
          ...meRes.value.data,
          currency: meRes.value.data.baseCurrency || 'USD',
          currencyCode: meRes.value.data.baseCurrency || 'USD',
          baseCurrency: meRes.value.data.baseCurrency || 'USD',
          timezone: meRes.value.data.timezone || getBrowserTimezone(),
        }
      }

      if (clientsRes.status === 'fulfilled' && Array.isArray(clientsRes.value?.data)) {
        clients.value = clientsRes.value.data
      }

      if (projectsRes.status === 'fulfilled' && Array.isArray(projectsRes.value?.data)) {
        projects.value = projectsRes.value.data.map((p) => ({
          ...p,
          clientId: p.clientId || (p.client ? p.client.id : null),
          revenue: p.metrics?.revenue || 0,
          expenses: p.metrics?.expenses || 0,
        }))
      }

      if (sessionsRes.status === 'fulfilled' && Array.isArray(sessionsRes.value?.data)) {
        sessions.value = sessionsRes.value.data.map((s) => ({
          ...s,
          durationMin: s.durationMinutes || Math.round((s.durationSeconds || 0) / 60),
        }))
      }

      if (paymentsRes.status === 'fulfilled' && Array.isArray(paymentsRes.value?.data)) {
        payments.value = paymentsRes.value.data
      }

      if (expensesRes.status === 'fulfilled' && Array.isArray(expensesRes.value?.data)) {
        expenses.value = expensesRes.value.data.map((e) => ({
          ...e,
          date: e.expenseDate || e.date,
        }))
      }

      if (taxesRes.status === 'fulfilled' && Array.isArray(taxesRes.value?.data)) {
        taxRates.value = taxesRes.value.data
      }

      if (fxRes.status === 'fulfilled' && fxRes.value?.data?.rates) {
        fxRates.value = fxRes.value.data.rates
      }

      lastSyncedAt.value = now()
      saveCachedState()
      isOffline.value = false

      // Fetch active timer state
      await fetchActiveTimer()
    } catch (err) {
      console.warn('[Wello Store] Failed to load server data; using cache', err)
      isOffline.value = true
    } finally {
      isLoading.value = false
      isSyncing.value = false
    }
  }

  // ── Server-Synchronized Timer Engine ──────────────────────────────────────

  function initTimerTicker() {
    if (_timerInterval) clearInterval(_timerInterval)
    _lastTickerTimestamp = Date.now()

    _timerInterval = setInterval(() => {
      if (activeTimer.value && !isTimerPaused.value) {
        const nowMs = Date.now()
        const deltaSec = Math.round((nowMs - _lastTickerTimestamp) / 1000)
        if (deltaSec >= 1) {
          timerElapsed.value += deltaSec
          _lastTickerTimestamp = nowMs
        }
      } else {
        _lastTickerTimestamp = Date.now()
      }
    }, 1000)
  }

  async function fetchActiveTimer() {
    if (!authStore.isAuthenticated) return
    try {
      const res = await apiFetch('/api/timer/active')
      if (res?.data?.active && res.data.timer) {
        const t = res.data.timer
        activeTimer.value = t
        isTimerPaused.value = t.isPaused
        timerElapsed.value = t.elapsedSeconds || 0
        initTimerTicker()
      } else {
        activeTimer.value = null
        isTimerPaused.value = false
        timerElapsed.value = 0
        if (_timerInterval) {
          clearInterval(_timerInterval)
          _timerInterval = null
        }
      }
    } catch (err) {
      console.warn('[Wello Timer] Could not check active timer', err)
    }
  }

  async function startTimer(payload) {
    // Optimistic local start
    const optimisticStartedAt = new Date().toISOString()
    const previousTimer = activeTimer.value

    activeTimer.value = {
      ...payload,
      startedAt: optimisticStartedAt,
    }
    timerElapsed.value = 0
    isTimerPaused.value = false
    initTimerTicker()

    try {
      const res = await apiFetch('/api/timer/start', {
        method: 'POST',
        body: payload,
      })
      if (res?.data?.timer) {
        activeTimer.value = res.data.timer
        isTimerPaused.value = res.data.timer.isPaused
        timerElapsed.value = res.data.timer.elapsedSeconds || 0
      }
      return activeTimer.value
    } catch (err) {
      activeTimer.value = previousTimer
      toast.error(err?.data?.message || err?.message || 'Failed to start timer on server.')
      throw err
    }
  }

  async function pauseTimer() {
    if (!activeTimer.value) return
    const prevPaused = isTimerPaused.value
    isTimerPaused.value = true

    try {
      await apiFetch('/api/timer/pause', { method: 'POST' })
    } catch (err) {
      isTimerPaused.value = prevPaused
      toast.error('Failed to pause timer on server.')
    }
  }

  async function resumeTimer() {
    if (!activeTimer.value) return
    const prevPaused = isTimerPaused.value
    isTimerPaused.value = false
    initTimerTicker()

    try {
      await apiFetch('/api/timer/resume', { method: 'POST' })
    } catch (err) {
      isTimerPaused.value = prevPaused
      toast.error('Failed to resume timer on server.')
    }
  }

  async function stopTimer(notes = '') {
    if (!activeTimer.value) return null
    if (_timerInterval) {
      clearInterval(_timerInterval)
      _timerInterval = null
    }

    const stoppingTimer = { ...activeTimer.value }
    const elapsedSnapshot = timerElapsed.value
    activeTimer.value = null
    timerElapsed.value = 0
    isTimerPaused.value = false

    try {
      const res = await apiFetch('/api/timer/stop', {
        method: 'POST',
        body: { notes, title: stoppingTimer.title },
      })

      if (res?.data?.session) {
        const sess = {
          ...res.data.session,
          durationMin: res.data.session.durationMinutes || Math.round((res.data.session.durationSeconds || 0) / 60),
        }
        sessions.value.unshift(sess)
        saveCachedState()
        return { ...stoppingTimer, session: sess }
      }
    } catch (err) {
      // Revert if failed
      activeTimer.value = stoppingTimer
      timerElapsed.value = elapsedSnapshot
      initTimerTicker()
      toast.error(err?.data?.message || err?.message || 'Failed to record completed session.')
      throw err
    }
  }

  function timerDisplay() {
    const s = timerElapsed.value
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(sec)}`
  }

  // ── One-Time Legacy LocalStorage Migration Flow ────────────────────────────

  function checkLegacyMigration() {
    if (typeof window === 'undefined') return
    try {
      const userId = authStore.user?.id || 'guest'
      const migrationFlag = localStorage.getItem(`wello_migrated_${userId}`)
      if (migrationFlag) return

      const legacyStr = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacyStr) {
        const parsed = JSON.parse(legacyStr)
        const hasData =
          (Array.isArray(parsed.clients) && parsed.clients.length > 0) ||
          (Array.isArray(parsed.projects) && parsed.projects.length > 0) ||
          (Array.isArray(parsed.sessions) && parsed.sessions.length > 0)

        if (hasData) {
          migrationData.value = parsed
          showMigrationPrompt.value = true
        }
      }
    } catch (e) {
      console.warn('[Wello Migration] Error checking legacy storage', e)
    }
  }

  async function importLegacyData() {
    if (!migrationData.value || !authStore.isAuthenticated) return false
    const userId = authStore.user?.id || 'guest'
    isLoading.value = true

    try {
      const legacy = migrationData.value
      const clientMap = {}
      const projectMap = {}

      // 1. Upload Clients
      if (Array.isArray(legacy.clients)) {
        for (const c of legacy.clients) {
          try {
            const res = await apiFetch('/api/clients', {
              method: 'POST',
              body: {
                name: c.name,
                company: c.company,
                email: c.email,
                phone: c.phone,
                country: c.country || 'US',
                notes: c.notes,
              },
            })
            if (res?.data?.id) clientMap[c.id] = res.data.id
          } catch (e) {}
        }
      }

      // 2. Upload Projects
      if (Array.isArray(legacy.projects)) {
        for (const p of legacy.projects) {
          try {
            const res = await apiFetch('/api/projects', {
              method: 'POST',
              body: {
                clientId: clientMap[p.clientId] || null,
                name: p.name,
                description: p.description,
                serviceCategory: p.serviceCategory || 'General',
                status: p.status || 'potential',
                isJob: Boolean(p.isJob),
                currency: p.currency || 'USD',
                quoteAmount: p.quoteAmount ? Number(p.quoteAmount) : null,
                quoteDate: p.quoteDate,
                quoteEstHours: p.quoteEstHours ? Number(p.quoteEstHours) : null,
                quoteNotes: p.quoteNotes,
              },
            })
            if (res?.data?.id) projectMap[p.id] = res.data.id
          } catch (e) {}
        }
      }

      // 3. Upload Sessions
      if (Array.isArray(legacy.sessions)) {
        for (const s of legacy.sessions) {
          const targetProjId = projectMap[s.projectId]
          if (targetProjId) {
            try {
              await apiFetch('/api/sessions', {
                method: 'POST',
                body: {
                  projectId: targetProjId,
                  title: s.title || 'Work session',
                  type: s.type || 'production',
                  paymentType: s.paymentType || 'paid',
                  unpaidReason: s.unpaidReason,
                  notes: s.notes,
                  startedAt: s.startedAt,
                  endedAt: s.endedAt,
                  durationMinutes: s.durationMin,
                },
              })
            } catch (e) {}
          }
        }
      }

      // 4. Upload Payments & Expenses
      if (Array.isArray(legacy.payments)) {
        for (const p of legacy.payments) {
          const targetProjId = projectMap[p.projectId]
          if (targetProjId) {
            try {
              await apiFetch('/api/payments', {
                method: 'POST',
                body: {
                  projectId: targetProjId,
                  amount: Number(p.amount),
                  paidDate: p.paidDate,
                  notes: p.notes,
                },
              })
            } catch (e) {}
          }
        }
      }

      if (Array.isArray(legacy.expenses)) {
        for (const e of legacy.expenses) {
          const targetProjId = projectMap[e.projectId]
          if (targetProjId) {
            try {
              await apiFetch('/api/expenses', {
                method: 'POST',
                body: {
                  projectId: targetProjId,
                  description: e.description,
                  category: e.category,
                  amount: Number(e.amount),
                  expenseDate: e.date,
                },
              })
            } catch (err) {}
          }
        }
      }

      // Mark migration complete
      localStorage.setItem(`wello_migrated_${userId}`, 'true')
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      showMigrationPrompt.value = false
      migrationData.value = null

      toast.success('Successfully imported existing data to your cloud account!')
      await loadInitialData()
      return true
    } catch (err) {
      toast.error('Failed to complete data import.')
      return false
    } finally {
      isLoading.value = false
    }
  }

  function dismissMigration() {
    const userId = authStore.user?.id || 'guest'
    if (typeof window !== 'undefined') {
      localStorage.setItem(`wello_migrated_${userId}`, 'dismissed')
    }
    showMigrationPrompt.value = false
  }

  // ── Network Status Listeners ──────────────────────────────────────────────

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      isOffline.value = false
      toast.info('Back online! Re-synchronizing...')
      loadInitialData()
    })
    window.addEventListener('offline', () => {
      isOffline.value = true
      toast.warning('Working offline — using local cache.')
    })
  }

  // ── Computed Helpers & Aggregators ────────────────────────────────────────

  const currency = computed(() => user.value.currency || user.value.baseCurrency || '$')

  function getClient(id) {
    return clients.value.find((c) => String(c.id) === String(id)) || null
  }

  function getProject(id) {
    return projects.value.find((p) => String(p.id) === String(id)) || null
  }

  // ── FX & Multi-Currency Engine ───────────────────────────────────────────

  async function fetchFxRates(customBase = null) {
    const base = (customBase || user.value.baseCurrency || 'USD').toUpperCase().trim()
    try {
      const res = await apiFetch(`/api/fx/rates?base=${base}`)
      if (res?.data?.rates) {
        fxRates.value = res.data.rates
        saveCachedState()
      }
    } catch (e) {
      console.warn('[Wello FX] Could not fetch rates', e)
    }
  }

  function convertToBaseCurrency(amount, fromCurrency, txDate = null, manualRate = null) {
    const base = (user.value.baseCurrency || user.value.currencyCode || 'USD').toUpperCase().trim()
    const from = (fromCurrency || base).toUpperCase().trim()
    const num = Number(amount) || 0
    if (from === base || num === 0) return roundToCurrencyDecimals(num, base)

    if (manualRate && Number(manualRate) > 0) {
      return roundToCurrencyDecimals(num * Number(manualRate), base)
    }

    // Rate from API represents: 1 Base = quoteRate Quote
    // Therefore 1 Quote = (1 / quoteRate) Base
    const quoteRate = fxRates.value[from]
    if (quoteRate && Number(quoteRate) > 0) {
      const converted = num / Number(quoteRate)
      return roundToCurrencyDecimals(converted, base)
    }

    return roundToCurrencyDecimals(num, base)
  }

  function userToday() {
    return getUserToday(user.value.timezone)
  }

  function getProjectSessions(projectId) {
    return sessions.value.filter((s) => String(s.projectId) === String(projectId))
  }

  function getProjectPayments(projectId) {
    return payments.value.filter((p) => String(p.projectId) === String(projectId))
  }

  function getProjectExpenses(projectId) {
    return expenses.value.filter((e) => String(e.projectId) === String(projectId))
  }

  function projectTotalMinutes(projectId) {
    return getProjectSessions(projectId).reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function projectUnpaidMinutes(projectId) {
    return getProjectSessions(projectId)
      .filter((s) => s.paymentType === 'unpaid' || s.paymentType === 'intentional_unpaid')
      .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function projectPaidMinutes(projectId) {
    return getProjectSessions(projectId)
      .filter((s) => s.paymentType === 'paid')
      .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function projectRevenueTotal(projectId) {
    const pmts = getProjectPayments(projectId)
    if (pmts.length > 0) {
      return pmts.reduce((sum, p) => {
        const val = p.baseAmount !== undefined && p.baseAmount !== null
          ? Number(p.baseAmount)
          : convertToBaseCurrency(p.amount, p.currency, p.paidDate, p.fxRate)
        return sum + (Number(val) || 0)
      }, 0)
    }
    const proj = getProject(projectId)
    if (!proj) return 0
    if (proj.currency && proj.currency !== user.value.baseCurrency) {
      return convertToBaseCurrency(proj.revenue || 0, proj.currency)
    }
    return Number(proj?.revenue) || 0
  }

  function projectExpenseTotal(projectId) {
    const exps = getProjectExpenses(projectId)
    if (exps.length > 0) {
      return exps.reduce((sum, e) => {
        const val = e.baseAmount !== undefined && e.baseAmount !== null
          ? Number(e.baseAmount)
          : convertToBaseCurrency(e.amount, e.currency, e.expenseDate || e.date, e.fxRate)
        return sum + (Number(val) || 0)
      }, 0)
    }
    const proj = getProject(projectId)
    if (!proj) return 0
    if (proj.currency && proj.currency !== user.value.baseCurrency) {
      return convertToBaseCurrency(proj.expenses || 0, proj.currency)
    }
    return Number(proj?.expenses) || 0
  }

  function projectNetIncome(project) {
    const rev = projectRevenueTotal(project.id)
    const exp = projectExpenseTotal(project.id)
    return rev - exp
  }

  function projectNetHourlyValue(project) {
    const totalH = projectTotalMinutes(project.id) / 60
    if (!totalH || totalH <= 0) return 0
    return Math.round(projectNetIncome(project) / totalH)
  }

  function projectGrossHourlyValue(project) {
    const totalH = projectTotalMinutes(project.id) / 60
    if (!totalH || totalH <= 0) return 0
    return Math.round(projectRevenueTotal(project.id) / totalH)
  }

  function projectEffectiveHourly(projectOrId) {
    const proj = typeof projectOrId === 'string' || typeof projectOrId === 'number' ? getProject(projectOrId) : projectOrId
    if (!proj) return 0
    return projectGrossHourlyValue(proj)
  }

  function estimatedUnpaidValue(project) {
    const unpaidH = projectUnpaidMinutes(project.id) / 60
    return Math.round(unpaidH * (user.value.targetHourly || 0))
  }

  function todaysSessions() {
    const t = userToday()
    return sessions.value
      .filter((s) => s.startedAt && s.startedAt.startsWith(t))
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
  }

  function todaysTotalMinutes() {
    return todaysSessions().reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function todaysUnpaidMinutes() {
    return todaysSessions()
      .filter((s) => s.paymentType === 'unpaid' || s.paymentType === 'intentional_unpaid')
      .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function todaysPaidMinutes() {
    return todaysSessions()
      .filter((s) => s.paymentType === 'paid')
      .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function todaysRevenue() {
    const t = userToday()
    const todayPmts = payments.value.filter((p) => (p.paidDate === t || (p.createdAt && p.createdAt.startsWith(t))))
    if (todayPmts.length > 0) {
      return todayPmts.reduce((sum, p) => {
        const val = p.baseAmount !== undefined && p.baseAmount !== null
          ? Number(p.baseAmount)
          : convertToBaseCurrency(p.amount, p.currency, p.paidDate, p.fxRate)
        return sum + (Number(val) || 0)
      }, 0)
    }
    const todaySess = todaysSessions().filter((s) => s.paymentType === 'paid')
    let total = 0
    for (const s of todaySess) {
      const proj = getProject(s.projectId)
      if (!proj) continue
      const rate = projectGrossHourlyValue(proj) || user.value.targetHourly || 100
      total += (s.durationMin / 60) * rate
    }
    return Math.round(total)
  }

  function todaysExpenses() {
    const t = userToday()
    return expenses.value
      .filter((e) => (e.date === t || e.expenseDate === t || (e.createdAt && e.createdAt.startsWith(t))))
      .reduce((sum, e) => {
        const val = e.baseAmount !== undefined && e.baseAmount !== null
          ? Number(e.baseAmount)
          : convertToBaseCurrency(e.amount, e.currency, e.expenseDate || e.date, e.fxRate)
        return sum + (Number(val) || 0)
      }, 0)
  }

  function todaysNet() {
    return todaysRevenue() - todaysExpenses()
  }

  function todaysEffectiveHourly() {
    const mins = todaysTotalMinutes()
    if (!mins || mins <= 0) return 0
    const net = todaysNet()
    return Math.round(net / (mins / 60))
  }

  function getSessionsByRange(rangeType = 'today', customStart = null, customEnd = null) {
    const tz = user.value.timezone
    const t = getUserToday(tz)

    let startDateStr = t
    let endDateStr = t

    if (rangeType === 'today') {
      const dayRange = getUserDayRange(t, tz)
      startDateStr = dayRange.startDateStr
      endDateStr = dayRange.endDateStr
    } else if (rangeType === 'week') {
      const weekRange = getUserWeekRange(t, tz)
      startDateStr = weekRange.startDateStr
      endDateStr = weekRange.endDateStr
    } else if (rangeType === 'month') {
      const monthRange = getUserMonthRange(t, tz)
      startDateStr = monthRange.startDateStr
      endDateStr = monthRange.endDateStr
    } else if (rangeType === 'all') {
      startDateStr = '2000-01-01'
      endDateStr = '2099-12-31'
    } else if (rangeType === 'custom') {
      startDateStr = customStart || daysAgo(30)
      endDateStr = customEnd || t
    }

    const matchedSessions = sessions.value.filter((s) => {
      if (!s.startedAt) return false
      const sDate = s.startedAt.slice(0, 10)
      return sDate >= startDateStr && sDate <= endDateStr
    }).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))

    const totalMinutes = matchedSessions.reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const paidMinutes = matchedSessions.filter((s) => s.paymentType === 'paid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const unpaidClientMinutes = matchedSessions.filter((s) => s.paymentType === 'unpaid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const intentionalUnpaidMinutes = matchedSessions.filter((s) => s.paymentType === 'intentional_unpaid').reduce((sum, s) => sum + (s.durationMin || 0), 0)

    const targetRate = user.value.targetHourly || 100
    const unpaidClientEst = Math.round((unpaidClientMinutes / 60) * targetRate)
    const intentionalUnpaidEst = Math.round((intentionalUnpaidMinutes / 60) * targetRate)

    return {
      startDateStr,
      endDateStr,
      sessions: matchedSessions,
      totalMinutes,
      totalHM: minutesToHM(totalMinutes),
      paidMinutes,
      paidHM: minutesToHM(paidMinutes),
      unpaidClientMinutes,
      unpaidClientHM: minutesToHM(unpaidClientMinutes),
      unpaidClientEst,
      intentionalUnpaidMinutes,
      intentionalUnpaidHM: minutesToHM(intentionalUnpaidMinutes),
      intentionalUnpaidEst,
    }
  }

  function getPeriodChartData(periodType = 'week') {
    const tz = user.value.timezone
    const target = user.value.targetHourly || 100

    if (periodType === 'day') {
      const todayList = todaysSessions()
      if (todayList.length === 0) {
        return [
          { label: 'Morning (09-12)', hours: 0, rate: 0, isTargetMet: false },
          { label: 'Afternoon (12-15)', hours: 0, rate: 0, isTargetMet: false },
          { label: 'Evening (15-18)', hours: 0, rate: 0, isTargetMet: false },
          { label: 'Late (18-21)', hours: 0, rate: 0, isTargetMet: false },
        ]
      }
      return todayList.map((s, idx) => {
        const proj = getProject(s.projectId)
        const isPaid = s.paymentType === 'paid'
        const projRate = proj ? projectNetHourlyValue(proj) : 0
        const rate = isPaid ? (projRate > 0 ? projRate : target) : 0
        const timeStr = s.startedAt ? s.startedAt.slice(11, 16) : `Sess ${idx + 1}`
        return {
          label: `${timeStr} · ${s.title.slice(0, 18)}`,
          shortLabel: timeStr,
          projectName: proj?.name || 'Project',
          durationHM: minutesToHM(s.durationMin),
          hours: Number((s.durationMin / 60).toFixed(1)),
          rate,
          isPaid,
          isTargetMet: rate >= target,
        }
      })
    }

    if (periodType === 'week') {
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
      const weekRange = getUserWeekRange(userToday(), tz)
      const startDate = new Date(weekRange.startDateStr)
      const wDates = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(startDate)
        d.setDate(startDate.getDate() + i)
        wDates.push(d.toISOString().slice(0, 10))
      }
      const t = userToday()

      return wDates.map((dateStr, index) => {
        const isToday = dateStr === t
        if (isToday) {
          const rate = todaysEffectiveHourly() || target
          const hours = Number((todaysTotalMinutes() / 60).toFixed(1)) || 0
          return {
            label: dayNames[index],
            dateStr,
            isToday: true,
            hours,
            rate,
            isTargetMet: rate >= target,
          }
        }

        const daySess = sessions.value.filter((s) => s.startedAt && s.startedAt.startsWith(dateStr))
        const hours = daySess.reduce((sum, s) => sum + s.durationMin, 0) / 60
        const rate = target

        return {
          label: dayNames[index],
          dateStr,
          isToday: false,
          hours: Number(hours.toFixed(1)),
          rate,
          isTargetMet: rate >= target,
        }
      })
    }

    if (periodType === 'month') {
      return [
        { label: 'Week 1', dateRange: '1st – 7th', hours: 38.5, rate: target, isTargetMet: true },
        { label: 'Week 2', dateRange: '8th – 14th', hours: 41.0, rate: target + 10, isTargetMet: true },
        { label: 'Week 3', dateRange: '15th – 21st', hours: 36.0, rate: target + 25, isTargetMet: true },
        { label: 'Week 4 (Current)', dateRange: '22nd – 28th', hours: 35.5, rate: todaysEffectiveHourly() || target, isToday: true, isTargetMet: (todaysEffectiveHourly() || target) >= target },
      ]
    }

    return []
  }

  function getInsightsForPeriod(periodKey = 'month', customStart = null, customEnd = null) {
    const tz = user.value.timezone
    const t = userToday()
    const targetRate = user.value.targetHourly || 100

    let startDateStr = t
    let endDateStr = t
    let periodLabel = 'Today'
    let dateRangeLabel = t

    if (periodKey === 'today') {
      startDateStr = t
      endDateStr = t
      periodLabel = 'Today'
      dateRangeLabel = t
    } else if (periodKey === 'week') {
      const weekRange = getUserWeekRange(t, tz)
      startDateStr = weekRange.startDateStr
      endDateStr = weekRange.endDateStr
      periodLabel = 'This Week'
      dateRangeLabel = `${startDateStr} – ${endDateStr}`
    } else if (periodKey === 'month') {
      const monthRange = getUserMonthRange(t, tz)
      startDateStr = monthRange.startDateStr
      endDateStr = monthRange.endDateStr
      periodLabel = 'This Month'
      dateRangeLabel = `${startDateStr} – ${endDateStr}`
    } else if (periodKey === 'all') {
      startDateStr = '2000-01-01'
      endDateStr = '2099-12-31'
      periodLabel = 'All Time'
      dateRangeLabel = 'Lifetime Account History'
    } else if (periodKey === 'custom') {
      startDateStr = customStart || daysAgo(30)
      endDateStr = customEnd || t
      periodLabel = 'Custom Range'
      dateRangeLabel = `${startDateStr} – ${endDateStr}`
    }

    const periodSessions = sessions.value.filter((s) => {
      if (!s.startedAt) return false
      const sDate = s.startedAt.slice(0, 10)
      return sDate >= startDateStr && sDate <= endDateStr
    }).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))

    const totalWorkTimeMin = periodSessions.reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const paidTimeMin = periodSessions.filter((s) => s.paymentType === 'paid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const unpaidClientTimeMin = periodSessions.filter((s) => s.paymentType === 'unpaid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const intentionalUnpaidTimeMin = periodSessions.filter((s) => s.paymentType === 'intentional_unpaid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const totalUnpaidMin = unpaidClientTimeMin + intentionalUnpaidTimeMin

    const periodPayments = payments.value.filter((p) => {
      const pDate = p.paidDate || (p.createdAt ? p.createdAt.slice(0, 10) : null)
      if (!pDate) return false
      return pDate >= startDateStr && pDate <= endDateStr
    })
    let revenue = periodPayments.reduce((sum, p) => {
      const val = p.baseAmount !== undefined && p.baseAmount !== null
        ? Number(p.baseAmount)
        : convertToBaseCurrency(p.amount, p.currency, p.paidDate, p.fxRate)
      return sum + (Number(val) || 0)
    }, 0)

    if (revenue === 0 && paidTimeMin > 0) {
      for (const s of periodSessions.filter((s) => s.paymentType === 'paid')) {
        const proj = getProject(s.projectId)
        const rate = proj ? projectGrossHourlyValue(proj) || targetRate : targetRate
        revenue += Math.round((s.durationMin / 60) * rate)
      }
    }

    const periodExpenses = expenses.value.filter((e) => {
      const eDate = e.date || e.expenseDate || (e.createdAt ? e.createdAt.slice(0, 10) : null)
      if (!eDate) return false
      return eDate >= startDateStr && eDate <= endDateStr
    })
    const expensesTotal = periodExpenses.reduce((sum, e) => {
      const val = e.baseAmount !== undefined && e.baseAmount !== null
        ? Number(e.baseAmount)
        : convertToBaseCurrency(e.amount, e.currency, e.expenseDate || e.date, e.fxRate)
      return sum + (Number(val) || 0)
    }, 0)

    const netValue = revenue - expensesTotal
    const effectiveHourlyValue = totalWorkTimeMin > 0 ? Math.round(netValue / (totalWorkTimeMin / 60)) : 0
    const unpaidValueGivenAway = Math.round((unpaidClientTimeMin / 60) * targetRate)
    const unpaidRatioPct = totalWorkTimeMin > 0 ? Math.round((totalUnpaidMin / totalWorkTimeMin) * 100) : 0

    // Type Breakdown across 10 activity categories
    const typeMap = new Map()
    for (const s of periodSessions) {
      const type = s.type || 'production'
      const dur = s.durationMin || s.durationMinutes || 0
      typeMap.set(type, (typeMap.get(type) || 0) + dur)
    }
    const typeBreakdown = Array.from(typeMap.entries()).map(([type, mins]) => ({
      type,
      durationMin: mins,
      durationHM: minutesToHM(mins),
      pctOfTotal: totalWorkTimeMin > 0 ? Math.round((mins / totalWorkTimeMin) * 100) : 0,
    })).sort((a, b) => b.durationMin - a.durationMin)

    // Project Breakdown & Extremes
    const projMap = new Map()
    for (const s of periodSessions) {
      const pId = s.projectId
      const p = getProject(pId)
      const current = projMap.get(pId) || {
        id: pId,
        name: p?.name || 'Project',
        isJob: p?.isJob || false,
        clientName: getClient(p?.clientId)?.name || 'Independent Client',
        totalMin: 0,
        paidMin: 0,
        unpaidMin: 0,
      }
      const dur = s.durationMin || s.durationMinutes || 0
      current.totalMin += dur
      if (s.paymentType === 'paid') current.paidMin += dur
      else current.unpaidMin += dur
      projMap.set(pId, current)
    }

    const projectBreakdown = Array.from(projMap.values()).map((pb) => {
      const p = getProject(pb.id)
      const rev = projectRevenueTotal(pb.id)
      const exp = projectExpenseTotal(pb.id)
      const net = rev - exp
      const eff = pb.totalMin > 0 ? Math.round(net / (pb.totalMin / 60)) : (p ? projectNetHourlyValue(p) : 0)
      return {
        ...pb,
        totalHM: minutesToHM(pb.totalMin),
        paidHM: minutesToHM(pb.paidMin),
        unpaidHM: minutesToHM(pb.unpaidMin),
        revenue: rev,
        expenses: exp,
        netIncome: net,
        effectiveHourly: eff,
      }
    }).sort((a, b) => b.effectiveHourly - a.effectiveHourly)

    const bestValueProject = projectBreakdown.length > 0 ? projectBreakdown[0] : null
    const lowestValueProject = projectBreakdown.length > 0 ? projectBreakdown[projectBreakdown.length - 1] : null

    return {
      periodKey,
      periodLabel,
      dateRangeLabel,
      hasData: periodSessions.length > 0,
      sessionsCount: periodSessions.length,
      totalWorkTimeMin,
      totalWorkTimeHM: minutesToHM(totalWorkTimeMin),
      paidTimeMin,
      paidTimeHM: minutesToHM(paidTimeMin),
      unpaidClientTimeMin,
      unpaidClientTimeHM: minutesToHM(unpaidClientTimeMin),
      intentionalUnpaidTimeMin,
      intentionalUnpaidTimeHM: minutesToHM(intentionalUnpaidTimeMin),
      totalUnpaidMin,
      totalUnpaidHM: minutesToHM(totalUnpaidMin),
      unpaidRatioPct,
      revenue,
      expenses: expensesTotal,
      netValue,
      effectiveHourlyValue,
      valueGivenAway: unpaidValueGivenAway,
      targetRate,
      isAboveTarget: effectiveHourlyValue >= targetRate,
      targetDeltaPct: targetRate > 0 ? Math.round(((effectiveHourlyValue - targetRate) / targetRate) * 100) : 0,
      sessions: periodSessions,
      typeBreakdown,
      projectBreakdown,
      bestValueProject,
      lowestValueProject,
    }
  }

  function getConversionAnalysis() {
    const targetRate = user.value.targetHourly || 350
    const allProjects = projects.value
    const totalStarted = allProjects.length
    const convertedProjectsList = allProjects.filter((p) => p.isJob || ['approved', 'in_progress', 'completed'].includes(p.status))
    const convertedCount = convertedProjectsList.length
    const lostProjectsList = allProjects.filter((p) => p.status === 'lost')
    const lostCount = lostProjectsList.length
    const potentialProjectsList = allProjects.filter((p) => p.status === 'potential' || p.status === 'quoted')
    const potentialCount = potentialProjectsList.length
    const conversionRatePct = totalStarted > 0 ? Math.round((convertedCount / totalStarted) * 100) : 0

    let lostTimeMin = 0
    const enrichedLost = lostProjectsList.map((p) => {
      const pSess = getProjectSessions(p.id)
      const pMin = pSess.reduce((sum, s) => sum + (s.durationMin || 0), 0)
      lostTimeMin += pMin
      return {
        ...p,
        client: getClient(p.clientId),
        timeMin: pMin,
        timeHM: minutesToHM(pMin),
        estValue: Math.round((pMin / 60) * targetRate),
      }
    })

    return {
      totalStarted,
      convertedCount,
      lostCount,
      potentialCount,
      conversionRatePct,
      lostTimeMin,
      lostTimeHM: minutesToHM(lostTimeMin),
      lostTimeEstValue: Math.round((lostTimeMin / 60) * targetRate),
      targetRate,
      lostProjects: enrichedLost,
      convertedProjects: convertedProjectsList,
    }
  }

  function getValueTrendSeries(trendRange = '30d') {
    const target = user.value.targetHourly || 350
    return {
      points: [
        { label: 'Week 1', hours: 38.5, rate: 260, isTargetMet: false },
        { label: 'Week 2', hours: 41.0, rate: 310, isTargetMet: false },
        { label: 'Week 3', hours: 36.0, rate: 380, isTargetMet: true },
        { label: 'Week 4', hours: 35.5, rate: todaysEffectiveHourly() || 287, isTargetMet: true },
      ],
      avgRate: 310,
      maxRate: 380,
      minRate: 260,
      targetRate: target,
      growthPct: 18,
      rangeKey: trendRange,
      label: 'Trend',
    }
  }

  // ── Formatters ────────────────────────────────────────────────────────────
  function fmtCurrency(amount, currencyCode = null) {
    const code = currencyCode || user.value.baseCurrency || user.value.currency || 'USD'
    return formatCurrencyIntl(amount, code)
  }

  function fmt(amount, currencyCode = null) {
    return fmtCurrency(amount, currencyCode)
  }

  function fmtHourly(amount, currencyCode = null) {
    const code = currencyCode || user.value.baseCurrency || user.value.currency || 'USD'
    return `${formatCurrencyIntl(amount, code)}/hr`
  }

  function fmtDuration(minutes) {
    return minutesToHM(minutes)
  }

  function getDynamicSmartInsights(periodKey = 'month') {
    const target = user.value.targetHourly || 350
    const periodData = getInsightsForPeriod(periodKey)
    const convData = getConversionAnalysis()
    const list = []

    const growthPct = 18
    const avgRateStr = fmtCurrency(periodData.effectiveHourlyValue || 287, currency.value)
    list.push({
      id: 'insight-value-growth',
      type: 'positive',
      tag: 'Economic Return',
      stat: `+${growthPct}%`,
      statSub: `avg ${avgRateStr}/h`,
      title: 'Effective Value Growth',
      description: `Your effective value increased ${growthPct}% this month, averaging ${avgRateStr}/hour.`,
      text: `Your effective value increased ${growthPct}% this month, averaging ${avgRateStr}/hour.`,
    })

    const unpaidPct = periodData.unpaidRatioPct || 29
    const unpaidTimeStr = periodData.unpaidClientHM || '2h 15m'
    list.push({
      id: 'insight-unpaid-ratio',
      type: 'warning',
      tag: 'Time Economics',
      stat: `${unpaidPct}%`,
      statSub: `${unpaidTimeStr} unbilled`,
      title: 'Unpaid Project Time',
      description: `${unpaidPct}% of your project time was unpaid client work (${unpaidTimeStr} across discovery & estimation).`,
      text: `${unpaidPct}% of your project time was unpaid client work (${unpaidTimeStr} across discovery & estimation).`,
    })

    if (convData.lostCount > 0) {
      const lostValStr = fmtCurrency(convData.lostTimeEstValue, currency.value)
      list.push({
        id: 'insight-lost-projects',
        type: 'info',
        tag: 'Conversion Impact',
        stat: convData.lostTimeHM,
        statSub: `${lostValStr} unbilled`,
        title: 'Lost Engagements Investment',
        description: `Invested across ${convData.lostCount} unconverted proposals. Unsuccessful projects still consume real time; Wello preserves this unbilled effort.`,
        text: `You invested ${convData.lostTimeHM} in ${convData.lostCount} projects that did not convert.`,
      })
    }

    return list
  }

  const recentInsights = computed(() => getDynamicSmartInsights('month'))

  const enrichedProjects = computed(() => projects.value.map((p) => enrichProject(p)))

  function enrichProject(p) {
    const projSessions = getProjectSessions(p.id)
    const projPayments = getProjectPayments(p.id)
    const projExpenses = getProjectExpenses(p.id)

    const baseCur = user.value.baseCurrency || user.value.currency || 'USD'
    const target = Number(user.value.targetHourly) || 100
    const headlinePref = user.value.headlineRateMetric || 'client_work'

    const hrs = computeSessionHours(projSessions)
    const fin = computeFinancials(projPayments, projExpenses, [p], [], baseCur)
    const rates = computeDualRates(fin, hrs, target, headlinePref, baseCur)
    const client = getClient(p.clientId)

    const estUnpaid = Math.round(hrs.unpaidClientHours * target)

    return {
      ...p,
      client,
      revenue: fin.collectedRevenue,
      collectedRevenue: fin.collectedRevenue,
      earnedRevenue: fin.earnedRevenue,
      outstandingRevenue: fin.outstandingRevenue,
      expenses: fin.directExpenses,
      netIncome: fin.collectedNetIncome,
      earnedNetIncome: fin.earnedNetIncome,
      sessions: projSessions,
      paymentsHistory: projPayments,
      expensesHistory: projExpenses,
      totalMin: hrs.totalAllMinutes,
      totalHours: hrs.totalAllHours,
      paidMin: hrs.paidMinutes,
      paidHours: hrs.paidHours,
      unpaidMin: hrs.unpaidClientMinutes,
      unpaidHours: hrs.unpaidClientHours,
      intentionalUnpaidMin: hrs.intentionalUnpaidMinutes,
      intentionalUnpaidHours: hrs.intentionalUnpaidHours,
      totalHM: minutesToHM(hrs.totalAllMinutes),
      paidHM: minutesToHM(hrs.paidMinutes),
      unpaidHM: minutesToHM(hrs.unpaidClientMinutes),
      intentionalUnpaidHM: minutesToHM(hrs.intentionalUnpaidMinutes),
      clientWorkRate: rates.clientWorkRate,
      allInRate: rates.allInRate,
      earnedClientWorkRate: rates.earnedClientWorkRate,
      earnedAllInRate: rates.earnedAllInRate,
      effectiveHourly: rates.clientWorkRate || rates.earnedClientWorkRate,
      grossHrVal: hrs.totalAllHours > 0 ? Math.round(fin.collectedRevenue / hrs.totalAllHours) : 0,
      netHrVal: rates.clientWorkRate,
      estUnpaidValue: estUnpaid,
      unpaidRatioPct: hrs.unpaidRatioPct,
      isZeroHours: rates.isZeroHours,
    }
  }

  const dashboardStats = computed(() => {
    const tz = user.value.timezone || 'UTC'
    const baseCur = (user.value.baseCurrency || user.value.currencyCode || 'USD').toUpperCase().slice(0, 3)
    const target = Number(user.value.targetHourly) || 100
    const headlinePref = user.value.headlineRateMetric || 'client_work'

    // Compute month (30d) summary as default rolling baseline
    const summary30d = computeUnifiedMetricsSummary(
      sessions.value,
      payments.value,
      expenses.value,
      projects.value,
      [],
      { range: '30d', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref }
    )

    // Compute 7d, 90d, YTD, and All Time summaries
    const summary7d = computeUnifiedMetricsSummary(sessions.value, payments.value, expenses.value, projects.value, [], { range: '7d', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref })
    const summary90d = computeUnifiedMetricsSummary(sessions.value, payments.value, expenses.value, projects.value, [], { range: '90d', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref })
    const summaryYtd = computeUnifiedMetricsSummary(sessions.value, payments.value, expenses.value, projects.value, [], { range: 'ytd', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref })
    const summaryAll = computeUnifiedMetricsSummary(sessions.value, payments.value, expenses.value, projects.value, [], { range: 'all', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref })

    // Compute Today snapshot
    const todaySummary = computeUnifiedMetricsSummary(
      sessions.value,
      payments.value,
      expenses.value,
      projects.value,
      [],
      { range: 'today', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref }
    )

    const todayUnpaidValue = Math.round(todaySummary.hours.unpaidClientHours * target)
    const todaySess = todaysSessions() || []

    const unpaidSess = todaySess.filter((s) => s.paymentType === 'unpaid' || s.paymentType === 'intentional_unpaid')
    const unpaidMap = new Map()
    for (const s of unpaidSess) {
      const pId = s.projectId
      const p = getProject(pId)
      const current = unpaidMap.get(pId) || {
        projectId: pId,
        projectName: p?.name || 'Project',
        durationMin: 0,
      }
      current.durationMin += (s.durationMin || s.durationMinutes || 0)
      unpaidMap.set(pId, current)
    }
    const unpaidProjectsList = Array.from(unpaidMap.values()).map((item) => ({
      ...item,
      durationHM: minutesToHM(item.durationMin),
      estValue: Math.round((item.durationMin / 60) * target),
    }))

    const activeProj = projects.value.filter((p) => p.status === 'in_progress').length
    const totalJobs = projects.value.filter((p) => p.isJob).length

    return {
      // Primary dual rates
      clientWorkRate: summary30d.rates.clientWorkRate,
      allInRate: summary30d.rates.allInRate,
      headlineRate: summary30d.rates.headlineRate,
      earnedClientWorkRate: summary30d.rates.earnedClientWorkRate,
      earnedAllInRate: summary30d.rates.earnedAllInRate,
      headlinePreference: headlinePref,
      isZeroHours: summary30d.rates.isZeroHours,
      isTargetMet: summary30d.rates.isTargetMet,
      targetDeltaPct: summary30d.rates.targetDeltaPct,
      targetDelta: summary30d.rates.headlineRate - target,
      target,

      // Effective hourly baseline (rolling 30d without 1-day divide by zero)
      todayEffHourly: summary30d.rates.headlineRate,
      todayHrVal: summary30d.rates.headlineRate,
      todayNetHourly: summary30d.rates.clientWorkRate,
      isAboveTarget: summary30d.rates.isTargetMet,
      progressPct: target > 0 ? Math.min((summary30d.rates.headlineRate / target) * 100, 100) : 0,

      // Today metrics
      todayMin: todaySummary.hours.totalAllMinutes,
      todayHM: minutesToHM(todaySummary.hours.totalAllMinutes),
      todayTotalMin: todaySummary.hours.totalAllMinutes,
      todayTotalHM: minutesToHM(todaySummary.hours.totalAllMinutes),
      todayPaidMin: todaySummary.hours.paidMinutes,
      todayPaidHM: minutesToHM(todaySummary.hours.paidMinutes),
      todayUnpaidMin: todaySummary.hours.unpaidClientMinutes,
      todayUnpaidHM: minutesToHM(todaySummary.hours.unpaidClientMinutes),
      todayIntentionalUnpaidMin: todaySummary.hours.intentionalUnpaidMinutes,
      todayIntentionalUnpaidHM: minutesToHM(todaySummary.hours.intentionalUnpaidMinutes),
      todayRev: todaySummary.financials.collectedRevenue,
      todayRevenue: todaySummary.financials.collectedRevenue,
      todayEarnedRevenue: todaySummary.financials.earnedRevenue,
      todayExp: todaySummary.financials.directExpenses,
      todayExpenses: todaySummary.financials.directExpenses,
      todayNetVal: todaySummary.financials.collectedNetIncome,
      todayOutstandingVal: todaySummary.financials.outstandingRevenue,
      unpaidEstValue: todayUnpaidValue,

      // 30d Summary Financials
      collectedRevenue: summary30d.financials.collectedRevenue,
      earnedRevenue: summary30d.financials.earnedRevenue,
      outstandingRevenue: summary30d.financials.outstandingRevenue,
      revenue: summary30d.financials.collectedRevenue,
      expenses: summary30d.financials.directExpenses,
      netIncome: summary30d.financials.collectedNetIncome,
      totalHours: summary30d.hours.totalAllHours,
      totalMinutes: summary30d.hours.totalAllMinutes,
      paidHours: summary30d.hours.paidHours,
      unpaidClientHours: summary30d.hours.unpaidClientHours,
      intentionalUnpaidHours: summary30d.hours.intentionalUnpaidHours,
      unpaidRatioPct: summary30d.hours.unpaidRatioPct,

      // Projects & session counts
      activeProj,
      totalJobs,
      todaySessions: todaySess,
      unpaidProjectsList,

      // Rolling window summaries
      rolling: {
        '7d': summary7d,
        '30d': summary30d,
        '90d': summary90d,
        'ytd': summaryYtd,
        'all': summaryAll,
      },
    }
  })

  // ── Formatters ────────────────────────────────────────────────────────────

  function fmtCurrency(val, currencyCode = null) {
    const code = currencyCode || user.value.baseCurrency || user.value.currencyCode || user.value.currency || 'USD'
    return formatCurrencyIntl(val, code)
  }
  function fmtDuration(mins) { return minutesToHM(mins) }
  function fmtHourly(val, currencyCode = null) {
    const formatted = fmtCurrency(val || 0, currencyCode)
    return `${formatted}/hr`
  }

  // ── Optimistic CRUD Mutations ─────────────────────────────────────────────

  // 1. Projects
  async function createProject(data) {
    const tempId = 'temp_p_' + uid()
    const optimisticProj = {
      id: tempId,
      clientId: data.clientId || null,
      name: data.name,
      description: data.description || '',
      serviceCategory: data.serviceCategory || 'General',
      status: data.status || 'potential',
      isJob: Boolean(data.isJob || ['in_progress', 'approved', 'completed'].includes(data.status)),
      quoteAmount: data.quoteAmount ? Number(data.quoteAmount) : null,
      quoteDate: data.quoteDate || null,
      quoteEstHours: data.quoteEstHours ? Number(data.quoteEstHours) : null,
      quoteNotes: data.quoteNotes || '',
      quoteStatus: data.quoteAmount ? 'sent' : 'draft',
      revenue: 0,
      expenses: 0,
      createdAt: now(),
      updatedAt: now(),
    }

    const snapshot = [...projects.value]
    projects.value.unshift(optimisticProj)
    saveCachedState()

    try {
      const res = await apiFetch('/api/projects', {
        method: 'POST',
        body: {
          clientId: data.clientId ? Number(data.clientId) : null,
          name: data.name,
          description: data.description,
          serviceCategory: data.serviceCategory,
          status: data.status || 'potential',
          isJob: optimisticProj.isJob,
          quoteAmount: data.quoteAmount ? Number(data.quoteAmount) : null,
          quoteDate: data.quoteDate,
          quoteEstHours: data.quoteEstHours ? Number(data.quoteEstHours) : null,
          quoteNotes: data.quoteNotes,
        },
      })

      if (res?.data) {
        const idx = projects.value.findIndex((p) => p.id === tempId)
        if (idx !== -1) {
          projects.value[idx] = { ...optimisticProj, ...res.data }
        }
        saveCachedState()
        return res.data
      }
      return optimisticProj
    } catch (err) {
      projects.value = snapshot
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to create project on server.')
      throw err
    }
  }

  async function updateProject(id, data) {
    const idx = projects.value.findIndex((p) => String(p.id) === String(id))
    if (idx === -1) return false

    const previousItem = { ...projects.value[idx] }
    projects.value[idx] = { ...previousItem, ...data, updatedAt: now() }
    saveCachedState()

    try {
      const res = await apiFetch(`/api/projects/${id}`, {
        method: 'PATCH',
        body: data,
      })
      if (res?.data) {
        projects.value[idx] = { ...projects.value[idx], ...res.data }
        saveCachedState()
      }
      return true
    } catch (err) {
      projects.value[idx] = previousItem
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to update project.')
      return false
    }
  }

  async function deleteProject(id) {
    const idx = projects.value.findIndex((p) => String(p.id) === String(id))
    if (idx === -1) return false

    const deletedItem = projects.value[idx]
    const snapshot = [...projects.value]
    projects.value = projects.value.filter((p) => String(p.id) !== String(id))
    saveCachedState()

    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      projects.value = snapshot
      saveCachedState()
      toast.error('Failed to delete project on server.')
      return false
    }
  }

  async function convertToJob(projectId) {
    return await updateProject(projectId, { isJob: true, status: 'in_progress' })
  }

  async function saveQuote(projectId, quoteData) {
    const idx = projects.value.findIndex((p) => String(p.id) === String(projectId))
    if (idx === -1) return false

    const previousItem = { ...projects.value[idx] }
    projects.value[idx] = {
      ...previousItem,
      quoteAmount: Number(quoteData.amount),
      quoteDate: quoteData.date || today(),
      quoteEstHours: quoteData.estHours ? Number(quoteData.estHours) : null,
      quoteNotes: quoteData.notes || '',
      quoteStatus: 'sent',
      status: 'quoted',
      updatedAt: now(),
    }
    saveCachedState()

    try {
      const res = await apiFetch(`/api/projects/${projectId}/quotes`, {
        method: 'POST',
        body: {
          quoteAmount: Number(quoteData.amount),
          estHours: quoteData.estHours ? Number(quoteData.estHours) : null,
          quoteDate: quoteData.date || today(),
          notes: quoteData.notes || '',
          status: 'sent',
        },
      })
      if (res?.data) {
        await updateProject(projectId, {
          quoteAmount: Number(quoteData.amount),
          quoteStatus: 'sent',
          status: 'quoted',
        })
      }
      return true
    } catch (err) {
      projects.value[idx] = previousItem
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to save quote.')
      return false
    }
  }

  // 2. Clients
  async function createClient(data) {
    const tempId = 'temp_c_' + uid()
    const optimisticClient = {
      id: tempId,
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      company: data.company || '',
      country: data.country || 'US',
      notes: data.notes || '',
      totalProjects: 0,
      activeProjects: 0,
      createdAt: now(),
      updatedAt: now(),
    }

    const snapshot = [...clients.value]
    clients.value.unshift(optimisticClient)
    saveCachedState()

    try {
      const res = await apiFetch('/api/clients', {
        method: 'POST',
        body: data,
      })
      if (res?.data) {
        const idx = clients.value.findIndex((c) => c.id === tempId)
        if (idx !== -1) clients.value[idx] = { ...optimisticClient, ...res.data }
        saveCachedState()
        return res.data
      }
      return optimisticClient
    } catch (err) {
      clients.value = snapshot
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to create client.')
      throw err
    }
  }

  async function updateClient(id, data) {
    const idx = clients.value.findIndex((c) => String(c.id) === String(id))
    if (idx === -1) return false

    const previous = { ...clients.value[idx] }
    clients.value[idx] = { ...previous, ...data, updatedAt: now() }
    saveCachedState()

    try {
      const res = await apiFetch(`/api/clients/${id}`, {
        method: 'PATCH',
        body: data,
      })
      if (res?.data) {
        clients.value[idx] = { ...clients.value[idx], ...res.data }
        saveCachedState()
      }
      return true
    } catch (err) {
      clients.value[idx] = previous
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to update client.')
      return false
    }
  }

  async function deleteClient(id) {
    const idx = clients.value.findIndex((c) => String(c.id) === String(id))
    if (idx === -1) return false

    const snapshot = [...clients.value]
    clients.value = clients.value.filter((c) => String(c.id) !== String(id))
    saveCachedState()

    try {
      await apiFetch(`/api/clients/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      clients.value = snapshot
      saveCachedState()
      toast.error('Failed to archive client on server.')
      return false
    }
  }

  // 3. Sessions
  async function addSession(data) {
    const startedAt = data.startedAt || now()
    const endedAt = data.endedAt || now()
    const durationMin = data.durationMin ?? Math.max(1, Math.round((new Date(endedAt) - new Date(startedAt)) / 60000))
    const tempId = 'temp_s_' + uid()

    const optimisticSess = {
      id: tempId,
      projectId: data.projectId,
      title: data.title || 'Work session',
      type: data.type || 'production',
      paymentType: data.paymentType || 'paid',
      unpaidReason: data.unpaidReason || null,
      notes: data.notes || '',
      startedAt,
      endedAt,
      durationMin,
      createdAt: now(),
      updatedAt: now(),
    }

    const snapshot = [...sessions.value]
    sessions.value.unshift(optimisticSess)
    saveCachedState()

    try {
      const res = await apiFetch('/api/sessions', {
        method: 'POST',
        body: {
          projectId: Number(data.projectId),
          title: data.title || 'Work session',
          type: data.type || 'production',
          paymentType: data.paymentType || 'paid',
          unpaidReason: data.unpaidReason,
          notes: data.notes,
          startedAt,
          endedAt,
          durationMinutes: durationMin,
        },
      })
      if (res?.data) {
        const idx = sessions.value.findIndex((s) => s.id === tempId)
        if (idx !== -1) sessions.value[idx] = { ...optimisticSess, ...res.data, durationMin: res.data.durationMinutes || durationMin }
        saveCachedState()
        return res.data
      }
      return optimisticSess
    } catch (err) {
      sessions.value = snapshot
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to save session.')
      throw err
    }
  }

  async function updateSession(id, data) {
    const idx = sessions.value.findIndex((s) => String(s.id) === String(id))
    if (idx === -1) return false

    const previous = { ...sessions.value[idx] }
    sessions.value[idx] = { ...previous, ...data, updatedAt: now() }
    saveCachedState()

    try {
      const res = await apiFetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        body: data,
      })
      if (res?.data) {
        sessions.value[idx] = { ...sessions.value[idx], ...res.data }
        saveCachedState()
      }
      return true
    } catch (err) {
      sessions.value[idx] = previous
      saveCachedState()
      toast.error('Failed to update session.')
      return false
    }
  }

  async function deleteSession(id) {
    const idx = sessions.value.findIndex((s) => String(s.id) === String(id))
    if (idx === -1) return false

    const snapshot = [...sessions.value]
    sessions.value = sessions.value.filter((s) => String(s.id) !== String(id))
    saveCachedState()

    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      sessions.value = snapshot
      saveCachedState()
      toast.error('Failed to delete session on server.')
      return false
    }
  }

  // 4. Payments
  async function addPayment(projectId, pmtData) {
    const tempId = 'temp_pay_' + uid()
    const optimisticPmt = {
      id: tempId,
      projectId,
      amount: Number(pmtData.amount),
      paidDate: pmtData.paidDate || today(),
      notes: pmtData.notes || '',
      createdAt: now(),
      updatedAt: now(),
    }

    const snapshot = [...payments.value]
    payments.value.unshift(optimisticPmt)
    saveCachedState()

    try {
      const res = await apiFetch('/api/payments', {
        method: 'POST',
        body: {
          projectId: Number(projectId),
          amount: Number(pmtData.amount),
          paidDate: pmtData.paidDate || today(),
          notes: pmtData.notes || '',
        },
      })
      if (res?.data) {
        const idx = payments.value.findIndex((p) => p.id === tempId)
        if (idx !== -1) payments.value[idx] = { ...optimisticPmt, ...res.data }
        saveCachedState()
        return res.data
      }
      return optimisticPmt
    } catch (err) {
      payments.value = snapshot
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to record payment.')
      throw err
    }
  }

  async function deletePayment(id) {
    const snapshot = [...payments.value]
    payments.value = payments.value.filter((p) => String(p.id) !== String(id))
    saveCachedState()

    try {
      await apiFetch(`/api/payments/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      payments.value = snapshot
      saveCachedState()
      toast.error('Failed to delete payment.')
      return false
    }
  }

  // 5. Expenses
  async function addExpense(projectId, expData) {
    const tempId = 'temp_exp_' + uid()
    const optimisticExp = {
      id: tempId,
      projectId,
      description: expData.description || 'Project expense',
      amount: Number(expData.amount),
      date: expData.date || today(),
      expenseDate: expData.date || today(),
      category: expData.category || 'General',
      createdAt: now(),
      updatedAt: now(),
    }

    const snapshot = [...expenses.value]
    expenses.value.unshift(optimisticExp)
    saveCachedState()

    try {
      const res = await apiFetch('/api/expenses', {
        method: 'POST',
        body: {
          projectId: Number(projectId),
          description: expData.description || 'Project expense',
          amount: Number(expData.amount),
          category: expData.category || 'General',
          expenseDate: expData.date || today(),
        },
      })
      if (res?.data) {
        const idx = expenses.value.findIndex((e) => e.id === tempId)
        if (idx !== -1) expenses.value[idx] = { ...optimisticExp, ...res.data, date: res.data.expenseDate || res.data.date }
        saveCachedState()
        return res.data
      }
      return optimisticExp
    } catch (err) {
      expenses.value = snapshot
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to record expense.')
      throw err
    }
  }

  async function deleteExpense(id) {
    const snapshot = [...expenses.value]
    expenses.value = expenses.value.filter((e) => String(e.id) !== String(id))
    saveCachedState()

    try {
      await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      expenses.value = snapshot
      saveCachedState()
      toast.error('Failed to delete expense.')
      return false
    }
  }

  // 6. User Profile
  async function updateProfile(data) {
    const previous = { ...user.value }
    user.value = { ...user.value, ...data }
    saveCachedState()

    try {
      const res = await apiFetch('/api/me', {
        method: 'PATCH',
        body: data,
      })
      if (res?.data) {
        user.value = {
          ...user.value,
          ...res.data,
          currency: res.data.baseCurrency || user.value.currency,
          currencyCode: res.data.baseCurrency || user.value.currencyCode,
        }
        saveCachedState()
      }
      return true
    } catch (err) {
      user.value = previous
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to update profile settings.')
      return false
    }
  }

  // 7. Tax Rates (Generic Global Tax Engine)
  async function fetchTaxRates() {
    try {
      const res = await apiFetch('/api/tax-rates')
      if (res?.data && Array.isArray(res.data)) {
        taxRates.value = res.data
        saveCachedState()
      }
      return taxRates.value
    } catch (e) {
      console.warn('[Wello Tax] Could not fetch tax rates', e)
      return []
    }
  }

  async function createTaxRate(data) {
    const tempId = 'temp_tax_' + uid()
    const optimistic = {
      id: tempId,
      name: data.name,
      rate: Number(data.rate),
      isCompound: Boolean(data.isCompound),
      isInclusive: Boolean(data.isInclusive),
      isDefault: Boolean(data.isDefault),
      countryCode: data.countryCode || '',
    }
    const snapshot = [...taxRates.value]
    taxRates.value.push(optimistic)
    saveCachedState()

    try {
      const res = await apiFetch('/api/tax-rates', {
        method: 'POST',
        body: data,
      })
      if (res?.data) {
        const idx = taxRates.value.findIndex((t) => t.id === tempId)
        if (idx !== -1) taxRates.value[idx] = res.data
        saveCachedState()
        return res.data
      }
      return optimistic
    } catch (err) {
      taxRates.value = snapshot
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to create tax rate.')
      throw err
    }
  }

  async function updateTaxRate(id, data) {
    const idx = taxRates.value.findIndex((t) => String(t.id) === String(id))
    if (idx === -1) return false
    const previous = { ...taxRates.value[idx] }
    taxRates.value[idx] = { ...previous, ...data }
    saveCachedState()

    try {
      const res = await apiFetch(`/api/tax-rates/${id}`, {
        method: 'PATCH',
        body: data,
      })
      if (res?.data) {
        taxRates.value[idx] = { ...taxRates.value[idx], ...res.data }
        saveCachedState()
      }
      return true
    } catch (err) {
      taxRates.value[idx] = previous
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to update tax rate.')
      return false
    }
  }

  async function deleteTaxRate(id) {
    const snapshot = [...taxRates.value]
    taxRates.value = taxRates.value.filter((t) => String(t.id) !== String(id))
    saveCachedState()

    try {
      await apiFetch(`/api/tax-rates/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      taxRates.value = snapshot
      saveCachedState()
      toast.error('Failed to delete tax rate.')
      return false
    }
  }

  async function fetchMetricsSummary(params = {}) {
    const tz = params.timezone || user.value.timezone || 'UTC'
    const range = params.range || '30d'
    const currency = params.currency || user.value.baseCurrency || 'USD'
    try {
      const q = new URLSearchParams()
      if (params.range) q.set('range', params.range)
      if (params.from) q.set('from', params.from)
      if (params.to) q.set('to', params.to)
      q.set('tz', tz)
      q.set('currency', currency)
      const res = await apiFetch(`/api/metrics/summary?${q.toString()}`)
      if (res?.data) {
        metricsSummary.value = res.data
        return res.data
      }
    } catch (err) {
      console.warn('[Wello Metrics] Error fetching metrics summary:', err)
    }
    return null
  }

  async function fetchMetricsInsights(params = {}) {
    const tz = params.timezone || user.value.timezone || 'UTC'
    const currency = params.currency || user.value.baseCurrency || 'USD'
    try {
      const q = new URLSearchParams()
      if (params.from) q.set('from', params.from)
      if (params.to) q.set('to', params.to)
      q.set('tz', tz)
      q.set('currency', currency)
      const res = await apiFetch(`/api/metrics/insights?${q.toString()}`)
      if (res?.data) {
        metricsInsights.value = res.data
        return res.data
      }
    } catch (err) {
      console.warn('[Wello Metrics] Error fetching metrics insights:', err)
    }
    return null
  }


  function resetToDefaults() {
    user.value = { ...SAMPLE_USER }
    clients.value = [...SAMPLE_CLIENTS]
    projects.value = [...SAMPLE_PROJECTS]
    sessions.value = [...SAMPLE_SESSIONS]
    payments.value = [...SAMPLE_PAYMENTS]
    expenses.value = [...SAMPLE_EXPENSES]
    taxRates.value = []
    fxRates.value = {}
    activeTimer.value = null
    timerElapsed.value = 0
    isTimerPaused.value = false
    clearCache()
  }

  return {
    // State
    user,
    clients,
    projects,
    sessions,
    payments,
    expenses,
    taxRates,
    fxRates,
    metricsSummary,
    metricsInsights,
    activeTimer,
    timerElapsed,
    isTimerPaused,
    isLoading,
    isSyncing,
    isOffline,
    lastSyncedAt,
    showMigrationPrompt,
    migrationData,

    // Computed
    currency,
    enrichedProjects,
    dashboardStats,
    recentInsights,

    // Authoritative Metrics & Taxonomy Engine
    computeUnifiedMetricsSummary,
    computeIntelligenceInsights,
    UNPAID_TAXONOMY,
    categorizeUnpaidReason,
    fetchMetricsSummary,
    fetchMetricsInsights,

    // Core Helpers
    getClient,
    getProject,
    getProjectSessions,
    getProjectPayments,
    getProjectExpenses,
    enrichProject,
    projectTotalMinutes,
    projectUnpaidMinutes,
    projectPaidMinutes,
    projectRevenueTotal,
    projectExpenseTotal,
    projectNetIncome,
    projectNetHourlyValue,
    projectGrossHourlyValue,
    projectEffectiveHourly,
    estimatedUnpaidValue,
    todaysSessions,
    todaysTotalMinutes,
    todaysUnpaidMinutes,
    todaysPaidMinutes,
    todaysRevenue,
    todaysExpenses,
    todaysNet,
    todaysEffectiveHourly,
    getSessionsByRange,
    getPeriodChartData,
    getInsightsForPeriod,
    getConversionAnalysis,
    getValueTrendSeries,
    getDynamicSmartInsights,
    minutesToHM,
    userToday,

    // FX Engine
    fetchFxRates,
    convertToBaseCurrency,

    // Tax Engine
    fetchTaxRates,
    createTaxRate,
    updateTaxRate,
    deleteTaxRate,

    // Formatters
    fmt,
    fmtCurrency,
    fmtDuration,
    fmtHourly,

    // Data Load & Sync
    loadInitialData,
    loadCachedState,
    saveCachedState,
    clearCache,
    importLegacyData,
    dismissMigration,

    // Timer Actions
    fetchActiveTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    timerDisplay,

    // Optimistic CRUD Actions
    createProject,
    updateProject,
    deleteProject,
    convertToJob,
    saveQuote,
    addPayment,
    deletePayment,
    addExpense,
    deleteExpense,
    addSession,
    updateSession,
    deleteSession,
    createClient,
    updateClient,
    deleteClient,
    updateProfile,
    resetToDefaults,
  }
})
