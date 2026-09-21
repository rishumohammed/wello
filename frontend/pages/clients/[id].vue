<template>
  <div class="client-detail-page animate-fade-in" v-if="client">
    <!-- Breadcrumbs -->
    <div class="flex items-center gap-2 mb-4">
      <NuxtLink to="/clients" class="btn btn-ghost btn-sm pl-0" id="btn-back-clients">
        <IconBack :size="15" />
        Clients
      </NuxtLink>
      <span class="text-tertiary">/</span>
      <span class="text-sm fw-600 text-secondary">{{ client.name }}</span>
    </div>

    <!-- CLIENT HEADER CARD -->
    <div class="card card-padded mb-6" id="client-header-card">
      <div class="flex items-start justify-between flex-wrap gap-4">
        <!-- Client Avatar & Info -->
        <div class="flex items-center gap-4 min-w-0">
          <div class="user-avatar-lg flex-shrink-0">
            {{ initials(client.name) }}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-3 mb-1 flex-wrap">
              <h1 class="page-title text-2xl mb-0">{{ client.name }}</h1>
              <span class="badge" :class="overallStatus.badgeClass">
                {{ overallStatus.label }}
              </span>
            </div>
            <div
              v-if="client.company && client.company.toLowerCase() !== client.name.toLowerCase()"
              class="text-secondary text-sm"
            >
              {{ client.company }}
            </div>
            <div class="text-tertiary text-xs flex items-center gap-3 mt-1 flex-wrap">
              <span v-if="clientLocation" class="flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                <span>{{ clientLocation }}</span>
              </span>
              <span v-if="clientEmail" class="flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <a :href="`mailto:${clientEmail}`" class="text-secondary hover:text-brand">{{ clientEmail }}</a>
              </span>
              <span v-if="clientPhone" class="flex items-center gap-1">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <a :href="`tel:${clientPhone}`" class="text-secondary hover:text-brand">{{ clientPhone }}</a>
              </span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2 flex-wrap">
          <button class="btn btn-primary btn-sm" @click="showNewProjectModal = true" id="btn-client-new-project">
            <IconPlus :size="14" /> New Project
          </button>
          <button class="btn btn-secondary btn-sm" @click="openEditModal" id="btn-client-edit">
            <IconEdit :size="14" /> Edit Client
          </button>
          <button class="btn btn-secondary btn-sm text-error border-error-subtle" @click="confirmDelete" id="btn-client-delete">
            <IconTrash :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- 4 KPI FINANCIAL & METRIC SUMMARY CARDS -->
    <div class="grid-4 gap-4 mb-6" id="client-financial-summary">
      <div class="metric-card hover-lift" id="metric-client-projects">
        <div class="metric-header">
          <span class="metric-label">Associated Projects</span>
          <div class="metric-icon-box kpi-icon-1">
            <IconFolders :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-1">{{ clientProjects.length }}</div>
        <div class="metric-secondary">
          {{ activeProjectsCount }} active · {{ completedProjectsCount }} completed
        </div>
      </div>

      <div class="metric-card hover-lift" id="metric-client-hours">
        <div class="metric-header">
          <span class="metric-label">Time Logged</span>
          <div class="metric-icon-box kpi-icon-5">
            <IconClock :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-5">{{ totalTimeFormatted }}</div>
        <div class="metric-secondary">Across {{ clientSessions.length }} recorded session(s)</div>
      </div>

      <div class="metric-card hover-lift" id="metric-client-quoted">
        <div class="metric-header">
          <span class="metric-label">Quoted Contract Value</span>
          <div class="metric-icon-box kpi-icon-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
        </div>
        <div class="metric-value kpi-val-4">{{ store.fmtCurrency(totalQuoted) }}</div>
        <div class="metric-secondary">Total contract pipeline</div>
      </div>

      <div class="metric-card hover-lift" id="metric-client-collected">
        <div class="metric-header">
          <span class="metric-label">Collected & Outstanding</span>
          <div class="metric-icon-box kpi-icon-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
        </div>
        <div class="metric-value kpi-val-2">{{ store.fmtCurrency(totalCollected) }}</div>
        <div class="metric-secondary">
          <span v-if="outstandingBalance > 0" class="text-warning font-semibold">
            {{ store.fmtCurrency(outstandingBalance) }} pending
          </span>
          <span v-else class="text-success font-semibold">Fully settled</span>
          · {{ collectionRate }}% collected
        </div>
      </div>
    </div>

    <!-- ASSOCIATED PROJECTS TABLE CARD -->
    <div class="card mb-6" id="client-projects-card">
      <div class="card-header flex items-center justify-between">
        <div>
          <div class="card-title text-base">Associated Projects & Engagements</div>
          <div class="card-subtitle">{{ clientProjects.length }} project(s) registered for this client</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="showNewProjectModal = true" id="btn-add-client-project">
          <IconPlus :size="13" /> New Project
        </button>
      </div>

      <div v-if="clientProjects.length === 0" class="empty-state py-12">
        <div class="empty-icon"><IconFolders :size="32" /></div>
        <div class="empty-title text-base mt-2">No projects found for this client</div>
        <div class="empty-desc text-xs mt-1">Create your first project engagement to begin tracking work sessions and quoted value.</div>
        <button class="btn btn-primary btn-sm mt-3" @click="showNewProjectModal = true">Create Project</button>
      </div>

      <div v-else class="table-wrap">
        <table class="table" id="client-projects-table">
          <thead>
            <tr>
              <th>Project Name</th>
              <th>Category</th>
              <th>Status</th>
              <th class="table-text-right">Quoted Amount</th>
              <th class="table-text-right">Revenue</th>
              <th>Tracked Time</th>
              <th class="table-text-right">Effective Rate</th>
              <th class="table-text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in clientProjects"
              :key="p.id"
              :id="`client-project-row-${p.id}`"
              class="cursor-pointer"
              @click="navigateTo(`/projects/${p.id}`)"
            >
              <td>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-primary hover:text-brand text-decoration-none">
                    {{ p.name }}
                  </span>
                  <span v-if="p.isJob" class="badge badge-job badge-xs">Job</span>
                </div>
                <div class="text-xs text-tertiary truncate max-w-xs mt-0.5" v-if="p.description">
                  {{ p.description }}
                </div>
              </td>

              <td>
                <span class="text-xs text-secondary">{{ p.serviceCategory || 'General Service' }}</span>
              </td>

              <td>
                <StatusBadge :status="p.status" />
              </td>

              <td class="table-text-right tabular font-bold text-sm text-primary">
                {{ p.quoteAmount ? store.fmtCurrency(p.quoteAmount) : '—' }}
              </td>

              <td class="table-text-right tabular font-bold text-sm text-success">
                {{ store.fmtCurrency(store.projectRevenueTotal(p.id)) }}
              </td>

              <td>
                <div class="text-xs font-semibold text-primary">
                  {{ store.minutesToHM(store.projectTotalMinutes(p.id)) }}
                </div>
                <div class="text-xs text-tertiary">
                  {{ store.getProjectSessions(p.id).length }} session(s)
                </div>
              </td>

              <td class="table-text-right tabular font-bold text-xs accent">
                {{ getProjectEffectiveHourly(p) }}
              </td>

              <td class="table-text-right" @click.stop>
                <NuxtLink :to="`/projects/${p.id}`" class="btn btn-secondary btn-sm" title="Open Project Details">
                  Open →
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- WORK SESSION STREAM CARD -->
    <div class="card mb-6" id="client-sessions-card">
      <div class="card-header flex items-center justify-between">
        <div>
          <div class="card-title text-base">Work Session History</div>
          <div class="card-subtitle">{{ clientSessions.length }} work session(s) recorded across all client projects</div>
        </div>
      </div>

      <div v-if="clientSessions.length === 0" class="empty-state py-8 px-4">
        <div class="empty-icon"><IconClock :size="28" /></div>
        <div class="empty-title text-base">No work sessions logged</div>
        <div class="empty-desc text-xs">Sessions recorded for this client's projects will appear here chronologically.</div>
      </div>

      <div v-else class="chronological-stream">
        <div
          v-for="sess in clientSessions"
          :key="sess.id"
          class="chronological-row"
          :id="`client-session-${sess.id}`"
        >
          <!-- Time Range -->
          <div class="session-time-range">
            {{ formatTimeRange(sess) }}
          </div>

          <!-- Project Link Badge -->
          <div
            class="session-proj-badge truncate cursor-pointer"
            @click="navigateTo(`/projects/${sess.projectId}`)"
            :title="getProjectName(sess.projectId)"
          >
            {{ getProjectName(sess.projectId) }}
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
            <template v-else>
              <span class="badge badge-unpaid badge-xs">Unpaid</span>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ProjectFormModal
      v-if="showNewProjectModal"
      @close="showNewProjectModal = false"
      @created="onProjectCreated"
    />

    <!-- Edit Client Modal -->
    <Teleport to="body">
      <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
        <div class="modal modal-sm" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="modal-title">Edit Client</div>
            <button class="modal-close" @click="showEditModal = false" aria-label="Close"><IconX /></button>
          </div>
          <form @submit.prevent="handleSaveClient" novalidate>
            <div class="modal-body">
              <div class="form-group mb-3">
                <label class="form-label" for="edit-client-name">Client / Contact Name <span class="required">*</span></label>
                <input
                  id="edit-client-name"
                  v-model="editForm.name"
                  class="form-input"
                  :class="{ error: editErrors.name }"
                  type="text"
                />
                <span v-if="editErrors.name" class="form-error">{{ editErrors.name }}</span>
              </div>

              <div class="form-row mb-3">
                <div class="form-group">
                  <label class="form-label" for="edit-client-company">Company / Legal Entity</label>
                  <input
                    id="edit-client-company"
                    v-model="editForm.company"
                    class="form-input"
                    type="text"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label" for="edit-client-location">Location / City</label>
                  <input
                    id="edit-client-location"
                    v-model="editForm.location"
                    class="form-input"
                    placeholder="e.g. San Francisco, USA or Berlin, Germany"
                    type="text"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="edit-client-email">Email Address</label>
                  <input
                    id="edit-client-email"
                    v-model="editForm.email"
                    class="form-input"
                    type="email"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label" for="edit-client-phone">Phone Number</label>
                  <input
                    id="edit-client-phone"
                    v-model="editForm.phone"
                    class="form-input"
                    type="tel"
                  />
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showEditModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-save-edit-client">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>

  <!-- Client Not Found State -->
  <div v-else class="card card-padded text-center py-16 animate-fade-in">
    <div class="empty-icon mb-3"><IconUser :size="48" /></div>
    <h2 class="text-xl font-bold text-primary mb-2">Client Not Found</h2>
    <p class="text-secondary text-sm mb-4">The client you are looking for does not exist or has been removed.</p>
    <NuxtLink to="/clients" class="btn btn-primary btn-sm">
      Return to Client Directory
    </NuxtLink>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const route = useRoute()
