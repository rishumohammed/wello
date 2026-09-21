<template>
  <div class="work-hub-page animate-fade-in">
    <!-- Master Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-4">
      <div>
        <h1 class="page-title">Work Hub</h1>
        <p class="page-subtitle">Manage engagements and track work sessions in one unified workspace.</p>
      </div>

      <!-- Contextual Action Buttons -->
      <div class="flex items-center gap-2 flex-wrap">
        <template v-if="activeTab === 'projects'">
          <button class="btn btn-primary" @click="showNewProject = true" id="btn-workhub-new-project">
            <IconPlus :size="14" /> New Project
          </button>
        </template>
        <template v-else-if="activeTab === 'time'">
          <button class="btn btn-secondary btn-sm" @click="showTimerModal = true" id="btn-workhub-start-timer">
            <IconClock :size="14" /> Start Timer
          </button>
          <button class="btn btn-primary btn-sm" @click="showNewSession = true" id="btn-workhub-log-session">
            <IconPlus :size="14" /> Log Session
          </button>
        </template>
      </div>
    </div>

    <!-- Active Timer Banner (Always Visible when timer is running) -->
    <div v-if="store.activeTimer" class="card mb-6 timer-running-card" id="workhub-running-timer-card">
      <div class="card-padded flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3">
          <span class="timer-running-indicator"></span>
          <div>
            <div class="fw-700 text-base text-brand">{{ store.timerDisplay() }}</div>
            <div class="text-tertiary text-xs">Running: {{ store.activeTimer.title }} · {{ timerProjectName }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-secondary btn-sm" @click="showTimerModal = true">View Timer</button>
          <button class="btn btn-primary btn-sm" @click="stopTimer" id="btn-stop-timer-workhub">Stop & Save</button>
        </div>
      </div>
    </div>

    <!-- Filter & Search Strip -->
    <div v-if="activeTab === 'projects'" class="animate-fade-in" id="workhub-section-projects">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div class="filter-strip mb-0" id="projects-filter-strip">
          <button
            v-for="f in projectFilters"
            :key="f.value"
            class="filter-chip"
            :class="{ active: activeProjectFilter === f.value }"
            @click="activeProjectFilter = f.value"
            :id="`filter-${f.value}`"
          >
            {{ f.label }}
            <span v-if="projectFilterCount(f.value)" class="text-xs opacity-75 ml-1">
              ({{ projectFilterCount(f.value) }})
            </span>
          </button>
        </div>

        <!-- Search Input & Time Logs Icon Button -->
        <div class="flex items-center gap-2">
          <div class="search-wrap">
            <input
              v-model="projectSearchQuery"
              type="text"
              class="form-input text-xs"
              placeholder="Search by project or customer…"
              id="input-search-projects"
            />
          </div>

          <button
            type="button"
            class="btn btn-secondary flex items-center gap-2"
            @click="setTab('time')"
            title="Time Logs & Tracking"
            id="btn-toggle-time-logs"
          >
            <IconClock :size="16" />
            <span class="text-xs font-semibold hidden sm:inline">Time Logs</span>
            <span class="work-hub-tab-badge">{{ store.sessions.length }}</span>
          </button>
        </div>
      </div>

      <!-- Projects List -->
      <div v-if="filteredProjects.length === 0" class="empty-state" id="projects-empty-state">
        <div class="empty-icon"><IconFolders /></div>
        <div class="empty-title">No projects {{ activeProjectFilter !== 'all' ? 'with status "' + activeProjectFilter + '"' : '' }}</div>
        <div class="empty-desc">
          {{ projectSearchQuery ? 'Try adjusting your search query.' : 'Create your first project to start tracking work and economic return.' }}
        </div>
        <button class="btn btn-primary btn-sm mt-3" @click="showNewProject = true">New Project</button>
      </div>

      <div v-else class="project-list">
        <div
          v-for="proj in filteredProjects"
          :key="proj.id"
          class="project-card"
          @click="navigateTo(`/projects/${proj.id}`)"
          :id="`project-card-${proj.id}`"
        >
          <!-- Top row -->
          <div class="project-card-top">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1 flex-wrap">
                <div class="project-card-name truncate">{{ proj.name }}</div>
                <span v-if="proj.isJob" class="badge badge-job text-xs">Job</span>
                <StatusBadge :status="proj.status" />
              </div>
              <div class="project-card-client">
                {{ proj.client?.name || 'Independent Customer' }} · {{ proj.serviceCategory || 'General Service' }}
              </div>
            </div>

            <!-- Quick Action Dropdown -->
            <div class="project-card-actions" @click.stop>
              <div class="dropdown-wrap relative">
                <button
                  type="button"
                  class="btn btn-ghost btn-icon btn-sm"
                  @click="activeDropdownId = activeDropdownId === proj.id ? null : proj.id"
                  title="Project actions"
                  :id="`btn-proj-actions-${proj.id}`"
                >
                  <IconMore :size="15" />
                </button>
                <div
                  v-if="activeDropdownId === proj.id"
                  class="dropdown-menu animate-fade-in"
                  @click.stop
                >
                  <NuxtLink :to="`/projects/${proj.id}`" class="dropdown-item" @click="activeDropdownId = null">View Details</NuxtLink>
                  <button class="dropdown-item" @click="showNewSession = true; activeDropdownId = null">Log Session</button>
                  <button
                    v-if="proj.status !== 'completed' && proj.status !== 'lost'"
                    class="dropdown-item text-danger"
                    @click="confirmMarkLost(proj); activeDropdownId = null"
                  >
                    Mark as Lost
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Description -->
          <p v-if="proj.description" class="text-xs text-secondary clamp-2">
            {{ proj.description }}
          </p>

          <!-- Quote & Hours progress bar -->
          <div v-if="proj.quoteEstHours" class="project-hours-progress">
            <div class="flex justify-between text-2xs text-tertiary mb-1">
              <span>Logged: {{ proj.totalHM }}</span>
              <span>Est: {{ proj.quoteEstHours }}h</span>
            </div>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: Math.min((proj.totalMin / 60 / proj.quoteEstHours) * 100, 100) + '%' }"
              ></div>
            </div>
          </div>

          <!-- Bottom statistics bar -->
          <div class="project-card-stats">
            <div class="project-stat">
              <span class="project-stat-label">Hours Logged</span>
              <span class="project-stat-value">{{ proj.totalHM }}</span>
            </div>
            <div class="project-stat">
              <span class="project-stat-label">Revenue Collected</span>
              <span class="project-stat-value">{{ store.fmtCurrency(proj.revenue) }}</span>
            </div>
            <div class="project-stat">
              <span class="project-stat-label">Effective Hourly</span>
              <span class="project-stat-value accent">
                {{ proj.netHrVal > 0 ? store.fmtHourly(proj.netHrVal) : '—' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- =========================================
         TIME LOGS & TRACKING SECTION
         ========================================= -->
    <div v-else-if="activeTab === 'time'" class="animate-fade-in" id="workhub-section-time">
      <!-- Section Navigation Bar -->
      <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="setTab('projects')"
            id="btn-back-to-projects"
          >
            <IconBack :size="14" />
            <span>Projects</span>
          </button>
          <h2 class="text-base font-bold text-primary mb-0">Time Logs & Tracking</h2>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-primary flex items-center gap-2"
            @click="setTab('projects')"
            title="Return to Projects"
            id="btn-time-logs-active-icon"
          >
            <IconClock :size="16" />
            <span class="text-xs font-semibold hidden sm:inline">Time Logs</span>
            <span class="work-hub-tab-badge text-purple bg-white-20">{{ store.sessions.length }}</span>
          </button>
        </div>
      </div>

      <!-- Range Filter & Project Selector -->
      <div class="card card-padded mb-6" id="time-range-filter-card">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <!-- Range Tabs -->
          <div class="chart-period-tabs" id="time-range-tabs">
            <button
              class="chart-tab-btn"
              :class="{ active: timeRangeTab === 'today' }"
              @click="timeRangeTab = 'today'"
              id="tab-time-today"
            >
              Today
            </button>
            <button
              class="chart-tab-btn"
              :class="{ active: timeRangeTab === 'week' }"
              @click="timeRangeTab = 'week'"
              id="tab-time-week"
            >
              This Week
            </button>
            <button
              class="chart-tab-btn"
              :class="{ active: timeRangeTab === 'month' }"
              @click="timeRangeTab = 'month'"
              id="tab-time-month"
            >
              This Month
            </button>
            <button
              class="chart-tab-btn"
              :class="{ active: timeRangeTab === 'all' }"
              @click="timeRangeTab = 'all'"
              id="tab-time-all"
            >
              All
            </button>
            <button
              class="chart-tab-btn"
              :class="{ active: timeRangeTab === 'custom' }"
              @click="timeRangeTab = 'custom'"
              id="tab-time-custom"
            >
              Custom
            </button>
          </div>

          <!-- Project Filter Dropdown -->
          <div class="flex items-center gap-2">
            <select v-model="selectedProjectFilter" class="form-select form-select-sm" id="time-project-select">
              <option value="all">All Projects</option>
              <option v-for="p in store.projects" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
          </div>
        </div>

        <!-- Custom Date Range Bar for Time Logs -->
        <div v-if="timeRangeTab === 'custom'" class="flex items-center justify-between flex-wrap gap-2 text-xs text-secondary mt-3 pt-3 border-t w-full animate-fade-in" id="time-custom-date-bar">
          <div class="flex items-center gap-2">
            <span class="fw-600 text-primary">Custom Dates:</span>
            <span>From</span>
            <input
              v-model="timeCustomStart"
              type="date"
              class="form-input form-input-sm"
              :max="timeCustomEnd || todayStr"
              id="time-custom-start"
            />
            <span>To</span>
            <input
              v-model="timeCustomEnd"
              type="date"
              class="form-input form-input-sm"
              :min="timeCustomStart"
              :max="todayStr"
              id="time-custom-end"
            />
          </div>
          <span class="text-tertiary text-2xs">Filtered by work session timestamp</span>
        </div>
      </div>

      <!-- Session Stream List -->
      <div class="card mb-6" id="time-sessions-card">
        <div class="card-header">
          <div>
            <div class="card-title">Work Session History</div>
            <div class="card-subtitle">{{ filteredSessions.length }} session{{ filteredSessions.length !== 1 ? 's' : '' }} recorded</div>
          </div>
          <button class="btn btn-secondary btn-sm" @click="showNewSession = true">
            <IconPlus :size="13" /> Log Work
          </button>
        </div>

        <div class="card-body p-0">
          <div v-if="filteredSessions.length === 0" class="empty-state py-8 px-4">
            <div class="empty-icon"><IconClock /></div>
            <div class="empty-title text-base">No work sessions logged</div>
            <div class="empty-desc text-xs">Use Start Timer or Log Session to record work hours.</div>
            <button class="btn btn-primary btn-sm mt-3" @click="showTimerModal = true">Start Work</button>
          </div>

          <div v-else class="chronological-stream">
            <div
              v-for="sess in filteredSessions"
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

              <!-- Task Title -->
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
                <template v-else-if="sess.paymentType === 'intentional_unpaid'">
                  <span class="badge badge-intentional badge-xs" :title="sess.unpaidReason">
                    {{ formatTaxonomyReason(sess.unpaidReason) || 'Intentional' }}
                  </span>
                </template>
                <template v-else>
                  <span class="badge badge-unpaid badge-xs" :title="sess.unpaidReason">
                    {{ formatTaxonomyReason(sess.unpaidReason) || 'Unpaid' }}
                  </span>
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
import { useToast } from '~/composables/useToast'

const route = useRoute()
const router = useRouter()
const store = useWelloStore()
const toast = useToast()

// Master Tab State: 'projects' | 'time' | 'jobs'
const activeTab = ref(route.query.tab || 'projects')

function setTab(tab) {
  activeTab.value = tab
  router.push({ path: '/work', query: { tab } })
}

// Modals & Dropdowns
const showNewSession = ref(false)
const showTimerModal = ref(false)
const showNewProject = ref(false)
const showPaymentModal = ref(false)
const showExpenseModal = ref(false)
const confirmDelete = ref(null)
const activeDropdownId = ref(null)

// ── Tab 1: Projects Logic ──
const activeProjectFilter = ref('all')
const projectSearchQuery = ref('')

const projectFilters = [
  { label: 'All Projects', value: 'all' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Proposals', value: 'lead' },
  { label: 'Completed', value: 'completed' },
  { label: 'Lost', value: 'lost' },
]

function projectFilterCount(val) {
  if (val === 'all') return store.projects.length
  return store.projects.filter(p => p.status === val).length
}

const filteredProjects = computed(() => {
  let list = store.projects
  if (activeProjectFilter.value !== 'all') {
    list = list.filter(p => p.status === activeProjectFilter.value)
  }
  if (projectSearchQuery.value.trim()) {
    const q = projectSearchQuery.value.toLowerCase()
    list = list.filter(p => p.name.toLowerCase().includes(q) || (p.client?.name && p.client.name.toLowerCase().includes(q)))
  }
  return list
})

function confirmMarkLost(proj) {
  store.updateProjectStatus(proj.id, 'lost')
  toast.info(`Project "${proj.name}" marked as lost.`)
}

// ── Tab 2: Time Logs Logic ──
const todayStr = new Date().toISOString().slice(0, 10)
const timeRangeTab = ref('today')
const timeCustomStart = ref(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
const timeCustomEnd = ref(todayStr)
const selectedProjectFilter = ref('all')

const filteredSessions = computed(() => {
  const rangeResult = store.getSessionsByRange(
    timeRangeTab.value,
    timeCustomStart.value,
    timeCustomEnd.value
  )
  let list = rangeResult.sessions || []
  if (selectedProjectFilter.value !== 'all') {
    list = list.filter(s => s.projectId === selectedProjectFilter.value)
  }
  return list
})

function formatTimeRange(sess) {
  if (!sess.startedAt || !sess.endedAt) return 'Manual Log'
  const start = new Date(sess.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const end = new Date(sess.endedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return `${start} - ${end}`
}

function formatTaxonomyReason(reason) {
  if (!reason) return ''
  const map = {
    scope_creep: 'Scope Creep',
    revisions_beyond_scope: 'Revisions',
    pitching: 'Pitching',
    client_friction: 'Client Friction',
    admin_overhead: 'Admin Overhead',
    uncollectible: 'Uncollectible',
    learning: 'Learning',
    portfolio: 'Portfolio',
    charity: 'Charity',
    strategic: 'Strategic',
    personal: 'Personal',
  }
  return map[reason] || reason.replace(/_/g, ' ')
}

function getSessionEffectiveRate(sess) {
  const proj = store.getProject(sess.projectId)
  if (!proj || proj.totalMin <= 0) return '—'
  const rate = Math.round(proj.netHrVal || 0)
  return `${store.currency}${rate}/h`
}

function projectName(projectId) {
  return store.getProject(projectId)?.name || 'General Work'
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

const timerProjectName = computed(() => {
  if (!store.activeTimer) return ''
  return store.getProject(store.activeTimer.projectId)?.name || 'Project'
})

async function stopTimer() {
  await store.stopTimer()
  toast.success('Timer stopped and session saved.')
}

function onProjectCreated(proj) {
  showNewProject.value = false
  toast.success(`Project "${proj.name}" created successfully.`)
}

function handleClickOutside(event) {
  activeDropdownId.value = null
}

onMounted(() => {
  if (route.query.tab === 'time') {
    activeTab.value = 'time'
  } else {
    activeTab.value = 'projects'
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleClickOutside)
  }
})
</script>
