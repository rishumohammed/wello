<template>
  <div class="public-invoice-page min-h-screen bg-app-subtle p-4 md:p-8 flex flex-col items-center justify-center">
    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-20 text-tertiary text-sm">
      <div class="spinner-border mb-3"></div>
      <div>Loading invoice…</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="card max-w-lg w-full text-center p-8">
      <div class="text-error text-3xl mb-3">⚠️</div>
      <h2 class="text-xl font-extrabold text-primary mb-2">Invoice Not Available</h2>
      <p class="text-xs text-secondary mb-6">{{ error }}</p>
      <a href="/" class="btn btn-secondary btn-sm">Visit Wello</a>
    </div>

    <!-- Public Invoice Paper -->
    <div v-else-if="invoice" class="max-w-3xl w-full flex flex-col gap-4 animate-fade-in">
      <!-- Actions Bar (Top) -->
      <div class="flex items-center justify-between flex-wrap gap-3 px-2">
        <div class="flex items-center gap-2">
          <span class="badge font-bold px-3 py-1 rounded-12 text-xs" :class="getStatusBadgeClass(invoice.status)">
            {{ invoice.status?.toUpperCase() }}
          </span>
          <span class="text-xs text-tertiary">Issued: {{ invoice.invoiceDate }}</span>
        </div>

        <div class="flex items-center gap-2">
          <a
            :href="`/api/invoices/public/${token}/pdf?template=${invoice.pdfTemplate || 'modern_clean'}`"
            target="_blank"
            class="btn btn-secondary btn-sm"
            id="btn-public-download-pdf"
          >
            📥 Download PDF
          </a>

          <a
            v-if="invoice.paymentLinkUrl && invoice.balanceDue > 0"
            :href="invoice.paymentLinkUrl"
            target="_blank"
            class="btn btn-primary btn-sm font-bold"
            id="btn-public-pay-now"
          >
            💳 Pay Balance Online
          </a>
        </div>
      </div>

      <!-- Main Invoice Card -->
      <div class="card p-6 md:p-10 shadow-lg border-subtle relative overflow-hidden bg-white">
        <!-- Top Purple Accent Bar -->
        <div class="absolute top-0 left-0 right-0 h-2 bg-purple"></div>

        <!-- Header -->
        <div class="flex items-start justify-between flex-wrap gap-6 pb-6 border-b border-subtle mt-2">
          <div>
            <div class="font-black text-2xl text-primary">{{ invoice.sellerName }}</div>
            <div class="text-xs text-secondary mt-1" v-if="invoice.sellerAddress">{{ invoice.sellerAddress }}</div>
            <div class="text-xs text-tertiary mt-0.5" v-if="invoice.sellerEmail">📧 {{ invoice.sellerEmail }}</div>
            <div class="text-xs text-secondary mt-1" v-if="invoice.sellerTaxId">
              <span class="badge bg-off-white text-secondary text-xs">{{ invoice.taxIdLabel || 'Tax ID' }}: {{ invoice.sellerTaxId }}</span>
            </div>
          </div>

          <div class="text-right">
            <h1 class="text-3xl font-black text-primary tracking-wide">INVOICE</h1>
            <div class="font-extrabold text-purple text-base mt-1">{{ invoice.invoiceNumber }}</div>
            <div class="text-xs text-tertiary mt-1">Due Date: <strong>{{ invoice.dueDate }}</strong></div>
            <div class="text-xs text-secondary mt-0.5">Terms: {{ invoice.paymentTerms || 'Net 14' }}</div>
          </div>
        </div>

        <!-- Billed To Box -->
        <div class="my-6 p-4 bg-off-white border-subtle-box rounded-12">
          <div class="text-xs text-tertiary uppercase font-bold tracking-wider mb-1">Billed To</div>
          <div class="text-base font-extrabold text-primary">{{ invoice.customerName }}</div>
          <div class="text-xs text-secondary mt-0.5" v-if="invoice.customerAddress">{{ invoice.customerAddress }}</div>
          <div class="text-xs text-tertiary mt-0.5" v-if="invoice.customerEmail">✉️ {{ invoice.customerEmail }}</div>
        </div>

        <!-- Items Table -->
        <div class="table-responsive mb-6">
          <table class="table w-full">
            <thead>
              <tr class="border-b text-xs text-tertiary uppercase">
                <th class="py-2 text-left">Description</th>
                <th class="py-2 text-center">Qty / Hrs</th>
                <th class="py-2 text-right">Rate</th>
                <th class="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, idx) in invoice.items" :key="idx" class="border-b border-subtle text-xs">
                <td class="py-3 font-semibold text-primary">{{ it.description }}</td>
                <td class="py-3 text-center text-secondary">{{ it.quantity }}</td>
                <td class="py-3 text-right text-secondary">{{ fmtCurrency(it.unitPrice, invoice.currency) }}</td>
                <td class="py-3 text-right font-bold text-primary">{{ fmtCurrency(it.amount, invoice.currency) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Financial Breakdown Box (Right Aligned) -->
        <div class="flex justify-end mb-6">
          <div class="w-full max-w-sm flex flex-col gap-2 p-4 bg-off-white rounded-12 border-subtle-box text-xs">
            <div class="flex justify-between text-secondary">
              <span>Subtotal:</span>
              <span class="font-semibold">{{ fmtCurrency(invoice.subtotal, invoice.currency) }}</span>
            </div>

            <div v-if="invoice.discount > 0" class="flex justify-between text-error font-semibold">
              <span>Discount:</span>
              <span>-{{ fmtCurrency(invoice.discount, invoice.currency) }}</span>
            </div>

            <div v-for="(tx, idx) in invoice.taxes" :key="idx" class="flex justify-between text-secondary">
              <span>{{ tx.taxName }} ({{ tx.taxPercent }}%):</span>
              <span class="font-semibold">{{ fmtCurrency(tx.taxAmount, invoice.currency) }}</span>
            </div>

            <div v-if="invoice.isReverseCharge" class="text-xs text-info font-semibold">
              ℹ️ Reverse-charge applicable on cross-border supplies.
            </div>

            <div class="border-t border-subtle pt-2 flex justify-between text-base font-extrabold text-primary">
              <span>Total:</span>
              <span>{{ fmtCurrency(invoice.total, invoice.currency) }}</span>
            </div>

            <div v-if="invoice.amountPaid > 0" class="flex justify-between text-success font-semibold">
              <span>Amount Paid:</span>
              <span>{{ fmtCurrency(invoice.amountPaid, invoice.currency) }}</span>
            </div>

            <div class="border-t border-subtle pt-2 flex justify-between text-base font-extrabold text-purple">
              <span>Balance Due:</span>
              <span>{{ fmtCurrency(invoice.balanceDue, invoice.currency) }}</span>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div v-if="invoice.notes" class="p-4 bg-off-white rounded-10 border-subtle-box text-xs text-secondary mb-4">
          <div class="font-bold text-primary mb-1">Notes & Payment Instructions:</div>
          <div class="whitespace-pre-line">{{ invoice.notes }}</div>
        </div>

        <!-- Footer -->
        <div class="text-center text-xs text-tertiary pt-4 border-t border-subtle">
          Securely generated & tracked via Wello Work-Value Platform.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useFormatters } from '~/composables/useFormatters'

const route = useRoute()
const token = route.params.token
const { fmtCurrency } = useFormatters()

const isLoading = ref(true)
const invoice = ref(null)
const error = ref('')

function getStatusBadgeClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'paid': return 'badge-success'
    case 'partially_paid': return 'badge-warning'
    case 'sent': return 'badge-info'
    case 'viewed': return 'badge-purple'
    case 'overdue': return 'badge-danger'
    default: return 'badge-default'
  }
}

async function loadPublicInvoice() {
  isLoading.value = true
  error.value = ''
  try {
    const res = await $fetch(`/api/invoices/public/${token}`)
    if (res?.data?.invoice) {
      invoice.value = res.data.invoice
    } else {
      error.value = 'Invoice could not be loaded.'
    }
  } catch (err) {
    error.value = err?.data?.statusMessage || 'Invoice link is invalid or has expired.'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadPublicInvoice()
})
</script>

<style scoped>
.bg-app-subtle {
  background: var(--bg-app, #F8FAFC);
}
.bg-off-white {
  background: var(--bg-subtle, #F1F5F9);
}
.border-subtle-box {
  border: 1px solid var(--border-subtle, #E2E8F0);
}
</style>
