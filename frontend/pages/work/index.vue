<template>
  <div class="work-hub-page animate-fade-in">
    <!-- Master Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-4">
      <div>
        <h1 class="page-title">Work Hub</h1>
        <p class="page-subtitle">Manage projects, income sources, overhead costs, and time logs in one unified workspace.</p>
      </div>

      <!-- Contextual Action Buttons -->
      <div class="flex items-center gap-2 flex-wrap">
        <button class="btn btn-secondary btn-sm" @click="showQuickEntryModal = true" id="btn-workhub-quick-entry">
          <span class="text-base">⚡</span>
          <span>Quick Entry</span>
        </button>

        <template v-if="activeTab === 'projects'">
          <button class="btn btn-primary btn-sm" @click="showNewProject = true" id="btn-workhub-new-project">
            <IconPlus :size="14" /> New Project
          </button>
        </template>
        <template v-else-if="activeTab === 'income_sources'">
          <button class="btn btn-primary btn-sm" @click="openIncomeSourceModal(null)" id="btn-workhub-new-source">
            <IconPlus :size="14" /> Add Income Source
          </button>
        </template>
        <template v-else-if="activeTab === 'overhead'">
          <button class="btn btn-primary btn-sm" @click="openOverheadModal(null)" id="btn-workhub-new-overhead">
            <IconPlus :size="14" /> Add Overhead Cost
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
            <div class="text-tertiary text-xs">Running: {{ store.activeTimer.title }} · {{ timerTargetName }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-secondary btn-sm" @click="showTimerModal = true">View Timer</button>
          <button class="btn btn-primary btn-sm" @click="stopTimer" id="btn-stop-timer-workhub">Stop & Save</button>
        </div>
      </div>
    </div>

    <!-- Master Navigation Tabs Strip -->
    <div class="filter-strip mb-5" id="workhub-tabs-strip">
      <button
        class="filter-chip"
        :class="{ active: activeTab === 'projects' }"
        @click="setTab('projects')"
        id="tab-workhub-projects"
      >
        <IconFolders :size="14" />
        <span>Projects ({{ store.projects.length }})</span>
      </button>

      <button
        class="filter-chip"
        :class="{ active: activeTab === 'income_sources' }"
        @click="setTab('income_sources')"
        id="tab-workhub-income-sources"
      >
        <span>💼</span>
        <span>Income Sources ({{ store.incomeSources.length }})</span>
      </button>

      <button
        class="filter-chip"
        :class="{ active: activeTab === 'overhead' }"
        @click="setTab('overhead')"
        id="tab-workhub-overhead"
      >
        <span>🚆</span>
        <span>Overhead & Costs ({{ store.overheads.length }})</span>
      </button>

      <button
        class="filter-chip"
        :class="{ active: activeTab === 'time' }"
        @click="setTab('time')"
        id="tab-workhub-time"
      >
        <IconClock :size="14" />
        <span>Time Logs ({{ store.sessions.length }})</span>
      </button>
    </div>

    <!-- =========================================
         TAB 1: PROJECTS & CLIENT WORK
         ========================================= -->
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

        <div class="search-wrap">
          <input
            v-model="projectSearchQuery"
            type="text"
            class="form-input text-xs"
            placeholder="Search by project or customer…"
            id="input-search-projects"
          />
        </div>
      </div>

      <!-- Projects List -->
      <EmptyState
        v-if="filteredProjects.length === 0"
        icon="📁"
        :title="`No projects ${activeProjectFilter !== 'all' ? 'with status \'' + activeProjectFilter + '\'' : ''}`"
        :description="projectSearchQuery ? 'Try adjusting your search query.' : 'Create your first project to start tracking client deliverables and quotes.'"
        actionText="New Project"
        actionId="btn-empty-new-project"
        @action="showNewProject = true"
      />

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
         TAB 2: INCOME SOURCES & EMPLOYERS
         ========================================= -->
    <div v-else-if="activeTab === 'income_sources'" class="animate-fade-in" id="workhub-section-income-sources">
      <!-- Income Sources Hero & Summary Banner -->
      <div class="p-4 bg-off-white border-subtle-box rounded-14 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div class="fw-700 text-sm text-primary">Multi-Employer, Salaried, Retainer & Gig Tracking</div>
          <div class="text-xs text-tertiary mt-0.5">
            Track individual hourly rates, shift wages, retainers, and salaried benchmarks without requiring client invoices.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn btn-secondary btn-sm" @click="showQuickEntryModal = true">
            ⚡ Quick Entry
          </button>
          <button class="btn btn-primary btn-sm" @click="openIncomeSourceModal(null)">
            + Add Income Source
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="store.incomeSources.length === 0" class="empty-state" id="income-sources-empty-state">
        <div class="empty-icon">💼</div>
        <div class="empty-title">No income sources added yet</div>
        <div class="empty-desc">
          Add your employers, salaried jobs, daily/hourly wage positions, retainers, or gig platforms to track true hourly value.
        </div>
        <button class="btn btn-primary btn-sm mt-3" @click="openIncomeSourceModal(null)">Add First Source</button>
      </div>

      <!-- Sources Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="src in store.incomeSources"
          :key="src.id"
          class="card p-4 flex flex-col justify-between hover:shadow-soft-md transition-all"
          :id="`income-source-card-${src.id}`"
        >
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <span class="text-xl">{{ getSourceIcon(src.type) }}</span>
                <div>
                  <div class="fw-700 text-sm text-primary">{{ src.name }}</div>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <span class="badge badge-secondary text-2xs uppercase">{{ src.type }}</span>
                    <span class="badge badge-purple text-2xs">{{ src.payFrequency }}</span>
                  </div>
                </div>
              </div>

              <!-- Action Menu -->
              <div class="flex items-center gap-1">
                <button
                  class="btn btn-ghost btn-icon btn-xs"
                  @click="openIncomeSourceModal(src)"
                  title="Edit Source"
                  :id="`btn-edit-source-${src.id}`"
                >
                  <IconEdit :size="13" />
                </button>
                <button
                  class="btn btn-ghost btn-icon btn-xs text-danger"
                  @click="confirmDeleteSource(src.id)"
                  title="Delete Source"
                  :id="`btn-delete-source-${src.id}`"
                >
                  <IconTrash :size="13" />
                </button>
              </div>
            </div>

            <!-- Expected Benchmarks -->
            <div v-if="src.expectedAmount || src.expectedHoursPerPeriod" class="p-2.5 bg-off-white rounded-8 text-xs text-secondary mb-3">
              <div class="flex justify-between items-center mb-1">
                <span class="text-tertiary">Expected:</span>
                <span class="fw-600">{{ store.fmtCurrency(src.expectedAmount || 0, src.currency) }} / {{ src.payFrequency }}</span>
              </div>
              <div class="flex justify-between items-center" v-if="src.expectedHoursPerPeriod">
                <span class="text-tertiary">Target Hours:</span>
                <span class="fw-600">{{ src.expectedHoursPerPeriod }}h / period</span>
              </div>
            </div>
          </div>

          <!-- Bottom Metric Strip -->
          <div class="pt-3 border-t border-neutral/60 grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div class="text-[10px] text-tertiary uppercase">Hours</div>
              <div class="fw-700 text-sm mt-0.5">{{ store.minutesToHM(src.totalMinutes || 0) }}</div>
            </div>
            <div>
              <div class="text-[10px] text-tertiary uppercase">Collected</div>
              <div class="fw-700 text-sm mt-0.5">{{ store.fmtCurrency(src.totalCollected || 0, src.currency) }}</div>
            </div>
            <div>
              <div class="text-[10px] text-tertiary uppercase">Real Hourly</div>
              <div class="fw-800 text-sm text-brand mt-0.5">
                {{ src.effectiveHourlyRate > 0 ? store.fmtHourly(src.effectiveHourlyRate, src.currency) : '—' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- =========================================
         TAB 3: OVERHEAD & NON-PROJECT COSTS
         ========================================= -->
    <div v-else-if="activeTab === 'overhead'" class="animate-fade-in" id="workhub-section-overhead">
      <!-- Overhead Summary Banner -->
      <div class="p-4 bg-off-white border-subtle-box rounded-14 mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div class="fw-700 text-sm text-primary">Overhead, Equipment & Commute Allocations</div>
          <div class="text-xs text-tertiary mt-0.5">
            Deduct transit passes, tools, software licenses, and gear to calculate your True All-In Hourly Return.
          </div>
        </div>
        <button class="btn btn-primary btn-sm" @click="openOverheadModal(null)" id="btn-add-overhead-top">
          + Add Overhead Cost
        </button>
      </div>

      <!-- Empty State -->
      <EmptyState
        v-if="store.overheads.length === 0"
        icon="🚆"
        title="No overhead costs recorded"
        description="Add commute fares, tool purchases, software subscriptions, or equipment to factor them into your effective hourly rates."
        actionText="Add Overhead Cost"
        actionId="btn-empty-add-overhead"
        @action="openOverheadModal(null)"
      />

      <!-- Overhead Table -->
      <div v-else class="card" id="overhead-table-card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Expense & Category</th>
                <th>Recurrence</th>
                <th>Allocation Rule</th>
                <th class="table-text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cost in store.overheads" :key="cost.id" :id="`overhead-row-${cost.id}`">
                <td>
                  <div class="flex items-center gap-2">
                    <span class="text-lg">{{ getOverheadCategoryIcon(cost.category) }}</span>
                    <div>
                      <div class="fw-600 text-sm text-primary">{{ cost.name }}</div>
                      <div class="text-xs text-tertiary capitalize">{{ cost.category.replace(/_/g, ' ') }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge badge-secondary text-xs capitalize">{{ cost.frequency }}</span>
                </td>
                <td>
                  <div class="flex items-center gap-1.5">
                    <span class="badge badge-purple text-xs">{{ formatAllocationRule(cost.allocationRule) }}</span>
                    <span v-if="cost.allocationRule === 'per_source' && cost.incomeSourceName" class="text-xs text-tertiary">
                      ({{ cost.incomeSourceName }})
                    </span>
                  </div>
                </td>
                <td class="table-text-right tabular fw-700 text-sm">
                  {{ store.fmtCurrency(cost.amount, cost.currency) }}
                </td>
                <td class="table-text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button class="btn btn-ghost btn-icon btn-xs" @click="openOverheadModal(cost)" title="Edit">
                      <IconEdit :size="13" />
                    </button>
                    <button class="btn btn-ghost btn-icon btn-xs text-danger" @click="confirmDeleteOverhead(cost.id)" title="Delete">
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

    <!-- =========================================
         TAB 4: TIME LOGS & TRACKING SECTION
         ========================================= -->
    <div v-else-if="activeTab === 'time'" class="animate-fade-in" id="workhub-section-time">
      <!-- Range Filter & Target Selector -->
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

          <!-- Target Filter Dropdown -->
          <div class="flex items-center gap-2">
            <select v-model="selectedTargetFilter" class="form-select form-select-sm" id="time-target-select">
              <option value="all">All Targets</option>
              <optgroup label="Projects" v-if="store.projects.length > 0">
                <option v-for="p in store.projects" :key="'p-' + p.id" :value="'p-' + p.id">
                  📁 {{ p.name }}
                </option>
              </optgroup>
              <optgroup label="Income Sources" v-if="store.incomeSources.length > 0">
                <option v-for="s in store.incomeSources" :key="'s-' + s.id" :value="'s-' + s.id">
                  💼 {{ s.name }}
                </option>
              </optgroup>
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
          <div class="flex items-center gap-2">
            <button class="btn btn-secondary btn-sm" @click="showQuickEntryModal = true">
              ⚡ Quick Entry
            </button>
            <button class="btn btn-secondary btn-sm" @click="showNewSession = true">
              <IconPlus :size="13" /> Log Work
            </button>
          </div>
        </div>

        <div class="card-body p-0">
          <div v-if="filteredSessions.length === 0" class="empty-state py-8 px-4">
            <div class="empty-icon"><IconClock /></div>
            <div class="empty-title text-base">No work sessions logged</div>
            <div class="empty-desc text-xs">Use Quick Entry, Start Timer, or Log Session to record work hours.</div>
            <div class="flex items-center gap-2 mt-3">
              <button class="btn btn-primary btn-sm" @click="showQuickEntryModal = true">⚡ 2-Tap Quick Entry</button>
              <button class="btn btn-secondary btn-sm" @click="showTimerModal = true">Start Work</button>
            </div>
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

              <!-- Project or Income Source Badge -->
              <div
                class="session-proj-badge truncate"
                :title="getSessionTargetLabel(sess)"
              >
                {{ getSessionTargetLabel(sess) }}
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
    <QuickEntryModal v-if="showQuickEntryModal" @close="showQuickEntryModal = false" @saved="showQuickEntryModal = false" />
    <IncomeSourceModal v-if="showIncomeSourceModal" :source="editingSource" @close="showIncomeSourceModal = false; editingSource = null" @saved="showIncomeSourceModal = false; editingSource = null" />
    <OverheadModal v-if="showOverheadModal" :overhead="editingOverhead" @close="showOverheadModal = false; editingOverhead = null" @saved="showOverheadModal = false; editingOverhead = null" />
    <SessionModal v-if="showNewSession" @close="showNewSession = false" @saved="showNewSession = false" />
    <TimerModal v-if="showTimerModal" @close="showTimerModal = false" />
    <ProjectFormModal v-if="showNewProject" @close="showNewProject = false" @created="onProjectCreated" />
    <PaymentModal v-if="showPaymentModal" @close="showPaymentModal = false" @saved="showPaymentModal = false" />
    <ExpenseModal v-if="showExpenseModal" @close="showExpenseModal = false" @saved="showExpenseModal = false" />
    <ConfirmDialog
      v-if="confirmDelete"
      :title="confirmDeleteTitle"
      :message="confirmDeleteMessage"
      @confirm="executeDelete"
      @cancel="confirmDelete = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'
import EmptyState from '~/components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const store = useWelloStore()
const toast = useToast()

// Master Tab State: 'projects' | 'income_sources' | 'overhead' | 'time'
const activeTab = ref(route.query.tab || 'projects')

function setTab(tab) {
  activeTab.value = tab
  router.push({ path: '/work', query: { tab } })
}

// Modals & Dropdowns
const showQuickEntryModal   = ref(false)
const showIncomeSourceModal = ref(false)
const showOverheadModal     = ref(false)
const showNewSession        = ref(false)
const showTimerModal        = ref(false)
const showNewProject        = ref(false)
const showPaymentModal      = ref(false)
const showExpenseModal      = ref(false)
const activeDropdownId      = ref(null)

const editingSource   = ref(null)
const editingOverhead = ref(null)

const confirmDelete        = ref(null)
const confirmDeleteType    = ref('')
const confirmDeleteTitle   = ref('')
const confirmDeleteMessage = ref('')

function openIncomeSourceModal(src = null) {
  editingSource.value = src
  showIncomeSourceModal.value = true
}

function openOverheadModal(cost = null) {
  editingOverhead.value = cost
  showOverheadModal.value = true
}

function getSourceIcon(type) {
  switch (type) {
    case 'salary': return '💼'
    case 'hourly_wage': return '⏱️'
    case 'daily_wage': return '📅'
    case 'retainer': return '🔄'
    case 'gig': return '🛵'
    default: return '💰'
  }
}

function getOverheadCategoryIcon(cat) {
  switch (cat) {
    case 'commute': return '🚆'
    case 'tool': return '🔨'
    case 'software': return '💻'
    case 'phone_internet': return '📱'
    case 'equipment': return '🎧'
    case 'uniform': return '🦺'
    case 'license': return '📜'
    default: return '📦'
  }
}

function formatAllocationRule(rule) {
  switch (rule) {
    case 'per_hour_worked': return 'Per Hour'
    case 'per_period': return 'Per Period'
    case 'per_source': return 'Per Source'
    case 'none':
    default: return 'Unallocated'
  }
}

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

// ── Tab 4: Time Logs Logic ──
const todayStr = new Date().toISOString().slice(0, 10)
const timeRangeTab = ref('today')
const timeCustomStart = ref(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
const timeCustomEnd = ref(todayStr)
const selectedTargetFilter = ref('all')

const filteredSessions = computed(() => {
  const rangeResult = store.getSessionsByRange(
    timeRangeTab.value,
    timeCustomStart.value,
    timeCustomEnd.value
  )
  let list = rangeResult.sessions || []
  if (selectedTargetFilter.value !== 'all') {
    if (selectedTargetFilter.value.startsWith('p-')) {
      const pId = selectedTargetFilter.value.replace('p-', '')
      list = list.filter(s => s.projectId === pId)
    } else if (selectedTargetFilter.value.startsWith('s-')) {
      const sId = selectedTargetFilter.value.replace('s-', '')
      list = list.filter(s => s.incomeSourceId === sId)
    }
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
    commute: 'Commute',
  }
  return map[reason] || reason.replace(/_/g, ' ')
}

function getSessionEffectiveRate(sess) {
  if (sess.projectId) {
    const proj = store.getProject(sess.projectId)
    if (proj && proj.netHrVal > 0) return `${store.currency}${Math.round(proj.netHrVal)}/h`
  }
  if (sess.incomeSourceId) {
    const src = store.incomeSources.find(s => s.id === sess.incomeSourceId)
    if (src && src.effectiveHourlyRate > 0) {
      return `${store.currency}${Math.round(src.effectiveHourlyRate)}/h`
    }
  }
  return '—'
}

function getSessionTargetLabel(sess) {
  if (sess.incomeSourceId) {
    const src = store.incomeSources.find(s => s.id === sess.incomeSourceId)
    if (src) return `💼 ${src.name}`
  }
  if (sess.projectId) {
    const p = store.getProject(sess.projectId)
    if (p) return `📁 ${p.name}`
  }
  return 'General Work'
}

const timerTargetName = computed(() => {
  if (!store.activeTimer) return ''
  if (store.activeTimer.incomeSourceId) {
    const src = store.incomeSources.find(s => s.id === store.activeTimer.incomeSourceId)
    if (src) return src.name
  }
  return store.getProject(store.activeTimer.projectId)?.name || 'Project'
})

async function stopTimer() {
  await store.stopTimer()
  toast.success('Timer stopped and session saved.')
}

function confirmDeleteSession(id) {
  confirmDelete.value = id
  confirmDeleteType.value = 'session'
  confirmDeleteTitle.value = 'Delete work session?'
  confirmDeleteMessage.value = 'This session and its logged time will be permanently removed.'
}

function confirmDeleteSource(id) {
  confirmDelete.value = id
  confirmDeleteType.value = 'source'
  confirmDeleteTitle.value = 'Delete income source?'
  confirmDeleteMessage.value = 'This income source will be removed. Existing logged sessions and payments will remain.'
}

function confirmDeleteOverhead(id) {
  confirmDelete.value = id
  confirmDeleteType.value = 'overhead'
  confirmDeleteTitle.value = 'Delete overhead cost?'
  confirmDeleteMessage.value = 'This overhead cost will be removed from future rate calculations.'
}

async function executeDelete() {
  if (!confirmDelete.value) return
  const id = confirmDelete.value
  const type = confirmDeleteType.value
  confirmDelete.value = null

  try {
    if (type === 'session') {
      await store.deleteSession(id)
      toast.success('Session removed.')
    } else if (type === 'source') {
      await store.deleteIncomeSource(id)
      toast.success('Income source deleted.')
    } else if (type === 'overhead') {
      await store.deleteOverhead(id)
      toast.success('Overhead cost removed.')
    }
  } catch (err) {
    console.error('Delete failed:', err)
    toast.error('Failed to complete delete action.')
  }
}

function onProjectCreated(proj) {
  showNewProject.value = false
  toast.success(`Project "${proj.name}" created successfully.`)
}

function handleClickOutside(event) {
  activeDropdownId.value = null
}

onMounted(async () => {
  if (['projects', 'income_sources', 'overhead', 'time'].includes(route.query.tab)) {
    activeTab.value = route.query.tab
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside)
  }
  await Promise.allSettled([
    store.fetchIncomeSources(),
    store.fetchOverheads(),
  ])
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleClickOutside)
  }
})
</script>
