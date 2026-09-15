<template>
  <div class="projects-page animate-fade-in">
    <!-- Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-4">
      <div>
        <h1 class="page-title">Projects</h1>
        <p class="page-subtitle">Manage every engagement from first discovery to delivery and value realisation.</p>
      </div>
      <button class="btn btn-primary" @click="showNewProject = true" id="btn-new-project-page">
        <IconPlus :size="14" /> New Project
      </button>
    </div>

    <!-- Filter & Search Strip -->
    <div class="flex items-center justify-between flex-wrap gap-3 mb-6">
      <div class="filter-strip mb-0" id="projects-filter-strip">
        <button
          v-for="f in filters"
          :key="f.value"
          class="filter-chip"
          :class="{ active: activeFilter === f.value }"
          @click="activeFilter = f.value"
          :id="`filter-${f.value}`"
        >
          {{ f.label }}
          <span v-if="filterCount(f.value)" style="font-size:10px; opacity:0.8; margin-left:2px;">
            ({{ filterCount(f.value) }})
          </span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="search-wrap" style="min-width: 220px;">
        <input
          v-model="searchQuery"
          type="text"
          class="form-input"
          style="padding-top: 6px; padding-bottom: 6px; font-size: var(--font-xs);"
          placeholder="Search by project or customer…"
          id="input-search-projects"
        />
      </div>
    </div>

    <!-- Projects list -->
    <div v-if="filteredProjects.length === 0" class="empty-state" id="projects-empty-state">
      <div class="empty-icon">
        <IconFolders />
      </div>
      <div class="empty-title">
        No projects {{ activeFilter !== 'all' ? 'with status "' + activeFilter + '"' : '' }}
      </div>
      <div class="empty-desc">
        {{ searchQuery ? 'Try adjusting your search query.' : 'Create your first project to start tracking your work and economic value.' }}
      </div>
      <button class="btn btn-primary btn-sm mt-3" @click="showNewProject = true" id="btn-first-project">New Project</button>
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
          <div class="flex-1 min-width-0">
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <div class="project-card-name truncate">{{ proj.name }}</div>
              <span v-if="proj.isJob" class="badge badge-job" style="font-size:10px;">Job</span>
              <StatusBadge :status="proj.status" />
            </div>
            <div class="project-card-client">
              {{ proj.client?.name || 'Independent Customer' }} · {{ proj.serviceCategory || 'General Service' }}
            </div>
          </div>

          <!-- Quick Action Dropdown -->
          <div class="dropdown-wrap" @click.stop>
            <button class="btn btn-ghost btn-icon" @click="toggleMenu(proj.id)" :id="`proj-menu-${proj.id}`" title="Options">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
            <div class="dropdown-menu" v-if="openMenu === proj.id">
              <button class="dropdown-item" @click="openSession(proj.id)" :id="`proj-log-session-${proj.id}`">
                <IconClock :size="14" /> Log Session
              </button>
              <button class="dropdown-item" @click="openQuote(proj)" :id="`proj-quote-${proj.id}`">
                <IconEdit :size="14" /> {{ proj.quoteAmount ? 'Edit Quote' : 'Add Quote' }}
              </button>
              <button class="dropdown-item" v-if="!proj.isJob && proj.status === 'approved'" @click="convertToJob(proj.id)" :id="`proj-convert-${proj.id}`">
                <IconBriefcase :size="14" /> Convert to Job
              </button>
              <div class="dropdown-divider"></div>
              <button class="dropdown-item danger" @click="confirmLost(proj)" v-if="proj.status !== 'lost' && proj.status !== 'completed'" :id="`proj-mark-lost-${proj.id}`">
                Mark as Lost
              </button>
            </div>
          </div>
        </div>

        <!-- Stats row -->
        <div class="project-card-stats">
          <div class="project-stat">
            <div class="project-stat-label">Total Time</div>
            <div class="project-stat-value kpi-val-1">{{ proj.totalHM }}</div>
          </div>
          <div class="project-stat">
            <div class="project-stat-label">Paid Revenue</div>
            <div class="project-stat-value kpi-val-2">{{ store.fmtCurrency(proj.revenue) }}</div>
          </div>
          <div class="project-stat">
            <div class="project-stat-label">Unpaid Time</div>
            <div class="project-stat-value kpi-val-3">{{ proj.unpaidHM }}</div>
          </div>
          <div class="project-stat">
            <div class="project-stat-label">Net Income</div>
            <div class="project-stat-value kpi-val-4">{{ store.fmtCurrency(proj.netIncome) }}</div>
          </div>
          <div class="project-stat">
            <div class="project-stat-label">Effective Value</div>
            <div class="project-stat-value accent">{{ proj.netHrVal > 0 ? store.fmtHourly(proj.netHrVal) : '—' }}</div>
          </div>
          <div class="project-stat" v-if="proj.quoteAmount">
            <div class="project-stat-label">Quote</div>
            <div class="project-stat-value">{{ store.fmtCurrency(proj.quoteAmount) }}</div>
          </div>
        </div>

        <!-- Progress bar for quoted projects with estimated hours -->
        <div v-if="proj.quoteEstHours && proj.totalMin > 0" class="mt-3 pt-2" style="border-top:1px solid var(--color-soft-gray);">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs text-tertiary">Time used vs estimate</span>
            <span class="text-xs text-secondary fw-600">{{ Math.round((proj.totalMin / 60 / proj.quoteEstHours) * 100) }}% ({{ proj.totalHM }} / {{ proj.quoteEstHours }}h)</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :class="{ warning: (proj.totalMin / 60 / proj.quoteEstHours) > 0.8, error: (proj.totalMin / 60 / proj.quoteEstHours) > 1 }"
              :style="{ width: Math.min((proj.totalMin / 60 / proj.quoteEstHours) * 100, 100) + '%' }"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ProjectFormModal v-if="showNewProject" @close="showNewProject = false" @created="showNewProject = false" />
    <SessionModal v-if="sessionForProject" :projectId="sessionForProject" @close="sessionForProject = null" @saved="sessionForProject = null" />
    <QuoteModal v-if="quoteProject" :project="quoteProject" @close="quoteProject = null" @saved="quoteProject = null" />
    <ConfirmDialog
      v-if="lostProject"
      title="Mark as Lost?"
      :message="`'${lostProject.name}' will be marked as lost. All ${lostProject.totalHM} of historical work sessions are preserved for analytics.`"
      confirmLabel="Mark Lost"
      danger
      @confirm="doMarkLost"
      @cancel="lostProject = null"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const store = useWelloStore()
