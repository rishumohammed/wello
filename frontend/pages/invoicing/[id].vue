<template>
  <div class="invoice-view-page animate-fade-in flex flex-col gap-6">
    <!-- Top Action Bar (Hidden during printing) -->
    <div class="no-print flex items-center justify-between flex-wrap gap-4 mb-2">
      <div class="flex items-center gap-3">
        <NuxtLink to="/invoicing" class="btn btn-secondary btn-sm" id="btn-back-invoices-list">
          <IconBack :size="14" />
          <span>All Invoices</span>
        </NuxtLink>
        <span class="text-xs text-tertiary">Invoice ID: {{ invoice?.invoiceNumber }}</span>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <!-- Manual Payment Status Switcher Dropdown -->
        <select
          v-if="invoice"
          v-model="invoice.status"
          @change="updateStatus"
          class="form-input text-xs font-bold status-badge-select"
          :class="getStatusBadgeClass(invoice.status)"
          id="invoice-view-status-select"
        >
          <option value="DRAFT">📝 DRAFT</option>
          <option value="SENT">📤 SENT</option>
          <option value="PAID">✅ PAID</option>
          <option value="OVERDUE">⚠️ OVERDUE</option>
          <option value="CANCELLED">🚫 CANCELLED</option>
        </select>

        <button class="btn btn-secondary btn-sm" @click="shareLink" id="btn-share-invoice">
          <IconShare :size="14" />
          <span>Share Link</span>
        </button>

        <button class="btn btn-secondary btn-sm" @click="triggerPrint" id="btn-download-pdf-invoice">
          <IconDownload :size="14" />
          <span>Download PDF</span>
        </button>

        <button class="btn btn-primary btn-sm" @click="triggerPrint" id="btn-print-invoice">
          <IconPrinter :size="14" />
          <span>Print Record</span>
        </button>
      </div>
    </div>

    <!-- Alert Toast -->
    <div v-if="toastMsg" class="no-print auth-alert success mb-0" id="invoice-view-toast">
      <span>{{ toastMsg }}</span>
    </div>

    <!-- Loading / Error State -->
    <div v-if="isLoading" class="text-center py-16 text-tertiary text-sm">
      Loading invoice details…
    </div>

    <div v-else-if="!invoice" class="empty-state py-16">
      <div class="empty-title">Invoice Not Found</div>
      <NuxtLink to="/invoicing" class="btn btn-primary btn-sm mt-3">Return to Invoices</NuxtLink>
    </div>

    <!-- PRINTABLE PAPER INVOICE CONTAINER (WELLO DESIGN SYSTEM) -->
    <div
      v-else
      class="card invoice-printable-paper"
      id="invoice-paper"
    >
      <!-- Top Brand Color Accent Bar -->
      <div class="invoice-top-accent"></div>

      <div class="invoice-paper-inner">
        <!-- Invoice Header: Logo, Issuer Name & Invoice Title Block -->
        <div class="flex items-start justify-between flex-wrap gap-6 pb-6 border-b border-subtle">
          <div>
            <!-- Seller Logo or Wello Default Badge -->
            <div class="mb-2">
              <img v-if="displayLogo" :src="displayLogo" alt="Business Logo" class="invoice-business-logo" />
              <div v-else class="flex items-center gap-2">
                <img src="~/assets/logo.png" alt="Wello" class="invoice-wello-logo" />
                <span class="badge badge-purple font-bold">INVOICE</span>
              </div>
            </div>
            <div class="font-extrabold text-xl text-primary">{{ displaySellerName }}</div>
            <div class="mt-2" v-if="displaySellerTaxId">
              <span class="badge bg-off-white text-secondary border-subtle-box text-xs font-semibold rounded-8 px-2.5 py-1">
                Tax ID / GSTIN: {{ cleanTaxId }}
              </span>
            </div>
          </div>

          <div class="text-right">
            <h2 class="text-3xl font-black text-primary tracking-wide">INVOICE</h2>
            <div class="fw-800 text-purple text-sm mt-2 mb-2">{{ invoice.invoiceNumber }}</div>
            <div>
              <span
                class="badge text-xs font-bold px-3 py-1 rounded-14"
                :class="getStatusBadgeClass(invoice.status)"
              >
                {{ invoice.status }}
              </span>
            </div>
          </div>
        </div>

        <!-- 2-Column Grid: Billed From Card & Billed To Card (Equal 50/50 Split) -->
        <div class="grid-2 gap-6 mb-6">
          <!-- Billed From Sub-Card -->
          <div class="p-5 bg-off-white border-subtle-box rounded-14 flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <div class="metric-icon-box purple">
                  <IconBriefcase :size="14" />
                </div>
                <span class="text-xs text-tertiary fw-700 uppercase tracking-wider">Billed From</span>
              </div>
              <div class="font-extrabold text-base text-primary mb-1">{{ displaySellerName }}</div>
              <div class="text-xs text-secondary whitespace-pre-line mb-3" v-if="displaySellerAddress">{{ displaySellerAddress }}</div>
            </div>
            <div class="pt-3 border-t text-xs text-tertiary flex flex-col gap-1">
              <span v-if="displaySellerEmail">📧 {{ displaySellerEmail }}</span>
              <span v-if="displaySellerPhone">📞 {{ displaySellerPhone }}</span>
            </div>
          </div>

          <!-- Billed To & Metadata Sub-Card -->
          <div class="p-5 bg-off-white border-subtle-box rounded-14 flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <div class="metric-icon-box blue">
                  <IconUser :size="14" />
                </div>
                <span class="text-xs text-tertiary fw-700 uppercase tracking-wider">Billed To</span>
              </div>
              <div class="font-extrabold text-base text-primary mb-1">{{ invoice.customerName }}</div>
              <div class="text-xs text-secondary mb-1" v-if="invoice.customerContact">📧 {{ invoice.customerContact }}</div>
              <div class="text-xs text-tertiary whitespace-pre-line mb-3" v-if="invoice.customerAddress">{{ invoice.customerAddress }}</div>
            </div>

            <!-- Metadata Box -->
            <div class="pt-3 border-t flex flex-col gap-1.5 text-xs">
              <div class="flex justify-between items-center">
                <span class="text-tertiary">Invoice Date:</span>
                <span class="fw-700 text-primary">{{ invoice.invoiceDate }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-tertiary">Payment Due:</span>
                <span class="fw-700 text-primary">{{ invoice.dueDate }}</span>
              </div>
              <div v-if="invoice.serviceDescription" class="flex justify-between items-center mt-0.5">
                <span class="text-tertiary">Service:</span>
                <span class="fw-600 text-primary truncate max-w-xs" :title="invoice.serviceDescription">{{ invoice.serviceDescription }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Itemized Line Items Table (Styled Wello Box) -->
        <div class="mb-6 border-subtle-box rounded-14 overflow-hidden">
          <table class="table m-0 w-full">
            <thead class="bg-off-white border-b border-subtle">
              <tr>
                <th class="p-4 text-left font-bold text-xs text-tertiary uppercase tracking-wider">Line Item Description</th>
                <th class="p-4 text-center font-bold text-xs text-tertiary uppercase tracking-wider w-28">Qty / Hours</th>
                <th class="p-4 text-right font-bold text-xs text-tertiary uppercase tracking-wider w-36">Unit Rate</th>
                <th class="p-4 text-right font-bold text-xs text-tertiary uppercase tracking-wider w-36">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in invoice.items" :key="item.id || idx" class="border-b border-subtle bg-card">
                <td class="p-4">
                  <div class="fw-700 text-sm text-primary">{{ item.description }}</div>
                </td>
                <td class="p-4 text-center tabular text-sm font-medium text-secondary">
                  {{ item.quantity }}
                </td>
                <td class="p-4 text-right tabular text-sm text-secondary">
                  {{ fmtCurrency(item.rate, invoice.currency) }}
                </td>
                <td class="p-4 text-right tabular text-sm fw-700 text-primary">
                  {{ fmtCurrency(item.amount, invoice.currency) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Financial Totals Summary & Notes Block -->
        <div class="flex justify-end mb-6">
          <div class="w-80 flex flex-col gap-2.5 bg-off-white p-5 rounded-14 border-subtle-box">
            <div class="flex justify-between text-xs text-secondary">
              <span>Subtotal</span>
              <span class="tabular fw-600 text-primary">{{ fmtCurrency(invoice.subtotal, invoice.currency) }}</span>
            </div>

            <div v-if="invoice.discount > 0" class="flex justify-between text-xs text-danger">
              <span>Discount</span>
              <span class="tabular fw-600">- {{ fmtCurrency(invoice.discount, invoice.currency) }}</span>
            </div>

            <div v-if="invoice.taxAmount > 0" class="flex justify-between text-xs text-secondary">
              <span>{{ invoice.taxIdLabel || 'Tax' }} ({{ invoice.taxPercent }}%)</span>
              <span class="tabular fw-600 text-primary">+ {{ fmtCurrency(invoice.taxAmount, invoice.currency) }}</span>
            </div>

            <div v-if="invoice.isReverseCharge" class="flex justify-between text-xs text-info font-medium">
              <span>Tax Regime</span>
              <span>Reverse Charge (0%)</span>
            </div>

            <!-- Total Amount Highlight Box -->
            <div class="flex items-center justify-between pt-3 border-t border-color mt-1">
              <span class="fw-800 text-sm text-primary">Total Amount Due</span>
              <span class="fw-800 text-xl text-purple">{{ fmtCurrency(invoice.total, invoice.currency) }}</span>
            </div>

            <!-- Base Currency Converted Equivalent -->
            <div v-if="invoice.currency && invoice.currency !== store.user.baseCurrency" class="text-right text-xs text-tertiary">
              ≈ {{ fmtCurrency(invoice.baseTotal || store.convertToBaseCurrency(invoice.total, invoice.currency)) }} (Base)
            </div>
          </div>
        </div>

        <!-- Notes & Payment Terms Footer -->
        <div class="p-5 bg-off-white border-subtle-box rounded-14">
          <div class="text-xs text-tertiary fw-700 uppercase tracking-wider mb-1">Notes & Payment Terms</div>
          <div class="text-xs text-secondary">
            {{ invoice.notes || store.user.defaultInvoiceNotes || 'Payment is due within 14 days of invoice date. Thank you for your business!' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import { useFormatters } from '~/composables/useFormatters'
import IconBack from '~/components/IconBack.vue'
import IconShare from '~/components/IconShare.vue'
import IconDownload from '~/components/IconDownload.vue'
import IconPrinter from '~/components/IconPrinter.vue'
import IconBriefcase from '~/components/IconBriefcase.vue'
import IconUser from '~/components/IconUser.vue'

const store = useWelloStore()
const authStore = useAuthStore()
const route = useRoute()
const { fmtCurrency } = useFormatters()

const invoice = ref(null)
const isLoading = ref(true)
const toastMsg = ref('')

const displayLogo = computed(() => {
  if (invoice.value?.sellerLogo) return invoice.value.sellerLogo
  if (store.user?.businessLogo) return store.user.businessLogo
  return null
})

const displaySellerName = computed(() => {
  if (invoice.value?.sellerName) return invoice.value.sellerName
  if (store.user?.businessName) return store.user.businessName
  return store.user?.name || 'Your Business Name'
})

const displaySellerAddress = computed(() => {
  if (invoice.value?.sellerAddress) return invoice.value.sellerAddress
  return store.user?.businessAddress || ''
})

const displaySellerEmail = computed(() => {
  if (invoice.value?.sellerEmail) return invoice.value.sellerEmail
  return store.user?.businessEmail || store.user?.email || ''
})

const displaySellerPhone = computed(() => {
  if (invoice.value?.sellerPhone) return invoice.value.sellerPhone
  return store.user?.businessPhone || ''
})

const displaySellerTaxId = computed(() => {
  if (invoice.value?.sellerTaxId) return invoice.value.sellerTaxId
  return store.user?.businessTaxId || ''
})

const cleanTaxId = computed(() => {
  const id = displaySellerTaxId.value || ''
  return id.replace(/^Tax ID \/ GSTIN:\s*/i, '').replace(/^GSTIN:\s*/i, '')
})

async function fetchInvoice() {
  isLoading.value = true
  try {
    const id = route.params.id
    const res = await $fetch(`/api/invoices/${id}`)
    if (res?.invoice) {
      invoice.value = res.invoice
    }
  } catch (err) {
    console.error('Failed to fetch invoice detail:', err)
  } finally {
    isLoading.value = false
  }
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'PAID': return 'badge-success'
    case 'SENT': return 'badge-info'
    case 'OVERDUE': return 'badge-warning'
    case 'CANCELLED': return 'badge-error'
    default: return 'badge-neutral'
  }
}

async function updateStatus() {
  if (!invoice.value) return
  try {
    const res = await $fetch('/api/invoices/status', {
      method: 'POST',
      body: { id: invoice.value.id, status: invoice.value.status }
    })
    if (res?.success) {
      showToast(`Status updated to ${invoice.value.status}`)
    }
  } catch (err) {
    console.error('Failed to update status:', err)
  }
}

function triggerPrint() {
  if (typeof window !== 'undefined') {
    window.print()
  }
}

function shareLink() {
  if (typeof window !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(window.location.href)
    showToast('Invoice URL copied to clipboard!')
  }
}

function showToast(msg) {
  toastMsg.value = msg
  setTimeout(() => { toastMsg.value = '' }, 3000)
}

onMounted(() => {
  fetchInvoice()
})
</script>
