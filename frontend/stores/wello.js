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
  computeIncomeSourceMetrics,
  computeSalariedCommuteAnalysis,
  computeMultiEmployerComparison,
  UNPAID_TAXONOMY,
  categorizeUnpaidReason,
} from '~/utils/metricsEngine'
import { OfflineOutboxManager } from '~/utils/offlineOutbox'

// ─── Helpers ────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString() }
function today() { return new Date().toISOString().slice(0, 10) }
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
    unpaidReason: 'pitching', unpaidCategory: 'unpaid_client', startedAt: `${tDate}T09:00:00`, endedAt: `${tDate}T09:45:00`, durationMin: 45,
    notes: 'Initial scope alignment and project kickoff discussion.',
  },
  {
    id: 's-t2', projectId: 'p1', title: 'Revision rounds', type: 'revision', paymentType: 'unpaid',
    unpaidReason: 'revisions_beyond_scope', unpaidCategory: 'unpaid_client', startedAt: `${tDate}T10:00:00`, endedAt: `${tDate}T11:00:00`, durationMin: 60,
    notes: 'Extra styling tweaks requested outside the approved wireframes.',
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
  earningPersona: 'freelancer_projects',
  includeOverheadInMetrics: true,
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
  const incomeSources = ref([])
  const overheadExpenses = ref([])
  const expectedPayments = ref([])
  const recurringProposals = ref([])
  const taxRates = ref([])
  const fxRates = ref({})
  const notifications = ref([])
  const unreadNotificationCount = ref(0)
  const notificationPreferences = ref([])
  const isNotificationsLoading = ref(false)

  // Addon Platform & Store State (100% Free Addons)
  const addons = ref([])
  const showAddonModal = ref(false)
  const addonModalData = ref({ key: '', name: '', description: '', isFree: true })

  // Trust, Privacy, Onboarding & Feedback State
  const showFeedbackModal = ref(false)
  const showOnboardingWizard = ref(false)
  const privacySettings = ref({
    analyticsConsent: true,
    cookieConsent: 'accepted',
    digestFrequency: 'weekly',
  })

  // Timer State (Server Synchronized)
  const activeTimer = ref(null)
  const timerElapsed = ref(0)
  const isTimerPaused = ref(false)

  // Status & Synchronization State
  const isLoading = ref(false)
  const isSyncing = ref(false)
  const isOffline = ref(typeof navigator !== 'undefined' ? !navigator.onLine : false)
  const lastSyncedAt = ref(null)

  // Offline Outbox & Conflict State
  const outbox = new OfflineOutboxManager(() => authStore.user?.id || authStore.user?.email || 'guest')
  const pendingOutboxCount = ref(0)
  const activeConflict = ref(null)

  if (typeof window !== 'undefined') {
    outbox.subscribe((queue) => {
      pendingOutboxCount.value = queue.filter((i) => i.status === 'pending' || i.status === 'processing').length
    })
  }

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
        if (Array.isArray(cached.incomeSources)) incomeSources.value = cached.incomeSources
        if (Array.isArray(cached.overheadExpenses)) overheadExpenses.value = cached.overheadExpenses
        if (Array.isArray(cached.expectedPayments)) expectedPayments.value = cached.expectedPayments
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
          incomeSources: incomeSources.value,
          overheadExpenses: overheadExpenses.value,
          expectedPayments: expectedPayments.value,
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
      if (err?.data?.data?.code === 'ADDON_NOT_ACTIVATED' || err?.data?.code === 'ADDON_NOT_ACTIVATED') {
        const addonKey = err?.data?.data?.addonKey || err?.data?.addonKey || ''
        const addonName = err?.data?.data?.addonName || err?.data?.addonName || ''
        triggerAddonGatePrompt(addonKey, addonName)
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
      // Parallel fetch of core user data, tax rates, fx rates, income sources, overheads, addons
      const [meRes, clientsRes, projectsRes, sessionsRes, paymentsRes, expensesRes, incomeSourcesRes, overheadsRes, expectedPmtsRes, taxesRes, fxRes, addonsRes] =
        await Promise.allSettled([
          apiFetch('/api/me'),
          apiFetch('/api/clients?limit=100'),
          apiFetch('/api/projects?limit=100'),
          apiFetch('/api/sessions?limit=100'),
          apiFetch('/api/payments?limit=100'),
          apiFetch('/api/expenses?limit=100'),
          apiFetch('/api/income-sources'),
          apiFetch('/api/overhead-expenses'),
          apiFetch('/api/expected-payments'),
          apiFetch('/api/tax-rates'),
          apiFetch('/api/fx/rates'),
          apiFetch('/api/store/addons'),
        ])

      if (addonsRes.status === 'fulfilled' && addonsRes.value?.data?.addons) {
        addons.value = addonsRes.value.data.addons
      }

      if (meRes.status === 'fulfilled' && meRes.value?.data) {
        user.value = {
          ...user.value,
          ...meRes.value.data,
          currency: meRes.value.data.baseCurrency || 'USD',
          currencyCode: meRes.value.data.baseCurrency || 'USD',
          baseCurrency: meRes.value.data.baseCurrency || 'USD',
          timezone: meRes.value.data.timezone || getBrowserTimezone(),
          earningPersona: meRes.value.data.earningPersona || 'freelancer_projects',
          includeOverheadInMetrics: meRes.value.data.includeOverheadInMetrics !== false,
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

      if (incomeSourcesRes.status === 'fulfilled' && Array.isArray(incomeSourcesRes.value?.data)) {
        incomeSources.value = incomeSourcesRes.value.data
      }

      if (overheadsRes.status === 'fulfilled' && Array.isArray(overheadsRes.value?.data)) {
        overheadExpenses.value = overheadsRes.value.data
      }

      if (expectedPmtsRes.status === 'fulfilled' && expectedPmtsRes.value?.data) {
        expectedPayments.value = expectedPmtsRes.value.data.expectedPayments || []
        recurringProposals.value = expectedPmtsRes.value.data.recurringProposals || []
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

  // ── Server-Synchronized & Trustworthy Timer Engine ────────────────────────
  let _timerBroadcastChannel = null
  let _heartbeatInterval = null

  if (typeof window !== 'undefined') {
    try {
      if ('BroadcastChannel' in window) {
        _timerBroadcastChannel = new BroadcastChannel('wello_timer_channel')
        _timerBroadcastChannel.onmessage = (ev) => {
          if (ev?.data?.type) {
            fetchActiveTimer(false)
          }
        }
      }
    } catch (e) {
      console.warn('[Wello BroadcastChannel] Not available', e)
    }

    window.addEventListener('focus', () => {
      fetchActiveTimer(false)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        fetchActiveTimer(false)
      }
    })
  }

  function broadcastTimerEvent(type, payload = {}) {
    if (_timerBroadcastChannel) {
      try {
        _timerBroadcastChannel.postMessage({ type, payload, timestamp: Date.now() })
      } catch (_) {}
    }
  }

  function startHeartbeat() {
    if (_heartbeatInterval) clearInterval(_heartbeatInterval)
    _heartbeatInterval = setInterval(async () => {
      if (activeTimer.value && !isTimerPaused.value && authStore.isAuthenticated) {
        try {
          await apiFetch('/api/timer/heartbeat', { method: 'POST' })
        } catch (_) {}
      }
    }, 30000)
  }

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

    startHeartbeat()
  }

  async function fetchActiveTimer(showToastOnError = false) {
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
        if (_heartbeatInterval) {
          clearInterval(_heartbeatInterval)
          _heartbeatInterval = null
        }
      }
    } catch (err) {
      if (showToastOnError) console.warn('[Wello Timer] Could not check active timer', err)
    }
  }

  async function startTimer(payload) {
    const previousTimer = activeTimer.value

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const localTimer = {
        id: 'local_timer_' + uid(),
        projectId: payload.projectId,
        title: payload.title || 'Work Session',
        startedAt: now(),
        isPaused: false,
        elapsedSeconds: 0,
      }
      activeTimer.value = localTimer
      isTimerPaused.value = false
      timerElapsed.value = 0
      initTimerTicker()
      saveCachedState()
      outbox.enqueue({
        action: 'START_TIMER',
        endpoint: '/api/timer/start',
        method: 'POST',
        payload,
        entityType: 'timer',
      })
      toast.info('Timer started offline. Will synchronize when online.')
      return { success: true, timer: localTimer }
    }

    try {
      const res = await apiFetch('/api/timer/start', {
        method: 'POST',
        body: payload,
      })
      if (res?.data?.timer) {
        activeTimer.value = res.data.timer
        isTimerPaused.value = res.data.timer.isPaused
        timerElapsed.value = res.data.timer.elapsedSeconds || 0
        initTimerTicker()
        broadcastTimerEvent('TIMER_STARTED', res.data.timer)
      }
      return { success: true, timer: activeTimer.value }
    } catch (err) {
      if (err?.statusCode === 409 || err?.data?.error?.code === 'ACTIVE_TIMER_EXISTS') {
        return {
          conflict: true,
          error: err?.data?.error || { message: err?.message },
          activeTimer: err?.data?.error?.details?.activeTimer || null,
        }
      }
      // Offline fallback if network fails
      const localTimer = {
        id: 'local_timer_' + uid(),
        projectId: payload.projectId,
        title: payload.title || 'Work Session',
        startedAt: now(),
        isPaused: false,
        elapsedSeconds: 0,
      }
      activeTimer.value = localTimer
      isTimerPaused.value = false
      timerElapsed.value = 0
      initTimerTicker()
      saveCachedState()
      outbox.enqueue({
        action: 'START_TIMER',
        endpoint: '/api/timer/start',
        method: 'POST',
        payload,
        entityType: 'timer',
      })
      toast.info('Network unreachable. Timer running in offline mode.')
      return { success: true, timer: localTimer }
    }
  }

  async function pauseTimer() {
    if (!activeTimer.value) return
    const prevPaused = isTimerPaused.value
    isTimerPaused.value = true

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      outbox.enqueue({ action: 'PAUSE_TIMER', endpoint: '/api/timer/pause', method: 'POST', entityType: 'timer' })
      return
    }

    try {
      await apiFetch('/api/timer/pause', { method: 'POST' })
      broadcastTimerEvent('TIMER_PAUSED')
    } catch (err) {
      outbox.enqueue({ action: 'PAUSE_TIMER', endpoint: '/api/timer/pause', method: 'POST', entityType: 'timer' })
    }
  }

  async function resumeTimer() {
    if (!activeTimer.value) return
    const prevPaused = isTimerPaused.value
    isTimerPaused.value = false
    initTimerTicker()

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      outbox.enqueue({ action: 'RESUME_TIMER', endpoint: '/api/timer/resume', method: 'POST', entityType: 'timer' })
      return
    }

    try {
      await apiFetch('/api/timer/resume', { method: 'POST' })
      broadcastTimerEvent('TIMER_RESUMED')
    } catch (err) {
      outbox.enqueue({ action: 'RESUME_TIMER', endpoint: '/api/timer/resume', method: 'POST', entityType: 'timer' })
    }
  }

  async function stopTimer(options = {}) {
    if (!activeTimer.value) return null
    if (_timerInterval) {
      clearInterval(_timerInterval)
      _timerInterval = null
    }
    if (_heartbeatInterval) {
      clearInterval(_heartbeatInterval)
      _heartbeatInterval = null
    }

    const stoppingTimer = { ...activeTimer.value }
    const elapsedSnapshot = timerElapsed.value
    activeTimer.value = null
    timerElapsed.value = 0
    isTimerPaused.value = false

    const body = typeof options === 'string'
      ? { notes: options, title: stoppingTimer.title }
      : {
          notes: options.notes || '',
          title: options.title || stoppingTimer.title,
          trimToLastActivity: Boolean(options.trimToLastActivity),
          trimToHours: options.trimToHours ? Number(options.trimToHours) : undefined,
          customEndedAt: options.customEndedAt,
        }

    const durationSec = elapsedSnapshot
    const localSess = {
      id: 'local_sess_' + uid(),
      projectId: stoppingTimer.projectId,
      title: body.title || 'Work Session',
      startedAt: stoppingTimer.startedAt || now(),
      endedAt: now(),
      durationMin: Math.max(1, Math.round(durationSec / 60)),
      durationSec,
      paymentType: 'paid',
      notes: body.notes || '',
      createdAt: now(),
      updatedAt: now(),
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      sessions.value.unshift(localSess)
      saveCachedState()
      outbox.enqueue({
        action: 'STOP_TIMER',
        endpoint: '/api/timer/stop',
        method: 'POST',
        payload: {
          ...body,
          startedAt: stoppingTimer.startedAt,
          endedAt: localSess.endedAt,
          durationSec,
        },
        entityType: 'session',
        localId: localSess.id,
      })
      toast.success('Session recorded offline. Will sync when back online.')
      return { ...stoppingTimer, session: localSess }
    }

    try {
      const res = await apiFetch('/api/timer/stop', {
        method: 'POST',
        body,
      })

      if (res?.data?.session) {
        const sess = {
          ...res.data.session,
          durationMin: res.data.session.durationMinutes || Math.round((res.data.session.durationSeconds || 0) / 60),
        }
        sessions.value.unshift(sess)
        saveCachedState()
        broadcastTimerEvent('TIMER_STOPPED', sess)
        return { ...stoppingTimer, session: sess }
      }
    } catch (err) {
      sessions.value.unshift(localSess)
      saveCachedState()
      outbox.enqueue({
        action: 'STOP_TIMER',
        endpoint: '/api/timer/stop',
        method: 'POST',
        payload: {
          ...body,
          startedAt: stoppingTimer.startedAt,
          endedAt: localSess.endedAt,
          durationSec,
        },
        entityType: 'session',
        localId: localSess.id,
      })
      toast.info('Network unreachable. Session saved locally in offline outbox.')
      return { ...stoppingTimer, session: localSess }
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

  async function fetchSessionHistory(sessionId) {
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/history`)
      return res?.data?.edits || []
    } catch (err) {
      console.warn('[Wello] Could not fetch session history', err)
      return []
    }
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

  // ── Network Status Listeners & Delta Sync Flush ──────────────────────────

  async function flushOutbox() {
    if (!authStore.isAuthenticated || isOffline.value) return
    isSyncing.value = true
    try {
      const result = await outbox.flush(apiFetch, (conflict) => {
        activeConflict.value = conflict
      })
      if (result.processed > 0) {
        toast.success(`Synchronized ${result.processed} offline change${result.processed > 1 ? 's' : ''}.`)
        await loadInitialData()
      }
      if (result.conflicts > 0) {
        toast.warning(`${result.conflicts} sync conflict${result.conflicts > 1 ? 's' : ''} require resolution.`)
      }
    } catch (err) {
      console.warn('[Wello Sync] Outbox flush failed:', err)
    } finally {
      isSyncing.value = false
    }
  }

  function dismissConflict() {
    activeConflict.value = null
  }

  async function resolveConflict(conflictData, resolution) {
    const { mutationId, entityType, recordId, serverRecord, clientPayload } = conflictData

    if (resolution === 'ACCEPT_SERVER') {
      if (entityType === 'payment') {
        const idx = payments.value.findIndex((p) => String(p.id) === String(recordId))
        if (idx !== -1) payments.value[idx] = { ...payments.value[idx], ...serverRecord }
      }
      outbox.remove(mutationId)
      toast.info('Accepted server version.')
    } else if (resolution === 'KEEP_LOCAL') {
      try {
        await apiFetch(`/api/payments/${recordId}`, {
          method: 'PUT',
          body: clientPayload,
        })
        outbox.remove(mutationId)
        toast.success('Updated server with your local version.')
      } catch (err) {
        toast.error('Failed to update server.')
      }
    } else if (resolution === 'KEEP_BOTH') {
      try {
        await apiFetch('/api/payments', {
          method: 'POST',
          body: {
            ...clientPayload,
            notes: (clientPayload.notes || '') + ' (Offline adjustment copy)',
          },
        })
        outbox.remove(mutationId)
        toast.success('Created second payment entry.')
      } catch (err) {
        toast.error('Failed to create copy.')
      }
    }

    saveCachedState()
    activeConflict.value = null
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      isOffline.value = false
      toast.info('Back online! Synchronizing outbox...')
      flushOutbox()
    })
    window.addEventListener('offline', () => {
      isOffline.value = true
      toast.warning('Working offline — changes queued in outbox.')
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
      overheadExpenses.value,
      incomeSources.value,
      { range: '30d', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref, includeOverhead: user.value.includeOverheadInMetrics !== false }
    )

    // Compute 7d, 90d, YTD, and All Time summaries
    const summary7d = computeUnifiedMetricsSummary(sessions.value, payments.value, expenses.value, projects.value, overheadExpenses.value, incomeSources.value, { range: '7d', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref, includeOverhead: user.value.includeOverheadInMetrics !== false })
    const summary90d = computeUnifiedMetricsSummary(sessions.value, payments.value, expenses.value, projects.value, overheadExpenses.value, incomeSources.value, { range: '90d', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref, includeOverhead: user.value.includeOverheadInMetrics !== false })
    const summaryYtd = computeUnifiedMetricsSummary(sessions.value, payments.value, expenses.value, projects.value, overheadExpenses.value, incomeSources.value, { range: 'ytd', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref, includeOverhead: user.value.includeOverheadInMetrics !== false })
    const summaryAll = computeUnifiedMetricsSummary(sessions.value, payments.value, expenses.value, projects.value, overheadExpenses.value, incomeSources.value, { range: 'all', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref, includeOverhead: user.value.includeOverheadInMetrics !== false })

    // Compute Today snapshot
    const todaySummary = computeUnifiedMetricsSummary(
      sessions.value,
      payments.value,
      expenses.value,
      projects.value,
      overheadExpenses.value,
      incomeSources.value,
      { range: 'today', timezone: tz, baseCurrency: baseCur, targetHourly: target, headlinePreference: headlinePref, includeOverhead: user.value.includeOverheadInMetrics !== false }
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
    const tempId = 'local_s_' + uid()

    const optimisticSess = {
      id: tempId,
      projectId: Number(data.projectId),
      title: data.title || 'Work session',
      type: data.type || 'production',
      paymentType: data.paymentType || 'paid',
      unpaidReason: data.unpaidReason || null,
      unpaidCategory: data.unpaidCategory || null,
      notes: data.notes || '',
      startedAt,
      endedAt,
      durationMin,
      durationSec: durationMin * 60,
      createdAt: now(),
      updatedAt: now(),
    }

    sessions.value.unshift(optimisticSess)
    saveCachedState()

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      outbox.enqueue({
        action: 'LOG_SESSION',
        endpoint: '/api/sessions',
        method: 'POST',
        payload: {
          projectId: Number(data.projectId),
          title: data.title || 'Work session',
          type: data.type || 'production',
          paymentType: data.paymentType || 'paid',
          unpaidReason: data.unpaidReason,
          unpaidCategory: data.unpaidCategory,
          notes: data.notes,
          startedAt,
          endedAt,
          durationMinutes: durationMin,
        },
        entityType: 'session',
        localId: tempId,
      })
      toast.info('Session saved offline.')
      return { success: true, session: optimisticSess }
    }

    try {
      const res = await apiFetch('/api/sessions', {
        method: 'POST',
        body: {
          projectId: Number(data.projectId),
          title: data.title || 'Work session',
          type: data.type || 'production',
          paymentType: data.paymentType || 'paid',
          unpaidReason: data.unpaidReason,
          unpaidCategory: data.unpaidCategory,
          notes: data.notes,
          startedAt,
          endedAt,
          durationMinutes: durationMin,
          allowOverlap: Boolean(data.allowOverlap),
        },
      })
      if (res?.data) {
        const idx = sessions.value.findIndex((s) => s.id === tempId)
        const sess = {
          ...res.data,
          durationMin: res.data.durationMinutes || durationMin,
        }
        if (idx !== -1) sessions.value[idx] = sess
        saveCachedState()
        return { success: true, session: sess }
      }
      return { success: true, session: optimisticSess }
    } catch (err) {
      if (err?.statusCode === 409 || err?.data?.error?.code === 'SESSION_OVERLAP_DETECTED') {
        return {
          conflict: true,
          error: err?.data?.error || { message: err?.message },
          overlappingSessions: err?.data?.error?.details?.overlappingSessions || [],
        }
      }
      outbox.enqueue({
        action: 'LOG_SESSION',
        endpoint: '/api/sessions',
        method: 'POST',
        payload: {
          projectId: Number(data.projectId),
          title: data.title || 'Work session',
          type: data.type || 'production',
          paymentType: data.paymentType || 'paid',
          unpaidReason: data.unpaidReason,
          unpaidCategory: data.unpaidCategory,
          notes: data.notes,
          startedAt,
          endedAt,
          durationMinutes: durationMin,
        },
        entityType: 'session',
        localId: tempId,
      })
      toast.info('Session queued for offline sync.')
      return { success: true, session: optimisticSess }
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
        body: {
          ...data,
          allowOverlap: Boolean(data.allowOverlap),
        },
      })
      if (res?.data) {
        sessions.value[idx] = {
          ...sessions.value[idx],
          ...res.data,
          durationMin: res.data.durationMinutes || sessions.value[idx].durationMin,
        }
        saveCachedState()
        return { success: true, session: sessions.value[idx] }
      }
      return { success: true }
    } catch (err) {
      if (err?.statusCode === 409 || err?.data?.error?.code === 'SESSION_OVERLAP_DETECTED') {
        return {
          conflict: true,
          error: err?.data?.error || { message: err?.message },
          overlappingSessions: err?.data?.error?.details?.overlappingSessions || [],
        }
      }
      sessions.value[idx] = previous
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to update session.')
      return false
    }
  }

  async function deleteSession(id) {
    const idx = sessions.value.findIndex((s) => String(s.id) === String(id))
    if (idx === -1) return false

    sessions.value = sessions.value.filter((s) => String(s.id) !== String(id))
    saveCachedState()

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      outbox.enqueue({
        action: 'DELETE_SESSION',
        endpoint: `/api/sessions/${id}`,
        method: 'DELETE',
        payload: { id },
        entityType: 'session',
        localId: id,
      })
      toast.info('Session deleted offline.')
      return true
    }

    try {
      await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      outbox.enqueue({
        action: 'DELETE_SESSION',
        endpoint: `/api/sessions/${id}`,
        method: 'DELETE',
        payload: { id },
        entityType: 'session',
        localId: id,
      })
      return true
    }
  }

  async function fetchSessionHistory(id) {
    try {
      const res = await apiFetch(`/api/sessions/${id}/history`)
      if (res?.data?.edits) {
        return res.data.edits
      }
      if (Array.isArray(res?.data)) {
        return res.data
      }
      return []
    } catch (err) {
      console.warn('[Wello Audit] Failed to fetch session history:', err)
      return []
    }
  }

  // 4. Payments
  async function addPayment(projectId, pmtData) {
    const tempId = 'local_p_' + uid()
    const optimisticPmt = {
      id: tempId,
      projectId: Number(projectId),
      amount: Number(pmtData.amount),
      currency: pmtData.currency || user.value.baseCurrency || 'USD',
      paidDate: pmtData.paidDate || userToday(),
      notes: pmtData.notes || '',
      isExpected: false,
      status: 'paid',
      createdAt: now(),
      updatedAt: now(),
    }

    payments.value.unshift(optimisticPmt)
    saveCachedState()

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      outbox.enqueue({
        action: 'CREATE_PAYMENT',
        endpoint: '/api/payments',
        method: 'POST',
        payload: optimisticPmt,
        entityType: 'payment',
        localId: tempId,
      })
      toast.info('Payment recorded locally (offline mode).')
      return optimisticPmt
    }

    try {
      const res = await apiFetch('/api/payments', {
        method: 'POST',
        body: {
          projectId: Number(projectId),
          amount: Number(pmtData.amount),
          currency: pmtData.currency,
          paidDate: pmtData.paidDate || userToday(),
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
      outbox.enqueue({
        action: 'CREATE_PAYMENT',
        endpoint: '/api/payments',
        method: 'POST',
        payload: optimisticPmt,
        entityType: 'payment',
        localId: tempId,
      })
      toast.info('Network unreachable. Payment queued in offline outbox.')
      return optimisticPmt
    }
  }

  async function deletePayment(id) {
    const snapshot = [...payments.value]
    payments.value = payments.value.filter((p) => String(p.id) !== String(id))
    saveCachedState()

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      outbox.enqueue({
        action: 'DELETE_PAYMENT',
        endpoint: `/api/payments/${id}`,
        method: 'DELETE',
        payload: { id },
        entityType: 'payment',
        localId: id,
      })
      toast.info('Payment deleted offline.')
      return true
    }

    try {
      await apiFetch(`/api/payments/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      outbox.enqueue({
        action: 'DELETE_PAYMENT',
        endpoint: `/api/payments/${id}`,
        method: 'DELETE',
        payload: { id },
        entityType: 'payment',
        localId: id,
      })
      return true
    }
  }

  // 5. Expenses
  async function addExpense(projectId, expData) {
    const tempId = 'local_exp_' + uid()
    const optimisticExp = {
      id: tempId,
      projectId: Number(projectId),
      description: expData.description || 'Project expense',
      amount: Number(expData.amount),
      date: expData.date || userToday(),
      expenseDate: expData.date || userToday(),
      category: expData.category || 'General',
      currency: expData.currency || user.value.baseCurrency || 'USD',
      createdAt: now(),
      updatedAt: now(),
    }

    expenses.value.unshift(optimisticExp)
    saveCachedState()

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      outbox.enqueue({
        action: 'CREATE_EXPENSE',
        endpoint: '/api/expenses',
        method: 'POST',
        payload: optimisticExp,
        entityType: 'expense',
        localId: tempId,
      })
      toast.info('Expense saved offline.')
      return optimisticExp
    }

    try {
      const res = await apiFetch('/api/expenses', {
        method: 'POST',
        body: {
          projectId: Number(projectId),
          description: expData.description || 'Project expense',
          amount: Number(expData.amount),
          category: expData.category || 'General',
          expenseDate: expData.date || userToday(),
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
      outbox.enqueue({
        action: 'CREATE_EXPENSE',
        endpoint: '/api/expenses',
        method: 'POST',
        payload: optimisticExp,
        entityType: 'expense',
        localId: tempId,
      })
      toast.info('Network unreachable. Expense queued in offline outbox.')
      return optimisticExp
    }
  }

  async function deleteExpense(id) {
    const snapshot = [...expenses.value]
    expenses.value = expenses.value.filter((e) => String(e.id) !== String(id))
    saveCachedState()

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      outbox.enqueue({
        action: 'DELETE_EXPENSE',
        endpoint: `/api/expenses/${id}`,
        method: 'DELETE',
        payload: { id },
        entityType: 'expense',
        localId: id,
      })
      toast.info('Expense deleted offline.')
      return true
    }

    try {
      await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      outbox.enqueue({
        action: 'DELETE_EXPENSE',
        endpoint: `/api/expenses/${id}`,
        method: 'DELETE',
        payload: { id },
        entityType: 'expense',
        localId: id,
      })
      return true
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

  // ── Addons & Store Platform (100% Free Addons) ────────────────────────────

  async function fetchAddons() {
    try {
      const res = await apiFetch('/api/store/addons')
      if (res?.data?.addons) {
        addons.value = res.data.addons
      } else if (Array.isArray(res?.addons)) {
        addons.value = res.addons
      }
      return addons.value
    } catch (err) {
      console.warn('[Wello Store] Failed to fetch addons:', err)
      return addons.value
    }
  }

  function hasAddon(keyOrSlug) {
    if (!keyOrSlug) return true
    const match = addons.value.find(a => a.key === keyOrSlug || a.slug === keyOrSlug)
    if (!match) return true
    return Boolean(match.isActivated)
  }

  function triggerAddonGatePrompt(key, name = '') {
    const match = addons.value.find(a => a.key === key || a.slug === key)
    addonModalData.value = {
      key,
      name: name || match?.name || key,
      description: match?.description || 'This feature requires activating the official free addon.',
      isFree: true,
    }
    showAddonModal.value = true
  }

  async function activateAddon(keyOrSlug) {
    try {
      const res = await apiFetch('/api/store/addons/activate', {
        method: 'POST',
        body: { addonKey: keyOrSlug, action: 'activate' },
      })
      if (res?.data) {
        const match = addons.value.find(a => a.key === keyOrSlug || a.slug === keyOrSlug)
        if (match) match.isActivated = true
        if (res.data.activatedKeys && Array.isArray(res.data.activatedKeys)) {
          res.data.activatedKeys.forEach(k => {
            const m = addons.value.find(a => a.key === k || a.slug === k)
            if (m) m.isActivated = true
          })
        }
        toast.success(res.data.message || 'Free addon activated!')
        showAddonModal.value = false
        return true
      }
      return false
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to activate addon.')
      return false
    }
  }

  async function deactivateAddon(keyOrSlug) {
    try {
      const res = await apiFetch('/api/store/addons/activate', {
        method: 'POST',
        body: { addonKey: keyOrSlug, action: 'deactivate' },
      })
      if (res?.data) {
        const match = addons.value.find(a => a.key === keyOrSlug || a.slug === keyOrSlug)
        if (match) match.isActivated = false
        toast.info(res.data.message || 'Addon deactivated. Your data is safely preserved.')
        return true
      }
      return false
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to deactivate addon.')
      return false
    }
  }

  // ── Income Sources Actions ────────────────────────────────────────────────
  async function fetchIncomeSources() {
    try {
      const res = await apiFetch('/api/income-sources')
      if (res?.data && Array.isArray(res.data)) {
        incomeSources.value = res.data
        saveCachedState()
      }
      return incomeSources.value
    } catch (e) {
      console.warn('[Wello IncomeSources] Could not fetch', e)
      return incomeSources.value
    }
  }

  async function createIncomeSource(data) {
    const tempId = 'temp_src_' + uid()
    const optimistic = {
      id: tempId,
      ...data,
      isArchived: false,
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    }
    const snapshot = [...incomeSources.value]
    incomeSources.value.push(optimistic)
    saveCachedState()

    try {
      const res = await apiFetch('/api/income-sources', {
        method: 'POST',
        body: data,
      })
      if (res?.data) {
        const idx = incomeSources.value.findIndex(s => s.id === tempId)
        if (idx !== -1) incomeSources.value[idx] = res.data
        saveCachedState()
        toast.success(`Income source "${res.data.name}" created.`)
        return res.data
      }
      return optimistic
    } catch (err) {
      incomeSources.value = snapshot
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to create income source.')
      throw err
    }
  }

  async function updateIncomeSource(id, data) {
    const idx = incomeSources.value.findIndex(s => String(s.id) === String(id))
    if (idx === -1) return false
    const previous = { ...incomeSources.value[idx] }
    incomeSources.value[idx] = { ...previous, ...data }
    saveCachedState()

    try {
      const res = await apiFetch(`/api/income-sources/${id}`, {
        method: 'PATCH',
        body: data,
      })
      if (res?.data) {
        incomeSources.value[idx] = { ...incomeSources.value[idx], ...res.data }
        saveCachedState()
        toast.success('Income source updated.')
        return res.data
      }
      return true
    } catch (err) {
      incomeSources.value[idx] = previous
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to update income source.')
      return false
    }
  }

  async function deleteIncomeSource(id) {
    const snapshot = [...incomeSources.value]
    incomeSources.value = incomeSources.value.filter(s => String(s.id) !== String(id))
    saveCachedState()

    try {
      await apiFetch(`/api/income-sources/${id}`, { method: 'DELETE' })
      toast.success('Income source removed.')
      return true
    } catch (err) {
      incomeSources.value = snapshot
      saveCachedState()
      toast.error('Failed to remove income source.')
      return false
    }
  }

  // ── Overhead Expenses Actions ─────────────────────────────────────────────
  async function fetchOverheadExpenses() {
    try {
      const res = await apiFetch('/api/overhead-expenses')
      if (res?.data && Array.isArray(res.data)) {
        overheadExpenses.value = res.data
        saveCachedState()
      }
      return overheadExpenses.value
    } catch (e) {
      console.warn('[Wello Overhead] Could not fetch', e)
      return overheadExpenses.value
    }
  }

  async function createOverheadExpense(data) {
    const tempId = 'temp_oh_' + uid()
    const optimistic = {
      id: tempId,
      ...data,
      createdAt: now(),
      updatedAt: now(),
    }
    const snapshot = [...overheadExpenses.value]
    overheadExpenses.value.push(optimistic)
    saveCachedState()

    try {
      const res = await apiFetch('/api/overhead-expenses', {
        method: 'POST',
        body: data,
      })
      if (res?.data) {
        const idx = overheadExpenses.value.findIndex(o => o.id === tempId)
        if (idx !== -1) overheadExpenses.value[idx] = res.data
        saveCachedState()
        toast.success(`Overhead "${res.data.name}" added.`)
        return res.data
      }
      return optimistic
    } catch (err) {
      overheadExpenses.value = snapshot
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to record overhead expense.')
      throw err
    }
  }

  async function updateOverheadExpense(id, data) {
    const idx = overheadExpenses.value.findIndex(o => String(o.id) === String(id))
    if (idx === -1) return false
    const previous = { ...overheadExpenses.value[idx] }
    overheadExpenses.value[idx] = { ...previous, ...data }
    saveCachedState()

    try {
      const res = await apiFetch(`/api/overhead-expenses/${id}`, {
        method: 'PATCH',
        body: data,
      })
      if (res?.data) {
        overheadExpenses.value[idx] = { ...overheadExpenses.value[idx], ...res.data }
        saveCachedState()
        toast.success('Overhead updated.')
        return res.data
      }
      return true
    } catch (err) {
      overheadExpenses.value[idx] = previous
      saveCachedState()
      toast.error(err?.data?.message || err?.message || 'Failed to update overhead.')
      return false
    }
  }

  async function deleteOverheadExpense(id) {
    const snapshot = [...overheadExpenses.value]
    overheadExpenses.value = overheadExpenses.value.filter(o => String(o.id) !== String(id))
    saveCachedState()

    try {
      await apiFetch(`/api/overhead-expenses/${id}`, { method: 'DELETE' })
      toast.success('Overhead removed.')
      return true
    } catch (err) {
      overheadExpenses.value = snapshot
      saveCachedState()
      toast.error('Failed to delete overhead expense.')
      return false
    }
  }

  // ── Quick Entry Flow ──────────────────────────────────────────────────────
  async function quickEntry(data) {
    isLoading.value = true
    try {
      const res = await apiFetch('/api/quick-entry', {
        method: 'POST',
        body: data,
      })
      if (res?.data) {
        if (res.data.session) {
          sessions.value.push({
            ...res.data.session,
            durationMin: res.data.session.durationMinutes || Math.round((res.data.session.durationSeconds || 0) / 60),
          })
        }
        if (res.data.payment) {
          payments.value.push(res.data.payment)
        }
        saveCachedState()
        toast.success('Logged successfully!')
        return res.data
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to log quick entry.')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ── Expected Payments Flow ────────────────────────────────────────────────
  async function fetchExpectedPayments() {
    try {
      const res = await apiFetch('/api/expected-payments')
      if (res?.data) {
        expectedPayments.value = res.data.expectedPayments || []
        recurringProposals.value = res.data.recurringProposals || []
        saveCachedState()
      }
    } catch (err) {
      console.warn('[Wello ExpectedPayments] Could not fetch', err)
    }
  }

  async function confirmExpectedPayment(data) {
    isLoading.value = true
    try {
      const res = await apiFetch('/api/expected-payments/confirm', {
        method: 'POST',
        body: data,
      })
      if (res?.data) {
        const confirmed = res.data
        const idx = payments.value.findIndex(p => String(p.id) === String(confirmed.id))
        if (idx !== -1) {
          payments.value[idx] = confirmed
        } else {
          payments.value.push(confirmed)
        }
        expectedPayments.value = expectedPayments.value.filter(p => String(p.id) !== String(confirmed.id))
        if (data.incomeSourceId) {
          recurringProposals.value = recurringProposals.value.filter(r => String(r.incomeSourceId) !== String(data.incomeSourceId))
        }
        saveCachedState()
        toast.success('Payment confirmed and added to your collected earnings!')
        return confirmed
      }
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to confirm payment.')
      throw err
    } finally {
      isLoading.value = false
    }
  }

  // ── Earning Persona & Settings ────────────────────────────────────────────
  async function updateEarningPersona(persona) {
    try {
      const res = await apiFetch('/api/me', {
        method: 'PATCH',
        body: { earningPersona: persona },
      })
      if (res?.data) {
        user.value.earningPersona = res.data.earningPersona
        saveCachedState()
        toast.success('Earning profile updated!')
      }
    } catch (err) {
      toast.error('Failed to update persona.')
    }
  }

  async function toggleIncludeOverhead(include) {
    try {
      const res = await apiFetch('/api/me', {
        method: 'PATCH',
        body: { includeOverheadInMetrics: include },
      })
      if (res?.data) {
        user.value.includeOverheadInMetrics = res.data.includeOverheadInMetrics
        saveCachedState()
      }
    } catch (err) {}
  }

  // ── Computed Getters for Income Sources & Analytics ───────────────────────
  const activeIncomeSources = computed(() => {
    return incomeSources.value.filter(s => !s.isArchived && s.status !== 'archived')
  })

  const incomeSourcesBreakdown = computed(() => {
    return computeIncomeSourceMetrics(
      incomeSources.value,
      sessions.value,
      payments.value,
      expenses.value,
      overheadExpenses.value,
      user.value.baseCurrency || 'USD',
      { includeOverhead: user.value.includeOverheadInMetrics !== false }
    )
  })

  const salariedCommuteSummary = computed(() => {
    return computeSalariedCommuteAnalysis(
      incomeSources.value,
      sessions.value,
      payments.value,
      overheadExpenses.value,
      user.value.baseCurrency || 'USD'
    )
  })

  const multiEmployerComparison = computed(() => {
    return computeMultiEmployerComparison(
      incomeSources.value,
      incomeSourcesBreakdown.value,
      user.value.baseCurrency || 'USD'
    )
  })

  // ── Notifications Engine Actions ──────────────────────────────────────────
  async function fetchNotifications({ unreadOnly = false, limit = 30 } = {}) {
    if (!authStore.isAuthenticated) return { notifications: [], unreadCount: 0 }
    isNotificationsLoading.value = true
    try {
      const res = await apiFetch(`/api/notifications?unreadOnly=${unreadOnly}&limit=${limit}`)
      if (res?.data) {
        notifications.value = res.data.notifications || []
        unreadNotificationCount.value = res.data.unreadCount || 0
      }
      return { notifications: notifications.value, unreadCount: unreadNotificationCount.value }
    } catch (err) {
      console.warn('[Wello Notifications] Could not fetch notifications', err)
      return { notifications: notifications.value, unreadCount: unreadNotificationCount.value }
    } finally {
      isNotificationsLoading.value = false
    }
  }

  async function markNotificationAsRead(id) {
    const item = notifications.value.find(n => String(n.id) === String(id))
    if (item && !item.isRead) {
      item.isRead = true
      item.readAt = now()
      if (unreadNotificationCount.value > 0) unreadNotificationCount.value--
    }
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      return true
    } catch (err) {
      console.warn('[Wello Notifications] Error marking read', err)
      return false
    }
  }

  async function markAllNotificationsAsRead() {
    notifications.value.forEach(n => {
      n.isRead = true
      n.readAt = now()
    })
    unreadNotificationCount.value = 0
    try {
      await apiFetch('/api/notifications/mark-all-read', { method: 'POST' })
      toast.success('All notifications marked as read.')
      return true
    } catch (err) {
      console.warn('[Wello Notifications] Error marking all read', err)
      return false
    }
  }

  async function deleteNotification(id) {
    const item = notifications.value.find(n => String(n.id) === String(id))
    if (item && !item.isRead && unreadNotificationCount.value > 0) {
      unreadNotificationCount.value--
    }
    notifications.value = notifications.value.filter(n => String(n.id) !== String(id))
    try {
      await apiFetch(`/api/notifications/${id}`, { method: 'DELETE' })
      return true
    } catch (err) {
      console.warn('[Wello Notifications] Error deleting notification', err)
      return false
    }
  }

  async function fetchNotificationPreferences() {
    try {
      const res = await apiFetch('/api/notifications/preferences')
      if (res?.data?.preferences) {
        notificationPreferences.value = res.data.preferences
      }
      return notificationPreferences.value
    } catch (err) {
      console.warn('[Wello Notifications] Error fetching preferences', err)
      return notificationPreferences.value
    }
  }

  async function saveNotificationPreferences(prefs) {
    try {
      const res = await apiFetch('/api/notifications/preferences', {
        method: 'PUT',
        body: { preferences: prefs }
      })
      if (res?.data) {
        notificationPreferences.value = prefs
        toast.success('Notification preferences updated!')
        return true
      }
    } catch (err) {
      toast.error('Failed to update notification preferences.')
      return false
    }
  }

  // ── Pricing Calculator & Reports Actions ──────────────────────────────────
  async function calculatePricing(payload) {
    try {
      const res = await apiFetch('/api/calculator/pricing', {
        method: 'POST',
        body: payload,
      })
      return res?.data || null
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to calculate pricing.')
      throw err
    }
  }

  async function applyQuoteToProject(payload) {
    try {
      const res = await apiFetch('/api/calculator/apply-quote', {
        method: 'POST',
        body: payload,
      })
      if (res?.data?.project) {
        const updated = res.data.project
        const idx = projects.value.findIndex(p => String(p.id) === String(updated.id))
        if (idx !== -1) {
          projects.value[idx] = { ...projects.value[idx], ...updated }
        }
        saveCachedState()
        toast.success('Quote applied to project successfully!')
        return updated
      }
      return null
    } catch (err) {
      toast.error(err?.data?.message || err?.message || 'Failed to apply quote to project.')
      throw err
    }
  }

  async function fetchReportsSummary(params = {}) {
    const query = new URLSearchParams()
    if (params.period) query.set('period', params.period)
    if (params.date) query.set('date', params.date)
    if (params.startDate) query.set('startDate', params.startDate)
    if (params.endDate) query.set('endDate', params.endDate)
    const res = await apiFetch(`/api/reports/summary?${query.toString()}`)
    return res?.data || null
  }

  function resetToDefaults() {
    user.value = { ...SAMPLE_USER }
    clients.value = [...SAMPLE_CLIENTS]
    projects.value = [...SAMPLE_PROJECTS]
    sessions.value = [...SAMPLE_SESSIONS]
    payments.value = [...SAMPLE_PAYMENTS]
    expenses.value = [...SAMPLE_EXPENSES]
    incomeSources.value = []
    overheadExpenses.value = []
    expectedPayments.value = []
    recurringProposals.value = []
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
    incomeSources,
    overheadExpenses,
    overheads: overheadExpenses,
    expectedPayments,
    recurringProposals,
    taxRates,
    fxRates,
    notifications,
    unreadNotificationCount,
    notificationPreferences,
    isNotificationsLoading,
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
    activeIncomeSources,
    incomeSourcesBreakdown,
    salariedCommuteSummary,
    multiEmployerComparison,

    // Authoritative Metrics & Taxonomy Engine
    computeUnifiedMetricsSummary,
    computeIntelligenceInsights,
    computeIncomeSourceMetrics,
    computeSalariedCommuteAnalysis,
    computeMultiEmployerComparison,
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

    // Income Sources & Non-Project Actions
    fetchIncomeSources,
    createIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    fetchOverheadExpenses,
    fetchOverheads: fetchOverheadExpenses,
    createOverheadExpense,
    createOverhead: createOverheadExpense,
    updateOverheadExpense,
    updateOverhead: updateOverheadExpense,
    deleteOverheadExpense,
    deleteOverhead: deleteOverheadExpense,
    quickEntry,
    fetchExpectedPayments,
    confirmExpectedPayment,
    updateEarningPersona,
    toggleIncludeOverhead,

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

    // Notifications Engine
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    fetchNotificationPreferences,
    saveNotificationPreferences,

    // Offline Outbox & Conflict Resolution
    outbox,
    pendingOutboxCount,
    activeConflict,
    flushOutbox,
    dismissConflict,
    resolveConflict,

    // Addon Platform & Store Actions (100% Free Addons)
    addons,
    showAddonModal,
    addonModalData,
    fetchAddons,
    hasAddon,
    triggerAddonGatePrompt,
    activateAddon,
    deactivateAddon,

    // Pricing Calculator & Reporting
    calculatePricing,
    applyQuoteToProject,
    fetchReportsSummary,

    // Trust, Privacy, Export/Import, Lifecycle & Support Actions
    showFeedbackModal,
    showOnboardingWizard,
    privacySettings,
    submitFeedback,
    fetchPrivacySettings,
    updatePrivacySettings,
    exportAllZip,
    exportJson,
    exportCsv,
    previewImport,
    executeImport,
    deleteAccount,
    cancelAccountDeletion,
    resetWorkData,
    completeOnboarding,

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
    fetchSessionHistory,
    createClient,
    updateClient,
    deleteClient,
    updateProfile,
    resetToDefaults,
  }

  // ── Trust & Lifecycle Action Implementations ─────────────────────────────────

  async function submitFeedback(payload) {
    const res = await apiFetch('/api/feedback', {
      method: 'POST',
      body: payload,
    })
    return res
  }

  async function fetchPrivacySettings() {
    const res = await apiFetch('/api/me/privacy')
    if (res?.data) {
      privacySettings.value = res.data
    }
    return privacySettings.value
  }

  async function updatePrivacySettings(settings) {
    const res = await apiFetch('/api/me/privacy', {
      method: 'POST',
      body: settings,
    })
    if (res?.data) {
      privacySettings.value = { ...privacySettings.value, ...res.data }
      user.value.analyticsConsent = res.data.analyticsConsent
      user.value.cookieConsent = res.data.cookieConsent
      user.value.digestFrequency = res.data.digestFrequency
    }
    return res
  }

  async function exportAllZip() {
    const token = authStore.token
    const res = await fetch('/api/export/all', {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wello-backup-${new Date().toISOString().slice(0, 10)}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  async function exportJson() {
    const token = authStore.token
    const res = await fetch('/api/export/json', {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wello-export-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  async function exportCsv(entity = 'sessions') {
    const token = authStore.token
    const res = await fetch(`/api/export/csv?entity=${entity}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wello-${entity}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  async function previewImport(csvText, targetEntity, mapping) {
    const res = await apiFetch('/api/import/preview', {
      method: 'POST',
      body: { csvText, targetEntity, mapping },
    })
    return res?.data || res
  }

  async function executeImport(csvText, entityType, mapping) {
    const res = await apiFetch('/api/import/execute', {
      method: 'POST',
      body: { csvText, entityType, mapping },
    })
    await loadInitialData()
    return res?.data || res
  }

  async function deleteAccount(gracePeriodDays = 14) {
    const res = await apiFetch('/api/me/delete-account', {
      method: 'POST',
      body: { gracePeriodDays },
    })
    if (res?.data) {
      user.value.status = 'pending_deletion'
      user.value.scheduledDeletionAt = res.data.scheduledDeletionAt
    }
    return res
  }

  async function cancelAccountDeletion() {
    const res = await apiFetch('/api/me/cancel-deletion', {
      method: 'POST',
    })
    if (res) {
      user.value.status = 'active'
      user.value.scheduledDeletionAt = null
    }
    return res
  }

  async function resetWorkData() {
    const res = await apiFetch('/api/me/reset-work-data', {
      method: 'POST',
    })
    sessions.value = []
    payments.value = []
    expenses.value = []
    projects.value = []
    clients.value = []
    incomeSources.value = []
    overheadExpenses.value = []
    expectedPayments.value = []
    saveCachedState()
    return res
  }

  async function completeOnboarding(onboardingData) {
    const res = await apiFetch('/api/me', {
      method: 'PATCH',
      body: onboardingData,
    })
    if (res?.data) {
      user.value = { ...user.value, ...res.data }
      saveCachedState()
    }
    return res
  }
})
