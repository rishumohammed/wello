<template>
  <div class="work-tracking-page animate-fade-in">
    <!-- Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-4">
      <div>
        <h1 class="page-title">Work Tracking & History</h1>
        <p class="page-subtitle">Track every session, timer log, and payment classification in real time.</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-secondary btn-sm" @click="showTimerModal = true" id="btn-start-timer-tracking">
          <IconClock :size="14" /> Start Timer
        </button>
        <button class="btn btn-primary btn-sm" @click="showSessionModal = true" id="btn-log-session-tracking">
          <IconPlus :size="14" /> Log Previous Work
        </button>
      </div>
    </div>

    <!-- Active Timer Card if Running -->
    <div v-if="store.activeTimer" class="card card-padded mb-6" style="border-color: rgba(122,63,246,0.3); background: rgba(122,63,246,0.03);" id="tracking-running-timer-banner">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3">
          <span class="timer-running-indicator" :style="{ background: store.isTimerPaused ? '#F59E0B' : 'var(--color-success)' }"></span>
          <div>
            <div class="fw-700 text-lg text-brand">{{ store.timerDisplay() }}</div>
            <div class="text-secondary text-xs">
              Running: <strong>{{ store.activeTimer.title }}</strong> · {{ timerProjectName }}
              <span v-if="store.isTimerPaused" class="text-warning fw-600 ml-1">(Paused)</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button v-if="!store.isTimerPaused" class="btn btn-secondary btn-sm" @click="store.pauseTimer()" id="btn-pause-tracking">
            Pause
          </button>
          <button v-else class="btn btn-secondary btn-sm" @click="store.resumeTimer()" id="btn-resume-tracking">
            Resume
          </button>
          <button class="btn btn-primary btn-sm" @click="stopActiveTimer" id="btn-stop-tracking">
            Stop & Save
          </button>
        </div>
      </div>
    </div>

    <!-- Range Selector Tabs & Custom Pickers -->
    <div class="card card-padded mb-6" id="tracking-range-filter-card">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <!-- Range Tabs -->
        <div class="chart-period-tabs" id="tracking-range-tabs">
          <button
            class="chart-tab-btn"
            :class="{ active: rangeTab === 'today' }"
            @click="rangeTab = 'today'"
            id="tab-range-today"
          >
            Today
          </button>
          <button
            class="chart-tab-btn"
            :class="{ active: rangeTab === 'week' }"
            @click="rangeTab = 'week'"
            id="tab-range-week"
          >
            This Week
          </button>
          <button
            class="chart-tab-btn"
            :class="{ active: rangeTab === 'month' }"
            @click="rangeTab = 'month'"
            id="tab-range-month"
          >
            This Month
          </button>
          <button
            class="chart-tab-btn"
            :class="{ active: rangeTab === 'custom' }"
            @click="rangeTab = 'custom'"
            id="tab-range-custom"
          >
            Custom Range
          </button>
        </div>

        <!-- Custom Date Range Pickers -->
        <div v-if="rangeTab === 'custom'" class="flex items-center gap-2 flex-wrap" id="tracking-custom-dates">
          <input v-model="customStart" type="date" class="form-input" style="padding: 4px 8px; font-size: 12px; width: 135px;" />
          <span class="text-tertiary text-xs">to</span>
          <input v-model="customEnd" type="date" class="form-input" style="padding: 4px 8px; font-size: 12px; width: 135px;" />
        </div>

        <!-- Project Filter Dropdown -->
        <div class="flex items-center gap-2">
          <select v-model="selectedProjectFilter" class="form-select" style="padding: 5px 10px; font-size: 12px; width: 180px;">
            <option value="all">All Projects</option>
            <option v-for="p in store.projects" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Range Summary Statistics (4 Metrics) -->
      <div class="hero-supporting-metrics mt-4 pt-4" id="tracking-range-totals">
        <div class="hero-sub-metric" id="metric-range-total-time">
          <div class="hero-sub-label">Total Time</div>
          <div class="hero-sub-value text-brand">{{ rangeSummary.totalHM }}</div>
          <div class="text-tertiary text-xs mt-1">{{ rangeSummary.sessions.length }} session{{ rangeSummary.sessions.length !== 1 ? 's' : '' }}</div>
        </div>

        <div class="hero-sub-metric" id="metric-range-paid-time">
          <div class="hero-sub-label">Paid Work Time</div>
          <div class="hero-sub-value" style="color:var(--color-success);">{{ rangeSummary.paidHM }}</div>
          <div class="text-tertiary text-xs mt-1">billable / revenue work</div>
        </div>

        <div class="hero-sub-metric" id="metric-range-unpaid-client">
          <div class="hero-sub-label">Unpaid Client Work</div>
          <div class="hero-sub-value" style="color:#D97706;">{{ rangeSummary.unpaidClientHM }}</div>
          <div class="text-tertiary text-xs mt-1">Est. value: {{ store.fmtCurrency(rangeSummary.unpaidClientEst) }}</div>
        </div>

        <div class="hero-sub-metric" id="metric-range-intentional-unpaid">
          <div class="hero-sub-label">Intentional Unpaid</div>
          <div class="hero-sub-value" style="color:#2563EB;">{{ rangeSummary.intentionalUnpaidHM }}</div>
          <div class="text-tertiary text-xs mt-1">Est. value: {{ store.fmtCurrency(rangeSummary.intentionalUnpaidEst) }}</div>
        </div>
      </div>
    </div>

    <!-- Sessions Stream Table / List -->
    <div class="card" id="tracking-sessions-card">
      <div class="card-header">
        <div>
          <div class="card-title">Work Sessions</div>
          <div class="card-subtitle">
            Showing {{ filteredSessionsList.length }} session{{ filteredSessionsList.length !== 1 ? 's' : '' }} for selected period
          </div>
        </div>
      </div>

      <div class="card-body" style="padding:0;">
        <div v-if="filteredSessionsList.length === 0" class="empty-state" style="padding: 40px 16px;">
          <div class="empty-icon"><IconClock /></div>
          <div class="empty-title">No work sessions found</div>
          <div class="empty-desc">No sessions logged for this timeframe. Use Start Timer or Log Previous Work.</div>
          <button class="btn btn-primary btn-sm mt-3" @click="showSessionModal = true">Log Session</button>
        </div>

        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Project</th>
                <th>Task / Description</th>
                <th>Work Type</th>
                <th>Classification</th>
                <th class="table-text-right">Duration</th>
                <th class="table-text-right">Rate / Impact</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="s in filteredSessionsList"
                :key="s.id"
                :id="`tracking-session-row-${s.id}`"
              >
                <!-- Date & Time -->
                <td>
                  <div class="fw-600 text-xs text-primary">{{ formatSessionDate(s) }}</div>
                  <div class="text-tertiary" style="font-size:11px;">{{ formatSessionTime(s) }}</div>
                </td>

                <!-- Project -->
                <td>
                  <NuxtLink :to="`/projects/${s.projectId}`" class="fw-600 text-xs text-brand truncate" style="max-width:140px; display:inline-block;">
                    {{ projectName(s.projectId) }}
                  </NuxtLink>
                </td>

                <!-- Description -->
                <td>
                  <div class="text-xs text-primary fw-500">{{ s.title }}</div>
                  <div class="text-tertiary" style="font-size:11px;" v-if="s.notes">{{ s.notes }}</div>
                </td>

                <!-- Work Type -->
                <td>
                  <span class="badge" style="background:var(--color-off-white); color:var(--text-secondary); text-transform:capitalize; font-size:10px;">
                    {{ s.type }}
                  </span>
                </td>

                <!-- Payment Classification -->
                <td>
                  <span v-if="s.paymentType === 'paid'" class="badge badge-paid" style="font-size:10px;">
                    Paid Work
                  </span>
                  <span v-else-if="s.paymentType === 'unpaid'" class="badge badge-unpaid" style="font-size:10px;">
                    Unpaid Client
                  </span>
                  <span v-else class="badge badge-intentional" style="font-size:10px;">
                    Intentional ({{ s.unpaidReason || 'Personal' }})
                  </span>
                </td>

                <!-- Duration -->
                <td class="table-text-right tabular fw-700 text-xs">
                  {{ store.minutesToHM(s.durationMin) }}
                </td>

                <!-- Rate / Impact -->
                <td class="table-text-right tabular text-xs">
                  <span v-if="s.paymentType === 'paid'" class="fw-700 text-brand">
                    {{ getProjectEffectiveRate(s.projectId) }}
                  </span>
                  <span v-else class="text-warning fw-600">
                    {{ store.fmtCurrency(Math.round((s.durationMin / 60) * (store.user.targetHourly || 350))) }}
                  </span>
                </td>

                <!-- Actions: Edit & Delete -->
                <td class="table-text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button class="btn btn-ghost btn-icon" @click="editSession(s)" title="Edit session" :id="`btn-edit-sess-${s.id}`">
                      <IconEdit :size="13" />
                    </button>
                    <button class="btn btn-ghost btn-icon text-error" @click="sessionToDelete = s.id" title="Delete session" :id="`btn-delete-sess-${s.id}`">
                      <IconTrash :size="13" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <TimerModal v-if="showTimerModal" @close="showTimerModal = false" />
    <SessionModal
      v-if="showSessionModal"
      :session="editingSession"
      @close="closeSessionModal"
      @saved="closeSessionModal"
    />

    <!-- Delete Confirmation -->
    <ConfirmDialog
      v-if="sessionToDelete"
      title="Delete Work Session?"
      message="This work session will be permanently removed and recalculate all project and range totals."
      danger
      @confirm="executeDeleteSession"
      @cancel="sessionToDelete = null"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const store = useWelloStore()
