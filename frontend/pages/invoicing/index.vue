<template>
  <div class="invoicing-page flex flex-col gap-6 animate-fade-in">
    <!-- Unactivated Addon Warning Banner if 403 -->
    <div v-if="addonRequired" class="card p-6 border-l-4 border-amber-500 bg-amber-500/10" id="invoicing-addon-gate">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div class="badge badge-warning mb-2 font-bold">Addon Required</div>
          <h2 class="text-xl font-extrabold text-primary mb-1">Basic Invoicing Addon is not activated</h2>
          <p class="text-sm text-secondary">
            Activate the 100% free Basic Invoicing addon from the Wello Store to generate gapless numbered invoices, calculate multi-tax & multi-currency totals, export server-side PDFs, and track client payments.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button class="btn btn-primary" @click="activateInvoicingAddon" :disabled="isActivatingAddon" id="btn-activate-invoicing">
            <span v-if="isActivatingAddon">Activating…</span>
            <span v-else>Activate Invoicing Addon (Free)</span>
          </button>
          <NuxtLink to="/store" class="btn btn-secondary">Visit Store</NuxtLink>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- Page Header & Action Bar -->
      <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
        <div>
          <h1 class="page-title">Invoicing & Receivables</h1>
          <p class="page-subtitle">Create gapless numbered invoices, track multi-tax line items, record partial payments, and issue credit notes.</p>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink to="/invoicing/recurring" class="btn btn-secondary btn-sm" id="btn-recurring-profiles">
            <span>Recurring Profiles</span>
          </NuxtLink>
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
          <div class="metric-secondary">across all lifecycle statuses</div>
        </div>
        <div class="metric-card hover-lift" id="metric-inv-billed">
          <div class="metric-header">
            <span class="metric-label">Collected Revenue</span>
            <div class="metric-icon-box kpi-icon-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <div class="metric-value kpi-val-2">{{ fmtCurrency(analytics.totalPaidRevenue || analytics.totalBilled || 0) }}</div>
          <div class="metric-secondary">{{ analytics.paidCount || 0 }} fully settled, {{ analytics.partiallyPaidCount || 0 }} partial</div>
        </div>
        <div class="metric-card hover-lift" id="metric-inv-outstanding">
          <div class="metric-header">
            <span class="metric-label">Outstanding Balance</span>
            <div class="metric-icon-box kpi-icon-3">
              <IconAlert :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-3">{{ fmtCurrency(analytics.totalOutstanding || 0) }}</div>
          <div class="metric-secondary">{{ analytics.overdueCount || 0 }} overdue, {{ analytics.sentCount || 0 }} sent</div>
        </div>
        <div class="metric-card hover-lift" id="metric-inv-drafts">
          <div class="metric-header">
            <span class="metric-label">Draft & Viewed</span>
            <div class="metric-icon-box kpi-icon-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          </div>
          <div class="metric-value kpi-val-4">{{ (analytics.draftCount || 0) + (analytics.viewedCount || 0) }}</div>
          <div class="metric-secondary">{{ analytics.viewedCount || 0 }} viewed by client</div>
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

        <div class="search-input-wrap max-w-280 w-full">
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
        <div v-if="isLoading" class="text-center py-12 text-tertiary text-sm">
          Loading invoices data…
        </div>

        <div v-else-if="filteredInvoices.length === 0" class="empty-state py-12">
          <div class="empty-icon"><IconReceipt :size="32" /></div>
          <div class="empty-title text-base mt-2">No invoices found matching filter</div>
          <div class="empty-desc text-xs mt-1">Click <strong>+ Create Invoice</strong> to issue your first gapless client invoice.</div>
          <button class="btn btn-primary btn-sm mt-3" @click="openCreateModal()">Create Invoice</button>
        </div>

        <div v-else class="table-responsive">
          <table class="table" id="invoices-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client / Customer</th>
                <th>Issue / Due Date</th>
                <th class="table-text-right">Total & Balance</th>
                <th>Status</th>
                <th class="table-text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in filteredInvoices" :key="inv.id" :id="`invoice-row-${inv.id}`">
                <!-- Invoice Number & Link -->
                <td>
                  <NuxtLink :to="`/invoicing/${inv.id}`" class="font-bold text-primary text-sm hover:text-brand text-decoration-none">
                    {{ inv.invoiceNumber }}
                  </NuxtLink>
                  <div v-if="inv.recurringProfileId" class="text-xs text-purple-600 font-medium">🔁 Recurring</div>
                </td>

                <!-- Customer -->
                <td>
                  <div>
                    <div class="font-bold text-sm text-primary">{{ inv.customerName }}</div>
                    <div class="text-xs text-tertiary truncate max-w-xs" v-if="inv.customerContact">{{ inv.customerContact }}</div>
                  </div>
                </td>

                <!-- Date & Due -->
                <td>
                  <div class="text-xs text-primary font-semibold">{{ inv.invoiceDate }}</div>
                  <div class="text-xs text-tertiary">Due: {{ inv.dueDate }}</div>
                </td>

                <!-- Total Amount & Balance Due -->
                <td class="table-text-right">
                  <div class="font-extrabold text-sm text-primary">
                    {{ fmtCurrency(inv.total, inv.currency) }}
                  </div>
                  <div v-if="inv.amountPaid > 0 && inv.balanceDue > 0" class="text-xs text-amber-600 font-semibold">
                    Paid: {{ fmtCurrency(inv.amountPaid, inv.currency) }} · Due: {{ fmtCurrency(inv.balanceDue, inv.currency) }}
                  </div>
                  <div v-else-if="inv.balanceDue > 0 && inv.status !== 'paid'" class="text-xs text-tertiary">
                    Balance: {{ fmtCurrency(inv.balanceDue, inv.currency) }}
                  </div>
                  <div v-if="inv.currency && inv.currency !== store.user.baseCurrency" class="text-xs text-tertiary">
                    ≈ {{ fmtCurrency(inv.baseTotal || inv.total) }}
                  </div>
                </td>

                <!-- Status Badge -->
                <td>
                  <span class="badge" :style="getStatusBadgeStyle(inv.status)" :id="`badge-status-${inv.id}`">
                    {{ formatStatusLabel(inv.status) }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="table-text-right">
                  <div class="flex items-center justify-end gap-2">
                    <NuxtLink :to="`/invoicing/${inv.id}`" class="btn btn-secondary btn-xs" title="View Details & PDF">
                      <IconPrinter :size="13" />
                      <span>View</span>
                    </NuxtLink>
                    <button
                      v-if="inv.balanceDue > 0 && inv.status !== 'draft' && inv.status !== 'cancelled' && inv.status !== 'void'"
                      class="btn btn-secondary btn-xs text-success"
                      @click="openPaymentModal(inv)"
                      title="Record Payment"
                    >
                      <IconPlus :size="13" />
                      <span>Pay</span>
                    </button>
                    <button
                      v-if="inv.status === 'draft' && !inv.isImmutable"
                      class="btn btn-secondary btn-xs"
                      @click="openEditModal(inv)"
                      title="Edit Invoice"
                      :id="`btn-edit-inv-${inv.id}`"
                    >
                      <IconEdit :size="13" />
                      <span>Edit</span>
                    </button>
                    <button
                      v-if="inv.status === 'draft' || inv.status === 'cancelled' || inv.status === 'void'"
                      class="btn btn-ghost btn-xs text-error"
                      @click="removeInvoice(inv)"
                      title="Delete Invoice"
                      :id="`btn-delete-inv-${inv.id}`"
                    >
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
    </template>

    <!-- Create / Edit Invoice Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="showModal = false" id="invoice-modal">
        <div class="modal modal-lg max-w-740 w-full" role="dialog">
          <div class="modal-header">
            <div class="modal-title">{{ modalForm.id ? 'Edit Invoice' : 'Create New Invoice' }}</div>
            <button type="button" class="modal-close" @click="showModal = false"><IconX :size="16" /></button>
          </div>

          <form @submit.prevent="saveInvoiceForm" novalidate>
            <div class="modal-body">
              <!-- Top Row: Invoice #, Date, Due Date, Template -->
              <div class="grid-4 gap-3">
                <div class="form-group">
                  <label class="form-label text-xs">Invoice Number</label>
                  <input v-model="modalForm.invoiceNumber" type="text" class="form-input text-xs" placeholder="Auto-generated gapless sequence" />
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">Invoice Date <span class="required">*</span></label>
                  <input v-model="modalForm.invoiceDate" type="date" class="form-input text-xs" required />
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">Payment Terms</label>
                  <select v-model="modalForm.paymentTerms" @change="onPaymentTermsChange" class="form-input text-xs">
                    <option value="due_on_receipt">Due on Receipt</option>
                    <option value="net_15">Net 15</option>
                    <option value="net_30">Net 30</option>
                    <option value="net_60">Net 60</option>
                    <option value="custom">Custom Due Date</option>
                  </select>
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
                <input v-model="modalForm.customerAddress" type="text" class="form-input text-xs" placeholder="Full street address, city, state, postal code" />
              </div>

              <div class="form-group">
                <label class="form-label text-xs">Overall Service Description / Job Scope</label>
                <input v-model="modalForm.serviceDescription" type="text" class="form-input text-xs" placeholder="e.g. Full-stack engineering & consulting contract" />
              </div>

              <!-- Itemized Line Items Table -->
              <div class="form-group">
                <div class="flex items-center justify-between mb-2">
                  <label class="form-label text-xs mb-0">Itemized Line Items <span class="required">*</span></label>
                  <button type="button" class="btn btn-secondary btn-xs" @click="addItemLine">
                    <IconPlus :size="12" /> Add Line Item
                  </button>
                </div>

                <div class="flex flex-col gap-2">
                  <div v-for="(item, idx) in modalForm.items" :key="idx" class="flex items-center gap-2">
                    <input v-model="item.description" type="text" class="form-input text-xs flex-3" placeholder="Item description" required />
                    <input v-model.number="item.quantity" type="number" step="0.5" min="0.1" class="form-input text-xs text-center flex-1" placeholder="Qty" required />
                    <input v-model.number="item.rate" type="number" step="any" min="0" class="form-input text-xs text-right flex-1-5" placeholder="Rate" required />
                    <input v-model.number="item.taxRate" type="number" step="any" min="0" max="100" class="form-input text-xs text-right flex-1" placeholder="Tax %" title="Tax Rate (%)" />
                    <div class="text-xs font-bold text-primary text-right tabular flex-1-5">
                      {{ fmtCurrency((item.quantity || 0) * (item.rate || 0), modalForm.currency) }}
                    </div>
                    <button type="button" class="btn btn-ghost btn-xs text-error p-1" @click="removeItemLine(idx)" v-if="modalForm.items.length > 1">✕</button>
                  </div>
                </div>
              </div>

              <!-- Currency, Discount, Tax Mode & PDF Template -->
              <div class="grid-4 gap-3">
                <div class="form-group">
                  <label class="form-label text-xs">Invoice Currency</label>
                  <select v-model="modalForm.currency" class="form-input text-xs">
                    <option v-for="c in ISO_CURRENCIES" :key="c.code" :value="c.code">
                      {{ c.code }} ({{ c.symbol }})
                    </option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">Tax Mode</label>
                  <select v-model="modalForm.taxMode" class="form-input text-xs">
                    <option value="exclusive">Exclusive (Add to Subtotal)</option>
                    <option value="inclusive">Inclusive (Embedded in Rate)</option>
                    <option value="none">No Tax / Zero Rated</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">PDF Template</label>
                  <select v-model="modalForm.pdfTemplate" class="form-input text-xs">
                    <option value="modern_clean">Modern Clean</option>
                    <option value="classic_executive">Classic Executive</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label text-xs">Discount ({{ modalForm.currency }})</label>
                  <input v-model.number="modalForm.discount" type="number" min="0" class="form-input text-xs" placeholder="0" />
                </div>
              </div>

              <!-- Reverse Charge & Tax Label -->
              <div class="grid-2 gap-3 mb-2">
                <div class="form-group">
                  <label class="form-label text-xs">Tax Label (e.g. VAT, GST, Sales Tax)</label>
                  <input v-model="modalForm.taxIdLabel" type="text" class="form-input text-xs" placeholder="e.g. VAT, GST, Sales Tax" />
                </div>
                <div class="flex items-center gap-4 pt-5">
                  <label class="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" v-model="modalForm.isReverseCharge" />
                    <span>Reverse-Charge (Cross-Border B2B)</span>
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label text-xs">Payment Link / Bank Instructions URL (Optional)</label>
                <input v-model="modalForm.paymentLinkUrl" type="url" class="form-input text-xs" placeholder="https://buy.stripe.com/..." />
              </div>

              <div class="form-group">
                <label class="form-label text-xs">Notes & Payment Instructions</label>
                <textarea v-model="modalForm.notes" class="form-input text-xs" rows="2" placeholder="Payment due within terms. Bank transfer / wire details..."></textarea>
              </div>

              <!-- Total Calculation Display Box -->
              <div class="p-3 bg-off-white border-soft rounded-10 flex justify-between items-center">
                <div class="text-xs text-secondary">
                  Subtotal: {{ fmtCurrency(calculatedSubtotal, modalForm.currency) }} · Tax: {{ fmtCurrency(calculatedTax, modalForm.currency) }}
                </div>
                <div class="text-base font-extrabold text-primary">
                  Total: {{ fmtCurrency(calculatedTotal, modalForm.currency) }}
                </div>
              </div>
            </div>

            <!-- Modal Footer Action Buttons -->
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="isSaving" id="btn-save-invoice-submit">
                {{ isSaving ? 'Saving…' : (modalForm.id ? 'Update Invoice' : 'Create Invoice') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Quick Payment Modal -->
    <Teleport to="body">
      <div v-if="showPaymentModal" class="modal-overlay" @click.self="showPaymentModal = false">
        <div class="modal max-w-md w-full" role="dialog">
          <div class="modal-header">
            <div class="modal-title">Record Payment for {{ activeInvoice?.invoiceNumber }}</div>
            <button type="button" class="modal-close" @click="showPaymentModal = false"><IconX :size="16" /></button>
          </div>
          <form @submit.prevent="recordPayment" class="p-4 flex flex-col gap-3">
            <div class="text-xs text-secondary mb-1">
              Total: <strong>{{ fmtCurrency(activeInvoice?.total, activeInvoice?.currency) }}</strong> ·
              Balance Due: <strong class="text-amber-600">{{ fmtCurrency(activeInvoice?.balanceDue, activeInvoice?.currency) }}</strong>
            </div>

            <div class="form-group">
              <label class="form-label text-xs">Payment Amount ({{ activeInvoice?.currency }}) <span class="required">*</span></label>
              <input v-model.number="paymentForm.amount" type="number" step="any" min="0.01" :max="activeInvoice?.balanceDue" class="form-input text-xs" required />
            </div>

            <div class="form-group">
              <label class="form-label text-xs">Payment Method</label>
              <select v-model="paymentForm.method" class="form-input text-xs">
                <option value="bank_transfer">Bank Transfer / Wire</option>
                <option value="stripe">Stripe / Card</option>
                <option value="cash">Cash</option>
                <option value="paypal">PayPal</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label text-xs">Reference / Transaction ID</label>
              <input v-model="paymentForm.reference" type="text" class="form-input text-xs" placeholder="e.g. TXN-99882" />
            </div>

            <div class="modal-footer mt-2">
              <button type="button" class="btn btn-secondary" @click="showPaymentModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="isSaving">Record Payment</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import { useFormatters } from '~/composables/useFormatters'
import { ISO_CURRENCIES } from '~/utils/currencyUtils'
import IconReceipt from '~/components/IconReceipt.vue'
import IconAlert from '~/components/IconAlert.vue'
import IconPlus from '~/components/IconPlus.vue'
import IconPrinter from '~/components/IconPrinter.vue'
import IconEdit from '~/components/IconEdit.vue'
import IconTrash from '~/components/IconTrash.vue'
import IconX from '~/components/IconX.vue'

const store = useWelloStore()
const authStore = useAuthStore()
const { fmtCurrency } = useFormatters()

const invoices = ref([])
const analytics = ref({})
const isLoading = ref(true)
const isSaving = ref(false)
const addonRequired = ref(false)
const isActivatingAddon = ref(false)
const selectedStatus = ref('ALL')
const searchQuery = ref('')

const alertMessage = ref('')
const alertType = ref('success')

const showModal = ref(false)
const showPaymentModal = ref(false)
const activeInvoice = ref(null)
const paymentForm = ref({
  amount: 0,
  method: 'bank_transfer',
  reference: '',
})

const modalForm = ref({
  id: '',
  invoiceNumber: '',
  currency: store.user.baseCurrency || 'USD',
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  paymentTerms: 'net_15',
  customerName: '',
  customerContact: '',
  customerAddress: '',
  serviceDescription: '',
  items: [{ description: 'Engineering & Consulting Services', quantity: 1, rate: 1000, taxRate: 0 }],
  discount: 0,
  taxMode: 'exclusive',
  taxPercent: 0,
  taxIdLabel: store.user.taxIdLabel || 'VAT',
  isReverseCharge: false,
  pdfTemplate: 'modern_clean',
  paymentLinkUrl: '',
  notes: 'Thank you for choosing our services. Payment due upon receipt.',
  status: 'draft',
})

const statusTabs = computed(() => [
  { key: 'ALL', label: 'All Invoices', count: invoices.value.length },
  { key: 'draft', label: 'Draft', count: invoices.value.filter(i => (i.status || '').toLowerCase() === 'draft').length },
  { key: 'sent', label: 'Sent', count: invoices.value.filter(i => (i.status || '').toLowerCase() === 'sent').length },
  { key: 'viewed', label: 'Viewed', count: invoices.value.filter(i => (i.status || '').toLowerCase() === 'viewed').length },
  { key: 'partially_paid', label: 'Partially Paid', count: invoices.value.filter(i => (i.status || '').toLowerCase() === 'partially_paid').length },
  { key: 'paid', label: 'Paid', count: invoices.value.filter(i => (i.status || '').toLowerCase() === 'paid').length },
  { key: 'overdue', label: 'Overdue', count: invoices.value.filter(i => (i.status || '').toLowerCase() === 'overdue').length },
  { key: 'cancelled', label: 'Cancelled', count: invoices.value.filter(i => (i.status || '').toLowerCase() === 'cancelled').length },
  { key: 'void', label: 'Void', count: invoices.value.filter(i => (i.status || '').toLowerCase() === 'void').length },
])

const filteredInvoices = computed(() => {
  let list = invoices.value
  if (selectedStatus.value !== 'ALL') {
    list = list.filter(i => (i.status || '').toLowerCase() === selectedStatus.value.toLowerCase())
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(i =>
      (i.invoiceNumber || '').toLowerCase().includes(q) ||
      (i.customerName || '').toLowerCase().includes(q) ||
      (i.serviceDescription || '').toLowerCase().includes(q)
    )
  }
  return list
})

const calculatedSubtotal = computed(() => {
  return modalForm.value.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.rate) || 0)), 0)
})

