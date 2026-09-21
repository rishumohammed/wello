<template>
  <div class="dashboard-page animate-fade-in">
    <!-- Greeting & Header -->
    <div class="page-header mb-5">
      <h1 class="page-title">Good {{ greeting }}, {{ firstName }}</h1>
      <p class="page-subtitle">{{ formattedDate }} · Personal work-value dashboard</p>
    </div>

    <!-- Quick Actions Toolbar -->
    <div class="quick-actions-toolbar" id="home-quick-actions">
      <button class="quick-action-btn action-start" @click="showTimerModal = true" id="action-start-work">
        <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Start Work</span>
      </button>
      <button class="quick-action-btn" @click="showNewProject = true" id="action-create-project">
        <IconFolders class="action-icon text-brand" />
        <span>Create Project</span>
      </button>
      <button class="quick-action-btn" @click="showPaymentModal = true" id="action-add-income">
        <svg class="action-icon text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
        <span>Add Income</span>
      </button>
      <button class="quick-action-btn" @click="showExpenseModal = true" id="action-add-expense">
        <svg class="action-icon text-danger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
        <span>Add Expense</span>
      </button>
    </div>

    <!-- Active timer banner (if running) -->
    <div v-if="store.activeTimer" class="card mb-6 timer-running-card" id="home-running-timer-card">
      <div class="card-padded flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <span class="timer-running-indicator"></span>
          <div>
            <div class="fw-700 text-base text-brand">{{ store.timerDisplay() }}</div>
            <div class="text-tertiary text-xs">Running: {{ store.activeTimer.title }} · {{ timerProjectName }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-secondary btn-sm" @click="showTimerModal = true">View</button>
          <button class="btn btn-primary btn-sm" @click="stopTimer" id="btn-stop-timer-home">Stop & Save</button>
        </div>
      </div>
    </div>

    <!-- PRIMARY HERO: ROLLING WORK-VALUE & DUAL RATES -->
    <div class="metric-card-hero mb-6" id="home-hero-metric">
      <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div class="flex items-center gap-2">
          <div class="metric-label uppercase tracking-wide fw-700">Work Value Return</div>
          <span class="badge badge-purple text-2xs font-semibold">
            {{ isAllInMetric ? 'All-In Metric' : 'Client-Work Metric' }}
          </span>
        </div>

        <!-- Rolling Window Selector -->
        <div class="filter-strip mb-0" id="hero-window-selector">
          <button
            v-for="w in windowOptions"
            :key="w.key"
            class="filter-chip"
            :class="{ active: selectedWindow === w.key }"
            @click="selectedWindow = w.key"
            :id="`btn-window-${w.key}`"
          >
            {{ w.label }}
          </button>
        </div>
      </div>

      <!-- Main Hourly Rate & Target Comparison -->
      <div class="flex items-baseline justify-between flex-wrap gap-3">
        <div class="hero-value-row">
          <div class="metric-value xl hero-value-main" id="hero-main-rate">
            <template v-if="activeHeroRate > 0">
              {{ store.fmtCurrency(activeHeroRate) }}
            </template>
            <template v-else-if="activeZeroHours">
              <span class="text-tertiary text-2xl font-medium">No Hours</span>
            </template>
            <template v-else>
              {{ store.fmtCurrency(0) }}
            </template>
          </div>
          <div class="hero-unit self-end mb-2">/hour</div>
        </div>

        <!-- Target comparison badge -->
        <div v-if="stats.target > 0 && activeHeroRate > 0" class="target-comparison-badge" :class="isActiveAboveTarget ? 'above' : 'below'" id="hero-target-comparison">
          <span v-if="isActiveAboveTarget">✓ +{{ activeTargetDeltaPct }}% Above Target</span>
          <span v-else>{{ Math.abs(activeTargetDeltaPct) }}% Below Target</span>
        </div>
      </div>

      <!-- Dual Rates Comparison Strip -->
      <div class="flex items-center gap-4 flex-wrap my-3 p-2.5 bg-off-white border-subtle-box rounded-10 text-xs">
        <div class="flex items-center gap-1.5">
          <span class="text-tertiary">Client-Work Rate:</span>
          <strong class="text-primary">{{ store.fmtHourly(activeClientWorkRate) }}</strong>
          <span class="text-tertiary text-2xs">(net / paid + client unpaid)</span>
        </div>
        <span class="text-tertiary opacity-50">|</span>
        <div class="flex items-center gap-1.5">
          <span class="text-tertiary">All-In Rate:</span>
          <strong class="text-primary">{{ store.fmtHourly(activeAllInRate) }}</strong>
          <span class="text-tertiary text-2xs">(net / all hours)</span>
        </div>
      </div>

      <!-- Target progress bar -->
      <div class="hero-target" v-if="stats.target > 0" id="hero-target-bar-wrap">
        <span class="hero-target-text">
          Target: {{ store.fmtHourly(stats.target) }}
        </span>
        <div class="hero-target-bar">
          <div class="hero-target-fill" :style="{ width: activeProgressPct + '%' }"></div>
        </div>
        <span class="hero-target-text fw-600">{{ Math.round(activeProgressPct) }}%</span>
      </div>

      <!-- Supporting Data Grid (4 Tiles) -->
      <div class="hero-supporting-metrics" id="hero-supporting-data">
        <div class="hero-sub-metric" id="sub-metric-worked">
          <div class="hero-sub-label">Time Worked ({{ selectedWindowLabel }})</div>
          <div class="hero-sub-value kpi-val-1">{{ activeTotalHM }}</div>
          <div class="text-tertiary text-xs mt-1">{{ activePaidHM }} paid · {{ activeUnpaidHM }} unpaid</div>
        </div>

        <div class="hero-sub-metric" id="sub-metric-revenue">
          <div class="hero-sub-label">Collected Revenue</div>
          <div class="hero-sub-value kpi-val-2">{{ store.fmtCurrency(activeCollectedRev) }}</div>
          <div class="text-tertiary text-xs mt-1">
            <span v-if="activeOutstanding > 0" class="text-brand font-semibold">+{{ store.fmtCurrency(activeOutstanding) }} uncollected</span>
            <span v-else>payments received</span>
          </div>
        </div>

        <div class="hero-sub-metric" id="sub-metric-expenses">
          <div class="hero-sub-label">Earned Revenue</div>
          <div class="hero-sub-value kpi-val-3">{{ store.fmtCurrency(activeEarnedRev) }}</div>
          <div class="text-tertiary text-xs mt-1">invoiced & accepted quotes</div>
        </div>

        <div class="hero-sub-metric" id="sub-metric-net">
          <div class="hero-sub-label">Net Return</div>
          <div class="hero-sub-value kpi-val-4">{{ store.fmtCurrency(activeNet) }}</div>
          <div class="text-tertiary text-xs mt-1">after {{ store.fmtCurrency(activeExpenses) }} costs</div>
        </div>
      </div>
    </div>

    <!-- RECENT INSIGHT (Exactly ONE Meaningful Insight at a Time) -->
    <div class="insight-banner-card" v-if="currentInsight" id="home-recent-insight">
      <div class="insight-banner-left">
        <div class="insight-sparkle-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <div class="insight-banner-text">
          {{ currentInsight.text }}
        </div>
      </div>
      <button class="insight-cycle-btn" @click="cycleInsight" v-if="store.recentInsights.length > 1" title="Next insight" id="btn-next-insight">
        <span>Next</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>

    <!-- UNPAID PROJECT INSIGHT BLOCK -->
    <div class="unpaid-insight-card mb-6" id="home-unpaid-insight">
      <div class="unpaid-insight-top">
        <div>
          <div class="badge badge-unpaid mb-1 text-2xs">Time invested before payment</div>
          <div class="unpaid-insight-title mt-1">{{ stats.todayUnpaidHM }} unpaid project work today</div>
          <div class="unpaid-insight-subtitle">Discovery, meetings, requirements & proposals before project billing.</div>
        </div>
        <div class="unpaid-val-badge">
          <div class="unpaid-val-amount">{{ store.fmtCurrency(stats.unpaidEstValue) }}</div>
          <div class="unpaid-val-sub">Estimated value @ {{ store.fmtHourly(stats.target) }}</div>
        </div>
      </div>

      <!-- Relevant Project Links -->
      <div v-if="stats.unpaidProjectsList?.length > 0" class="unpaid-projects-chip-list">
        <span class="text-tertiary text-xs flex items-center mr-1">Relevant projects:</span>
        <NuxtLink
          v-for="p in (stats.unpaidProjectsList || [])"
          :key="p.projectId"
          :to="`/projects/${p.projectId}`"
          class="unpaid-project-chip"
          :id="`unpaid-chip-${p.projectId}`"
        >
          <IconFolders :size="12" />
          <span class="fw-600">{{ p.projectName }}</span>
          <span class="text-tertiary">({{ p.durationHM }} · {{ store.fmtCurrency(p.estValue) }})</span>
        </NuxtLink>
      </div>
    </div>

    <!-- 2-COLUMN SECTION: Today's Work & Value Chart -->
    <div class="grid-2 mb-6">
      <!-- TODAY'S WORK: Chronological Work Sessions -->
      <div class="card" id="home-today-sessions">
        <div class="card-header">
          <div>
            <div class="card-title">Today's Work</div>
            <div class="card-subtitle">{{ (stats.todaySessions || []).length }} chronological session{{ (stats.todaySessions || []).length !== 1 ? 's' : '' }}</div>
          </div>
          <button class="btn btn-secondary btn-sm" @click="showNewSession = true" id="btn-add-session-today">
            <IconPlus :size="13" /> Log Work
          </button>
        </div>

        <div class="card-body p-0">
          <div v-if="!stats.todaySessions || stats.todaySessions.length === 0" class="empty-state py-8 px-4">
            <div class="empty-icon"><IconClock /></div>
            <div class="empty-title text-base">No work logged today</div>
            <div class="empty-desc text-xs">Use Start Work or Log Session to record time.</div>
            <button class="btn btn-primary btn-sm mt-3" @click="showTimerModal = true">Start Work</button>
          </div>

          <div v-else class="chronological-stream">
            <div
              v-for="sess in stats.todaySessions"
              :key="sess.id"
              class="chronological-row"
              :id="`session-row-${sess.id}`"
            >
              <!-- Time Range -->
              <div class="session-time-range">
                {{ formatTimeRange(sess) }}
              </div>

              <!-- Project -->
              <div
                class="session-proj-badge truncate"
                @click="navigateTo(`/projects/${sess.projectId}`)"
                :title="projectName(sess.projectId)"
              >
                {{ projectName(sess.projectId) }}
              </div>

              <!-- Title / Task Description -->
              <div class="session-task-title" :title="sess.title">
                {{ sess.title }}
              </div>

              <!-- Duration -->
              <div class="session-duration-pill">
                {{ store.minutesToHM(sess.durationMin) }}
              </div>

              <!-- Rate / Status -->
              <div class="session-rate-value" :class="sess.paymentType === 'paid' ? 'paid' : 'unpaid'">
                <template v-if="sess.paymentType === 'paid'">
                  {{ getSessionEffectiveRate(sess) }}
                </template>
                <template v-else>
                  <span class="badge badge-unpaid badge-xs">Unpaid</span>
                </template>
              </div>

              <!-- Action -->
              <div>
                <button class="btn btn-ghost btn-icon" @click="confirmDeleteSession(sess.id)" title="Delete session">
                  <IconTrash :size="12" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- VALUE CHART: Day / Week / Month -->
      <div class="card" id="home-value-chart-card">
        <div class="card-header">
          <div>
            <div class="card-title">Effective Value Trend</div>
            <div class="card-subtitle">Personal hourly return over time</div>
          </div>
          <!-- Period switch tabs -->
          <div class="chart-period-tabs" id="chart-period-tabs">
            <button
              class="chart-tab-btn"
              :class="{ active: chartPeriod === 'day' }"
              @click="chartPeriod = 'day'"
              id="tab-chart-day"
            >
              Day
            </button>
            <button
              class="chart-tab-btn"
              :class="{ active: chartPeriod === 'week' }"
              @click="chartPeriod = 'week'"
              id="tab-chart-week"
            >
              Week
            </button>
            <button
              class="chart-tab-btn"
              :class="{ active: chartPeriod === 'month' }"
              @click="chartPeriod = 'month'"
              id="tab-chart-month"
            >
              Month
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- Interactive Bar Chart -->
          <div class="interactive-bar-chart" id="interactive-bar-chart">
            <!-- Target dashed line -->
            <div
              class="chart-target-line"
              v-if="stats.target > 0 && maxChartRate > 0"
              :style="{ bottom: `${Math.min(92, (stats.target / maxChartRate) * 160 + 24)}px` }"
            >
              <span class="chart-target-label">Target: {{ store.fmtHourly(stats.target) }}</span>
            </div>

            <!-- Chart Columns -->
            <div
              v-for="(bar, i) in periodChartData"
              :key="i"
              class="chart-bar-column"
              :class="{ 'is-today': bar.isToday }"
              :title="`${bar.label}: ${store.fmtHourly(bar.rate)} (${bar.hours}h worked)`"
            >
              <div class="chart-bar-value-top" v-if="bar.rate > 0">
                {{ store.fmtCurrency(bar.rate) }}
              </div>
              <div class="chart-bar-value-top text-tertiary" v-else>
                —
              </div>
              <div
                class="chart-bar-fill"
                :style="{
                  height: `${maxChartRate > 0 ? Math.max(6, (bar.rate / maxChartRate) * 130) : 6}px`,
                  opacity: bar.rate === 0 ? '0.2' : (bar.isToday ? '1' : '0.8')
                }"
              ></div>
              <div class="chart-bar-label">{{ bar.label }}</div>
            </div>
          </div>

          <!-- Chart Footer Summary -->
          <div class="flex items-center justify-between text-xs text-tertiary mt-6 pt-2">
            <span>Target line at {{ store.fmtHourly(stats.target) }}</span>
            <span class="fw-600 text-brand">Current Rate: {{ store.fmtHourly(stats.todayHrVal) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- PROJECT SUMMARY: Active Projects -->
    <div class="card mb-6" id="home-active-projects">
      <div class="card-header">
        <div>
          <div class="card-title">Project Summary</div>
          <div class="card-subtitle">Active projects, hours, and economic return</div>
        </div>
        <NuxtLink to="/projects" class="section-action" id="link-all-projects">View All Projects →</NuxtLink>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Status</th>
              <th class="table-text-right">Hours</th>
              <th class="table-text-right">Revenue</th>
              <th class="table-text-right">Effective Value</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="proj in activeProjectsList"
              :key="proj.id"
              :id="`proj-row-${proj.id}`"
              class="cursor-pointer"
              @click="navigateTo(`/projects/${proj.id}`)"
            >
              <td>
                <div class="fw-600 text-sm">{{ proj.name }}</div>
                <div class="text-tertiary text-xs">{{ proj.client?.name || 'Independent Client' }} · {{ proj.serviceCategory || 'General' }}</div>
              </td>
              <td>
                <StatusBadge :status="proj.status" />
              </td>
              <td class="table-text-right tabular text-sm">
                {{ proj.totalHM }}
                <span class="text-tertiary text-xs block" v-if="proj.unpaidMin > 0">({{ proj.unpaidHM }} unpaid)</span>
              </td>
              <td class="table-text-right tabular fw-600 text-sm">
                {{ store.fmtCurrency(proj.revenue) }}
              </td>
              <td class="table-text-right">
                <span v-if="proj.netHrVal > 0" class="fw-700 text-brand text-sm">{{ store.fmtHourly(proj.netHrVal) }}</span>
                <span v-else class="text-tertiary text-sm">—</span>
              </td>
              <td class="table-text-right" @click.stop>
                <NuxtLink :to="`/projects/${proj.id}`" class="btn btn-ghost btn-sm" :id="`btn-open-proj-${proj.id}`">
                  Open
                </NuxtLink>
              </td>
            </tr>

            <tr v-if="activeProjectsList.length === 0">
              <td colspan="6" class="text-center py-6 text-tertiary">
                No active projects. <button class="btn btn-ghost btn-sm text-brand" @click="showNewProject = true">Create one</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Global Modals Integration -->
    <SessionModal v-if="showNewSession" @close="showNewSession = false" @saved="showNewSession = false" />
    <TimerModal v-if="showTimerModal" @close="showTimerModal = false" />
    <ProjectFormModal v-if="showNewProject" @close="showNewProject = false" @created="onProjectCreated" />
    <PaymentModal v-if="showPaymentModal" @close="showPaymentModal = false" @saved="showPaymentModal = false" />
    <ExpenseModal v-if="showExpenseModal" @close="showExpenseModal = false" @saved="showExpenseModal = false" />
    <ConfirmDialog
      v-if="confirmDelete"
      title="Delete work session?"
      message="This session and its logged time will be permanently removed."
      @confirm="executeDeleteSession"
      @cancel="confirmDelete = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

const store = useWelloStore()
const authStore = useAuthStore()
const toast = useToast()

// Modal states
const showNewSession   = ref(false)
const showTimerModal   = ref(false)
const showNewProject   = ref(false)
const showPaymentModal = ref(false)
const showExpenseModal = ref(false)
const confirmDelete    = ref(null)

// Chart period state: 'day' | 'week' | 'month'
const chartPeriod = ref('week')

// Hero Rolling Window state: 'today' | '7d' | '30d' | '90d' | 'ytd' | 'all'
const selectedWindow = ref('30d')
const windowOptions = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: 'ytd', label: 'YTD' },
  { key: 'all', label: 'All' },
]

