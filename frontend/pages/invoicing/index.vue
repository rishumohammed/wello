<template>
  <div class="invoicing-page animate-fade-in" style="display:flex;flex-direction:column;gap:24px;">
    <!-- Page Header & Action Bar -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Invoicing</h1>
        <p class="page-subtitle">Create, manage, print, and export itemized invoices directly from your completed Wello jobs.</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-primary btn-sm" @click="openCreateModal()" id="btn-create-invoice-top">
          <IconPlus :size="14" /> Create Invoice
        </button>
      </div>
    </div>

    <!-- Alert Toast -->
    <div v-if="alertMessage" class="auth-alert mb-0" :class="alertType" id="invoices-toast">
      <span>{{ alertMessage }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="alertMessage = ''">✕</button>
    </div>

    <!-- 4 Summary KPI Cards -->
    <div class="grid-4 gap-4 mb-6" id="invoicing-summary-cards">
      <div class="metric-card hover-lift" id="metric-inv-total">
        <div class="metric-header">
          <span class="metric-label">Total Invoices</span>
          <div class="metric-icon-box kpi-icon-1">
            <IconReceipt :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-1">{{ analytics.totalInvoices || 0 }}</div>
        <div class="metric-secondary">across all billing statuses</div>
      </div>
      <div class="metric-card hover-lift" id="metric-inv-billed">
        <div class="metric-header">
          <span class="metric-label">Paid Billed Revenue</span>
          <div class="metric-icon-box kpi-icon-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
        </div>
        <div class="metric-value kpi-val-2">{{ store.currency }} {{ (analytics.totalBilled || 0).toLocaleString('en-IN') }}</div>
        <div class="metric-secondary">{{ analytics.paidCount || 0 }} fully settled invoice(s)</div>
      </div>
      <div class="metric-card hover-lift" id="metric-inv-outstanding">
        <div class="metric-header">
          <span class="metric-label">Outstanding Balance</span>
          <div class="metric-icon-box kpi-icon-3">
            <IconAlert :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-3">{{ store.currency }} {{ (analytics.totalOutstanding || 0).toLocaleString('en-IN') }}</div>
        <div class="metric-secondary">{{ (analytics.sentCount || 0) + (analytics.overdueCount || 0) }} pending / sent invoice(s)</div>
      </div>
      <div class="metric-card hover-lift" id="metric-inv-drafts">
        <div class="metric-header">
          <span class="metric-label">Draft Invoices</span>
          <div class="metric-icon-box kpi-icon-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
        </div>
        <div class="metric-value kpi-val-4">{{ analytics.draftCount || 0 }}</div>
        <div class="metric-secondary">Unsent invoices</div>
      </div>
    </div>

    <!-- Search & Filter Strip -->
    <div class="card card-padded flex items-center justify-between flex-wrap gap-4" id="invoicing-filters-card">
      <div class="filter-strip mb-0" id="invoice-status-filters">
        <button
          v-for="st in statusTabs"
          :key="st.key"
          class="filter-chip"
          :class="{ active: selectedStatus === st.key }"
          @click="selectedStatus = st.key"
          :id="`tab-inv-status-${st.key}`"
        >
          {{ st.label }}
          <span v-if="st.count !== undefined" class="text-xs opacity-80 ml-1">({{ st.count }})</span>
        </button>
      </div>

      <div class="search-input-wrap" style="max-width:280px;width:100%;">
        <input
          v-model="searchQuery"
          type="text"
          class="form-input text-xs"
          placeholder="Search by invoice # or client…"
          id="input-search-invoices"
        />
      </div>
    </div>

    <!-- Invoices Directory Table Card -->
    <div class="card" id="invoices-directory-card">
      <div class="card-header flex items-center justify-between">
        <div>
          <div class="card-title text-base">Invoices Directory</div>
          <div class="card-subtitle">Manage billing, print paper records, or export invoices</div>
        </div>
        <span class="text-xs text-tertiary">{{ filteredInvoices.length }} invoice(s) found</span>
      </div>

      <div v-if="isLoading" class="text-center py-12 text-tertiary text-sm">
        Loading invoices data…
      </div>

      <div v-else-if="filteredInvoices.length === 0" class="empty-state py-12">
        <div class="empty-icon"><IconReceipt :size="32" /></div>
        <div class="empty-title text-base mt-2">No invoices found matching filter</div>
        <div class="empty-desc text-xs mt-1">Click <strong>+ Create Invoice</strong> to issue your first client invoice.</div>
        <button class="btn btn-primary btn-sm mt-3" @click="openCreateModal()">Create Invoice</button>
      </div>

      <div v-else class="table-responsive">
        <table class="table" id="invoices-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer / Client</th>
              <th>Service Description</th>
              <th>Date / Due</th>
              <th class="table-text-right">Total Amount</th>
              <th>Status</th>
              <th class="table-text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="inv in filteredInvoices" :key="inv.id" :id="`invoice-row-${inv.id}`">
              <!-- Invoice Number & Link -->
              <td>
                <NuxtLink :to="`/invoicing/${inv.id}`" class="font-bold text-primary text-sm hover:text-brand" style="text-decoration:none;">
                  {{ inv.invoiceNumber }}
                </NuxtLink>
              </td>

              <!-- Customer -->
              <td>
                <div>
                  <div class="font-bold text-sm text-primary">{{ inv.customerName }}</div>
                  <div class="text-xs text-tertiary truncate max-w-xs" v-if="inv.customerContact">{{ inv.customerContact }}</div>
                </div>
              </td>

              <!-- Service Description -->
              <td>
                <div class="text-xs text-secondary max-w-xs truncate" :title="inv.serviceDescription">
                  {{ inv.serviceDescription }}
                </div>
              </td>

              <!-- Date & Due -->
              <td>
                <div class="text-xs text-primary font-semibold">{{ inv.invoiceDate }}</div>
                <div class="text-xs text-tertiary">Due: {{ inv.dueDate }}</div>
              </td>

              <!-- Total Amount -->
              <td class="table-text-right">
                <div class="font-extrabold text-sm text-primary">
                  {{ store.currency }} {{ inv.total.toLocaleString('en-IN') }}
                </div>
                <div class="text-xs text-tertiary" v-if="inv.taxAmount > 0">+{{ store.currency }}{{ inv.taxAmount.toLocaleString('en-IN') }} GST</div>
              </td>

              <!-- Status Dropdown (Manual Payment Status Switcher) -->
              <td>
                <select
                  v-model="inv.status"
                  @change="updateStatus(inv)"
                  class="form-input text-xs font-bold"
                  :style="getStatusBadgeStyle(inv.status)"
                  style="padding:3px 8px;border-radius:12px;height:28px;cursor:pointer;"
                  :id="`select-status-${inv.id}`"
                >
                  <option value="DRAFT">📝 DRAFT</option>
                  <option value="SENT">📤 SENT</option>
                  <option value="PAID">✅ PAID</option>
                  <option value="OVERDUE">⚠️ OVERDUE</option>
                  <option value="CANCELLED">🚫 CANCELLED</option>
                </select>
              </td>

              <!-- Actions -->
              <td class="table-text-right">
                <div class="flex items-center justify-end gap-2">
                  <NuxtLink :to="`/invoicing/${inv.id}`" class="btn btn-secondary btn-xs" title="View & Print Invoice">
                    <IconPrinter :size="13" />
                    <span>View</span>
                  </NuxtLink>
                  <button class="btn btn-secondary btn-xs" @click="openEditModal(inv)" title="Edit Invoice" :id="`btn-edit-inv-${inv.id}`">
                    <IconEdit :size="13" />
                    <span>Edit</span>
                  </button>
                  <button class="btn btn-ghost btn-xs text-error" @click="removeInvoice(inv)" title="Delete Invoice" :id="`btn-delete-inv-${inv.id}`">
                    <IconTrash :size="13" />
                    <span>Delete</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create / Edit Invoice Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false" id="invoice-modal">
        <div class="modal modal-lg" role="dialog" style="max-width:740px;width:100%;">
          <div class="modal-header">
            <div class="modal-title">{{ modalForm.id ? 'Edit Invoice' : 'Create New Invoice' }}</div>
            <button type="button" class="modal-close" @click="showModal = false"><IconX :size="16" /></button>
          </div>

          <form @submit.prevent="saveInvoiceForm" novalidate style="display:flex;flex-direction:column;gap:16px;">
            <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;max-height:75vh;overflow-y:auto;padding-right:4px;">
              <!-- Top Row: Invoice #, Date, Due Date -->
              <div class="grid-3 gap-3">
                <div class="form-group">
                  <label class="form-label text-xs">Invoice Number</label>
                  <input v-model="modalForm.invoiceNumber" type="text" class="form-input text-xs" placeholder="Auto-generated" />
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">Invoice Date <span class="required">*</span></label>
                  <input v-model="modalForm.invoiceDate" type="date" class="form-input text-xs" required />
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">Due Date <span class="required">*</span></label>
                  <input v-model="modalForm.dueDate" type="date" class="form-input text-xs" required />
                </div>
              </div>

              <!-- Customer Information -->
              <div class="grid-2 gap-3">
                <div class="form-group">
                  <label class="form-label text-xs">Customer / Client Name <span class="required">*</span></label>
                  <input v-model="modalForm.customerName" type="text" class="form-input text-xs" placeholder="e.g. Acme Corp" required />
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">Customer Contact (Email / Phone)</label>
                  <input v-model="modalForm.customerContact" type="text" class="form-input text-xs" placeholder="billing@client.com" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label text-xs">Customer Billing Address</label>
                <input v-model="modalForm.customerAddress" type="text" class="form-input text-xs" placeholder="Full street address, city, state, pincode" />
              </div>

              <div class="form-group">
                <label class="form-label text-xs">Overall Service Description</label>
                <input v-model="modalForm.serviceDescription" type="text" class="form-input text-xs" placeholder="e.g. Web design & consulting contract" />
              </div>

              <!-- Itemized Line Items Table -->
              <div class="form-group">
                <div class="flex items-center justify-between mb-2">
                  <label class="form-label text-xs mb-0">Itemized Line Items <span class="required">*</span></label>
                  <button type="button" class="btn btn-secondary btn-xs" @click="addItemLine">
                    <IconPlus :size="12" /> Add Line Item
                  </button>
                </div>

                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div v-for="(item, idx) in modalForm.items" :key="idx" class="flex items-center gap-2">
                    <input v-model="item.description" type="text" class="form-input text-xs" style="flex:3;" placeholder="Item description" required />
                    <input v-model.number="item.quantity" type="number" step="0.5" min="0.1" class="form-input text-xs text-center" style="flex:1;" placeholder="Qty" required />
                    <input v-model.number="item.rate" type="number" step="1" min="0" class="form-input text-xs text-right" style="flex:1.5;" placeholder="Rate" required />
                    <div class="text-xs font-bold text-primary text-right tabular" style="flex:1.5;">
                      {{ store.currency }}{{ ((item.quantity || 0) * (item.rate || 0)).toLocaleString('en-IN') }}
                    </div>
                    <button type="button" class="btn btn-ghost btn-xs text-error p-1" @click="removeItemLine(idx)" v-if="modalForm.items.length > 1">✕</button>
                  </div>
                </div>
              </div>

              <!-- Discount, Tax, Status & Totals Summary -->
              <div class="grid-3 gap-3">
                <div class="form-group">
                  <label class="form-label text-xs">Discount ({{ store.currency }})</label>
                  <input v-model.number="modalForm.discount" type="number" min="0" class="form-input text-xs" placeholder="0" />
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">Tax / GST (%)</label>
                  <input v-model.number="modalForm.taxPercent" type="number" min="0" max="100" class="form-input text-xs" placeholder="18" />
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">Invoice Status</label>
                  <select v-model="modalForm.status" class="form-input text-xs">
                    <option value="DRAFT">DRAFT</option>
                    <option value="SENT">SENT</option>
                    <option value="PAID">PAID</option>
                    <option value="OVERDUE">OVERDUE</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label text-xs">Notes / Payment Terms</label>
                <textarea v-model="modalForm.notes" class="form-input text-xs" rows="2" placeholder="Payment due within 15 days. Bank transfer details..."></textarea>
              </div>

              <!-- Total Calculation Display Box -->
              <div class="p-3" style="background:var(--color-off-white);border:1px solid var(--border-color);border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                <div class="text-xs text-secondary">
                  Subtotal: {{ store.currency }}{{ calculatedSubtotal.toLocaleString('en-IN') }} · Tax: {{ store.currency }}{{ calculatedTax.toLocaleString('en-IN') }}
                </div>
                <div class="text-base font-extrabold text-primary">
                  Total: {{ store.currency }}{{ calculatedTotal.toLocaleString('en-IN') }}
                </div>
              </div>
            </div>

            <!-- Modal Footer Action Buttons -->
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="isSaving" id="btn-save-invoice-submit">
                {{ isSaving ? 'Saving…' : (modalForm.id ? 'Update Invoice' : 'Save Invoice') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import IconReceipt from '~/components/IconReceipt.vue'
import IconAlert from '~/components/IconAlert.vue'
import IconPlus from '~/components/IconPlus.vue'
import IconPrinter from '~/components/IconPrinter.vue'
import IconEdit from '~/components/IconEdit.vue'
import IconTrash from '~/components/IconTrash.vue'
import IconX from '~/components/IconX.vue'

const store = useWelloStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const invoices = ref([])
const analytics = ref({})
const isLoading = ref(true)
const isSaving = ref(false)
const selectedStatus = ref('ALL')
const searchQuery = ref('')

const alertMessage = ref('')
const alertType = ref('success')

const showModal = ref(false)
const modalForm = ref({
  id: '',
  invoiceNumber: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  customerName: '',
  customerContact: '',
  customerAddress: '',
  serviceDescription: '',
  items: [{ description: 'Service Line Item', quantity: 1, rate: 1000 }],
  discount: 0,
  taxPercent: 18,
  notes: 'Thank you for choosing Wello services. Payment due upon receipt.',
  status: 'DRAFT',
})

const statusTabs = computed(() => [
  { key: 'ALL', label: 'All Invoices', count: invoices.value.length },
  { key: 'DRAFT', label: 'Draft', count: invoices.value.filter(i => i.status === 'DRAFT').length },
  { key: 'SENT', label: 'Sent', count: invoices.value.filter(i => i.status === 'SENT').length },
  { key: 'PAID', label: 'Paid', count: invoices.value.filter(i => i.status === 'PAID').length },
  { key: 'OVERDUE', label: 'Overdue', count: invoices.value.filter(i => i.status === 'OVERDUE').length },
  { key: 'CANCELLED', label: 'Cancelled', count: invoices.value.filter(i => i.status === 'CANCELLED').length },
])

const filteredInvoices = computed(() => {
  let list = invoices.value
  if (selectedStatus.value !== 'ALL') {
    list = list.filter(i => i.status === selectedStatus.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(i =>
      i.invoiceNumber.toLowerCase().includes(q) ||
      i.customerName.toLowerCase().includes(q) ||
      i.serviceDescription.toLowerCase().includes(q)
    )
  }
  return list
})

const calculatedSubtotal = computed(() => {
  return modalForm.value.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.rate) || 0)), 0)
})

