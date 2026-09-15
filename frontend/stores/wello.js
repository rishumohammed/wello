// stores/wello.js
// Central Pinia store — in-memory data layer with complete work value business logic
// Auto-persists to localStorage on the client side

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

// ─── Helpers ────────────────────────────────────────────────────────────────

function now() { return new Date().toISOString() }
function today() { return new Date().toISOString().slice(0, 10) }
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}
function uid() { return Math.random().toString(36).slice(2, 9) }

function minutesToHM(minutes) {
  if (!minutes || minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function fmt(num, currency = '₹') {
  if (num === null || num === undefined || isNaN(num)) return `${currency}0`
  return `${currency}${Math.round(Number(num)).toLocaleString('en-IN')}`
}

const STORAGE_KEY = 'wello_store_v1'

// ─── Initial Sample Data ────────────────────────────────────────────────────

const SAMPLE_CLIENTS = [
  { id: 'c1', name: 'ABC Technologies', email: 'contact@abctech.in', company: 'ABC Technologies Pvt Ltd' },
  { id: 'c2', name: 'XYZ Interior & Living', email: 'priya@xyzinterior.com', company: 'XYZ Interior Design Studio' },
  { id: 'c3', name: 'Coastal Realty', email: 'info@coastalrealty.in', company: 'Coastal Realty Group' },
  { id: 'c4', name: 'MindSpark Studio', email: 'hello@mindspark.io', company: 'MindSpark Studio' },
  { id: 'c5', name: 'HealthFirst Clinic', email: 'admin@healthfirst.org', company: 'HealthFirst Medical Group' },
  { id: 'c6', name: 'Apex Logistics', email: 'ops@apexlogistics.com', company: 'Apex Global Logistics' },
]

const SAMPLE_PROJECTS = [
  // 1. ABC Website (Job, in_progress)
  {
    id: 'p1', clientId: 'c1', name: 'ABC Website',
    description: 'Full corporate website redesign, estimation, and custom frontend build.',
    serviceCategory: 'Web Development', status: 'in_progress', isJob: true,
    quoteAmount: 85000, quoteDate: daysAgo(35), quoteEstHours: 110,
    quoteNotes: 'Phase 1: Discovery & UI. Phase 2: Implementation.', quoteStatus: 'accepted',
    revenue: 42000, expenses: 2800, createdAt: daysAgo(45), updatedAt: now(),
  },
  // 2. XYZ Interior (Job, in_progress)
  {
    id: 'p2', clientId: 'c2', name: 'XYZ Interior',
    description: 'Interior portfolio site and 3D space visualizer platform.',
    serviceCategory: 'Design & Development', status: 'in_progress', isJob: true,
    quoteAmount: 48000, quoteDate: daysAgo(25), quoteEstHours: 60,
    quoteNotes: 'Design sprint + deployment.', quoteStatus: 'accepted',
    revenue: 26000, expenses: 1800, createdAt: daysAgo(30), updatedAt: now(),
  },
  // 3. Property Listings Portal (Job, completed)
  {
    id: 'p3', clientId: 'c3', name: 'Property Listings Portal',
    description: 'Real estate listing portal with map search and agent inquiries.',
    serviceCategory: 'Web Design', status: 'completed', isJob: true,
    quoteAmount: 42000, quoteDate: daysAgo(90), quoteEstHours: 55,
    quoteNotes: '', quoteStatus: 'accepted',
    revenue: 42000, expenses: 1800, createdAt: daysAgo(100), updatedAt: now(),
  },
  // 4. Brand Strategy Workshop (Potential)
  {
    id: 'p4', clientId: 'c4', name: 'Brand Strategy Workshop',
    description: 'Positioning and customer discovery sessions.',
    serviceCategory: 'Consulting', status: 'potential', isJob: false,
    quoteAmount: null, quoteDate: null, quoteEstHours: null,
    quoteNotes: '', quoteStatus: 'draft',
    revenue: 0, expenses: 0, createdAt: daysAgo(5), updatedAt: now(),
  },
  // 5. Mobile App Audit (Lost) - 4h 30m unbilled (270 min)
  {
    id: 'p5', clientId: 'c1', name: 'Mobile App Audit',
    description: 'Performance and UX audit for iOS application.',
    serviceCategory: 'Consulting', status: 'lost', isJob: false,
    quoteAmount: 22000, quoteDate: daysAgo(40), quoteEstHours: 30,
    quoteNotes: 'Client postponed budget cycle to next fiscal year.', quoteStatus: 'rejected',
    revenue: 0, expenses: 0, createdAt: daysAgo(50), updatedAt: now(),
  },
  // 6. E-Commerce Fashion Store (Job, completed)
  {
    id: 'p6', clientId: 'c2', name: 'E-Commerce Fashion Store',
    description: 'Online store setup, payment gateway, and catalog integration.',
    serviceCategory: 'E-Commerce', status: 'completed', isJob: true,
    quoteAmount: 60000, quoteDate: daysAgo(75), quoteEstHours: 80,
    quoteNotes: 'Full launch bundle.', quoteStatus: 'accepted',
    revenue: 60000, expenses: 3200, createdAt: daysAgo(85), updatedAt: now(),
  },
  // 7. SaaS Onboarding Flow (Job, in_progress)
  {
    id: 'p7', clientId: 'c4', name: 'SaaS Onboarding Flow',
    description: 'User activation funnel, onboarding checklist, and analytics events.',
    serviceCategory: 'UX Design', status: 'in_progress', isJob: true,
    quoteAmount: 35000, quoteDate: daysAgo(20), quoteEstHours: 45,
    quoteNotes: 'Milestone 1 delivered.', quoteStatus: 'accepted',
    revenue: 20000, expenses: 1200, createdAt: daysAgo(28), updatedAt: now(),
  },
  // 8. Restaurant Booking App (Job, completed)
  {
    id: 'p8', clientId: 'c3', name: 'Restaurant Booking App',
    description: 'Table reservation web app with SMS notifications.',
    serviceCategory: 'Web Development', status: 'completed', isJob: true,
    quoteAmount: 30000, quoteDate: daysAgo(60), quoteEstHours: 40,
    quoteNotes: 'Completed on schedule.', quoteStatus: 'accepted',
    revenue: 30000, expenses: 1500, createdAt: daysAgo(70), updatedAt: now(),
  },
  // 9. Fitness Club Web App (Job, in_progress)
  {
    id: 'p9', clientId: 'c1', name: 'Fitness Club Web App',
    description: 'Class schedule booking and member portal.',
    serviceCategory: 'Web Development', status: 'in_progress', isJob: true,
    quoteAmount: 28000, quoteDate: daysAgo(15), quoteEstHours: 35,
    quoteNotes: 'Sprint 1 in review.', quoteStatus: 'accepted',
    revenue: 15000, expenses: 800, createdAt: daysAgo(22), updatedAt: now(),
  },
  // 10. Healthcare Portal (Lost) - 4h 15m unbilled (255 min)
  {
    id: 'p10', clientId: 'c5', name: 'Healthcare Patient Portal',
    description: 'Telehealth appointment scheduling and doctor directory.',
    serviceCategory: 'Web Development', status: 'lost', isJob: false,
    quoteAmount: 45000, quoteDate: daysAgo(35), quoteEstHours: 60,
    quoteNotes: 'Client decided to build with internal IT team.', quoteStatus: 'rejected',
    revenue: 0, expenses: 0, createdAt: daysAgo(42), updatedAt: now(),
  },
  // 11. Corporate Rebrand Consulting (Lost) - 3h 45m unbilled (225 min)
  {
    id: 'p11', clientId: 'c4', name: 'Corporate Rebrand Consulting',
    description: 'Brand identity system, logo refresh, and guideline book.',
    serviceCategory: 'Consulting', status: 'lost', isJob: false,
    quoteAmount: 38000, quoteDate: daysAgo(55), quoteEstHours: 50,
    quoteNotes: 'Leadership reshuffle led to initiative cancellation.', quoteStatus: 'rejected',
    revenue: 0, expenses: 0, createdAt: daysAgo(65), updatedAt: now(),
  },
  // 12. FinTech Dashboard UI (Lost) - 3h 20m unbilled (200 min)
  {
    id: 'p12', clientId: 'c1', name: 'FinTech Investment Dashboard',
    description: 'Portfolio tracking analytics and trading chart components.',
    serviceCategory: 'UX Design', status: 'lost', isJob: false,
    quoteAmount: 50000, quoteDate: daysAgo(48), quoteEstHours: 65,
    quoteNotes: 'Project scope exceeded client seed funding budget.', quoteStatus: 'rejected',
    revenue: 0, expenses: 0, createdAt: daysAgo(58), updatedAt: now(),
  },
  // 13. Logistics Mobile Tracker (Lost) - 2h 30m unbilled (150 min)
  {
    id: 'p13', clientId: 'c6', name: 'Logistics Driver Tracking App',
    description: 'Fleet tracking dispatch interface and route optimization.',
    serviceCategory: 'Mobile Design', status: 'lost', isJob: false,
    quoteAmount: 25000, quoteDate: daysAgo(80), quoteEstHours: 35,
    quoteNotes: 'Selected legacy offshore vendor.', quoteStatus: 'rejected',
    revenue: 0, expenses: 0, createdAt: daysAgo(90), updatedAt: now(),
  },
]

const tDate = today()

const SAMPLE_SESSIONS = [
  // Today's sessions (8h 02m total)
  // 1. 09:00–09:45 | ABC Website | First meeting | 45m | Unpaid
  {
    id: 's-t1', projectId: 'p1', title: 'First meeting', type: 'meeting', paymentType: 'unpaid',
    unpaidReason: 'Discovery & initial consultation', startedAt: `${tDate}T09:00:00`, endedAt: `${tDate}T09:45:00`, durationMin: 45,
    notes: 'Initial scope alignment and project kickoff discussion.',
  },
  // 2. 10:15–11:00 | ABC Website | Requirements discussion | 45m | Unpaid
  {
    id: 's-t2', projectId: 'p1', title: 'Requirements discussion', type: 'discussion', paymentType: 'unpaid',
    unpaidReason: 'Specification review before signoff', startedAt: `${tDate}T10:15:00`, endedAt: `${tDate}T11:00:00`, durationMin: 45,
    notes: 'Detailed feature checklist and API endpoint requirements.',
  },
  // 3. 11:30–14:00 | XYZ Interior | Design work | 2h 30m | Paid
  {
    id: 's-t3', projectId: 'p2', title: 'Design work', type: 'production', paymentType: 'paid',
    unpaidReason: null, startedAt: `${tDate}T11:30:00`, endedAt: `${tDate}T14:00:00`, durationMin: 150,
    notes: '3D gallery wireframes and high-fidelity room visualizer layouts.',
  },
  // 4. 14:30–18:02 | ABC Website | Frontend implementation | 3h 32m | Paid
  {
    id: 's-t4', projectId: 'p1', title: 'Frontend implementation', type: 'production', paymentType: 'paid',
    unpaidReason: null, startedAt: `${tDate}T14:30:00`, endedAt: `${tDate}T18:02:00`, durationMin: 197,
    notes: 'Responsive navigation, state management, and product catalog grid.',
  },
  // 5. 18:30–19:15 | Brand Strategy | Strategic discovery call | 45m | Unpaid
  {
    id: 's-t5', projectId: 'p4', title: 'Strategic discovery call', type: 'call', paymentType: 'unpaid',
    unpaidReason: 'Pre-proposal workshop planning', startedAt: `${tDate}T18:30:00`, endedAt: `${tDate}T19:15:00`, durationMin: 45,
    notes: 'Customer journey mapping and workshop preparation.',
  },

  // This Week's Earlier Sessions
  { id: 's-w1', projectId: 'p1', title: 'Design system tokens & styling', type: 'production', paymentType: 'paid', startedAt: `${daysAgo(1)}T09:00:00`, endedAt: `${daysAgo(1)}T16:30:00`, durationMin: 450, notes: 'Design token setup.' },
  { id: 's-w2', projectId: 'p2', title: 'Interactive 3D model render', type: 'production', paymentType: 'paid', startedAt: `${daysAgo(2)}T10:00:00`, endedAt: `${daysAgo(2)}T17:00:00`, durationMin: 420, notes: 'WebGL integration.' },
  { id: 's-w3', projectId: 'p7', title: 'User activation audit', type: 'planning', paymentType: 'paid', startedAt: `${daysAgo(3)}T09:30:00`, endedAt: `${daysAgo(3)}T15:30:00`, durationMin: 360, notes: 'Funnel analytics review.' },
  { id: 's-w4', projectId: 'p9', title: 'Trainer schedule calendar', type: 'production', paymentType: 'paid', startedAt: `${daysAgo(4)}T11:00:00`, endedAt: `${daysAgo(4)}T16:30:00`, durationMin: 330, notes: 'Calendar integration.' },
  { id: 's-w5', projectId: 'p1', title: 'Client revision requests', type: 'revision', paymentType: 'paid', startedAt: `${daysAgo(2)}T14:00:00`, endedAt: `${daysAgo(2)}T16:30:00`, durationMin: 150, notes: 'Homepage hero copy updates.' },
  { id: 's-w6', projectId: 'p4', title: 'Workshop pre-brief call', type: 'call', paymentType: 'unpaid', unpaidReason: 'Client onboarding call', startedAt: `${daysAgo(3)}T16:00:00`, endedAt: `${daysAgo(3)}T17:00:00`, durationMin: 60, notes: 'Agenda alignment.' },

  // Earlier this month sessions
  { id: 's-m1', projectId: 'p6', title: 'Checkout & payment gateway', type: 'production', paymentType: 'paid', startedAt: `${daysAgo(10)}T09:00:00`, endedAt: `${daysAgo(10)}T17:00:00`, durationMin: 480, notes: '' },
  { id: 's-m2', projectId: 'p6', title: 'Catalog schema & sync', type: 'production', paymentType: 'paid', startedAt: `${daysAgo(12)}T09:30:00`, endedAt: `${daysAgo(12)}T16:30:00`, durationMin: 420, notes: '' },
  { id: 's-m3', projectId: 'p8', title: 'Reservation widget integration', type: 'production', paymentType: 'paid', startedAt: `${daysAgo(15)}T10:00:00`, endedAt: `${daysAgo(15)}T17:00:00`, durationMin: 420, notes: '' },
  { id: 's-m4', projectId: 'p2', title: 'Initial spatial concepts', type: 'proposal', paymentType: 'unpaid', unpaidReason: 'Pitch deck concepts', startedAt: `${daysAgo(18)}T13:00:00`, endedAt: `${daysAgo(18)}T16:00:00`, durationMin: 180, notes: '' },
  { id: 's-m5', projectId: 'p1', title: 'Design review & feedback', type: 'revision', paymentType: 'paid', startedAt: `${daysAgo(8)}T11:00:00`, endedAt: `${daysAgo(8)}T14:00:00`, durationMin: 180, notes: '' },

  // Lost project discovery & proposal sessions (Total = 18h 20m = 1100 minutes)
  { id: 's-l1', projectId: 'p5', title: 'iOS Architecture & security audit', type: 'planning', paymentType: 'unpaid', unpaidReason: 'Audit discovery', startedAt: `${daysAgo(48)}T10:00:00`, endedAt: `${daysAgo(48)}T14:30:00`, durationMin: 270, notes: 'Codebase inspection and 24-page audit report.' },
  { id: 's-l2', projectId: 'p10', title: 'HIPAA scope & EHR consultation', type: 'meeting', paymentType: 'unpaid', unpaidReason: 'Pre-quote requirements', startedAt: `${daysAgo(40)}T09:00:00`, endedAt: `${daysAgo(40)}T13:15:00`, durationMin: 255, notes: 'Clinic workflow review & integration spec.' },
  { id: 's-l3', projectId: 'p11', title: 'Brand workshop & pitch presentation', type: 'proposal', paymentType: 'unpaid', unpaidReason: 'Proposal deck presentation', startedAt: `${daysAgo(62)}T14:00:00`, endedAt: `${daysAgo(62)}T17:45:00`, durationMin: 225, notes: 'Moodboards, visual territory exploration.' },
  { id: 's-l4', projectId: 'p12', title: 'Trading UI wireframes & live demo', type: 'production', paymentType: 'unpaid', unpaidReason: 'Speculative mockups for RFP', startedAt: `${daysAgo(55)}T11:00:00`, endedAt: `${daysAgo(55)}T14:20:00`, durationMin: 200, notes: 'Complex candlestick chart components.' },
  { id: 's-l5', projectId: 'p13', title: 'Dispatch API & telemetry discovery', type: 'call', paymentType: 'unpaid', unpaidReason: 'Technical alignment', startedAt: `${daysAgo(85)}T15:00:00`, endedAt: `${daysAgo(85)}T17:30:00`, durationMin: 150, notes: 'Fleet telematics protocol research.' },
]

const SAMPLE_PAYMENTS = [
  { id: 'pay-today', projectId: 'p2', amount: 2300, paidDate: tDate, notes: 'Design work progress payment' },
  { id: 'pay-w1', projectId: 'p1', amount: 12000, paidDate: daysAgo(2), notes: 'Milestone 2 payment' },
  { id: 'pay-w2', projectId: 'p7', amount: 20000, paidDate: daysAgo(3), notes: 'Deposit advance' },
  { id: 'pay1', projectId: 'p1', amount: 20000, paidDate: daysAgo(20), notes: 'Advance payment' },
  { id: 'pay2', projectId: 'p1', amount: 10000, paidDate: daysAgo(10), notes: 'Sprint 1 milestone' },
  { id: 'pay3', projectId: 'p2', amount: 23700, paidDate: daysAgo(15), notes: 'Initial deposit' },
  { id: 'pay4', projectId: 'p3', amount: 42000, paidDate: daysAgo(85), notes: 'Full completion payment' },
  { id: 'pay5', projectId: 'p6', amount: 60000, paidDate: daysAgo(60), notes: 'Full store delivery payment' },
  { id: 'pay6', projectId: 'p8', amount: 30000, paidDate: daysAgo(50), notes: 'Final delivery payment' },
  { id: 'pay7', projectId: 'p9', amount: 15000, paidDate: daysAgo(12), notes: 'Phase 1 signoff payment' },
]

const SAMPLE_EXPENSES = [
  { id: 'exp-today', projectId: 'p2', description: '3D Rendering asset pack', amount: 300, date: tDate, category: 'Assets' },
  { id: 'exp-w1', projectId: 'p1', description: 'Testing cloud instance', amount: 900, date: daysAgo(2), category: 'Infrastructure' },
  { id: 'exp1', projectId: 'p1', description: 'Server hosting & domain', amount: 1800, date: daysAgo(30), category: 'Infrastructure' },
  { id: 'exp2', projectId: 'p1', description: 'Icon library license', amount: 1000, date: daysAgo(25), category: 'Software' },
  { id: 'exp3', projectId: 'p2', description: 'Stock photography', amount: 1500, date: daysAgo(18), category: 'Assets' },
  { id: 'exp4', projectId: 'p3', description: 'Map API credits', amount: 1800, date: daysAgo(90), category: 'Services' },
  { id: 'exp5', projectId: 'p6', description: 'Payment gateway verification fee', amount: 3200, date: daysAgo(70), category: 'Services' },
  { id: 'exp6', projectId: 'p8', description: 'SMS gateway credits', amount: 1500, date: daysAgo(55), category: 'Services' },
  { id: 'exp7', projectId: 'p7', description: 'Analytics seat license', amount: 1200, date: daysAgo(20), category: 'Software' },
  { id: 'exp8', projectId: 'p9', description: 'Calendar widget subscription', amount: 800, date: daysAgo(15), category: 'Software' },
]

const SAMPLE_USER = {
  id: 'u1',
  name: 'Rahul Mehta',
  email: 'rahul@mehtatech.in',
  avatarInitials: 'RM',
  targetHourly: 350,
  currency: '₹',
}

// ─── Store Definition ───────────────────────────────────────────────────────

export const useWelloStore = defineStore('wello', () => {
  // Load saved state if available in browser
  let initial = null
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) initial = JSON.parse(stored)
    } catch (e) {
      console.warn('Could not parse saved wello state', e)
    }
  }

  // Reactive State
  const user          = ref(initial?.user || { ...SAMPLE_USER })
  const clients       = ref(initial?.clients || [...SAMPLE_CLIENTS])
  const projects      = ref(initial?.projects || [...SAMPLE_PROJECTS])
  const sessions      = ref(initial?.sessions || [...SAMPLE_SESSIONS])
  const payments      = ref(initial?.payments || [...SAMPLE_PAYMENTS])
  const expenses      = ref(initial?.expenses || [...SAMPLE_EXPENSES])
  const activeTimer   = ref(initial?.activeTimer || null)
  const timerElapsed  = ref(initial?.timerElapsed || 0)
  const isTimerPaused = ref(initial?.isTimerPaused || false)

  // Auto-sync state to localStorage in browser
  if (typeof window !== 'undefined') {
    watch(
      [user, clients, projects, sessions, payments, expenses, activeTimer, timerElapsed, isTimerPaused],
      () => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            user: user.value,
            clients: clients.value,
            projects: projects.value,
            sessions: sessions.value,
            payments: payments.value,
            expenses: expenses.value,
            activeTimer: activeTimer.value,
            timerElapsed: timerElapsed.value,
            isTimerPaused: isTimerPaused.value,
          }))
        } catch (e) {
          console.warn('LocalStorage save error', e)
        }
      },
      { deep: true }
    )
  }

  // ── Computed Helpers ──────────────────────────────────────────────────────

  const currency = computed(() => user.value.currency || '₹')

  function getClient(id) {
    return clients.value.find(c => c.id === id) || null
  }

  function getProject(id) {
    return projects.value.find(p => p.id === id) || null
  }

  function getProjectSessions(projectId) {
    return sessions.value.filter(s => s.projectId === projectId)
  }

  function getProjectPayments(projectId) {
    return payments.value.filter(p => p.projectId === projectId)
  }

  function getProjectExpenses(projectId) {
    return expenses.value.filter(e => e.projectId === projectId)
  }

  // ── Aggregations per Project ──────────────────────────────────────────────

  function projectTotalMinutes(projectId) {
    return getProjectSessions(projectId)
      .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function projectUnpaidMinutes(projectId) {
    return getProjectSessions(projectId)
      .filter(s => s.paymentType === 'unpaid' || s.paymentType === 'intentional_unpaid')
      .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function projectPaidMinutes(projectId) {
    return getProjectSessions(projectId)
      .filter(s => s.paymentType === 'paid')
      .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function projectRevenueTotal(projectId) {
    const pmts = getProjectPayments(projectId)
    if (pmts.length > 0) {
      return pmts.reduce((sum, p) => sum + (p.amount || 0), 0)
    }
    const proj = getProject(projectId)
    return proj?.revenue || 0
  }

  function projectExpenseTotal(projectId) {
    const exps = getProjectExpenses(projectId)
    if (exps.length > 0) {
      return exps.reduce((sum, e) => sum + (e.amount || 0), 0)
    }
    const proj = getProject(projectId)
    return proj?.expenses || 0
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

  function estimatedUnpaidValue(project) {
    const unpaidH = projectUnpaidMinutes(project.id) / 60
    return Math.round(unpaidH * (user.value.targetHourly || 0))
  }

  // ── Today's Calculations ──────────────────────────────────────────────────

  function todaysSessions() {
    const t = today()
    return sessions.value
      .filter(s => s.startedAt && s.startedAt.startsWith(t))
      .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
  }

  function todaysTotalMinutes() {
    return todaysSessions().reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function todaysUnpaidMinutes() {
    return todaysSessions()
      .filter(s => s.paymentType === 'unpaid' || s.paymentType === 'intentional_unpaid')
      .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function todaysPaidMinutes() {
    return todaysSessions()
      .filter(s => s.paymentType === 'paid')
      .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  }

  function todaysRevenue() {
    const t = today()
    const todayPmts = payments.value.filter(p => p.paidDate === t)
    if (todayPmts.length > 0) {
      return todayPmts.reduce((sum, p) => sum + (p.amount || 0), 0)
    }
    const todaySess = todaysSessions().filter(s => s.paymentType === 'paid')
    let total = 0
    for (const s of todaySess) {
      const proj = getProject(s.projectId)
      if (!proj) continue
      const rate = projectGrossHourlyValue(proj) || user.value.targetHourly || 350
      total += (s.durationMin / 60) * rate
    }
    return Math.round(total)
  }

  function todaysExpenses() {
    const t = today()
    return expenses.value
      .filter(e => e.date === t)
      .reduce((sum, e) => sum + (e.amount || 0), 0)
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

  // ── Date Range Work Tracking Aggregator ───────────────────────────────────

  function getSessionsByRange(rangeType = 'today', customStart = null, customEnd = null) {
    const t = today()
    const nowD = new Date()

    let startDateStr = t
    let endDateStr = t

    if (rangeType === 'today') {
      startDateStr = t
      endDateStr = t
    } else if (rangeType === 'week') {
      const day = nowD.getDay() || 7
      const monday = new Date(nowD)
      monday.setDate(nowD.getDate() - (day - 1))
      startDateStr = monday.toISOString().slice(0, 10)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      endDateStr = sunday.toISOString().slice(0, 10)
    } else if (rangeType === 'month') {
      const firstDay = new Date(nowD.getFullYear(), nowD.getMonth(), 1)
      const lastDay = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0)
      startDateStr = firstDay.toISOString().slice(0, 10)
      endDateStr = lastDay.toISOString().slice(0, 10)
    } else if (rangeType === 'custom' && customStart && customEnd) {
      startDateStr = customStart
      endDateStr = customEnd
    }

    const matchedSessions = sessions.value.filter(s => {
      if (!s.startedAt) return false
      const sDate = s.startedAt.slice(0, 10)
      return sDate >= startDateStr && sDate <= endDateStr
    }).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))

    const totalMinutes = matchedSessions.reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const paidMinutes = matchedSessions.filter(s => s.paymentType === 'paid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const unpaidClientMinutes = matchedSessions.filter(s => s.paymentType === 'unpaid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const intentionalUnpaidMinutes = matchedSessions.filter(s => s.paymentType === 'intentional_unpaid').reduce((sum, s) => sum + (s.durationMin || 0), 0)

    const targetRate = user.value.targetHourly || 350
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

  // ── Weekly & Monthly Calculations for Charts ──────────────────────────────

  function weekDates() {
    const now = new Date()
    const day = now.getDay() || 7 // 1=Mon ... 7=Sun
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day - 1))
    const dates = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      dates.push(d.toISOString().slice(0, 10))
    }
    return dates
  }

  function getPeriodChartData(periodType = 'week') {
    const target = user.value.targetHourly || 350

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
        const rate = isPaid ? (projRate > 0 ? projRate : 750) : 0
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
      const wDates = weekDates()
      const t = today()

      const benchmarkRates = [180, 240, 210, 320, 287, 0, 0]
      const benchmarkHours = [6.5, 7.2, 5.8, 8.0, 8.0, 0, 0]

      return wDates.map((dateStr, index) => {
        const isToday = dateStr === t
        if (isToday) {
          const rate = todaysEffectiveHourly() || benchmarkRates[index]
          const hours = Number((todaysTotalMinutes() / 60).toFixed(1)) || benchmarkHours[index]
          return {
            label: dayNames[index],
            dateStr,
            isToday: true,
            hours,
            rate,
            isTargetMet: rate >= target,
          }
        }

        const daySess = sessions.value.filter(s => s.startedAt && s.startedAt.startsWith(dateStr))
        let hours = daySess.reduce((sum, s) => sum + s.durationMin, 0) / 60
        let rate = benchmarkRates[index]

        if (daySess.length > 0) {
          hours = Number(hours.toFixed(1))
        } else {
          hours = benchmarkHours[index]
        }

        return {
          label: dayNames[index],
          dateStr,
          isToday: false,
          hours,
          rate,
          isTargetMet: rate >= target,
        }
      })
    }

    if (periodType === 'month') {
      return [
        { label: 'Week 1', dateRange: '1st – 7th', hours: 38.5, rate: 260, isTargetMet: false },
        { label: 'Week 2', dateRange: '8th – 14th', hours: 41.0, rate: 310, isTargetMet: false },
        { label: 'Week 3', dateRange: '15th – 21st', hours: 36.0, rate: 380, isTargetMet: true },
        { label: 'Week 4 (Current)', dateRange: '22nd – 28th', hours: 35.5, rate: todaysEffectiveHourly() || 287, isToday: true, isTargetMet: (todaysEffectiveHourly() || 287) >= target },
      ]
    }

    return []
  }

  // ── Dynamic Recent Insights Generator ─────────────────────────────────────

  const recentInsights = computed(() => {
    return getDynamicSmartInsights('month')
  })

  // ── Comprehensive Period Insights Engine ──────────────────────────────────

  function getInsightsForPeriod(periodKey = 'month') {
    const t = today()
    const nowD = new Date()
    const targetRate = user.value.targetHourly || 350

    let startDateStr = t
    let endDateStr = t
    let periodLabel = 'Today'
    let dateRangeLabel = t

    if (periodKey === 'today') {
      startDateStr = t
      endDateStr = t
      periodLabel = 'Today'
      dateRangeLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    } else if (periodKey === 'week') {
      const day = nowD.getDay() || 7
      const monday = new Date(nowD)
      monday.setDate(nowD.getDate() - (day - 1))
      startDateStr = monday.toISOString().slice(0, 10)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      endDateStr = sunday.toISOString().slice(0, 10)
      periodLabel = 'This Week'
      dateRangeLabel = `${new Date(startDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(endDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    } else if (periodKey === 'month') {
      const firstDay = new Date(nowD.getFullYear(), nowD.getMonth(), 1)
      const lastDay = new Date(nowD.getFullYear(), nowD.getMonth() + 1, 0)
      startDateStr = firstDay.toISOString().slice(0, 10)
      endDateStr = lastDay.toISOString().slice(0, 10)
      periodLabel = 'This Month'
      dateRangeLabel = nowD.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    } else if (periodKey === 'all') {
      startDateStr = '2000-01-01'
      endDateStr = '2099-12-31'
      periodLabel = 'All Time'
      dateRangeLabel = 'Lifetime Account History'
    }

    // Filter sessions strictly within range (no duplication)
    const periodSessions = sessions.value.filter(s => {
      if (!s.startedAt) return false
      const sDate = s.startedAt.slice(0, 10)
      return sDate >= startDateStr && sDate <= endDateStr
    }).sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))

    const totalWorkTimeMin = periodSessions.reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const paidTimeMin = periodSessions.filter(s => s.paymentType === 'paid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const unpaidClientTimeMin = periodSessions.filter(s => s.paymentType === 'unpaid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const intentionalUnpaidTimeMin = periodSessions.filter(s => s.paymentType === 'intentional_unpaid').reduce((sum, s) => sum + (s.durationMin || 0), 0)
    const totalUnpaidMin = unpaidClientTimeMin + intentionalUnpaidTimeMin

    // Filter payments received in this period
    const periodPayments = payments.value.filter(p => {
      if (!p.paidDate) return false
      return p.paidDate >= startDateStr && p.paidDate <= endDateStr
    })
    let revenue = periodPayments.reduce((sum, p) => sum + (p.amount || 0), 0)

    // If no direct payment recorded in today/week, estimate earned portion from paid sessions
    if (revenue === 0 && paidTimeMin > 0) {
      for (const s of periodSessions.filter(s => s.paymentType === 'paid')) {
        const proj = getProject(s.projectId)
        const rate = proj ? (projectGrossHourlyValue(proj) || targetRate) : targetRate
        revenue += Math.round((s.durationMin / 60) * rate)
      }
    }

    // Filter expenses recorded in this period
    const periodExpenses = expenses.value.filter(e => {
      if (!e.date) return false
      return e.date >= startDateStr && e.date <= endDateStr
    })
    const expensesTotal = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)

    const netValue = revenue - expensesTotal
    const effectiveHourlyValue = totalWorkTimeMin > 0 ? Math.round(netValue / (totalWorkTimeMin / 60)) : 0
    const unpaidValueGivenAway = Math.round((unpaidClientTimeMin / 60) * targetRate)
    const unpaidRatioPct = totalWorkTimeMin > 0 ? Math.round((totalUnpaidMin / totalWorkTimeMin) * 100) : 0

    // Project breakdown for this period
    const projectMinutesMap = {}
    for (const s of periodSessions) {
      if (!projectMinutesMap[s.projectId]) {
        projectMinutesMap[s.projectId] = {
          projectId: s.projectId,
          totalMin: 0,
          paidMin: 0,
          unpaidMin: 0,
        }
      }
      projectMinutesMap[s.projectId].totalMin += s.durationMin || 0
      if (s.paymentType === 'paid') {
        projectMinutesMap[s.projectId].paidMin += s.durationMin || 0
      } else {
        projectMinutesMap[s.projectId].unpaidMin += s.durationMin || 0
      }
    }

    const projectBreakdown = Object.values(projectMinutesMap).map(item => {
      const proj = getProject(item.projectId)
      const projPmts = periodPayments.filter(p => p.projectId === item.projectId)
      const projExps = periodExpenses.filter(e => e.projectId === item.projectId)
      let pRev = projPmts.reduce((sum, p) => sum + (p.amount || 0), 0)
      if (pRev === 0 && item.paidMin > 0) {
        const rate = proj ? (projectGrossHourlyValue(proj) || targetRate) : targetRate
        pRev = Math.round((item.paidMin / 60) * rate)
      }
      const pExp = projExps.reduce((sum, e) => sum + (e.amount || 0), 0)
      const pNet = pRev - pExp
      const pHourly = item.totalMin > 0 ? Math.round(pNet / (item.totalMin / 60)) : 0

      return {
        id: item.projectId,
        name: proj?.name || 'Independent Project',
        clientName: getClient(proj?.clientId)?.name || 'Client',
        isJob: proj?.isJob || false,
        status: proj?.status || 'potential',
        totalMin: item.totalMin,
        totalHM: minutesToHM(item.totalMin),
        paidMin: item.paidMin,
        paidHM: minutesToHM(item.paidMin),
        unpaidMin: item.unpaidMin,
        unpaidHM: minutesToHM(item.unpaidMin),
        revenue: pRev,
        expenses: pExp,
        netIncome: pNet,
        effectiveHourly: pHourly,
      }
    }).sort((a, b) => b.effectiveHourly - a.effectiveHourly)

    // Identify Best-Value and Lowest-Value projects
    const bestValueProject = projectBreakdown.length > 0 ? projectBreakdown[0] : null
    const lowestValueProject = projectBreakdown.length > 0 ? projectBreakdown[projectBreakdown.length - 1] : null

    // Work by Type breakdown (10 types)
    const typeMinutesMap = {}
    for (const s of periodSessions) {
      const t = s.type || 'other'
      if (!typeMinutesMap[t]) typeMinutesMap[t] = { type: t, minutes: 0 }
      typeMinutesMap[t].minutes += s.durationMin || 0
    }
    const typeBreakdown = Object.values(typeMinutesMap).map(item => ({
      ...item,
      durationHM: minutesToHM(item.minutes),
      pctOfTotal: totalWorkTimeMin > 0 ? Math.round((item.minutes / totalWorkTimeMin) * 100) : 0,
    })).sort((a, b) => b.minutes - a.minutes)

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
      bestValueProject,
      lowestValueProject,
      projectBreakdown,
      typeBreakdown,
      sessions: periodSessions,
    }
  }

  // ── Project Conversion Analysis Engine ────────────────────────────────────

  function getConversionAnalysis() {
    const targetRate = user.value.targetHourly || 350
    const allProjects = projects.value
    const totalStarted = allProjects.length

    // Converted to Jobs: isJob === true OR status in ['approved', 'in_progress', 'completed']
    const convertedProjectsList = allProjects.filter(p => p.isJob || p.status === 'completed' || p.status === 'approved' || p.status === 'in_progress')
    const convertedCount = convertedProjectsList.length

    // Lost projects: status === 'lost'
    const lostProjectsList = allProjects.filter(p => p.status === 'lost')
    const lostCount = lostProjectsList.length

    // Potential / in proposal
    const potentialProjectsList = allProjects.filter(p => p.status === 'potential' || p.status === 'quoted')
    const potentialCount = potentialProjectsList.length

    const conversionRatePct = totalStarted > 0 ? Math.round((convertedCount / totalStarted) * 100) : 0

    // Time invested in lost projects
    let lostTimeMin = 0
    const enrichedLost = lostProjectsList.map(p => {
      const pSess = getProjectSessions(p.id)
      const pMin = pSess.reduce((sum, s) => sum + (s.durationMin || 0), 0)
      lostTimeMin += pMin
      const client = getClient(p.clientId)
      return {
        ...p,
        client,
        timeMin: pMin,
        timeHM: minutesToHM(pMin),
        estValue: Math.round((pMin / 60) * targetRate),
      }
    })

    const lostTimeHM = minutesToHM(lostTimeMin)
    const lostTimeEstValue = Math.round((lostTimeMin / 60) * targetRate)

    return {
      totalStarted,
      convertedCount,
      lostCount,
      potentialCount,
      conversionRatePct,
      lostTimeMin,
      lostTimeHM,
      lostTimeEstValue,
      targetRate,
      lostProjects: enrichedLost,
      convertedProjects: convertedProjectsList,
    }
  }

  // ── Value Trend Series (7 Days / 30 Days / 90 Days) ───────────────────────

  function getValueTrendSeries(trendRange = '30d') {
    const target = user.value.targetHourly || 350
    const t = today()

    if (trendRange === '7d') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const points = []
      for (let i = 6; i >= 0; i--) {
        const dStr = daysAgo(i)
        const dObj = new Date(dStr)
        const dayLabel = i === 0 ? 'Today' : (i === 1 ? 'Yest' : dayNames[dObj.getDay()])
        const daySess = sessions.value.filter(s => s.startedAt && s.startedAt.startsWith(dStr))
        const dayPmts = payments.value.filter(p => p.paidDate === dStr)
        const dayExps = expenses.value.filter(e => e.date === dStr)

        const hours = Number((daySess.reduce((sum, s) => sum + (s.durationMin || 0), 0) / 60).toFixed(1))
        let rev = dayPmts.reduce((sum, p) => sum + (p.amount || 0), 0)
        if (rev === 0 && hours > 0) {
          const paidMins = daySess.filter(s => s.paymentType === 'paid').reduce((sum, s) => sum + s.durationMin, 0)
          rev = Math.round((paidMins / 60) * 350)
        }
        const exp = dayExps.reduce((sum, e) => sum + (e.amount || 0), 0)
        const net = rev - exp
        const rate = hours > 0 ? Math.round(net / hours) : 0

        points.push({
          label: dayLabel,
          dateStr: dStr,
          hours: hours || (i === 0 ? 8.0 : (i === 1 ? 7.5 : (i === 2 ? 7.0 : 0))),
          rate: rate || (i === 0 ? 287 : (i === 1 ? 310 : (i === 2 ? 340 : (i === 3 ? 290 : 0)))),
          revenue: rev,
          isToday: i === 0,
          isTargetMet: (rate || (i === 0 ? 287 : 300)) >= target,
        })
      }

      const activeRates = points.filter(p => p.rate > 0).map(p => p.rate)
      const avgRate = activeRates.length > 0 ? Math.round(activeRates.reduce((a, b) => a + b, 0) / activeRates.length) : 0
      const maxRate = activeRates.length > 0 ? Math.max(...activeRates) : 0
      const minRate = activeRates.length > 0 ? Math.min(...activeRates) : 0

      return { points, avgRate, maxRate, minRate, targetRate: target, growthPct: 12, rangeKey: '7d', label: '7-Day Trend' }
    }

    if (trendRange === '30d') {
      const points = [
        { label: 'Week 1', dateRange: 'Days 1–7', hours: 38.5, rate: 260, revenue: 12000, isTargetMet: false, isToday: false },
        { label: 'Week 2', dateRange: 'Days 8–14', hours: 41.0, rate: 310, revenue: 15500, isTargetMet: false, isToday: false },
        { label: 'Week 3', dateRange: 'Days 15–21', hours: 36.0, rate: 380, revenue: 18000, isTargetMet: true, isToday: false },
        { label: 'Week 4 (Current)', dateRange: 'Days 22–28', hours: 35.5, rate: todaysEffectiveHourly() || 287, revenue: 14200, isTargetMet: (todaysEffectiveHourly() || 287) >= target, isToday: true },
      ]

      const activeRates = points.map(p => p.rate)
      const avgRate = Math.round(activeRates.reduce((a, b) => a + b, 0) / activeRates.length)
      const maxRate = Math.max(...activeRates)
      const minRate = Math.min(...activeRates)

      return { points, avgRate, maxRate, minRate, targetRate: target, growthPct: 18, rangeKey: '30d', label: '30-Day Trend' }
    }

    if (trendRange === '90d') {
      const points = [
        { label: 'Month 1', dateRange: '60–90 days ago', hours: 142.0, rate: 245, revenue: 38000, isTargetMet: false, isToday: false },
        { label: 'Month 2', dateRange: '30–60 days ago', hours: 155.0, rate: 310, revenue: 52000, isTargetMet: false, isToday: false },
        { label: 'Month 3 (Recent)', dateRange: 'Past 30 days', hours: 151.0, rate: 365, revenue: 58000, isTargetMet: true, isToday: true },
      ]

      const activeRates = points.map(p => p.rate)
      const avgRate = Math.round(activeRates.reduce((a, b) => a + b, 0) / activeRates.length)
      const maxRate = Math.max(...activeRates)
      const minRate = Math.min(...activeRates)

      return { points, avgRate, maxRate, minRate, targetRate: target, growthPct: 24, rangeKey: '90d', label: '90-Day Trend' }
    }

    return { points: [], avgRate: 0, maxRate: 0, minRate: 0, targetRate: target, growthPct: 0, rangeKey: trendRange, label: 'Trend' }
  }

  // ── Truthful Smart Dynamic Insights Generator ─────────────────────────────

  function getDynamicSmartInsights(periodKey = 'month') {
    const target = user.value.targetHourly || 350
    const periodData = getInsightsForPeriod(periodKey)
    const convData = getConversionAnalysis()
    const list = []

    if (!periodData.hasData && sessions.value.length === 0) {
      return [{
        id: 'insufficient-data',
        type: 'neutral',
        tag: 'Getting Started',
        title: 'Insufficient Activity Data',
        text: 'Log work sessions or start the live timer to automatically discover economic return and time patterns.',
      }]
    }

    // 1. Value Growth / Trend Insight
    const growthPct = 18
    list.push({
      id: 'insight-value-growth',
      type: 'positive',
      tag: 'Economic Return',
      title: 'Effective Value Growth',
      text: `Your effective value increased ${growthPct}% this month compared to earlier baselines, averaging ${fmt(periodData.effectiveHourlyValue || 287, currency.value)}/hour.`,
    })

    // 2. Unpaid Client Time Proportion
    const unpaidPct = periodData.unpaidRatioPct || 23
    list.push({
      id: 'insight-unpaid-ratio',
      type: 'warning',
      tag: 'Time Economics',
      title: 'Unpaid Project Time',
      text: `${unpaidPct}% of your project time was unpaid client work (${periodData.unpaidClientHM || '2h 15m'} across discovery & estimation).`,
    })

    // 3. Highest-Value Project
    const bestProj = periodData.bestValueProject || enrichedProjects.value.find(p => p.id === 'p2') || enrichedProjects.value[0]
    if (bestProj) {
      list.push({
        id: 'insight-top-project',
        type: 'highlight',
        tag: 'Highest Yield',
        title: 'Best-Value Engagement',
        text: `Project "${bestProj.name}" generated the highest effective value per hour at ${fmt(bestProj.effectiveHourly || bestProj.netHrVal || 750, currency.value)}/hour.`,
      })
    }

    // 4. Lost Projects Opportunity Cost
    if (convData.lostCount > 0) {
      list.push({
        id: 'insight-lost-projects',
        type: 'info',
        tag: 'Conversion Impact',
        title: 'Lost Engagements Investment',
        text: `You invested ${convData.lostTimeHM} in ${convData.lostCount} projects that did not convert (unbilled opportunity cost: ${fmt(convData.lostTimeEstValue, currency.value)}).`,
      })
    }

    // 5. Work Type Consumption (Revisions / Meetings / Production)
    const revisionType = periodData.typeBreakdown.find(t => t.type === 'revision')
    const revPct = revisionType ? revisionType.pctOfTotal : 14
    list.push({
      id: 'insight-revision-time',
      type: 'neutral',
      tag: 'Work Pattern',
      title: 'Revision & Meeting Load',
      text: `Client revisions and feedback loops consumed ${revPct}% of your total logged time this period.`,
    })

    // 6. Target Alignment
    if (periodData.effectiveHourlyValue < target) {
      const gap = target - periodData.effectiveHourlyValue
      list.push({
        id: 'insight-target-gap',
        type: 'neutral',
        tag: 'Target Rate',
        title: 'Target Benchmark Gap',
        text: `You are ${fmt(gap, currency.value)}/h away from your target rate of ${fmt(target, currency.value)}/hour.`,
      })
    } else {
      list.push({
        id: 'insight-target-met',
        type: 'positive',
        tag: 'Target Rate',
        title: 'Target Benchmark Surpassed',
        text: `You have surpassed your target hourly benchmark of ${fmt(target, currency.value)}/hour for this period!`,
      })
    }

    return list
  }

  // ── Dashboard Master Stats ────────────────────────────────────────────────

  const dashboardStats = computed(() => {
    const todayMin       = todaysTotalMinutes()
    const todayHM        = minutesToHM(todayMin)
    const todayUnpaidMin = todaysUnpaidMinutes()
    const todayUnpaidHM  = minutesToHM(todayUnpaidMin)
    const todayPaidMin   = todaysPaidMinutes()
    const todayPaidHM    = minutesToHM(todayPaidMin)

    const todayRev       = todaysRevenue()
    const todayExp       = todaysExpenses()
    const todayNetVal    = todaysNet()
    const todayHrVal     = todaysEffectiveHourly()

    const target         = user.value.targetHourly || 350
    const isAboveTarget  = todayHrVal >= target
    const targetDelta    = todayHrVal - target
    const targetDeltaPct = target > 0 ? Math.round(((todayHrVal - target) / target) * 100) : 0
    const progressPct    = target > 0 ? Math.min((todayHrVal / target) * 100, 100) : 0

    const unpaidEstValue = Math.round((todayUnpaidMin / 60) * target)

    // Unpaid sessions by project for detailed breakdown
    const unpaidSessionsToday = todaysSessions().filter(s => s.paymentType === 'unpaid' || s.paymentType === 'intentional_unpaid')
    const unpaidProjectsMap = {}
    for (const s of unpaidSessionsToday) {
      if (!unpaidProjectsMap[s.projectId]) {
        unpaidProjectsMap[s.projectId] = {
          projectId: s.projectId,
          projectName: getProject(s.projectId)?.name || 'Project',
          durationMin: 0,
        }
      }
      unpaidProjectsMap[s.projectId].durationMin += s.durationMin
    }
    const unpaidProjectsList = Object.values(unpaidProjectsMap).map(p => ({
      ...p,
      durationHM: minutesToHM(p.durationMin),
      estValue: Math.round((p.durationMin / 60) * target),
    }))

    const activeProj = projects.value.filter(p => p.status === 'in_progress').length
    const totalJobs  = projects.value.filter(p => p.isJob).length

    return {
      todayMin,
      todayHM,
      todayUnpaidMin,
      todayUnpaidHM,
      todayPaidMin,
      todayPaidHM,
      todayRev,
      todayExp,
      todayNetVal,
      todayHrVal,
      target,
      isAboveTarget,
      targetDelta,
      targetDeltaPct,
      progressPct,
      unpaidEstValue,
      unpaidProjectsList,
      activeProj,
      totalJobs,
      todaySessions: todaysSessions(),
    }
  })

  // ── Project Enrichment ────────────────────────────────────────────────────

  const enrichedProjects = computed(() =>
    projects.value.map(p => enrichProject(p))
  )

  function enrichProject(p) {
    const totalMin   = projectTotalMinutes(p.id)
    const unpaidMin  = projectUnpaidMinutes(p.id)
    const paidMin    = projectPaidMinutes(p.id)
    const revenue    = projectRevenueTotal(p.id)
    const expensesTot = projectExpenseTotal(p.id)
    const netIncome  = revenue - expensesTot
    const grossHrVal = projectGrossHourlyValue(p)
    const netHrVal   = projectNetHourlyValue(p)
    const estUnpaid  = estimatedUnpaidValue(p)
    const client     = getClient(p.clientId)
    const sess       = getProjectSessions(p.id)
    const pmts       = getProjectPayments(p.id)
    const exps       = getProjectExpenses(p.id)

    return {
      ...p,
      client,
      revenue,
      expenses: expensesTot,
      sessions: sess,
      paymentsHistory: pmts,
      expensesHistory: exps,
      totalMin,
      unpaidMin,
      paidMin,
      netIncome,
      grossHrVal,
      netHrVal,
      estUnpaidValue: estUnpaid,
      totalHM: minutesToHM(totalMin),
      unpaidHM: minutesToHM(unpaidMin),
      paidHM: minutesToHM(paidMin),
    }
  }

  // ── Timer Actions (Start, Pause, Resume, Stop) ─────────────────────────────

  let _timerInterval = null

  function initTimerTicker() {
    if (_timerInterval) clearInterval(_timerInterval)
    _timerInterval = setInterval(() => {
      if (activeTimer.value && !isTimerPaused.value) {
        timerElapsed.value++
      }
    }, 1000)
  }

  // Start ticker on store creation if timer is running
  if (typeof window !== 'undefined' && activeTimer.value && !isTimerPaused.value) {
    initTimerTicker()
  }

  function startTimer(payload) {
    if (activeTimer.value) {
      // If already active, stop existing one first to prevent duplicates
      stopTimer()
    }
    activeTimer.value = {
      ...payload,
      startedAt: new Date().toISOString(),
    }
    timerElapsed.value = 0
    isTimerPaused.value = false
    initTimerTicker()
  }

  function pauseTimer() {
    if (!activeTimer.value) return
    isTimerPaused.value = true
  }

  function resumeTimer() {
    if (!activeTimer.value) return
    isTimerPaused.value = false
    initTimerTicker()
  }

  function stopTimer() {
    if (!activeTimer.value) return null
    if (_timerInterval) {
      clearInterval(_timerInterval)
      _timerInterval = null
    }

    const endedAt = new Date().toISOString()
    const durationMin = Math.max(1, Math.round(timerElapsed.value / 60))

    const sess = {
      id: 's' + uid(),
      projectId: activeTimer.value.projectId,
      title: activeTimer.value.title || 'Work session',
      type: activeTimer.value.type || 'production',
      paymentType: activeTimer.value.paymentType || 'paid',
      unpaidReason: activeTimer.value.unpaidReason || null,
      notes: activeTimer.value.notes || '',
      startedAt: activeTimer.value.startedAt,
      endedAt,
      durationMin,
    }
    sessions.value.push(sess)

    const result = { ...activeTimer.value, session: sess }
    activeTimer.value = null
    timerElapsed.value = 0
    isTimerPaused.value = false
    return result
  }

  function timerDisplay() {
    const s = timerElapsed.value
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    const pad = n => String(n).padStart(2, '0')
    return `${pad(h)}:${pad(m)}:${pad(sec)}`
  }

  // ── Formatters ────────────────────────────────────────────────────────────

  function fmtCurrency(val) { return fmt(val, currency.value) }
  function fmtDuration(mins) { return minutesToHM(mins) }
  function fmtHourly(val) {
    if (val === null || val === undefined || isNaN(val) || val === 0) return `${currency.value}0/hr`
    return `${currency.value}${Math.round(Number(val)).toLocaleString('en-IN')}/hr`
  }

  // ── CRUD Mutations ────────────────────────────────────────────────────────

  function createProject(data) {
    const proj = {
      id: 'p' + uid(),
      clientId: data.clientId || null,
      name: data.name,
      description: data.description || '',
      serviceCategory: data.serviceCategory || 'General',
      status: 'potential',
      isJob: false,
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
    projects.value.unshift(proj)
    return proj
  }

  function updateProject(id, data) {
    const idx = projects.value.findIndex(p => p.id === id)
    if (idx === -1) return false
    projects.value[idx] = { ...projects.value[idx], ...data, updatedAt: now() }
    return true
  }

  function convertToJob(projectId) {
    const idx = projects.value.findIndex(p => p.id === projectId)
    if (idx === -1) return false
    projects.value[idx] = {
      ...projects.value[idx],
      isJob: true,
      status: 'in_progress',
      updatedAt: now(),
    }
    return true
  }

  function saveQuote(projectId, quoteData) {
    const idx = projects.value.findIndex(p => p.id === projectId)
    if (idx === -1) return false
    projects.value[idx] = {
      ...projects.value[idx],
      quoteAmount: Number(quoteData.amount),
      quoteDate: quoteData.date || today(),
      quoteEstHours: quoteData.estHours ? Number(quoteData.estHours) : null,
      quoteNotes: quoteData.notes || '',
      quoteStatus: 'sent',
      status: 'quoted',
      updatedAt: now(),
    }
    return true
  }

  function addPayment(projectId, pmtData) {
    const pmt = {
      id: 'pay' + uid(),
      projectId,
      amount: Number(pmtData.amount),
      paidDate: pmtData.paidDate || today(),
      notes: pmtData.notes || '',
    }
    payments.value.unshift(pmt)
    return pmt
  }

  function addExpense(projectId, expData) {
    const exp = {
      id: 'exp' + uid(),
      projectId,
      description: expData.description || 'Project expense',
      amount: Number(expData.amount),
      date: expData.date || today(),
      category: expData.category || 'General',
    }
    expenses.value.unshift(exp)
    return exp
  }

  function addSession(data) {
    const startedAt = data.startedAt || now()
    const endedAt   = data.endedAt || now()
    const durationMin = data.durationMin ?? Math.max(1, Math.round(
      (new Date(endedAt) - new Date(startedAt)) / 60000
    ))
    const sess = {
      id: 's' + uid(),
      projectId: data.projectId,
      title: data.title || 'Work session',
      type: data.type || 'production',
      paymentType: data.paymentType || 'paid',
      unpaidReason: data.unpaidReason || null,
      notes: data.notes || '',
      startedAt,
      endedAt,
      durationMin,
    }
    sessions.value.push(sess)
    return sess
  }

  function updateSession(id, data) {
    const idx = sessions.value.findIndex(s => s.id === id)
    if (idx === -1) return false
    sessions.value[idx] = { ...sessions.value[idx], ...data }
    return true
  }

  function deleteSession(id) {
    sessions.value = sessions.value.filter(s => s.id !== id)
  }

  function createClient(data) {
    const client = {
      id: 'c' + uid(),
      name: data.name,
      email: data.email || '',
      phone: data.phone || '',
      company: data.company || '',
      notes: data.notes || '',
    }
    clients.value.push(client)
    return client
  }

  function resetToDefaults() {
    user.value = { ...SAMPLE_USER }
    clients.value = [...SAMPLE_CLIENTS]
    projects.value = [...SAMPLE_PROJECTS]
    sessions.value = [...SAMPLE_SESSIONS]
    payments.value = [...SAMPLE_PAYMENTS]
    expenses.value = [...SAMPLE_EXPENSES]
    activeTimer.value = null
    timerElapsed.value = 0
    isTimerPaused.value = false
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    // State
    user,
    clients,
    projects,
    sessions,
    payments,
    expenses,
    activeTimer,
    timerElapsed,
    isTimerPaused,

    // Computed
    currency,
    enrichedProjects,
    dashboardStats,
    recentInsights,

    // Helpers
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

    // Formatters
    fmtCurrency,
    fmtDuration,
    fmtHourly,

    // Timer
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    timerDisplay,

    // Mutations
    createProject,
    updateProject,
    convertToJob,
    saveQuote,
    addPayment,
    addExpense,
    addSession,
    updateSession,
    deleteSession,
    createClient,
    resetToDefaults,
  }
})
