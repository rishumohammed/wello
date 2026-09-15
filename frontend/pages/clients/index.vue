<template>
  <div class="clients-page animate-fade-in" style="display:flex;flex-direction:column;gap:24px;">
    <!-- Page Header & Action Bar -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Clients</h1>
        <p class="page-subtitle">Manage client relationships, contact details, associated projects, and income.</p>
      </div>
      <button class="btn btn-primary" @click="openAddModal" id="btn-add-client-page">
        <IconPlus :size="16" /> Add Client
      </button>
    </div>

    <!-- Search & Summary Bar -->
    <div class="card card-padded flex items-center justify-between flex-wrap gap-4 mb-2">
      <div class="form-group mb-0" style="max-width:320px;width:100%;">
        <input
          v-model="searchQuery"
          type="text"
          class="form-input"
          placeholder="Search clients by name, company, or email…"
        />
      </div>

      <div class="flex items-center gap-6 text-xs text-secondary">
        <div>Total Clients: <span class="font-bold text-primary text-sm">{{ store.clients.length }}</span></div>
        <div>Total Projects: <span class="font-bold text-primary text-sm">{{ store.projects.length }}</span></div>
      </div>
    </div>

    <!-- Clients List Card Container -->
    <div class="card" id="clients-list-card">
      <div class="card-header flex items-center justify-between">
        <div class="card-title text-base">Client Directory</div>
        <span class="text-xs text-tertiary">{{ filteredClients.length }} client(s) found</span>
      </div>

      <div v-if="filteredClients.length === 0" class="text-center py-12 text-tertiary text-sm">
        No clients found. Click <strong>+ Add Client</strong> to create your first client relationship.
      </div>

      <div v-else style="display:flex;flex-direction:column;">
        <div
          v-for="client in filteredClients"
          :key="client.id"
          class="client-item-row flex items-center justify-between p-4"
          style="border-bottom:1px solid var(--border-color);transition:background 0.15s ease;"
          :id="`client-row-${client.id}`"
        >
          <!-- Client Avatar & Info -->
          <div class="flex items-center gap-4 min-width-0">
            <div
              class="user-avatar"
              style="width:44px;height:44px;font-size:13px;font-weight:700;background:var(--grad-brand);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 2px 8px rgba(255,159,28,0.25);"
            >
              {{ initials(client.name) }}
            </div>
            <div class="min-width-0">
              <div class="font-bold text-base text-primary truncate" style="line-height:1.2;">{{ client.name }}</div>
              <div class="text-xs text-tertiary truncate mt-1">
                {{ client.company || client.email || 'Independent Client' }}
              </div>
            </div>
          </div>

          <!-- Project Stats & Actions -->
          <div class="flex items-center gap-6">
            <div class="text-right hidden sm:block">
              <div class="text-xs font-bold text-primary">{{ getClientProjectCount(client.id) }} Project(s)</div>
              <div class="text-xs text-tertiary">{{ store.currency }} {{ getClientRevenue(client.id).toLocaleString('en-IN') }} Billed</div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="openEditModal(client)"
                class="btn btn-secondary btn-sm"
                title="Edit Client"
              >
                <IconEdit :size="14" />
                <span class="hidden md:inline">Edit</span>
              </button>
              <button
                type="button"
                @click="confirmDeleteClient(client)"
                class="btn btn-secondary btn-sm"
                style="color:var(--color-error);border-color:rgba(239,68,68,0.3);"
                title="Delete Client"
              >
                <IconTrash :size="14" />
              </button>
            </div>
          </div>
        </div>
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

const searchQuery = ref('')
const showModal = ref(false)
const editingClient = ref(null)

const form = reactive({
  name: '',
  company: '',
  email: '',
  phone: '',
})

const errors = reactive({ name: '' })

const filteredClients = computed(() => {
  if (!searchQuery.value.trim()) return store.clients
  const q = searchQuery.value.trim().toLowerCase()
  return store.clients.filter(c =>
    (c.name && c.name.toLowerCase().includes(q)) ||
    (c.company && c.company.toLowerCase().includes(q)) ||
    (c.email && c.email.toLowerCase().includes(q))
  )
})

function initials(name) {
  if (!name) return 'CL'
  const p = name.trim().split(' ')
  if (p.length >= 2) return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getClientProjectCount(clientId) {
  return store.projects.filter(p => p.clientId === clientId).length
}

function getClientRevenue(clientId) {
  const clientProjs = store.projects.filter(p => p.clientId === clientId)
  let total = 0
  for (const proj of clientProjs) {
    total += store.projectRevenueTotal(proj.id)
  }
  return total
}

function openAddModal() {
  editingClient.value = null
  form.name = ''
  form.company = ''
  form.email = ''
  form.phone = ''
  errors.name = ''
  showModal.value = true
}

function openEditModal(client) {
  editingClient.value = client
  form.name = client.name || ''
  form.company = client.company || ''
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
      email: form.email.trim(),
      phone: form.phone.trim(),
    })
    toast.success(`Client "${form.name.trim()}" updated.`)
  } else {
    store.createClient({
      name: form.name.trim(),
      company: form.company.trim(),
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

<style scoped>
.client-item-row:last-child {
  border-bottom: none !important;
}
.client-item-row:hover {
  background: var(--color-off-white);
}
</style>
