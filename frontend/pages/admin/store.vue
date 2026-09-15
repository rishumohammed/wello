<template>
  <div class="admin-store-page animate-fade-in" style="display:flex;flex-direction:column;gap:24px;">
    <!-- Page Header & Action Bar -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Wello Store Addons Management</h1>
        <p class="page-subtitle">Manage official Store addons, publish modular features, inspect user adoption, and review platform analytics.</p>
      </div>

      <button class="btn btn-primary" @click="openCreateModal" id="btn-admin-add-addon">
        <IconPlus :size="16" /> Create New Addon
      </button>
    </div>

    <!-- Alert / Toast -->
    <div v-if="alertMessage" class="auth-alert mb-0" :class="alertType" id="admin-store-alert">
      <span>{{ alertMessage }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="alertMessage = ''">✕</button>
    </div>

    <!-- Summary KPI Cards -->
    <div class="grid-4 gap-4 mb-6" id="admin-store-kpi-grid">
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Total Store Addons</span>
          <div class="metric-icon-box kpi-icon-1">
            <IconPackage :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-1">{{ storeStats.totalAddons || 0 }}</div>
        <div class="metric-secondary">Modular features in catalog</div>
      </div>
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Published Addons</span>
          <div class="metric-icon-box kpi-icon-2">
            <IconPackage :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-2">{{ storeStats.publishedAddons || 0 }}</div>
        <div class="metric-secondary">Active & visible in Store</div>
      </div>
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">User Activations</span>
          <div class="metric-icon-box kpi-icon-3">
            <IconUser :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-3">{{ storeStats.totalActivations || 0 }}</div>
        <div class="metric-secondary">Active user addon installations</div>
      </div>
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Total Store Visits</span>
          <div class="metric-icon-box kpi-icon-4">
            <IconInsights :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-4">{{ storeStats.storeVisits || 0 }}</div>
        <div class="metric-secondary">User Store views</div>
      </div>
    </div>

    <!-- Addon Management Directory (Rendered as Cards Grid) -->
    <div id="admin-addons-card-section" style="display:flex;flex-direction:column;gap:16px;">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold text-primary mb-1">Addon Catalog Products</h2>
          <p class="text-xs text-secondary">Manage feature metadata, publish status, and inspect user adoption</p>
        </div>
        <span class="badge" style="background:var(--color-off-white);color:var(--text-secondary);font-weight:700;">{{ addons.length }} product(s)</span>
      </div>

      <div v-if="isLoading" class="text-center py-12 text-tertiary text-sm">
        Loading addon directory…
      </div>

      <div v-else class="store-products-grid" id="admin-addons-grid">
        <div
          v-for="addon in addons"
          :key="addon.id"
          class="card store-product-card hover-lift"
          style="background:white;border:1px solid var(--border-color);border-radius:20px;box-shadow:0 4px 20px rgba(0,0,0,0.04);display:flex;flex-direction:column;justify-content:space-between;padding:24px;position:relative;overflow:hidden;transition:all 0.25s ease;"
          :id="`admin-addon-card-${addon.id}`"
        >
          <!-- Top Accent -->
          <div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg, var(--color-purple), var(--color-info));"></div>

          <div>
            <!-- Status & Pricing Badges -->
            <div class="flex items-center justify-between gap-2 mb-4" style="margin-top:4px;">
              <span
                class="badge"
                :style="addon.isFree ? 'background:rgba(16,185,129,0.12);color:var(--color-success);font-weight:700;' : 'background:rgba(122,63,246,0.12);color:var(--color-purple);font-weight:700;'"
                style="padding:4px 12px;border-radius:12px;font-size:11px;letter-spacing:0.3px;"
              >
                {{ addon.isFree ? 'FREE ADDON' : 'PRO' }}
              </span>

              <span
                class="badge"
                :style="addon.status === 'PUBLISHED' ? 'background:rgba(16,185,129,0.12);color:var(--color-success);' : 'background:rgba(245,158,11,0.12);color:#D97706;'"
                style="font-weight:700;font-size:11px;padding:4px 12px;border-radius:12px;"
              >
                {{ addon.status }}
              </span>
            </div>

            <!-- Product Icon & Title (Portrait Layout) -->
            <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;margin-bottom:16px;">
              <div
                style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg, rgba(122,63,246,0.15) 0%, rgba(0,123,255,0.15) 100%);color:var(--color-purple);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(122,63,246,0.15);"
              >
                <IconPackage :size="30" />
              </div>
              <div>
                <h3 class="font-extrabold text-lg text-primary" style="line-height:1.2;margin-bottom:2px;">{{ addon.name }}</h3>
                <span class="text-xs text-tertiary font-medium">{{ addon.category }} · v{{ addon.version }}</span>
              </div>
            </div>

            <p class="text-sm text-secondary mb-4 text-center" style="line-height:1.5;min-height:42px;">
              {{ addon.description }}
            </p>

            <!-- Adoption Stats Summary Chips -->
            <div class="flex items-center gap-3 text-xs mb-4 p-3" style="background:var(--color-off-white);border:1px solid var(--border-subtle);border-radius:12px;">
              <div style="flex:1;text-align:center;">
                <div class="text-tertiary" style="font-size:11px;">Active Users</div>
                <div class="font-bold text-primary text-sm mt-0.5">{{ addon.stats?.activeUsers || 0 }}</div>
              </div>
              <div style="flex:1;border-left:1px solid var(--border-color);padding-left:12px;text-align:center;">
                <div class="text-tertiary" style="font-size:11px;">Total Usage</div>
                <div class="font-bold text-primary text-sm mt-0.5">{{ addon.stats?.usageCount || 0 }} times</div>
              </div>
            </div>

            <!-- Features List -->
            <div v-if="addon.features && addon.features.length > 0" class="features-list" style="display:flex;flex-direction:column;gap:8px;background:var(--color-off-white);padding:14px;border-radius:12px;border:1px solid var(--border-subtle);margin-bottom:16px;">
              <div v-for="(feat, idx) in addon.features" :key="idx" class="flex items-start gap-2 text-xs text-secondary" style="text-align:left;">
                <IconCheck :size="14" style="color:var(--color-success);flex-shrink:0;margin-top:2px;" />
                <span style="line-height:1.4;">{{ feat }}</span>
              </div>
            </div>
          </div>

          <!-- Card Actions Footer -->
          <div style="display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--border-subtle);">
            <div class="text-xs text-tertiary text-center font-mono">ID: {{ addon.id }}</div>

            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary btn-sm" style="flex:1;justify-content:center;height:38px;font-weight:600;" @click="toggleStatus(addon)">
                {{ addon.status === 'PUBLISHED' ? 'Unpublish' : 'Publish' }}
              </button>
              <button class="btn btn-primary btn-sm" style="flex:1;justify-content:center;height:38px;font-weight:600;" @click="openEditModal(addon)">
                <IconEdit :size="13" /> Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Store & Invoicing Analytics Overview -->
    <div class="card p-6" id="admin-store-analytics-card">
      <div class="card-title text-base mb-4">Addon & Store Usage Trends</div>
      <div class="grid-2 gap-6">
        <div>
          <div class="text-xs text-tertiary fw-600 uppercase mb-2">Monthly Activations & Billing Summary</div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th class="table-text-center">Activations</th>
                  <th class="table-text-center">Invoices</th>
                  <th class="table-text-right">Billed Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(tr, idx) in trends" :key="idx">
                  <td class="font-bold text-xs text-primary">{{ tr.month }}</td>
                  <td class="table-text-center text-xs text-secondary">{{ tr.activations }}</td>
                  <td class="table-text-center text-xs text-secondary">{{ tr.invoices }}</td>
                  <td class="table-text-right text-xs font-bold text-success">{{ store.currency }} {{ tr.revenueBilled.toLocaleString('en-IN') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div style="background:var(--color-off-white);padding:16px;border-radius:12px;border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:12px;">
          <div class="text-xs text-tertiary fw-700 uppercase">Invoicing Addon Usage Insights</div>
          <div class="flex justify-between text-xs py-1 border-b">
            <span class="text-secondary">Total Invoices Created:</span>
            <span class="font-bold text-primary">{{ invoiceStats.totalInvoices || 0 }}</span>
          </div>
          <div class="flex justify-between text-xs py-1 border-b">
            <span class="text-secondary">Settled Paid Invoices:</span>
            <span class="font-bold text-success">{{ invoiceStats.paidCount || 0 }}</span>
          </div>
          <div class="flex justify-between text-xs py-1 border-b">
            <span class="text-secondary">Outstanding Unpaid Invoices:</span>
            <span class="font-bold" style="color:#D97706;">{{ (invoiceStats.sentCount || 0) + (invoiceStats.overdueCount || 0) }}</span>
          </div>
          <div class="flex justify-between text-xs py-1">
            <span class="text-secondary">Total Settled Billed Amount:</span>
            <span class="font-extrabold text-primary">{{ store.currency }} {{ (invoiceStats.totalBilled || 0).toLocaleString('en-IN') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit Addon Modal -->
    <div v-if="showModal" class="modal-backdrop animate-fade-in" @click.self="showModal = false">
      <div class="modal-content card p-6" style="max-width:540px;width:100%;">
        <div class="flex items-center justify-between pb-3 border-b mb-4">
          <div class="card-title text-base">{{ modalForm.id ? 'Edit Addon' : 'Create New Addon' }}</div>
          <button class="btn btn-ghost btn-sm p-0" @click="showModal = false">✕</button>
        </div>

        <form @submit.prevent="saveAddonForm" style="display:flex;flex-direction:column;gap:14px;">
          <div class="form-group">
            <label class="form-label text-xs">Addon Name *</label>
            <input v-model="modalForm.name" type="text" class="form-input text-xs" required placeholder="e.g. Basic Invoicing" />
          </div>

          <div class="grid-2 gap-3">
            <div class="form-group">
              <label class="form-label text-xs">Category</label>
              <input v-model="modalForm.category" type="text" class="form-input text-xs" placeholder="Finance & Billing" />
            </div>
            <div class="form-group">
              <label class="form-label text-xs">Version</label>
              <input v-model="modalForm.version" type="text" class="form-input text-xs" placeholder="1.0.0" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label text-xs">Description</label>
            <textarea v-model="modalForm.description" class="form-input text-xs" rows="2" placeholder="Brief overview of what this addon does"></textarea>
          </div>

          <div class="form-group">
            <label class="form-label text-xs">Features (One feature per line)</label>
            <textarea v-model="featuresText" class="form-input text-xs" rows="3" placeholder="Itemized billing lines with tax & discounts&#10;Generate invoice directly from completed Wello jobs"></textarea>
          </div>

          <div class="grid-2 gap-3">
            <div class="form-group">
              <label class="form-label text-xs">Pricing Designation</label>
              <select v-model="modalForm.isFree" class="form-input text-xs">
                <option :value="true">FREE</option>
                <option :value="false">PRO</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label text-xs">Publish Status</label>
              <select v-model="modalForm.status" class="form-input text-xs">
                <option value="PUBLISHED">PUBLISHED</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t">
            <button type="button" class="btn btn-secondary btn-sm" @click="showModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="isSaving">
              {{ isSaving ? 'Saving…' : (modalForm.id ? 'Update Addon' : 'Create Addon') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'admin',
})

const store = useWelloStore()
const authStore = useAuthStore()

const addons = ref([])
const storeStats = ref({})
const invoiceStats = ref({})
const trends = ref([])
const isLoading = ref(true)
const isSaving = ref(false)

const alertMessage = ref('')
const alertType = ref('success')

const showModal = ref(false)
const modalForm = ref({
  id: '',
  name: '',
  slug: '',
  description: '',
  category: 'Utilities',
  version: '1.0.0',
  isFree: true,
  status: 'PUBLISHED',
  features: [],
})

const featuresText = computed({
  get: () => (modalForm.value.features || []).join('\n'),
  set: (val) => {
    modalForm.value.features = val.split('\n').filter(Boolean)
  }
})

async function fetchAdminStoreData() {
  isLoading.value = true
  try {
    const res = await $fetch('/api/admin/store/addons', { params: { role: 'admin' } })
    if (res?.addons) addons.value = res.addons
    if (res?.analytics) storeStats.value = res.analytics

    const analyticsRes = await $fetch('/api/admin/store/analytics', { params: { role: 'admin' } })
    if (analyticsRes?.invoiceAnalytics) invoiceStats.value = analyticsRes.invoiceAnalytics
    if (analyticsRes?.usageTrends) trends.value = analyticsRes.usageTrends
  } catch (err) {
    console.error('Failed to fetch admin store data:', err)
  } finally {
    isLoading.value = false
  }
}

function openCreateModal() {
  modalForm.value = {
    id: '',
    name: '',
    slug: '',
    description: '',
    category: 'Finance & Billing',
    version: '1.0.0',
    isFree: true,
    status: 'PUBLISHED',
    features: [],
  }
  showModal.value = true
}

function openEditModal(addon) {
  modalForm.value = JSON.parse(JSON.stringify(addon))
  showModal.value = true
}

async function saveAddonForm() {
  isSaving.value = true
  try {
    const res = await $fetch('/api/admin/store/addons', {
      method: 'POST',
      body: {
        ...modalForm.value,
        role: 'admin',
        adminEmail: authStore.user?.email || 'admin@wello.com',
        action: modalForm.value.id ? 'UPDATE' : 'CREATE',
      }
    })

    if (res?.success) {
      alertMessage.value = res.message
      alertType.value = 'success'
      showModal.value = false
      await fetchAdminStoreData()
    }
  } catch (err) {
    alertMessage.value = 'Error saving store addon.'
    alertType.value = 'error'
  } finally {
    isSaving.value = false
  }
}

async function toggleStatus(addon) {
  try {
    const res = await $fetch('/api/admin/store/addons', {
      method: 'POST',
      body: {
        id: addon.id,
        action: 'TOGGLE_STATUS',
        role: 'admin',
        adminEmail: authStore.user?.email || 'admin@wello.com',
      }
    })

    if (res?.success) {
      alertMessage.value = res.message
      alertType.value = 'success'
      await fetchAdminStoreData()
    }
  } catch (err) {
    alertMessage.value = 'Failed to toggle addon status.'
    alertType.value = 'error'
  }
}

onMounted(() => {
  fetchAdminStoreData()
})
</script>

<style scoped>
.store-products-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
@media (max-width: 992px) {
  .store-products-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .store-products-grid {
    grid-template-columns: 1fr;
  }
}
</style>