const calculatedTax = computed(() => {
  if (modalForm.value.isReverseCharge || modalForm.value.taxMode === 'none') return 0
  return modalForm.value.items.reduce((sum, item) => {
    const lineVal = (Number(item.quantity) || 0) * (Number(item.rate) || 0)
    const rate = Number(item.taxRate) || 0
    return sum + (lineVal * rate / 100)
  }, 0)
})

const calculatedTotal = computed(() => {
  const sub = calculatedSubtotal.value
  const disc = Number(modalForm.value.discount) || 0
  const afterDisc = Math.max(0, sub - disc)
  if (modalForm.value.taxMode === 'inclusive') return afterDisc
  return afterDisc + calculatedTax.value
})

function onPaymentTermsChange() {
  const d = new Date(modalForm.value.invoiceDate || Date.now())
  if (modalForm.value.paymentTerms === 'due_on_receipt') {
    modalForm.value.dueDate = d.toISOString().split('T')[0]
  } else if (modalForm.value.paymentTerms === 'net_15') {
    d.setDate(d.getDate() + 15)
    modalForm.value.dueDate = d.toISOString().split('T')[0]
  } else if (modalForm.value.paymentTerms === 'net_30') {
    d.setDate(d.getDate() + 30)
    modalForm.value.dueDate = d.toISOString().split('T')[0]
  } else if (modalForm.value.paymentTerms === 'net_60') {
    d.setDate(d.getDate() + 60)
    modalForm.value.dueDate = d.toISOString().split('T')[0]
  }
}