const calculatedTax = computed(() => {
  const afterDiscount = Math.max(0, calculatedSubtotal.value - (Number(modalForm.value.discount) || 0))
  return (afterDiscount * (Number(modalForm.value.taxPercent) || 0)) / 100
})

const calculatedTotal = computed(() => {
  const afterDiscount = Math.max(0, calculatedSubtotal.value - (Number(modalForm.value.discount) || 0))
  return afterDiscount + calculatedTax.value
})

async function fetchInvoices() {
  isLoading.value = true
  try {
    const res = await $fetch('/api/invoices', {
      params: { userId: authStore.user?.id || 'u1' }
    })
    if (res?.invoices) invoices.value = res.invoices
    if (res?.analytics) analytics.value = res.analytics
  } catch (err) {
    console.error('Failed to fetch invoices:', err)
  } finally {
    isLoading.value = false
  }
}

function getStatusBadgeStyle(status) {
  switch (status) {
    case 'PAID': return 'background:rgba(16,185,129,0.12);color:var(--color-success);border:1px solid rgba(16,185,129,0.3);'
    case 'SENT': return 'background:rgba(0,123,255,0.12);color:var(--color-blue);border:1px solid rgba(0,123,255,0.3);'
    case 'OVERDUE': return 'background:rgba(245,158,11,0.12);color:#D97706;border:1px solid rgba(245,158,11,0.3);'
    case 'CANCELLED': return 'background:rgba(239,68,68,0.12);color:#EF4444;border:1px solid rgba(239,68,68,0.3);'
    default: return 'background:var(--color-off-white);color:var(--text-tertiary);border:1px solid var(--border-color);'
  }
}