const router = useRouter()
const store = useWelloStore()
const toast = useToast()

const clientId = computed(() => route.params.id)
const client = computed(() => store.getClient(clientId.value))

const defaultPhones = {
  c1: '+1 415 555 0123',
  c2: '+49 30 1234567',
  c3: '+971 4 123 4567',
  c4: '+61 2 9876 5432',
  c5: '+46 8 123 456',
  c6: '+44 20 7946 0912',
}

const defaultLocations = {
  c1: 'San Francisco, USA',
  c2: 'Berlin, Germany',
  c3: 'Dubai, UAE',
  c4: 'Sydney, Australia',
  c5: 'Stockholm, Sweden',
  c6: 'London, UK',
}

const clientLocation = computed(() => {
  if (!client.value) return ''
  return client.value.location || defaultLocations[client.value.id] || 'Global'
})

const clientPhone = computed(() => {
  if (!client.value) return ''
  return client.value.phone || defaultPhones[client.value.id] || ''
})

const clientEmail = computed(() => client.value?.email || '')

// ── Client Projects & Sessions ──
const clientProjects = computed(() => {
  if (!client.value) return []
  return store.projects.filter(p => p.clientId === client.value.id)
})

const clientProjectIds = computed(() => new Set(clientProjects.value.map(p => p.id)))