async function fetchInvoices() {
  isLoading.value = true
  addonRequired.value = false
  try {
    const res = await $fetch('/api/invoices', {
      params: { userId: authStore.user?.id || 'u1' }
    })
    if (res?.invoices) invoices.value = res.invoices
    if (res?.analytics) analytics.value = res.analytics
  } catch (err) {
    if (err?.statusCode === 403 && (err?.data?.code === 'ADDON_NOT_ACTIVATED' || err?.data?.code === 'INVOICING_ADDON_REQUIRED')) {
      addonRequired.value = true
    } else {
      console.error('Failed to fetch invoices:', err)
    }
  } finally {
    isLoading.value = false
  }
}

async function activateInvoicingAddon() {
  isActivatingAddon.value = true
  try {
    const addonsRes = await $fetch('/api/store/addons', {
      params: { userId: authStore.user?.id || 'u1' }
    })
    const basicAddon = addonsRes?.addons?.find(a => a.slug === 'basic-invoicing')
    if (basicAddon) {
      await $fetch('/api/store/addons/activate', {
        method: 'POST',
        body: { userId: authStore.user?.id || 'u1', addonId: basicAddon.id }
      })
      alertMessage.value = 'Basic Invoicing Addon activated successfully!'
      alertType.value = 'success'
      await fetchInvoices()
    }
  } catch (err) {
    alertMessage.value = 'Failed to activate Invoicing Addon.'
    alertType.value = 'error'
  } finally {
    isActivatingAddon.value = false
  }
}

