<template>
  <div class="invoice-view-page animate-fade-in" style="display:flex;flex-direction:column;gap:24px;">
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
          class="form-input text-xs font-bold"
          :style="getStatusBadgeStyle(invoice.status)"
          style="padding:4px 12px;border-radius:14px;height:34px;cursor:pointer;"
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
      style="background:white;border:1px solid var(--border-color);border-radius:20px;box-shadow:0 8px 32px rgba(17,24,39,0.06);max-width:860px;margin:0 auto;width:100%;overflow:hidden;position:relative;"
      id="invoice-paper"
    >
      <!-- Top Brand Color Accent Bar -->
      <div style="height:6px;background:var(--grad-brand);width:100%;"></div>

      <div style="padding:36px 40px;display:flex;flex-direction:column;gap:24px;">
        <!-- Invoice Header: Logo, Issuer Name & Invoice Title Block -->
        <div class="flex items-start justify-between flex-wrap gap-6 pb-6" style="border-bottom:1px solid var(--color-soft-gray);">
          <div>
            <!-- Seller Logo or Wello Default Badge -->
            <div class="mb-2">
              <img v-if="displayLogo" :src="displayLogo" alt="Business Logo" style="max-height:52px;max-width:240px;object-fit:contain;" />
              <div v-else class="flex items-center gap-2">
                <img src="~/assets/logo.png" alt="Wello" style="height:32px;width:auto;" />
                <span class="badge" style="background:rgba(122,63,246,0.1);color:var(--color-purple);font-weight:700;">INVOICE</span>
              </div>
            </div>
            <div class="font-extrabold text-xl text-primary" style="font-size:22px;letter-spacing:-0.3px;">{{ displaySellerName }}</div>
            <div class="mt-2" v-if="displaySellerTaxId">
              <span class="badge" style="background:var(--color-off-white);color:var(--text-secondary);border:1px solid var(--border-subtle);font-size:11px;font-weight:600;padding:3px 10px;border-radius:8px;">
                Tax ID / GSTIN: {{ cleanTaxId }}
              </span>
            </div>
          </div>

          <div class="text-right">
            <h2 class="text-3xl font-black text-primary" style="letter-spacing:1px;line-height:1;font-size:28px;">INVOICE</h2>
            <div class="fw-800 text-purple text-sm mt-2 mb-2">{{ invoice.invoiceNumber }}</div>
            <div>
              <span
                class="badge text-xs"
                :style="getStatusBadgeStyle(invoice.status)"
                style="padding:5px 14px;border-radius:14px;font-weight:700;"
              >
                {{ invoice.status }}
              </span>
            </div>
          </div>
        </div>

        <!-- 2-Column Grid: Billed From Card & Billed To Card (Equal 50/50 Split) -->
        <div class="grid-2 gap-6 mb-6">
          <!-- Billed From Sub-Card -->
          <div class="p-5" style="background:var(--color-off-white);border:1px solid var(--border-subtle);border-radius:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <div class="metric-icon-box purple" style="width:28px;height:28px;">
                  <IconBriefcase :size="14" />
                </div>
                <span class="text-xs text-tertiary fw-700 uppercase tracking-wider">Billed From</span>
              </div>
              <div class="font-extrabold text-base text-primary mb-1">{{ displaySellerName }}</div>
              <div class="text-xs text-secondary whitespace-pre-line mb-3" v-if="displaySellerAddress" style="line-height:1.5;">{{ displaySellerAddress }}</div>
            </div>
            <div class="pt-3 border-t text-xs text-tertiary flex flex-col gap-1">
              <span v-if="displaySellerEmail">📧 {{ displaySellerEmail }}</span>
              <span v-if="displaySellerPhone">📞 {{ displaySellerPhone }}</span>
            </div>
          </div>

          <!-- Billed To & Metadata Sub-Card -->
          <div class="p-5" style="background:var(--color-off-white);border:1px solid var(--border-subtle);border-radius:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div class="flex items-center gap-2 mb-3">
                <div class="metric-icon-box blue" style="width:28px;height:28px;">
                  <IconUser :size="14" />
                </div>
                <span class="text-xs text-tertiary fw-700 uppercase tracking-wider">Billed To</span>
              </div>
              <div class="font-extrabold text-base text-primary mb-1">{{ invoice.customerName }}</div>
              <div class="text-xs text-secondary mb-1" v-if="invoice.customerContact">📧 {{ invoice.customerContact }}</div>
              <div class="text-xs text-tertiary whitespace-pre-line mb-3" v-if="invoice.customerAddress" style="line-height:1.5;">{{ invoice.customerAddress }}</div>
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
        <div class="mb-6" style="border:1px solid var(--border-color);border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.02);">
          <table class="table" style="margin:0;width:100%;border-collapse:collapse;">
            <thead style="background:var(--color-off-white);border-bottom:1px solid var(--border-color);">
              <tr>
                <th style="padding:14px 18px;text-align:left;font-weight:700;font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.8px;">Line Item Description</th>
                <th style="padding:14px 18px;width:110px;text-align:center;font-weight:700;font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.8px;">Qty / Hours</th>
                <th style="padding:14px 18px;width:140px;text-align:right;font-weight:700;font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.8px;">Unit Rate</th>
                <th style="padding:14px 18px;width:150px;text-align:right;font-weight:700;font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.8px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in invoice.items" :key="item.id || idx" style="border-bottom:1px solid var(--border-subtle);background:white;">
                <td style="padding:16px 18px;">
                  <div class="fw-700 text-sm text-primary">{{ item.description }}</div>
                </td>
                <td style="padding:16px 18px;text-align:center;" class="tabular text-sm font-medium text-secondary">
                  {{ item.quantity }}
                </td>
                <td style="padding:16px 18px;text-align:right;" class="tabular text-sm text-secondary">
                  {{ store.currency }} {{ item.rate.toLocaleString('en-IN') }}
                </td>
                <td style="padding:16px 18px;text-align:right;" class="tabular text-sm fw-700 text-primary">
                  {{ store.currency }} {{ item.amount.toLocaleString('en-IN') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Financial Totals Summary & Notes Block -->
        <div class="flex justify-end mb-6">
          <div style="width:340px;display:flex;flex-direction:column;gap:10px;background:var(--color-off-white);padding:20px;border-radius:14px;border:1px solid var(--border-subtle);">
            <div class="flex justify-between text-xs text-secondary">
              <span>Subtotal</span>
              <span class="tabular fw-600 text-primary">{{ store.currency }} {{ invoice.subtotal.toLocaleString('en-IN') }}</span>
            </div>

            <div v-if="invoice.discount > 0" class="flex justify-between text-xs" style="color:#DC2626;">
              <span>Discount</span>
              <span class="tabular fw-600">- {{ store.currency }} {{ invoice.discount.toLocaleString('en-IN') }}</span>
            </div>

            <div v-if="invoice.taxAmount > 0" class="flex justify-between text-xs text-secondary">
              <span>Tax / GST ({{ invoice.taxPercent }}%)</span>
              <span class="tabular fw-600 text-primary">+ {{ store.currency }} {{ invoice.taxAmount.toLocaleString('en-IN') }}</span>
            </div>

            <!-- Total Amount Highlight Box -->
            <div
              class="flex items-center justify-between pt-3 border-t mt-1"
              style="border-top:1.5px solid var(--border-color);"
            >
              <span class="fw-800 text-sm text-primary">Total Amount Due</span>
              <span class="fw-800 text-xl text-purple" style="letter-spacing:-0.5px;">{{ store.currency }} {{ invoice.total.toLocaleString('en-IN') }}</span>
            </div>
          </div>
        </div>

        <!-- Notes & Payment Terms Footer -->
        <div class="p-5" style="background:var(--color-off-white);border:1px solid var(--border-subtle);border-radius:14px;">
          <div class="text-xs text-tertiary fw-700 uppercase tracking-wider mb-1">Notes & Payment Terms</div>
          <div class="text-xs text-secondary" style="line-height:1.6;">
            {{ invoice.notes || store.user.defaultInvoiceNotes || 'Payment is due within 14 days of invoice date. Thank you for your business!' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import IconBack from '~/components/IconBack.vue'
import IconShare from '~/components/IconShare.vue'
import IconDownload from '~/components/IconDownload.vue'
import IconPrinter from '~/components/IconPrinter.vue'
import IconBriefcase from '~/components/IconBriefcase.vue'
import IconUser from '~/components/IconUser.vue'

const store = useWelloStore()
const authStore = useAuthStore()
const route = useRoute()

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
  return store.user?.name || 'Rahul Mehta Tech Consulting'
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

function getStatusBadgeStyle(status) {
  switch (status) {
    case 'PAID': return 'background:rgba(16,185,129,0.12);color:var(--color-success);border:1px solid rgba(16,185,129,0.3);'
    case 'SENT': return 'background:rgba(0,123,255,0.12);color:var(--color-blue);border:1px solid rgba(0,123,255,0.3);'
    case 'OVERDUE': return 'background:rgba(245,158,11,0.12);color:#D97706;border:1px solid rgba(245,158,11,0.3);'
    case 'CANCELLED': return 'background:rgba(239,68,68,0.12);color:#EF4444;border:1px solid rgba(239,68,68,0.3);'
    default: return 'background:var(--color-off-white);color:var(--text-tertiary);border:1px solid var(--border-color);'
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

<style>
@media print {
  body {
    background: white !important;
  }
  .app-sidebar, .app-topbar, .no-print, .mobile-nav {
    display: none !important;
  }
  .app-content {
    padding: 0 !important;
    max-width: 100% !important;
  }
  .invoice-printable-paper {
    border: none !important;
    box-shadow: none !important;
    max-width: 100% !important;
    padding: 0 !important;
  }
}
</style>
