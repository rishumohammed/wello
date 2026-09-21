<template>
  <div class="public-quote-page min-h-screen bg-app-subtle p-4 md:p-8 flex flex-col items-center justify-center">
    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-20 text-tertiary text-sm">
      <div class="spinner-border mb-3"></div>
      <div>Loading proposal…</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="card max-w-lg w-full text-center p-8">
      <div class="text-error text-3xl mb-3">⚠️</div>
      <h2 class="text-xl font-extrabold text-primary mb-2">Proposal Not Found</h2>
      <p class="text-xs text-secondary mb-6">{{ error }}</p>
      <a href="/" class="btn btn-secondary btn-sm">Visit Wello</a>
    </div>

    <!-- Quote Content -->
    <div v-else-if="quote" class="max-w-2xl w-full flex flex-col gap-4 animate-fade-in">
      <!-- Status Notification Banner -->
      <div v-if="quote.status === 'accepted'" class="auth-alert success mb-0 flex items-center justify-between">
        <span>🎉 This proposal was accepted on {{ quote.acceptedAt ? new Date(quote.acceptedAt).toLocaleDateString() : 'today' }}. Project is officially approved!</span>
      </div>
      <div v-else-if="quote.status === 'rejected'" class="auth-alert danger mb-0">
        <span>This proposal has been declined.</span>
      </div>

      <!-- Action Card Header -->
      <div class="card p-6 md:p-10 shadow-lg border-subtle relative overflow-hidden bg-white">
        <div class="absolute top-0 left-0 right-0 h-2 bg-purple"></div>

        <div class="flex items-start justify-between flex-wrap gap-6 pb-6 border-b border-subtle mt-2">
          <div>
            <div class="text-xs text-tertiary uppercase font-bold tracking-wider mb-1">Proposal Prepared By</div>
            <div class="font-black text-2xl text-primary">{{ quote.sellerName }}</div>
            <div class="text-xs text-secondary mt-0.5" v-if="quote.sellerEmail">📧 {{ quote.sellerEmail }}</div>
            <div class="text-xs text-secondary mt-0.5" v-if="quote.sellerAddress">{{ quote.sellerAddress }}</div>
          </div>

          <div class="text-right">
            <span class="badge font-bold px-3 py-1 rounded-12 text-xs" :class="getStatusBadgeClass(quote.status)">
              {{ quote.status?.toUpperCase() }}
            </span>
            <div class="text-xs text-tertiary mt-2">Date: {{ quote.quoteDate }}</div>
            <div class="text-xs text-secondary" v-if="quote.validUntil">Valid until: {{ quote.validUntil }}</div>
          </div>
        </div>

        <!-- Project Scope Details -->
        <div class="my-6 p-5 bg-off-white border-subtle-box rounded-12">
          <div class="text-xs text-tertiary uppercase font-bold tracking-wider mb-1">Prepared For {{ quote.customerName }}</div>
          <h2 class="text-2xl font-black text-primary mb-2">{{ quote.projectName }}</h2>
          <p class="text-xs text-secondary whitespace-pre-line" v-if="quote.projectDescription">
            {{ quote.projectDescription }}
          </p>
          <div class="mt-3 flex items-center gap-4 text-xs text-tertiary" v-if="quote.estimatedHours">
            <span>⏱️ Estimated Effort: <strong>{{ quote.estimatedHours }} hours</strong></span>
          </div>
        </div>

        <!-- Total Valuation Box -->
        <div class="p-6 bg-purple-gradient text-white rounded-14 flex items-center justify-between flex-wrap gap-4 mb-6">
          <div>
            <div class="text-xs opacity-90 uppercase tracking-wider font-semibold">Total Estimated Valuation</div>
            <div class="text-3xl font-black mt-1">{{ fmtCurrency(quote.quoteAmount, quote.currency) }}</div>
          </div>
          <a
            :href="`/api/quotes/${quote.id}/pdf`"
            target="_blank"
            class="btn bg-white text-purple hover:bg-slate-100 btn-sm font-bold shadow"
            id="btn-public-quote-pdf"
          >
            📄 Download Quote PDF
          </a>
        </div>

        <!-- Notes / Scope Terms -->
        <div v-if="quote.notes" class="p-4 bg-off-white rounded-10 border-subtle-box text-xs text-secondary mb-6">
          <div class="font-bold text-primary mb-1">Terms & Conditions:</div>
          <div class="whitespace-pre-line">{{ quote.notes }}</div>
        </div>

        <!-- Interactive Accept / Decline Actions (if in draft or sent status) -->
        <div v-if="quote.status === 'draft' || quote.status === 'sent'" class="pt-4 border-t border-subtle flex items-center justify-end gap-3">
          <button
            class="btn btn-secondary btn-sm"
            @click="promptDecline"
            :disabled="isSubmitting"
            id="btn-decline-quote"
          >
            Decline Proposal
          </button>
          <button
            class="btn btn-primary btn-sm font-bold"
            @click="handleAction('accept')"
            :disabled="isSubmitting"
            id="btn-accept-quote"
          >
            {{ isSubmitting ? 'Processing…' : '✓ Accept & Approve Proposal' }}
          </button>
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
const isSubmitting = ref(false)
const quote = ref(null)
const error = ref('')

function getStatusBadgeClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'accepted': return 'badge-success'
    case 'rejected': return 'badge-danger'
    case 'sent': return 'badge-info'
    default: return 'badge-default'
  }
}

async function loadPublicQuote() {
  isLoading.value = true
  error.value = ''
  try {
    const res = await $fetch(`/api/quotes/public/${token}`)
    if (res?.data?.quote) {
      quote.value = res.data.quote
    } else {
      error.value = 'Proposal could not be loaded.'
    }
  } catch (err) {
    error.value = err?.data?.statusMessage || 'Proposal link is invalid or has expired.'
  } finally {
    isLoading.value = false
  }
}

async function handleAction(action, feedback = null) {
  isSubmitting.value = true
  try {
    const res = await $fetch(`/api/quotes/public/${token}/action`, {
      method: 'POST',
      body: { action, feedback },
    })
    if (res?.success) {
      quote.value.status = res.data.status
      if (res.data.acceptedAt) quote.value.acceptedAt = res.data.acceptedAt
    }
  } catch (err) {
    alert(err?.data?.statusMessage || 'Failed to update proposal.')
  } finally {
    isSubmitting.value = false
  }
}

function promptDecline() {
  const reason = prompt('Optional: Please let us know why you are declining this proposal:')
  if (reason !== null) {
    handleAction('decline', reason)
  }
}

onMounted(() => {
  loadPublicQuote()
})
</script>

<style scoped>
.bg-purple-gradient {
  background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
}
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
