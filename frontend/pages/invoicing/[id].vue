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

      <div class="flex items-center gap-2 flex-wrap" v-if="invoice">
        <!-- Status Badge / Selector -->
        <select
          v-model="invoice.status"
          @change="updateStatus"
          class="form-input text-xs font-bold status-badge-select"
          :class="getStatusBadgeClass(invoice.status)"
          id="invoice-view-status-select"
        >
          <option value="draft">📝 DRAFT</option>
          <option value="sent">📤 SENT</option>
          <option value="viewed">👁️ VIEWED</option>
          <option value="partially_paid">⏳ PARTIALLY PAID</option>
          <option value="paid">✅ PAID</option>
          <option value="overdue">⚠️ OVERDUE</option>
          <option value="cancelled">🚫 CANCELLED</option>
          <option value="void">⛔ VOID</option>
        </select>

        <!-- Template Selector -->
        <select v-model="selectedTemplate" class="form-input text-xs" title="PDF & Layout Style">
          <option value="modern_clean">Modern Clean</option>
          <option value="classic_executive">Classic Executive</option>
        </select>

        <!-- Record Payment Button (if balance > 0) -->
        <button
          v-if="invoice.balanceDue > 0 && invoice.status !== 'cancelled' && invoice.status !== 'void'"
          class="btn btn-primary btn-sm font-bold"
          @click="showPaymentModal = true"
          id="btn-record-payment"
        >
          💰 Record Payment
        </button>

        <!-- Send Email Button -->
        <button class="btn btn-secondary btn-sm" @click="openSendModal" id="btn-send-email-invoice">
          ✉️ Send Email
        </button>

        <!-- Share Link Button -->
        <button class="btn btn-secondary btn-sm" @click="shareLink" id="btn-share-invoice">
          <IconShare :size="14" />
          <span>Share Link</span>
        </button>

        <!-- Issue Credit Note Button (if issued and balance remaining) -->
        <button
          v-if="invoice.isImmutable && invoice.balanceDue > 0"
          class="btn btn-secondary btn-sm"
          @click="showCreditNoteModal = true"
          id="btn-credit-note-invoice"
        >
          📄 Credit Note
        </button>

        <!-- Download Server-Side PDF -->
        <a
          :href="`/api/invoices/${invoice.id}/pdf?template=${selectedTemplate}`"
          target="_blank"
          class="btn btn-secondary btn-sm"
          id="btn-download-pdf-invoice"
        >
          <IconDownload :size="14" />
          <span>Download PDF</span>
        </a>

        <!-- Browser Print -->
        <button class="btn btn-secondary btn-sm" @click="triggerPrint" id="btn-print-invoice">
          <IconPrinter :size="14" />
          <span>Print</span>
        </button>
      </div>
    </div>

    <!-- Alert Toast -->
    <div v-if="toastMsg" class="no-print auth-alert success mb-0" id="invoice-view-toast">
      <span>{{ toastMsg }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="toastMsg = ''">✕</button>
    </div>

    <!-- Loading / Error State -->
    <div v-if="isLoading" class="text-center py-16 text-tertiary text-sm">
      Loading invoice details…
    </div>

    <div v-else-if="!invoice" class="empty-state py-16">
      <div class="empty-title">Invoice Not Found</div>
      <NuxtLink to="/invoicing" class="btn btn-primary btn-sm mt-3">Return to Invoices</NuxtLink>
    </div>

    <!-- MAIN INVOICE DOCUMENT CONTAINER -->
    <div
      v-else
      class="card invoice-printable-paper"
      :class="{ 'classic-style': selectedTemplate === 'classic_executive' }"
      id="invoice-paper"
    >
      <!-- Top Brand Color Accent Bar -->
      <div class="invoice-top-accent" v-if="selectedTemplate === 'modern_clean'"></div>

      <div class="invoice-paper-inner">
        <!-- Invoice Header: Logo, Issuer Name & Title -->
        <div class="flex items-start justify-between flex-wrap gap-6 pb-6 border-b border-subtle">
          <div>
            <div class="mb-2">
              <img v-if="displayLogo" :src="displayLogo" alt="Business Logo" class="invoice-business-logo" />
              <div v-else class="flex items-center gap-2">
                <span class="badge badge-purple font-bold text-sm">WELLO INVOICE</span>
              </div>
            </div>
            <div class="font-extrabold text-2xl text-primary">{{ displaySellerName }}</div>
            <div class="mt-2" v-if="displaySellerTaxId">
              <span class="badge bg-off-white text-secondary border-subtle-box text-xs font-semibold rounded-8 px-2.5 py-1">
                {{ invoice.taxIdLabel || 'Tax ID / VAT Reg' }}: {{ invoice.sellerTaxId || userProfile?.taxId }}
              </span>
            </div>
          </div>

          <div class="text-right">
            <h1 class="text-3xl font-black text-primary tracking-wide">INVOICE</h1>
            <div class="font-extrabold text-purple text-base mt-1">{{ invoice.invoiceNumber }}</div>
            <div class="mt-2">
              <span class="badge text-xs font-bold px-3 py-1 rounded-14" :class="getStatusBadgeClass(invoice.status)">
                {{ (invoice.status || 'draft').toUpperCase() }}
              </span>
            </div>
          </div>
        </div>

        <!-- 2-Column Grid: Billed From Card & Billed To Card -->
        <div class="grid-2 gap-6 my-6">
          <!-- Billed From Sub-Card -->
          <div class="p-5 bg-off-white border-subtle-box rounded-14 flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs text-tertiary font-bold uppercase tracking-wider">Billed From</span>
              </div>
              <div class="font-extrabold text-base text-primary mb-1">{{ displaySellerName }}</div>
              <div class="text-xs text-secondary whitespace-pre-line mb-3" v-if="displaySellerAddress">{{ displaySellerAddress }}</div>
            </div>
            <div class="pt-3 border-t text-xs text-tertiary flex flex-col gap-1">
              <span v-if="displaySellerEmail">📧 {{ displaySellerEmail }}</span>
              <span v-if="displaySellerPhone">📞 {{ displaySellerPhone }}</span>
            </div>
          </div>

          <!-- Billed To Sub-Card -->
          <div class="p-5 bg-off-white border-subtle-box rounded-14 flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="text-xs text-tertiary font-bold uppercase tracking-wider">Billed To</span>
              </div>
              <div class="font-extrabold text-base text-primary mb-1">{{ invoice.customerName }}</div>
              <div class="text-xs text-secondary mb-1" v-if="invoice.customerEmail">✉️ {{ invoice.customerEmail }}</div>
              <div class="text-xs text-secondary mb-1" v-if="invoice.customerContact">📞 {{ invoice.customerContact }}</div>
              <div class="text-xs text-tertiary whitespace-pre-line mb-3" v-if="invoice.customerAddress">{{ invoice.customerAddress }}</div>
            </div>

            <!-- Metadata Box -->
            <div class="pt-3 border-t flex flex-col gap-1.5 text-xs">
              <div class="flex justify-between">
                <span class="text-tertiary">Invoice Date:</span>
                <span class="font-semibold text-primary">{{ invoice.invoiceDate }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-tertiary">Due Date:</span>
                <span class="font-bold text-purple">{{ invoice.dueDate }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-tertiary">Payment Terms:</span>
                <span class="font-semibold text-primary">{{ invoice.paymentTerms || 'Net 14' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Itemized Line Items Table -->
        <div class="table-responsive mb-6">
          <table class="table w-full">
            <thead>
              <tr class="border-b text-xs text-tertiary uppercase">
                <th class="py-2.5 text-left">#</th>
                <th class="py-2.5 text-left">Description</th>
                <th class="py-2.5 text-center">Qty / Hrs</th>
                <th class="py-2.5 text-right">Unit Price</th>
                <th class="py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, idx) in invoice.items" :key="idx" class="border-b border-subtle text-xs">
                <td class="py-3 text-tertiary font-mono">{{ idx + 1 }}</td>
                <td class="py-3 font-semibold text-primary">{{ it.description }}</td>
                <td class="py-3 text-center text-secondary">{{ it.quantity }}</td>
                <td class="py-3 text-right text-secondary">{{ fmtCurrency(it.unitPrice || it.rate, invoice.currency) }}</td>
                <td class="py-3 text-right font-bold text-primary">{{ fmtCurrency(it.amount, invoice.currency) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 2-Column Summary Footer: Notes & Terms (Left) / Totals Calculation (Right) -->
        <div class="grid-2 gap-6 pt-4 border-t border-subtle">
          <!-- Left: Notes & Banking -->
          <div>
            <div class="p-4 bg-off-white border-subtle-box rounded-12 text-xs flex flex-col gap-2">
              <div class="font-bold text-primary">Notes & Remittance Instructions</div>
              <div class="text-secondary whitespace-pre-line">{{ invoice.notes || 'Payment due on receipt. Thank you for your business!' }}</div>
              <div v-if="invoice.paymentLinkUrl" class="mt-2 pt-2 border-t text-purple font-semibold">
                🔗 Online Payment Link: <a :href="invoice.paymentLinkUrl" target="_blank" class="underline">Click to pay</a>
              </div>
            </div>
          </div>

          <!-- Right: Summary Box -->
          <div class="flex flex-col gap-2 p-5 bg-off-white border-subtle-box rounded-12 text-xs">
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
              ℹ️ Reverse-charge applicable.
            </div>

            <div class="border-t border-subtle pt-2 flex justify-between text-base font-black text-primary">
              <span>Total:</span>
              <span>{{ fmtCurrency(invoice.total, invoice.currency) }}</span>
            </div>

            <div v-if="invoice.amountPaid > 0" class="flex justify-between text-success font-semibold">
              <span>Amount Paid:</span>
              <span>{{ fmtCurrency(invoice.amountPaid, invoice.currency) }}</span>
            </div>

            <div class="border-t border-subtle pt-2 flex justify-between text-base font-black text-purple">
              <span>Balance Due:</span>
              <span>{{ fmtCurrency(invoice.balanceDue, invoice.currency) }}</span>
            </div>
          </div>
        </div>

        <!-- Payments Ledger History (if any payments recorded) -->
        <div v-if="invoice.payments && invoice.payments.length > 0" class="mt-8 pt-6 border-t border-subtle">
          <div class="font-bold text-sm text-primary mb-3">Recorded Payments Ledger</div>
          <div class="table-responsive">
            <table class="table text-xs">
              <thead>
                <tr>
                  <th>Payment Date</th>
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in invoice.payments" :key="p.id">
                  <td>{{ p.paidDate }}</td>
                  <td class="font-bold text-success">{{ fmtCurrency(p.amount, p.currency) }}</td>
                  <td>{{ p.currency }}</td>
                  <td class="text-secondary">{{ p.notes || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Credit Notes History (if any) -->
        <div v-if="invoice.creditNotes && invoice.creditNotes.length > 0" class="mt-6 pt-4 border-t border-subtle">
          <div class="font-bold text-sm text-error mb-3">Issued Credit Notes</div>
          <div class="table-responsive">
            <table class="table text-xs">
              <thead>
                <tr>
                  <th>Credit Note #</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="cn in invoice.creditNotes" :key="cn.id">
                  <td class="font-mono font-bold">{{ cn.creditNoteNumber }}</td>
                  <td>{{ cn.creditNoteDate }}</td>
                  <td class="font-bold text-error">-{{ fmtCurrency(cn.amount, invoice.currency) }}</td>
                  <td class="text-secondary">{{ cn.reason }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 1: RECORD PARTIAL / FULL PAYMENT -->
    <Teleport to="body">
      <div v-if="showPaymentModal" class="modal-backdrop">
        <div class="modal-card max-w-md w-full p-6">
          <div class="flex items-center justify-between pb-3 border-b mb-4">
            <h3 class="font-bold text-base text-primary">Record Payment</h3>
            <button class="btn btn-ghost btn-sm p-1" @click="showPaymentModal = false">✕</button>
          </div>

          <form @submit.prevent="submitPayment" class="flex flex-col gap-4">
            <div>
              <label class="form-label text-xs">Payment Amount ({{ invoice.currency }}) <span class="required">*</span></label>
              <input v-model.number="paymentForm.amount" type="number" step="0.01" min="0.01" :max="invoice.balanceDue" class="form-input text-sm font-bold" required />
              <div class="text-xs text-tertiary mt-1">Remaining balance: {{ fmtCurrency(invoice.balanceDue, invoice.currency) }}</div>
            </div>

            <div>
              <label class="form-label text-xs">Payment Date</label>
              <input v-model="paymentForm.paymentDate" type="date" class="form-input text-xs" required />
            </div>

            <div>
              <label class="form-label text-xs">Notes / Transaction Reference</label>
              <input v-model="paymentForm.notes" type="text" class="form-input text-xs" placeholder="e.g. Bank Transfer #TXN-98765" />
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t">
              <button type="button" class="btn btn-secondary btn-sm" @click="showPaymentModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm font-bold" :disabled="isSubmittingPayment">
                {{ isSubmittingPayment ? 'Recording…' : 'Record Payment' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- MODAL 2: SEND INVOICE VIA EMAIL -->
    <Teleport to="body">
      <div v-if="showSendModal" class="modal-backdrop">
        <div class="modal-card max-w-md w-full p-6">
          <div class="flex items-center justify-between pb-3 border-b mb-4">
            <h3 class="font-bold text-base text-primary">Send Invoice by Email</h3>
            <button class="btn btn-ghost btn-sm p-1" @click="showSendModal = false">✕</button>
          </div>

          <form @submit.prevent="submitSendEmail" class="flex flex-col gap-4">
            <div>
              <label class="form-label text-xs">Recipient Email <span class="required">*</span></label>
              <input v-model="sendEmailForm.recipientEmail" type="email" class="form-input text-sm" placeholder="client@company.com" required />
            </div>

            <div>
              <label class="form-label text-xs">Subject</label>
              <input v-model="sendEmailForm.subject" type="text" class="form-input text-xs" />
            </div>

            <div class="flex items-center justify-between pt-2 border-t">
              <button type="button" class="btn btn-ghost btn-xs" @click="markAsSentOnly">
                Mark as Sent (Offline)
              </button>
              <div class="flex gap-2">
                <button type="button" class="btn btn-secondary btn-sm" @click="showSendModal = false">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm font-bold" :disabled="isSendingEmail">
                  {{ isSendingEmail ? 'Sending…' : 'Send Invoice' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- MODAL 3: ISSUE CREDIT NOTE -->
    <Teleport to="body">
      <div v-if="showCreditNoteModal" class="modal-backdrop">
        <div class="modal-card max-w-md w-full p-6">
          <div class="flex items-center justify-between pb-3 border-b mb-4">
            <h3 class="font-bold text-base text-primary">Issue Credit Note</h3>
            <button class="btn btn-ghost btn-sm p-1" @click="showCreditNoteModal = false">✕</button>
          </div>

          <form @submit.prevent="submitCreditNote" class="flex flex-col gap-4">
            <div>
              <label class="form-label text-xs">Credit Note Amount ({{ invoice.currency }}) <span class="required">*</span></label>
              <input v-model.number="creditNoteForm.amount" type="number" step="0.01" min="0.01" :max="invoice.balanceDue" class="form-input text-sm font-bold" required />
            </div>

            <div>
              <label class="form-label text-xs">Reason for Adjustment <span class="required">*</span></label>
              <input v-model="creditNoteForm.reason" type="text" class="form-input text-xs" placeholder="e.g. Scope reduction or billing correction" required />
            </div>

            <div>
              <label class="form-label text-xs">Notes</label>
              <textarea v-model="creditNoteForm.notes" class="form-input text-xs" rows="2"></textarea>
            </div>

            <div class="flex justify-end gap-2 pt-2 border-t">
              <button type="button" class="btn btn-secondary btn-sm" @click="showCreditNoteModal = false">Cancel</button>
              <button type="submit" class="btn btn-danger btn-sm font-bold" :disabled="isSubmittingCreditNote">
                {{ isSubmittingCreditNote ? 'Issuing…' : 'Issue Credit Note' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useWelloStore } from '~/stores/wello'
import { useFormatters } from '~/composables/useFormatters'
import IconBack from '~/components/IconBack.vue'
import IconDownload from '~/components/IconDownload.vue'
import IconPrinter from '~/components/IconPrinter.vue'
import IconShare from '~/components/IconShare.vue'

const route = useRoute()
const store = useWelloStore()
const { fmtCurrency } = useFormatters()

const invoiceId = route.params.id
const isLoading = ref(true)
const invoice = ref(null)
const selectedTemplate = ref('modern_clean')
const toastMsg = ref('')

const showPaymentModal = ref(false)
const isSubmittingPayment = ref(false)
const paymentForm = ref({
  amount: 0,
  paymentDate: new Date().toISOString().slice(0, 10),
  notes: '',
})

const showSendModal = ref(false)
const isSendingEmail = ref(false)
const sendEmailForm = ref({
  recipientEmail: '',
  subject: '',
})

const showCreditNoteModal = ref(false)
const isSubmittingCreditNote = ref(false)
const creditNoteForm = ref({
  amount: 0,
  reason: '',
  notes: '',
})

const userProfile = computed(() => store.user || {})
const displaySellerName = computed(() => invoice.value?.sellerName || userProfile.value?.businessName || userProfile.value?.name || 'Verified Professional')
const displaySellerAddress = computed(() => invoice.value?.sellerAddress || userProfile.value?.businessAddress || '')
const displaySellerEmail = computed(() => invoice.value?.sellerEmail || userProfile.value?.businessEmail || userProfile.value?.email || '')
const displaySellerPhone = computed(() => invoice.value?.sellerPhone || userProfile.value?.businessPhone || '')
const displaySellerTaxId = computed(() => invoice.value?.sellerTaxId || userProfile.value?.taxId || '')
const displayLogo = computed(() => invoice.value?.sellerLogo || userProfile.value?.logoUrl || null)

function getStatusBadgeClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'paid': return 'badge-success'
    case 'partially_paid': return 'badge-warning'
    case 'sent': return 'badge-info'
    case 'viewed': return 'badge-purple'
    case 'overdue': return 'badge-danger'
    case 'cancelled':
    case 'void': return 'badge-default'
    default: return 'badge-default'
  }
}

async function loadInvoice() {
  isLoading.value = true
  try {
    const res = await $fetch(`/api/invoices/${invoiceId}`)
    if (res?.data?.invoice) {
      invoice.value = res.data.invoice
      selectedTemplate.value = res.data.invoice.pdfTemplate || 'modern_clean'
      paymentForm.value.amount = res.data.invoice.balanceDue
      creditNoteForm.value.amount = res.data.invoice.balanceDue
    }
  } catch (err) {
    console.error('Failed to load invoice:', err)
  } finally {
    isLoading.value = false
  }
}

async function updateStatus() {
  try {
    const res = await $fetch('/api/invoices/status', {
      method: 'POST',
      body: { id: invoice.value.id, status: invoice.value.status },
    })
    if (res?.success) {
      toastMsg.value = `Status updated to ${invoice.value.status.toUpperCase()}`
      if (res.data?.invoice) {
        invoice.value.amountPaid = res.data.invoice.amountPaid
        invoice.value.balanceDue = res.data.invoice.balanceDue
      }
    }
  } catch (err) {
    alert(err?.data?.statusMessage || 'Failed to update status.')
  }
}

function openSendModal() {
  sendEmailForm.value.recipientEmail = invoice.value?.customerEmail || ''
  sendEmailForm.value.subject = `Invoice ${invoice.value?.invoiceNumber} from ${displaySellerName.value}`
  showSendModal.value = true
}

async function submitSendEmail() {
  isSendingEmail.value = true
  try {
    const res = await $fetch(`/api/invoices/${invoice.value.id}/send`, {
      method: 'POST',
      body: sendEmailForm.value,
    })
    if (res?.success) {
      showSendModal.value = false
      invoice.value.status = res.data.status || 'sent'
      toastMsg.value = `Invoice sent to ${sendEmailForm.value.recipientEmail}!`
    }
  } catch (err) {
    alert(err?.data?.statusMessage || 'Failed to send invoice email.')
  } finally {
    isSendingEmail.value = false
  }
}

async function markAsSentOnly() {
  try {
    const res = await $fetch(`/api/invoices/${invoice.value.id}/mark-sent`, { method: 'POST' })
    if (res?.success) {
      showSendModal.value = false
      invoice.value.status = 'sent'
      toastMsg.value = 'Invoice marked as sent.'
    }
  } catch (err) {
    alert(err?.data?.statusMessage || 'Failed to mark as sent.')
  }
}

async function submitPayment() {
  isSubmittingPayment.value = true
  try {
    const res = await $fetch(`/api/invoices/${invoice.value.id}/payments`, {
      method: 'POST',
      body: paymentForm.value,
    })
    if (res?.success) {
      showPaymentModal.value = false
      toastMsg.value = res.data.message
      await loadInvoice()
    }
  } catch (err) {
    alert(err?.data?.statusMessage || 'Failed to record payment.')
  } finally {
    isSubmittingPayment.value = false
  }
}

async function submitCreditNote() {
  isSubmittingCreditNote.value = true
  try {
    const res = await $fetch(`/api/invoices/${invoice.value.id}/credit-notes`, {
      method: 'POST',
      body: creditNoteForm.value,
    })
    if (res?.success) {
      showCreditNoteModal.value = false
      toastMsg.value = res.data.message
      await loadInvoice()
    }
  } catch (err) {
    alert(err?.data?.statusMessage || 'Failed to issue credit note.')
  } finally {
    isSubmittingCreditNote.value = false
  }
}

function shareLink() {
  if (!invoice.value?.publicToken) return
  const url = `${window.location.origin}/invoice/${invoice.value.publicToken}`
  navigator.clipboard?.writeText(url)
  toastMsg.value = `Public share link copied to clipboard!`
}

function triggerPrint() {
  window.print()
}

onMounted(() => {
  loadInvoice()
})
</script>

<style scoped>
.invoice-printable-paper {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--border-subtle, #E2E8F0);
}
.invoice-top-accent {
  height: 8px;
  background: #6366F1;
}
.invoice-paper-inner {
  padding: 36px;
}
.classic-style {
  border: 2px solid #334155;
}
.status-badge-select {
  border-radius: 20px;
  padding: 4px 10px;
}
.bg-off-white {
  background: #F8FAFC;
}
.border-subtle-box {
  border: 1px solid #E2E8F0;
}
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.modal-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}
@media print {
  .no-print {
    display: none !important;
  }
  .invoice-printable-paper {
    box-shadow: none !important;
    border: none !important;
  }
  .invoice-paper-inner {
    padding: 0 !important;
  }
}
</style>