function formatStatusLabel(status) {
  const s = (status || '').toLowerCase()
  switch (s) {
    case 'draft': return '📝 Draft'
    case 'sent': return '📤 Sent'
    case 'viewed': return '👁️ Viewed'
    case 'partially_paid': return '⏳ Partial'
    case 'paid': return '✅ Paid'
    case 'overdue': return '⚠️ Overdue'
    case 'cancelled': return '🚫 Cancelled'
    case 'void': return '⚪ Void'
    default: return status
  }
}

function getStatusBadgeStyle(status) {
  const s = (status || '').toLowerCase()
  switch (s) {
    case 'paid': return 'background:rgba(16,185,129,0.12);color:var(--color-success);border:1px solid rgba(16,185,129,0.3);'
    case 'partially_paid': return 'background:rgba(245,158,11,0.12);color:#D97706;border:1px solid rgba(245,158,11,0.3);'
    case 'sent': return 'background:rgba(59,130,246,0.12);color:#2563EB;border:1px solid rgba(59,130,246,0.3);'
    case 'viewed': return 'background:rgba(99,102,241,0.12);color:#4F46E5;border:1px solid rgba(99,102,241,0.3);'
    case 'overdue': return 'background:rgba(239,68,68,0.12);color:#EF4444;border:1px solid rgba(239,68,68,0.3);'
    case 'cancelled': return 'background:rgba(107,114,128,0.12);color:#6B7280;border:1px solid rgba(107,114,128,0.3);'
    case 'void': return 'background:rgba(100,116,139,0.12);color:#475569;border:1px solid rgba(100,116,139,0.3);'
    default: return 'background:var(--color-off-white);color:var(--text-tertiary);border:1px solid var(--border-color);'
  }
}