const clientSessions = computed(() => {
  return store.sessions
    .filter(s => clientProjectIds.value.has(s.projectId))
    .slice()
    .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
})

const activeProjectsCount = computed(() => {
  return clientProjects.value.filter(p => p.status === 'in_progress').length
})

const completedProjectsCount = computed(() => {
  return clientProjects.value.filter(p => p.status === 'completed').length
})

const totalTimeFormatted = computed(() => {
  const totalMin = clientSessions.value.reduce((acc, s) => acc + (s.durationMin || 0), 0)
  return store.minutesToHM(totalMin)
})

const totalQuoted = computed(() => {
  return clientProjects.value.reduce((acc, p) => acc + (p.quoteAmount || 0), 0)
})

const totalCollected = computed(() => {
  let total = 0
  for (const p of clientProjects.value) {
    total += store.projectRevenueTotal(p.id)
  }
  return total
})

const outstandingBalance = computed(() => Math.max(0, totalQuoted.value - totalCollected.value))

const collectionRate = computed(() => {
  if (totalQuoted.value <= 0) return 100
  return Math.min(100, Math.round((totalCollected.value / totalQuoted.value) * 100))
})

const overallStatus = computed(() => {
  const projs = clientProjects.value
  if (!projs || projs.length === 0) {
    return { label: 'No Projects', badgeClass: 'badge-potential' }
  }
  if (projs.some(p => p.status === 'in_progress')) {
    return { label: 'In Progress', badgeClass: 'badge-in-progress' }
  }
  if (projs.some(p => p.status === 'quoted' || p.status === 'potential')) {
    return { label: 'Proposed', badgeClass: 'badge-quoted' }
  }
  if (projs.every(p => p.status === 'completed')) {
    return { label: 'Completed', badgeClass: 'badge-completed' }
  }
  if (projs.every(p => p.status === 'lost')) {
    return { label: 'Closed', badgeClass: 'badge-lost' }
  }
  return { label: 'Active', badgeClass: 'badge-subtle' }
})