const selectedWindowLabel = computed(() => {
  const map = { today: 'Today', '7d': '7 Days', '30d': '30 Days', '90d': '90 Days', ytd: 'YTD', all: 'All Time' }
  return map[selectedWindow.value] || '30 Days'
})

// Insights index
const insightIndex = ref(0)

const defaultStats = {
  todayMin: 0,
  todayHM: '0m',
  todayUnpaidMin: 0,
  todayUnpaidHM: '0m',
  todayPaidMin: 0,
  todayPaidHM: '0m',
  todayRev: 0,
  todayExp: 0,
  todayNetVal: 0,
  todayHrVal: 0,
  target: 350,
  isAboveTarget: false,
  targetDelta: 0,
  targetDeltaPct: 0,
  progressPct: 0,
  unpaidEstValue: 0,
  activeProj: 0,
  totalJobs: 0,
  todaySessions: [],
  unpaidProjectsList: [],
}

const stats = computed(() => store.dashboardStats || defaultStats)

const isAllInMetric = computed(() => {
  return (store.user?.headlineRateMetric || stats.value?.headlinePreference) === 'all_in'
})

const activeWindowSummary = computed(() => {
  if (selectedWindow.value === 'today') {
    return null
  }
  return stats.value?.rolling?.[selectedWindow.value] || null
})

