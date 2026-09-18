<template>
  <div class="clients-page flex flex-col gap-6 animate-fade-in">
    <!-- Page Header & Action Bar -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Clients <span class="text-xs font-normal text-tertiary">({{ clients.length }})</span></h1>
        <p class="page-subtitle">Manage client relationships, associated project portfolios, tracked time, and financial values.</p>
      </div>
      <button class="btn btn-primary" @click="openAddModal" id="btn-add-client-page">
        <IconPlus :size="16" /> Add Client
      </button>
    </div>

    <!-- Clients Directory Table Card -->
    <div class="card" id="clients-list-card">

      <div v-if="clients.length === 0" class="empty-state py-12" id="clients-empty-state">
        <div class="empty-icon"><IconUser :size="32" /></div>
        <div class="empty-title text-base mt-2">No clients found</div>
        <div class="empty-desc text-xs mt-1">
          Click "+ Add Client" to create your first business relationship.
        </div>
        <button class="btn btn-primary btn-sm mt-3" @click="openAddModal">Add Client</button>
      </div>

      <div v-else class="table-wrap">
        <table class="table" id="clients-directory-table">
          <thead>
            <tr>
              <th>Client & Company</th>
              <th>Email</th>
              <th>Phone Number</th>
              <th>Associated Projects</th>
              <th class="table-text-right">Outstanding</th>
              <th class="table-text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="client in clients"
              :key="client.id"
              :id="`client-row-${client.id}`"
              class="cursor-pointer"
              @click="navigateTo(`/clients/${client.id}`)"
            >
              <!-- 1. Client & Company (with Location) -->
              <td>
                <div class="flex items-center gap-3">
                  <div class="user-avatar-lg flex-shrink-0">
                    {{ initials(client.name) }}
                  </div>
                  <div class="min-w-0">
                    <NuxtLink
                      :to="`/clients/${client.id}`"
                      class="font-bold text-sm text-primary lh-tight hover:text-brand text-decoration-none"
                      @click.stop
                    >
                      {{ client.name }}
                    </NuxtLink>
                    <div
                      v-if="client.company && client.company.toLowerCase() !== client.name.toLowerCase()"
                      class="text-xs text-secondary mt-0.5"
                    >
                      {{ client.company }}
                    </div>
                    <div class="text-xs text-tertiary flex items-center gap-1 mt-0.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <span>{{ getClientLocation(client) }}</span>
                    </div>
                  </div>
                </div>
              </td>

              <!-- 2. Email (Separate Column) -->
              <td>
                <a
                  v-if="client.email"
                  :href="`mailto:${client.email}`"
                  class="text-xs text-secondary hover:text-brand font-medium text-decoration-none"
                  @click.stop
                >
                  {{ client.email }}
                </a>
                <span v-else class="text-xs text-tertiary">—</span>
              </td>

              <!-- 3. Phone Number -->
              <td>
                <div class="text-sm text-primary font-medium">
                  {{ getClientPhone(client) }}
                </div>
              </td>

              <!-- 4. Associated Projects -->
              <td>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-semibold text-primary">
                    {{ getClientProjectStatusDisplay(client.id).countText }}
                  </span>
                  <span
                    v-if="getClientProjectStatusDisplay(client.id).hasBadge"
                    class="badge badge-xs"
                    :class="getClientProjectStatusDisplay(client.id).badgeClass"
                  >
                    {{ getClientProjectStatusDisplay(client.id).badgeText }}
                  </span>
                </div>
              </td>

              <!-- 4. Outstanding Balance -->
              <td class="table-text-right">
                <div
                  class="font-bold text-sm"
                  :class="getClientOutstanding(client.id) > 0 ? 'text-warning' : 'text-tertiary'"
                >
                  {{ store.currency }} {{ getClientOutstanding(client.id).toLocaleString('en-IN') }}
                </div>
                <div class="text-xs mt-1">
                  <span v-if="getClientOutstanding(client.id) > 0" class="badge badge-unpaid badge-xs">
                    Pending
                  </span>
                  <span v-else class="text-tertiary">Settled</span>
                </div>
              </td>

              <!-- 5. Actions -->
              <td class="table-text-right" @click.stop>
                <div class="flex items-center justify-end gap-1">
                  <NuxtLink
                    :to="`/clients/${client.id}`"
                    class="btn btn-secondary btn-icon btn-sm"
                    title="View Client Details"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </NuxtLink>
                  <button
                    type="button"
                    @click="openEditModal(client)"
                    class="btn btn-secondary btn-icon btn-sm"
                    title="Edit Client"
                  >
                    <IconEdit :size="14" />
                  </button>
                  <button
                    type="button"
                    @click="confirmDeleteClient(client)"
                    class="btn btn-secondary btn-icon btn-sm text-error border-error-subtle"
                    title="Delete Client"
                  >
                    <IconTrash :size="14" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Client Modal (Add / Edit) -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
        <div class="modal modal-sm" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="modal-title">{{ editingClient ? 'Edit Client' : 'Add Client' }}</div>
            <button class="modal-close" @click="showModal = false" aria-label="Close"><IconX /></button>
          </div>
          <form @submit.prevent="handleSaveClient" novalidate>
            <div class="modal-body">
              <div class="form-group mb-3">
                <label class="form-label" for="client-modal-name">Client / Contact Name <span class="required">*</span></label>
                <input
                  id="client-modal-name"
                  v-model="form.name"
                  class="form-input"
                  :class="{ error: errors.name }"
                  type="text"
                  placeholder="e.g. ABC Technologies"
                />
                <span v-if="errors.name" class="form-error">{{ errors.name }}</span>
              </div>

              <div class="form-group mb-3">
                <label class="form-label" for="client-modal-company">Company / Legal Entity</label>
                <input
                  id="client-modal-company"
                  v-model="form.company"
                  class="form-input"
                  type="text"
                  placeholder="e.g. ABC Technologies Pvt Ltd"
                />
              </div>

              <div class="form-group mb-3">
                <label class="form-label" for="client-modal-location">Location / City</label>
                <input
                  id="client-modal-location"
                  v-model="form.location"
                  class="form-input"
                  type="text"
                  placeholder="e.g. Bengaluru, India"
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="client-modal-email">Email Address</label>
                  <input
                    id="client-modal-email"
                    v-model="form.email"
                    class="form-input"
                    type="email"
                    placeholder="contact@abc.com"
                  />
                </div>
                <div class="form-group">
                  <label class="form-label" for="client-modal-phone">Phone Number</label>
                  <input
                    id="client-modal-phone"
                    v-model="form.phone"
                    class="form-input"
                    type="tel"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-submit-client">
                {{ editingClient ? 'Save Changes' : 'Add Client' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const store = useWelloStore()
const toast = useToast()

const clients = computed(() => store.clients)
const showModal = ref(false)
const editingClient = ref(null)

const form = reactive({
  name: '',
  company: '',
  location: '',
  email: '',
  phone: '',
})

const errors = reactive({ name: '' })



function initials(name) {
  if (!name) return 'CL'
  const p = name.trim().split(' ')
  if (p.length >= 2) return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getClientProjects(clientId) {
  return store.projects.filter(p => p.clientId === clientId)
}

function getClientProjectCount(clientId) {
  return getClientProjects(clientId).length
}

function getClientProjectBreakdown(clientId) {
  const projs = getClientProjects(clientId)
  const inProgress = projs.filter(p => p.status === 'in_progress').length
  const completed = projs.filter(p => p.status === 'completed').length
  const proposals = projs.filter(p => p.status === 'potential' || p.quoteStatus === 'sent' || p.quoteStatus === 'draft').length
  const lost = projs.filter(p => p.status === 'lost').length
  return { total: projs.length, inProgress, completed, proposals, lost }
}

function getClientHours(clientId) {
  const clientProjIds = new Set(getClientProjects(clientId).map(p => p.id))
  const totalMin = store.sessions
    .filter(s => clientProjIds.has(s.projectId))
    .reduce((sum, s) => sum + (s.durationMin || 0), 0)
  return store.minutesToHM(totalMin)
}

function getClientSessionCount(clientId) {
  const clientProjIds = new Set(getClientProjects(clientId).map(p => p.id))
  return store.sessions.filter(s => clientProjIds.has(s.projectId)).length
}

function getClientQuotedTotal(clientId) {
  return getClientProjects(clientId).reduce((sum, p) => sum + (p.quoteAmount || 0), 0)
}

function getClientRevenue(clientId) {
  const clientProjs = getClientProjects(clientId)
  let total = 0
  for (const proj of clientProjs) {
    total += store.projectRevenueTotal(proj.id)
  }
  return total
}

function getClientOutstanding(clientId) {
  const quoted = getClientQuotedTotal(clientId)
  const collected = getClientRevenue(clientId)
  return Math.max(0, quoted - collected)
}

function getClientCollectionRate(clientId) {
  const quoted = getClientQuotedTotal(clientId)
  if (quoted <= 0) return 100
  const collected = getClientRevenue(clientId)
  return Math.min(100, Math.round((collected / quoted) * 100))
}

const defaultPhones = {
  c1: '+91 98201 12345',
  c2: '+91 98334 56789',
  c3: '+91 98112 34567',
  c4: '+91 97690 98765',
  c5: '+91 98450 11223',
  c6: '+91 99001 88776',
}

const defaultLocations = {
  c1: 'Bengaluru, India',
  c2: 'Mumbai, India',
  c3: 'Goa, India',
  c4: 'Pune, India',
  c5: 'Hyderabad, India',
  c6: 'New Delhi, India',
}

function getClientLocation(client) {
  return client.location || defaultLocations[client.id] || 'India'
}

function getClientPhone(client) {
  return client.phone || defaultPhones[client.id] || '—'
}

function getClientProjectStatusDisplay(clientId) {
  const projs = getClientProjects(clientId)
  const total = projs.length
  const countText = `${total} Project${total !== 1 ? 's' : ''}`

  if (total === 0) {
    return {
      countText: '0 Projects',
      hasBadge: false,
      badgeText: '',
      badgeClass: '',
    }
  }

  // If multiple, show in progress if ANY one project is under progress
  const activeCount = projs.filter(p => p.status === 'in_progress').length
  if (activeCount > 0) {
    return {
      countText,
      hasBadge: true,
      badgeText: `${activeCount} Active`,
      badgeClass: 'badge-in-progress',
    }
  }

  // Quoted / Proposed
  const quotedCount = projs.filter(p => p.status === 'quoted' || p.status === 'potential' || p.quoteStatus === 'sent' || p.quoteStatus === 'draft').length
  if (quotedCount > 0) {
    return {
      countText,
      hasBadge: true,
      badgeText: `${quotedCount} Proposed`,
      badgeClass: 'badge-quoted',
    }
  }

  // Completed
  const completedCount = projs.filter(p => p.status === 'completed').length
  if (completedCount > 0) {
    return {
      countText,
      hasBadge: true,
      badgeText: `${completedCount} Done`,
      badgeClass: 'badge-completed',
    }
  }

  // All lost
  const lostCount = projs.filter(p => p.status === 'lost').length
  if (lostCount > 0) {
    return {
      countText,
      hasBadge: true,
      badgeText: 'Closed',
      badgeClass: 'badge-lost',
    }
  }

  return {
    countText,
    hasBadge: false,
    badgeText: '',
    badgeClass: '',
  }
}

function openAddModal() {
  editingClient.value = null
  form.name = ''
  form.company = ''
  form.location = ''
  form.email = ''
  form.phone = ''
  errors.name = ''
  showModal.value = true
}

function openEditModal(client) {
  editingClient.value = client
  form.name = client.name || ''
  form.company = client.company || ''
  form.location = getClientLocation(client)
  form.email = client.email || ''
  form.phone = client.phone || ''
  errors.name = ''
  showModal.value = true
}

function handleSaveClient() {
  errors.name = ''
  if (!form.name.trim()) {
    errors.name = 'Client name is required.'
    return
  }

  if (editingClient.value) {
    store.updateClient(editingClient.value.id, {
      name: form.name.trim(),
      company: form.company.trim(),
      location: form.location.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    })
    toast.success(`Client "${form.name.trim()}" updated.`)
  } else {
    store.createClient({
      name: form.name.trim(),
      company: form.company.trim(),
      location: form.location.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
    })
    toast.success(`Client "${form.name.trim()}" added.`)
  }

  showModal.value = false
}

function confirmDeleteClient(client) {
  if (confirm(`Are you sure you want to delete client "${client.name}"?`)) {
    store.deleteClient(client.id)
    toast.success(`Client "${client.name}" removed.`)
  }
}
</script>