const toast = useToast()

const showNewProject    = ref(false)
const sessionForProject = ref(null)
const quoteProject      = ref(null)
const openMenu          = ref(null)
const lostProject       = ref(null)
const activeFilter      = ref('all')
const searchQuery       = ref('')

const filters = [
  { label: 'All',         value: 'all' },
  { label: 'Potential',   value: 'potential' },
  { label: 'Quoted',      value: 'quoted' },
  { label: 'Approved',    value: 'approved' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed',   value: 'completed' },
  { label: 'Lost',        value: 'lost' },
]

function filterCount(status) {
  if (status === 'all') return store.projects.length
  return store.projects.filter(p => p.status === status).length
}

const filteredProjects = computed(() => {
  let list = store.enrichedProjects

  if (activeFilter.value !== 'all') {
    list = list.filter(p => p.status === activeFilter.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.client?.name && p.client.name.toLowerCase().includes(q)) ||
      (p.serviceCategory && p.serviceCategory.toLowerCase().includes(q))
    )
  }

  return list.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
})

function toggleMenu(id) {
  openMenu.value = openMenu.value === id ? null : id
}

function openSession(projectId) {
  sessionForProject.value = projectId
  openMenu.value = null
}

function openQuote(proj) {
  quoteProject.value = proj
  openMenu.value = null
}

function convertToJob(projectId) {
  store.convertToJob(projectId)
  toast.success('Project converted to Job. All previous time preserved.')
  openMenu.value = null
}

function confirmLost(proj) {
  lostProject.value = proj
  openMenu.value = null
}

function doMarkLost() {
  if (lostProject.value) {
    store.updateProjectStatus(lostProject.value.id, 'lost')
    toast.info(`"${lostProject.value.name}" marked as lost. Historical data retained.`)
    lostProject.value = null
  }
}
</script>

<style scoped>
.projects-page {
  max-width: 1140px;
  margin: 0 auto;
}

.project-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