async function updateStatus(invoice) {
  try {
    const res = await $fetch('/api/invoices/status', {
      method: 'POST',
      body: { id: invoice.id, status: invoice.status }
    })
    if (res?.success) {
      alertMessage.value = `Invoice ${invoice.invoiceNumber} status updated to ${invoice.status}.`
      alertType.value = 'success'
      await fetchInvoices()
    }
  } catch (err) {
    alertMessage.value = 'Failed to update invoice status.'
    alertType.value = 'error'
  }
}

function openCreateModal() {
  modalForm.value = {
    id: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    customerName: '',
    customerContact: '',
    customerAddress: '',
    serviceDescription: '',
    sellerName: store.user.businessName || store.user.name || '',
    sellerLogo: store.user.businessLogo || '',
    sellerAddress: store.user.businessAddress || '',
    sellerEmail: store.user.businessEmail || store.user.email || '',
    sellerPhone: store.user.businessPhone || '',
    sellerTaxId: store.user.businessTaxId || '',
    items: [{ description: 'Service Line Item', quantity: 1, rate: 1000 }],
    discount: 0,
    taxPercent: 18,
    notes: store.user.defaultInvoiceNotes || 'Payment is due within 14 days of invoice date. Thank you for your business!',
    status: 'DRAFT',
  }
  showModal.value = true
}