function initials(name) {
  if (!name) return 'CL'
  const p = name.trim().split(' ')
  if (p.length >= 2) return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getProjectName(projectId) {
  return store.getProject(projectId)?.name || 'Project'
}

function getProjectEffectiveHourly(p) {
  const rev = store.projectRevenueTotal(p.id)
  const hours = store.projectTotalMinutes(p.id) / 60
  if (hours <= 0 || rev <= 0) return '—'
  return store.fmtHourly(Math.round(rev / hours))
}

function formatTimeRange(sess) {
  if (!sess.startedAt) return ''
  const d = new Date(sess.startedAt)
  const month = d.toLocaleString('en-US', { month: 'short' })
  const day = d.getDate()
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${month} ${day}, ${timeStr}`
}

function getSessionEffectiveRate(sess) {
  const proj = store.getProject(sess.projectId)
  if (!proj) return 'Paid'
  const rate = store.projectGrossHourlyValue(proj)
  return rate > 0 ? store.fmtHourly(rate) : 'Paid'
}

// ── Modals & Actions ──
const showNewProjectModal = ref(false)
const showEditModal = ref(false)

const editForm = reactive({
  name: '',
  company: '',
  location: '',
  email: '',
  phone: '',
})

const editErrors = reactive({ name: '' })

function openEditModal() {
  if (!client.value) return
  editForm.name = client.value.name || ''
  editForm.company = client.value.company || ''
  editForm.location = client.value.location || defaultLocations[client.value.id] || ''
  editForm.email = client.value.email || ''
  editForm.phone = clientPhone.value || ''
  editErrors.name = ''
  showEditModal.value = true
}

function handleSaveClient() {
  editErrors.name = ''
  if (!editForm.name.trim()) {
    editErrors.name = 'Client name is required.'
    return
  }

  store.updateClient(client.value.id, {
    name: editForm.name.trim(),
    company: editForm.company.trim(),
    location: editForm.location.trim(),
    email: editForm.email.trim(),
    phone: editForm.phone.trim(),
  })

  showEditModal.value = false
  toast.success(`Client "${editForm.name.trim()}" updated.`)
}

function confirmDelete() {
  if (!client.value) return
  if (confirm(`Are you sure you want to delete client "${client.value.name}"?`)) {
    const name = client.value.name
    store.deleteClient(client.value.id)
    toast.success(`Client "${name}" deleted.`)
    router.push('/clients')
  }
}

function onProjectCreated(newProj) {
  showNewProjectModal.value = false
  toast.success(`Project "${newProj.name}" created successfully.`)
}
</script>