const activeHeroRate = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.todayEffHourly || 0
  }
  return activeWindowSummary.value?.rates?.headlineRate || 0
})

const activeClientWorkRate = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.clientWorkRate || 0
  }
  return activeWindowSummary.value?.rates?.clientWorkRate || 0
})

const activeAllInRate = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.allInRate || 0
  }
  return activeWindowSummary.value?.rates?.allInRate || 0
})

const activeZeroHours = computed(() => {
  if (selectedWindow.value === 'today') {
    return (stats.value?.todayMin || 0) <= 0
  }
  return !!activeWindowSummary.value?.rates?.isZeroHours
})

const activeTotalHM = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.todayHM || '0m'
  }
  const mins = activeWindowSummary.value?.hours?.totalAllMinutes || 0
  return store.minutesToHM(mins)
})

const activePaidHM = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.todayPaidHM || '0m'
  }
  const mins = activeWindowSummary.value?.hours?.paidMinutes || 0
  return store.minutesToHM(mins)
})

const activeUnpaidHM = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.todayUnpaidHM || '0m'
  }
  const mins = (activeWindowSummary.value?.hours?.unpaidClientMinutes || 0) + (activeWindowSummary.value?.hours?.intentionalUnpaidMinutes || 0)
  return store.minutesToHM(mins)
})