function openEditModal(inv) {
  modalForm.value = JSON.parse(JSON.stringify(inv))
  showModal.value = true
}

function addItemLine() {
  modalForm.value.items.push({ description: 'Additional Item', quantity: 1, rate: 500 })
}

function removeItemLine(idx) {
  modalForm.value.items.splice(idx, 1)
}

async function saveInvoiceForm() {
  isSaving.value = true
  try {
    const res = await $fetch('/api/invoices', {
      method: 'POST',
      body: {
        ...modalForm.value,
        userId: authStore.user?.id || 'u1',
        sellerName: modalForm.value.sellerName || store.user.businessName || store.user.name,
        sellerLogo: modalForm.value.sellerLogo || store.user.businessLogo || '',
        sellerAddress: modalForm.value.sellerAddress || store.user.businessAddress || '',
        sellerEmail: modalForm.value.sellerEmail || store.user.businessEmail || store.user.email || '',
        sellerPhone: modalForm.value.sellerPhone || store.user.businessPhone || '',
        sellerTaxId: modalForm.value.sellerTaxId || store.user.businessTaxId || '',
      }
    })
    if (res?.success) {
      alertMessage.value = res.message
      alertType.value = 'success'
      showModal.value = false
      await fetchInvoices()
    }
  } catch (err) {
    alertMessage.value = 'Error saving invoice.'
    alertType.value = 'error'
  } finally {
    isSaving.value = false
  }
}

async function removeInvoice(inv) {
  if (!confirm(`Are you sure you want to delete invoice ${inv.invoiceNumber}?`)) return
  try {
    const res = await $fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' })
    if (res?.success) {
      alertMessage.value = res.message
      alertType.value = 'success'
      await fetchInvoices()
    }
  } catch (err) {
    alertMessage.value = 'Failed to delete invoice.'
    alertType.value = 'error'
  }
}

onMounted(() => {
  fetchInvoices()
})
</script>