function openCreateModal() {
  modalForm.value = {
    id: '',
    invoiceNumber: '',
    currency: store.user.baseCurrency || 'USD',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    paymentTerms: 'net_15',
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
    items: [{ description: 'Engineering & Consulting Services', quantity: 1, rate: 1000, taxRate: 0 }],
    discount: 0,
    taxMode: 'exclusive',
    taxPercent: 0,
    taxIdLabel: store.user.taxIdLabel || 'VAT',
    isReverseCharge: false,
    pdfTemplate: 'modern_clean',
    paymentLinkUrl: '',
    notes: store.user.defaultInvoiceNotes || 'Payment is due within 14 days of invoice date. Thank you for your business!',
    status: 'draft',
  }
  showModal.value = true
}

function openEditModal(inv) {
  modalForm.value = JSON.parse(JSON.stringify(inv))
  showModal.value = true
}

function openPaymentModal(inv) {
  activeInvoice.value = inv
  paymentForm.value = {
    amount: inv.balanceDue || inv.total,
    method: 'bank_transfer',
    reference: '',
  }
  showPaymentModal.value = true
}

async function recordPayment() {
  if (!activeInvoice.value) return
  isSaving.value = true
  try {
    const res = await $fetch(`/api/invoices/${activeInvoice.value.id}/payments`, {
      method: 'POST',
      body: {
        userId: authStore.user?.id || 'u1',
        amount: paymentForm.value.amount,
        method: paymentForm.value.method,
        reference: paymentForm.value.reference,
      }
    })
    if (res?.success) {
      alertMessage.value = res.message || 'Payment recorded successfully!'
      alertType.value = 'success'
      showPaymentModal.value = false
      await fetchInvoices()
    }
  } catch (err) {
    alertMessage.value = 'Failed to record payment.'
    alertType.value = 'error'
  } finally {
    isSaving.value = false
  }
}

function addItemLine() {
  modalForm.value.items.push({ description: 'Additional Service Item', quantity: 1, rate: 500, taxRate: 0 })
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
    alertMessage.value = err?.data?.message || 'Error saving invoice.'
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
    alertMessage.value = err?.data?.message || 'Failed to delete invoice.'
    alertType.value = 'error'
  }
}

onMounted(() => {
  fetchInvoices()
})
</script>