const activeCollectedRev = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.todayRev || 0
  }
  return activeWindowSummary.value?.financials?.collectedRevenue || 0
})

const activeEarnedRev = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.todayEarnedRevenue || stats.value?.todayRev || 0
  }
  return activeWindowSummary.value?.financials?.earnedRevenue || 0
})

const activeOutstanding = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.todayOutstandingVal || 0
  }
  return activeWindowSummary.value?.financials?.outstandingRevenue || 0
})

const activeExpenses = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.todayExp || 0
  }
  return activeWindowSummary.value?.financials?.directExpenses || 0
})

const activeNet = computed(() => {
  if (selectedWindow.value === 'today') {
    return stats.value?.todayNetVal || 0
  }
  return activeWindowSummary.value?.financials?.collectedNetIncome || 0
})

const activeTargetDeltaPct = computed(() => {
  const target = stats.value?.target || 100
  if (!target || target <= 0) return 0
  return Math.round(((activeHeroRate.value - target) / target) * 100)
})

const isActiveAboveTarget = computed(() => {
  return activeHeroRate.value >= (stats.value?.target || 100)
})

const activeProgressPct = computed(() => {
  const target = stats.value?.target || 100
  if (!target || target <= 0) return 0
  return Math.min((activeHeroRate.value / target) * 100, 100)
})