const toast = useToast()

const showTimerModal   = ref(false)
const showSessionModal = ref(false)
const editingSession   = ref(null)
const sessionToDelete  = ref(null)

const rangeTab = ref('today')
const customStart = ref(new Date().toISOString().slice(0, 10))
const customEnd   = ref(new Date().toISOString().slice(0, 10))
const selectedProjectFilter = ref('all')

const timerProjectName = computed(() => {
  if (!store.activeTimer) return ''
  return store.getProject(store.activeTimer.projectId)?.name || 'Project'
})

const rangeSummary = computed(() => {
  return store.getSessionsByRange(
    rangeTab.value,
    customStart.value,
    customEnd.value
  )
})

const filteredSessionsList = computed(() => {
  let list = rangeSummary.value.sessions
  if (selectedProjectFilter.value !== 'all') {
    list = list.filter(s => s.projectId === selectedProjectFilter.value)
  }
  return list
})

function projectName(projectId) {
  return store.getProject(projectId)?.name || 'General Project'
}

function getProjectEffectiveRate(projectId) {
  const p = store.getProject(projectId)
  if (!p) return `${store.currency}750/hr`
  const r = store.projectNetHourlyValue(p)
  return r > 0 ? store.fmtHourly(r) : `${store.currency}750/hr`
}

function formatSessionDate(s) {
  if (!s.startedAt) return 'Today'
  return new Date(s.startedAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  })
}

function formatSessionTime(s) {
  if (s.startedAt && s.endedAt) {
    return `${s.startedAt.slice(11, 16)}–${s.endedAt.slice(11, 16)}`
  }
  return s.startedAt ? s.startedAt.slice(11, 16) : 'Logged'
}

function editSession(sess) {
  editingSession.value = sess
  showSessionModal.value = true
}

function closeSessionModal() {
  showSessionModal.value = false
  editingSession.value = null
}

function stopActiveTimer() {
  const res = store.stopTimer()
  if (res) toast.success('Work session saved.')
}

function executeDeleteSession() {
  if (sessionToDelete.value) {
    store.deleteSession(sessionToDelete.value)
    sessionToDelete.value = null
    toast.success('Session deleted.')
  }
}
</script>

<style scoped>
.work-tracking-page {
  max-width: 1140px;
  margin: 0 auto;
}
</style>
