<template>
  <div class="admin-store-page flex flex-col gap-6 animate-fade-in">
    <!-- Page Header & Action Bar -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Wello Store & Addon Manager</h1>
        <p class="page-subtitle">Configure modular free addons, persona onboarding defaults, abuse safety limits, and incident kill-switches.</p>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn btn-primary btn-sm flex items-center gap-2" @click="openCreateModal" id="btn-admin-add-addon">
          <IconPlus :size="16" /> Create Addon
        </button>
      </div>
    </div>

    <!-- Top Navigation Tabs -->
    <div class="filter-strip mb-0">
      <button
        class="filter-chip"
        :class="{ active: activeTab === 'catalog' }"
        @click="activeTab = 'catalog'"
        id="tab-admin-catalog"
      >
        Addon Catalog
      </button>
      <button
        class="filter-chip"
        :class="{ active: activeTab === 'personas' }"
        @click="activeTab = 'personas'"
        id="tab-admin-personas"
      >
        Persona Defaults
      </button>
      <button
        class="filter-chip"
        :class="{ active: activeTab === 'limits' }"
        @click="activeTab = 'limits'"
        id="tab-admin-limits"
      >
        Fair-Use Safety Limits
      </button>
      <button
        class="filter-chip"
        :class="{ active: activeTab === 'users' }"
        @click="activeTab = 'users'"
        id="tab-admin-users"
      >
        User Addon Inspector
      </button>
    </div>

    <!-- Alert / Toast -->
    <div v-if="alertMessage" class="auth-alert mb-0" :class="alertType" id="admin-store-alert">
      <span>{{ alertMessage }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="alertMessage = ''">✕</button>
    </div>

    <!-- ───────────────────────────────────────────────────────────────────── -->
    <!-- TAB 1: ADDON CATALOG                                                 -->
    <!-- ───────────────────────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'catalog'" class="flex flex-col gap-6">
      <!-- Summary KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4" id="admin-store-kpi-grid">
        <div class="metric-card hover-lift">
          <div class="metric-header">
            <span class="metric-label">Total Catalog Addons</span>
            <div class="metric-icon-box kpi-icon-1"><IconPackage :size="18" /></div>
          </div>
          <div class="metric-value kpi-val-1">{{ addons.length }}</div>
          <div class="metric-secondary">Modular features</div>
        </div>
        <div class="metric-card hover-lift">
          <div class="metric-header">
            <span class="metric-label">Active Products</span>
            <div class="metric-icon-box kpi-icon-2"><IconPackage :size="18" /></div>
          </div>
          <div class="metric-value kpi-val-2">{{ activeAddonsCount }}</div>
          <div class="metric-secondary">Published in catalog</div>
        </div>
        <div class="metric-card hover-lift">
          <div class="metric-header">
            <span class="metric-label">Total User Activations</span>
            <div class="metric-icon-box kpi-icon-3"><IconUser :size="18" /></div>
          </div>
          <div class="metric-value kpi-val-3">{{ totalActivationsCount }}</div>
          <div class="metric-secondary">Across all users</div>
        </div>
        <div class="metric-card hover-lift">
          <div class="metric-header">
            <span class="metric-label">Incident Holds</span>
            <div class="metric-icon-box kpi-icon-4"><IconShield :size="18" /></div>
          </div>
          <div class="metric-value text-rose-500">{{ killedCount }}</div>
          <div class="metric-secondary">Kill-switched addons</div>
        </div>
      </div>

      <!-- Addons List Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="admin-addons-grid">
        <div
          v-for="addon in addons"
          :key="addon.id"
          class="card p-5 flex flex-col justify-between hover-lift relative border"
          :class="addon.isKilled ? 'border-rose-500/50 bg-rose-500/[0.02]' : 'border-slate-200 dark:border-slate-800'"
          :id="`admin-addon-card-${addon.key || addon.slug}`"
        >
          <div>
            <!-- Status & Kill Switch Bar -->
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="badge badge-success font-bold text-xs">FREE</span>
              <div class="flex items-center gap-1.5">
                <span v-if="addon.isKilled" class="badge badge-danger font-bold text-2xs">KILL-SWITCH ENGAGED</span>
                <span v-else class="badge badge-emerald font-bold text-2xs uppercase">{{ addon.status }}</span>
              </div>
            </div>

            <!-- Title & Category -->
            <div class="flex items-start gap-3 mb-2">
              <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary shrink-0 border border-slate-200 dark:border-slate-700">
                <IconPackage :size="20" />
              </div>
              <div>
                <h3 class="font-extrabold text-base text-primary">{{ addon.name }}</h3>
                <span class="text-xs text-tertiary font-mono">{{ addon.key || addon.slug }} · v{{ addon.version }}</span>
              </div>
            </div>

            <p class="text-xs text-secondary mb-3 leading-relaxed">
              {{ addon.description }}
            </p>

            <div class="text-2xs text-tertiary bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700/50 mb-4 space-y-1">
              <div><span class="font-bold text-secondary">Category:</span> {{ addon.category }}</div>
              <div><span class="font-bold text-secondary">Default Enabled:</span> {{ addon.defaultEnabled ? 'Yes' : 'No' }}</div>
              <div><span class="font-bold text-secondary">Depends On:</span> {{ (addon.dependsOn && addon.dependsOn.length > 0) ? addon.dependsOn.join(', ') : 'None' }}</div>
              <div><span class="font-bold text-secondary">Active Users:</span> {{ addon.stats?.activeUsers || 0 }}</div>
            </div>
          </div>

          <!-- Card Actions -->
          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
            <div class="flex gap-2">
              <button
                class="btn btn-secondary btn-sm flex-1 text-xs font-semibold"
                @click="openEditModal(addon)"
              >
                Edit Details
              </button>
              <button
                class="btn btn-sm flex-1 text-xs font-semibold"
                :class="addon.isKilled ? 'btn-success' : 'btn-danger'"
                @click="toggleKillSwitch(addon)"
              >
                {{ addon.isKilled ? 'Release Kill-Switch' : 'Engage Kill-Switch' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ───────────────────────────────────────────────────────────────────── -->
    <!-- TAB 2: PERSONA ONBOARDING DEFAULTS                                    -->
    <!-- ───────────────────────────────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'personas'" class="flex flex-col gap-4">
      <div class="card p-6">
        <h2 class="text-lg font-bold text-primary mb-1">Persona Onboarding Default Addons</h2>
        <p class="text-xs text-secondary mb-4">
          Configure which free addons are automatically activated when new users select their earning persona during registration.
        </p>

        <div class="space-y-4">
          <div
            v-for="p in personaDefaults"
            :key="p.persona"
            class="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div class="font-extrabold text-sm text-primary font-mono capitalize">{{ p.persona.replace(/_/g, ' ') }}</div>
              <div class="text-xs text-tertiary mt-1">
                Active Defaults: <span class="font-semibold text-secondary">{{ p.defaultAddonKeys.join(', ') || 'None' }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <select
                multiple
                class="form-input text-xs py-1 px-2 rounded-lg"
                v-model="p.defaultAddonKeys"
              >
                <option v-for="a in addons" :key="a.key || a.slug" :value="a.key || a.slug">
                  {{ a.name }} ({{ a.key || a.slug }})
                </option>
              </select>
              <button
                class="btn btn-primary btn-sm text-xs font-bold whitespace-nowrap"
                @click="savePersonaDefaults(p)"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ───────────────────────────────────────────────────────────────────── -->
    <!-- TAB 3: FAIR-USE SAFETY LIMITS                                         -->
    <!-- ───────────────────────────────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'limits'" class="flex flex-col gap-4">
      <div class="card p-6">
        <h2 class="text-lg font-bold text-primary mb-1">Configurable Fair-Use Abuse Protection Limits</h2>
        <p class="text-xs text-secondary mb-4">
          Safety rate limits to protect server resources and prevent abuse. None of these limits are hardcoded.
        </p>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b text-tertiary">
                <th class="py-2.5 px-3">Limit Name & Key</th>
                <th class="py-2.5 px-3">Threshold</th>
                <th class="py-2.5 px-3">Window</th>
                <th class="py-2.5 px-3">Unit</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="l in fairUseLimits" :key="l.limitKey" class="border-b hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td class="py-3 px-3">
                  <div class="font-bold text-primary">{{ l.name }}</div>
                  <div class="text-2xs text-tertiary font-mono">{{ l.limitKey }}</div>
                </td>
                <td class="py-3 px-3">
                  <input
                    type="number"
                    class="form-input text-xs py-1 px-2 w-24 rounded"
                    v-model.number="l.limitValue"
                  />
                </td>
                <td class="py-3 px-3 font-mono text-secondary">
                  {{ l.windowSeconds === 86400 ? 'Daily (24h)' : (l.windowSeconds === 3600 ? 'Hourly (1h)' : 'Static Size') }}
                </td>
                <td class="py-3 px-3 font-mono text-tertiary">{{ l.unit }}</td>
                <td class="py-3 px-3">
                  <span class="badge font-bold text-2xs" :class="l.isActive ? 'badge-success' : 'badge-secondary'">
                    {{ l.isActive ? 'Active' : 'Disabled' }}
                  </span>
                </td>
                <td class="py-3 px-3 text-right">
                  <button class="btn btn-primary btn-sm text-xs font-bold" @click="saveLimit(l)">
                    Save Limit
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ───────────────────────────────────────────────────────────────────── -->
    <!-- TAB 4: USER ADDON INSPECTOR                                           -->
    <!-- ───────────────────────────────────────────────────────────────────── -->
    <div v-else-if="activeTab === 'users'" class="flex flex-col gap-4">
      <div class="card p-6">
        <h2 class="text-lg font-bold text-primary mb-1">User Addon Inspector & Manual Override</h2>
        <p class="text-xs text-secondary mb-4">
          Look up any user by ID to inspect their active entitlements and manually toggle addons with admin audit logging.
        </p>

        <div class="flex items-center gap-3 mb-6">
          <input
            v-model="targetUserId"
            type="number"
            class="form-input text-xs py-2 px-3 rounded-lg w-48"
            placeholder="Enter User ID (e.g. 1)"
            id="input-user-lookup"
          />
          <button class="btn btn-primary btn-sm font-bold text-xs" @click="lookupUserAddons">
            Inspect User
          </button>
        </div>

        <div v-if="inspectedUserData" class="space-y-4">
          <div class="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border flex items-center justify-between">
            <div>
              <div class="font-extrabold text-sm text-primary">{{ inspectedUserData.user.name }} ({{ inspectedUserData.user.email }})</div>
              <div class="text-xs text-tertiary">User ID: {{ inspectedUserData.user.id }} · Persona: {{ inspectedUserData.user.earningPersona || 'None' }}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="ua in inspectedUserData.addons"
              :key="ua.id"
              class="p-4 rounded-xl border flex items-center justify-between"
              :class="ua.isActivated ? 'border-emerald-500/30 bg-emerald-500/[0.02]' : 'border-slate-200 dark:border-slate-700'"
            >
              <div>
                <div class="font-bold text-sm text-primary">{{ ua.name }}</div>
                <div class="text-2xs text-tertiary font-mono">{{ ua.key || ua.slug }}</div>
                <div class="text-2xs text-secondary mt-1">
                  Status: <span class="font-semibold" :class="ua.isActivated ? 'text-emerald-600' : 'text-slate-400'">{{ ua.isActivated ? 'ACTIVATED' : 'DISABLED' }}</span>
                </div>
              </div>

              <button
                class="btn btn-sm font-bold text-xs"
                :class="ua.isActivated ? 'btn-danger' : 'btn-primary'"
                @click="toggleUserAddon(ua)"
              >
                {{ ua.isActivated ? 'Manual Deactivate' : 'Manual Activate' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit Addon Modal -->
    <div v-if="showEditModal" class="modal-overlay animate-fade-in" @click.self="showEditModal = false">
      <div class="modal-card max-w-lg animate-scale-up" id="addon-edit-modal">
        <div class="modal-header flex items-center justify-between border-b pb-3 mb-4">
          <h3 class="font-bold text-base text-primary">{{ editForm.id ? 'Edit Addon' : 'Create New Free Addon' }}</h3>
          <button class="btn btn-ghost btn-sm p-1" @click="showEditModal = false">✕</button>
        </div>

        <div class="modal-body flex flex-col gap-3">
          <div>
            <label class="form-label text-xs">Addon Name *</label>
            <input v-model="editForm.name" type="text" class="form-input text-xs" placeholder="e.g. Basic Invoicing" />
          </div>

          <div>
            <label class="form-label text-xs">Key / Slug *</label>
            <input v-model="editForm.key" type="text" class="form-input text-xs font-mono" placeholder="e.g. basic-invoicing" />
          </div>

          <div>
            <label class="form-label text-xs">Description</label>
            <textarea v-model="editForm.description" rows="2" class="form-input text-xs"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label text-xs">Category</label>
              <input v-model="editForm.category" type="text" class="form-input text-xs" />
            </div>
            <div>
              <label class="form-label text-xs">Status</label>
              <select v-model="editForm.status" class="form-input text-xs">
                <option value="active">active</option>
                <option value="beta">beta</option>
                <option value="deprecated">deprecated</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="form-label text-xs">Sort Order</label>
              <input v-model.number="editForm.sortOrder" type="number" class="form-input text-xs" />
            </div>
            <div class="flex items-center gap-2 pt-5">
              <input v-model="editForm.defaultEnabled" type="checkbox" id="chk-default-enabled" />
              <label for="chk-default-enabled" class="text-xs font-medium cursor-pointer">Default Enabled for All</label>
            </div>
          </div>

          <div>
            <label class="form-label text-xs">Dependencies (comma separated keys)</label>
            <input v-model="editForm.dependsOnStr" type="text" class="form-input text-xs font-mono" placeholder="e.g. basic-invoicing" />
          </div>
        </div>

        <div class="modal-footer flex justify-end gap-2 pt-4 border-t mt-4">
          <button class="btn btn-secondary btn-sm" @click="showEditModal = false">Cancel</button>
          <button class="btn btn-primary btn-sm font-bold" @click="saveAddon">
            Save Addon
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from '~/composables/useToast'
import IconPackage from '~/components/IconPackage.vue'
import IconUser from '~/components/IconUser.vue'
import IconShield from '~/components/IconShield.vue'
import IconPlus from '~/components/IconPlus.vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})


const toast = useToast()

const activeTab = ref('catalog')
const addons = ref([])
const personaDefaults = ref([])
const fairUseLimits = ref([])
const isLoading = ref(false)
const alertMessage = ref('')
const alertType = ref('auth-alert-success')

const showEditModal = ref(false)
const editForm = ref({
  id: null,
  name: '',
  key: '',
  description: '',
  category: 'Utilities',
  status: 'active',
  defaultEnabled: false,
  sortOrder: 1,
  dependsOnStr: '',
})

const targetUserId = ref('')
const inspectedUserData = ref(null)

const activeAddonsCount = computed(() => addons.value.filter(a => a.status === 'active' || a.status === 'published').length)
const totalActivationsCount = computed(() => addons.value.reduce((acc, a) => acc + (a.stats?.totalUsers || 0), 0))
const killedCount = computed(() => addons.value.filter(a => a.isKilled).length)

async function loadData() {
  isLoading.value = true
  try {
    const [addonsRes, personasRes, limitsRes] = await Promise.allSettled([
      $fetch('/api/admin/store/addons'),
      $fetch('/api/admin/store/personas'),
      $fetch('/api/admin/store/limits'),
    ])

    if (addonsRes.status === 'fulfilled' && addonsRes.value?.data?.addons) {
      addons.value = addonsRes.value.data.addons
    }
    if (personasRes.status === 'fulfilled' && personasRes.value?.data?.personaDefaults) {
      personaDefaults.value = personasRes.value.data.personaDefaults
    }
    if (limitsRes.status === 'fulfilled' && limitsRes.value?.data?.limits) {
      fairUseLimits.value = limitsRes.value.data.limits
    }
  } catch (err) {
    console.error('Failed to load admin store data:', err)
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  editForm.value = {
    id: null,
    name: '',
    key: '',
    description: '',
    category: 'Finance & Invoicing',
    status: 'active',
    defaultEnabled: false,
    sortOrder: addons.value.length + 1,
    dependsOnStr: '',
  }
  showEditModal.value = true
}

function openEditModal(addon) {
  editForm.value = {
    id: addon.id,
    name: addon.name,
    key: addon.key || addon.slug,
    description: addon.description,
    category: addon.category,
    status: addon.status,
    defaultEnabled: Boolean(addon.defaultEnabled),
    sortOrder: addon.sortOrder || 1,
    dependsOnStr: (addon.dependsOn || []).join(', '),
  }
  showEditModal.value = true
}

async function saveAddon() {
  const dependsOn = editForm.value.dependsOnStr
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  const payload = {
    action: editForm.value.id ? 'UPDATE' : 'CREATE',
    id: editForm.value.id,
    name: editForm.value.name,
    key: editForm.value.key,
    description: editForm.value.description,
    category: editForm.value.category,
    status: editForm.value.status,
    defaultEnabled: editForm.value.defaultEnabled,
    sortOrder: editForm.value.sortOrder,
    dependsOn,
  }

  try {
    const res = await $fetch('/api/admin/store/addons', {
      method: 'POST',
      body: payload,
    })
    toast.success(res?.data?.message || 'Addon saved successfully.')
    showEditModal.value = false
    await loadData()
  } catch (err) {
    toast.error(err?.data?.message || err?.message || 'Failed to save addon.')
  }
}

async function toggleKillSwitch(addon) {
  const nextKilled = !addon.isKilled
  try {
    const res = await $fetch('/api/admin/store/kill-switch', {
      method: 'POST',
      body: {
        addonKey: addon.key || addon.slug,
        isKilled: nextKilled,
        incidentReason: 'Admin dashboard manual toggle',
      },
    })
    toast.info(res?.data?.message || 'Kill switch updated.')
    await loadData()
  } catch (err) {
    toast.error(err?.data?.message || 'Failed to toggle kill switch.')
  }
}

async function savePersonaDefaults(p) {
  try {
    const res = await $fetch('/api/admin/store/personas', {
      method: 'PUT',
      body: {
        persona: p.persona,
        defaultAddonKeys: p.defaultAddonKeys,
      },
    })
    toast.success(res?.data?.message || 'Persona defaults updated.')
  } catch (err) {
    toast.error(err?.data?.message || 'Failed to update persona defaults.')
  }
}

async function saveLimit(l) {
  try {
    const res = await $fetch('/api/admin/store/limits', {
      method: 'PUT',
      body: {
        limitKey: l.limitKey,
        limitValue: l.limitValue,
        isActive: l.isActive,
      },
    })
    toast.success(res?.data?.message || 'Safety limit updated.')
  } catch (err) {
    toast.error(err?.data?.message || 'Failed to update safety limit.')
  }
}

async function lookupUserAddons() {
  if (!targetUserId.value) return
  try {
    const res = await $fetch(`/api/admin/store/user-addons?userId=${targetUserId.value}`)
    if (res?.data) {
      inspectedUserData.value = res.data
    }
  } catch (err) {
    toast.error(err?.data?.message || 'User not found.')
  }
}

async function toggleUserAddon(ua) {
  if (!inspectedUserData.value) return
  const action = ua.isActivated ? 'deactivate' : 'activate'
  try {
    const res = await $fetch('/api/admin/store/user-addons', {
      method: 'POST',
      body: {
        userId: inspectedUserData.value.user.id,
        addonKey: ua.key || ua.slug,
        action,
        reason: 'Admin dashboard manual override',
      },
    })
    toast.success(res?.data?.message || 'User addon updated.')
    await lookupUserAddons()
  } catch (err) {
    toast.error(err?.data?.message || 'Failed to update user addon.')
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}
.modal-card {
  background: var(--bg-surface, #ffffff);
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  width: 100%;
  padding: 1.5rem;
  border: 1px solid var(--border-color, #e2e8f0);
}
</style>