const firstName = computed(() => {
  const name = authStore.user?.name || store.user?.name || ''
  return name.trim().split(' ')[0] || 'User'
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
})

const formattedDate = computed(() => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const timerProjectName = computed(() => {
  if (!store.activeTimer) return ''
  return store.getProject(store.activeTimer.projectId)?.name || 'Project'
})

// Current dynamic insight
const currentInsight = computed(() => {
  const list = store.recentInsights
  if (!list || list.length === 0) return null
  return list[insightIndex.value % list.length]
})

function cycleInsight() {
  const list = store.recentInsights
  if (list && list.length > 0) {
    insightIndex.value = (insightIndex.value + 1) % list.length
  }
}

// Chart data
const periodChartData = computed(() => {
  return store.getPeriodChartData(chartPeriod.value) || []
})

const maxChartRate = computed(() => {
  const data = periodChartData.value || []
  const maxVal = Math.max(...data.map(d => d.rate || 0), stats.value?.target || 350, 0)
  return Math.max(maxVal * 1.15, 400)
})

// Active projects list
const activeProjectsList = computed(() => {
  return (store.enrichedProjects || [])
    .filter(p => p.status !== 'lost')
    .slice(0, 6)
})

function projectName(projectId) {
  return store.getProject(projectId)?.name || 'General Project'
}

function formatTimeRange(sess) {
  if (sess.startedAt && sess.endedAt) {
    const start = sess.startedAt.slice(11, 16)
    const end = sess.endedAt.slice(11, 16)
    if (start && end) return `${start}–${end}`
  }
  return `Logged session`
}

function getSessionEffectiveRate(sess) {
  const proj = store.getProject(sess.projectId)
  if (!proj) return `${store.currency}750/hr`
  const rate = store.projectNetHourlyValue(proj)
  if (rate > 0) return store.fmtHourly(rate)
  return `${store.currency}750/hr`
}

async function stopTimer() {
  const result = await store.stopTimer()
  if (result) toast.success('Work session saved successfully.')
}

function confirmDeleteSession(id) {
  confirmDelete.value = id
}

function executeDeleteSession() {
  if (confirmDelete.value) {
    store.deleteSession(confirmDelete.value)
    confirmDelete.value = null
    toast.success('Session removed.')
  }
}

function onProjectCreated(proj) {
  showNewProject.value = false
  toast.success(`Project "${proj.name}" created.`)
}

// Live timer ticker
let ticker = null
onMounted(() => {
  ticker = setInterval(() => {}, 1000)
})
onUnmounted(() => {
  if (ticker) clearInterval(ticker)
})
</script>
