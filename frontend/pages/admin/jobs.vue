<template>
  <div class="admin-jobs-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">Job Insights & Moderation</h1>
        <p class="page-subtitle">Inspect job listings, review flagged items, and moderate content with privacy-first financial protection.</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="search-input-wrap">
          <input v-model="searchQuery" type="text" class="form-input text-xs w-240 h-36" placeholder="Search jobs by title or category…" />
        </div>

        <button
          v-if="!financialsUnmasked && canViewFinancials"
          @click="showUnmaskModal = true"
          class="btn btn-secondary btn-sm h-36"
        >
          🔒 Unlock Amounts
        </button>

        <button @click="() => fetchJobs()" class="btn btn-secondary btn-sm h-36">
          🔄 Refresh
        </button>
      </div>
    </div>

    <!-- Financial Unmask Alert / Status -->
    <div v-if="financialsUnmasked" class="p-3 bg-purple-subtle border-purple-soft rounded-8 flex items-center justify-between mb-4">
      <div class="text-xs text-purple fw-600">
        🛡️ Monetary amounts and client contact details unmasked for this session. Audit log entry recorded.
      </div>
      <button @click="remaskFinancials" class="btn btn-ghost btn-xs text-purple font-mono">
        Hide Amounts
      </button>
    </div>

    <!-- Jobs Table Card -->
    <div class="card" id="jobs-table-card">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Job / Service Listing</th>
              <th>Category</th>
              <th>Status</th>
              <th>Moderation Flag</th>
              <th class="table-text-right">Quote Value</th>
              <th class="table-text-right">Est. Hours</th>
              <th>Created Date</th>
              <th class="table-text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="8" class="text-center py-8 text-tertiary">Loading job insights…</td>
            </tr>
            <tr v-else-if="filteredJobs.length === 0">
              <td colspan="8" class="text-center py-8 text-tertiary">No jobs found matching search.</td>
            </tr>
            <tr v-for="j in filteredJobs" :key="j.id">
              <td>
                <div class="fw-700 text-sm text-primary">{{ j.title }}</div>
                <div class="text-xs text-tertiary font-mono">ID: #{{ j.id }} · Provider: {{ j.userName }}</div>
              </td>
              <td class="text-xs text-secondary">{{ j.category }}</td>
              <td>
                <span class="badge" :class="getJobStatusBadge(j.status)">
                  {{ (j.status || 'POTENTIAL').toUpperCase() }}
                </span>
              </td>
              <td>
                <div v-if="j.isFlagged" class="flex flex-col gap-0.5">
                  <span class="badge badge-lost fw-700">🚩 FLAGGED</span>
                  <span class="text-2xs text-danger truncate max-w-xs">{{ j.flagReason || 'Content under review' }}</span>
                </div>
                <span v-else class="badge badge-approved text-2xs">
                  ✓ Verified Clear
                </span>
              </td>
              <td class="table-text-right fw-700 tabular text-sm">
                <span v-if="!j.isFinancialsMasked && j.quoteAmount !== null" class="text-primary">
                  ${{ Number(j.quoteAmount).toLocaleString() }}
                </span>
                <span v-else class="text-tertiary font-mono" title="Requires users.financial_view permission & justification reason">
                  ••••••
                </span>
              </td>
              <td class="table-text-right text-xs tabular fw-600">{{ j.estHours ? `${j.estHours} hrs` : '—' }}</td>
              <td class="text-xs text-tertiary">{{ formatTime(j.createdAt) }}</td>
              <td class="table-text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    v-if="j.isFlagged"
                    type="button"
                    class="btn btn-secondary btn-xs text-green fw-600"
                    @click="resolveFlag(j)"
                    title="Clear moderation flag and mark approved"
                  >
                    ✓ Resolve
                  </button>
                  <button
                    v-else
                    type="button"
                    class="btn btn-ghost btn-xs text-danger"
                    @click="openFlagPrompt(j)"
                    title="Flag listing for moderation review"
                  >
                    🚩 Flag
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- UNMASK FINANCIALS MODAL -->
    <div v-if="showUnmaskModal" class="modal-backdrop" @click="showUnmaskModal = false">
      <div class="modal-box modal-md animate-fade-in" @click.stop>
        <div class="modal-header flex items-center justify-between border-b pb-3 mb-4">
          <h3 class="text-base font-bold text-primary mb-0">Unlock Monetary Values</h3>
          <button class="btn btn-ghost btn-sm" @click="showUnmaskModal = false">✕</button>
        </div>

        <p class="text-xs text-secondary mb-4">
          Monetary values and client details are protected by default. Access requires <code>users.financial_view</code> and writes a permanent tamper-evident audit record.
        </p>

        <form @submit.prevent="executeUnmask" class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label text-xs">Business Justification Reason <span class="text-danger">*</span></label>
            <input
              v-model="unmaskReason"
              type="text"
              class="form-input text-xs"
              placeholder="e.g. Rate moderation and pricing compliance audit"
              required
              minlength="5"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t">
            <button type="button" class="btn btn-secondary btn-sm" @click="showUnmaskModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="isUnmasking || !unmaskReason.trim()">
              <span v-if="isUnmasking">Unlocking & Auditing…</span>
              <span v-else>Unlock Values (Audited)</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- FLAG CONTENT MODAL -->
    <div v-if="flaggingJob" class="modal-backdrop" @click="flaggingJob = null">
      <div class="modal-box modal-md animate-fade-in" @click.stop>
        <div class="modal-header flex items-center justify-between border-b pb-3 mb-4">
          <h3 class="text-base font-bold text-primary mb-0">Flag Listing for Moderation</h3>
          <button class="btn btn-ghost btn-sm" @click="flaggingJob = null">✕</button>
        </div>

        <form @submit.prevent="executeFlag" class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label text-xs">Job Title</label>
            <input :value="flaggingJob.title" disabled class="form-input text-xs bg-off-white" />
          </div>

          <div class="form-group">
            <label class="form-label text-xs">Reason for Flagging <span class="text-danger">*</span></label>
            <textarea
              v-model="flagReasonInput"
              class="form-textarea text-xs"
              rows="3"
              placeholder="e.g. Misleading title, suspicious contact details, or policy violation"
              required
              minlength="5"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t">
            <button type="button" class="btn btn-secondary btn-sm" @click="flaggingJob = null">Cancel</button>
            <button type="submit" class="btn btn-danger btn-sm" :disabled="isSubmittingFlag || !flagReasonInput.trim()">
              <span v-if="isSubmittingFlag">Flagging…</span>
              <span v-else>Flag Listing</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const authStore = useAuthStore()
const toast = useToast()

const jobs = ref([])
const searchQuery = ref('')
const isLoading = ref(false)
const financialsUnmasked = ref(false)

// Unmask modal
const showUnmaskModal = ref(false)
const unmaskReason = ref('')
const isUnmasking = ref(false)

// Flag modal
const flaggingJob = ref(null)
const flagReasonInput = ref('')
const isSubmittingFlag = ref(false)

const canViewFinancials = computed(() => {
  const role = authStore.user?.adminRole
  const perms = authStore.user?.adminPermissions || []
  return role === 'SUPER_ADMIN' || perms.includes('users.financial_view')
})

const filteredJobs = computed(() => {
  if (!searchQuery.value.trim()) return jobs.value
  const q = searchQuery.value.toLowerCase().trim()
  return jobs.value.filter(j =>
    (j.title && j.title.toLowerCase().includes(q)) ||
    (j.category && j.category.toLowerCase().includes(q)) ||
    (j.userName && j.userName.toLowerCase().includes(q))
  )
})

onMounted(async () => {
  await fetchJobs()
})

async function fetchJobs(options = {}) {
  isLoading.value = true
  try {
    const query = {}
    if (options.unmask && options.reason) {
      query.unmaskFinancials = 'true'
      query.reason = options.reason
    }

    const res = await $fetch('/api/admin/jobs', { query })
    if (res?.jobs) {
      jobs.value = res.jobs
      financialsUnmasked.value = Boolean(res.financialsUnmasked)
    }
  } catch (err) {
    console.error('Failed to fetch jobs:', err)
    toast.error('Failed to load job insights.')
  } finally {
    isLoading.value = false
  }
}

async function executeUnmask() {
  if (!unmaskReason.value.trim() || unmaskReason.value.length < 5) {
    toast.error('Please enter a valid justification reason.')
    return
  }

  isUnmasking.value = true
  try {
    await fetchJobs({ unmask: true, reason: unmaskReason.value.trim() })
    showUnmaskModal.value = false
    unmaskReason.value = ''
    toast.success('Financial figures unmasked and logged to audit trail.')
  } catch (err) {
    toast.error('Failed to unmask financial records.')
  } finally {
    isUnmasking.value = false
  }
}

function remaskFinancials() {
  financialsUnmasked.value = false
  fetchJobs()
}

function openFlagPrompt(j) {
  flaggingJob.value = j
  flagReasonInput.value = ''
}

async function executeFlag() {
  if (!flagReasonInput.value.trim()) return
  isSubmittingFlag.value = true
  try {
    await $fetch('/api/admin/jobs/moderate', {
      method: 'POST',
      body: {
        jobId: flaggingJob.value.id,
        action: 'FLAG',
        flagReason: flagReasonInput.value.trim(),
      },
    })
    flaggingJob.value.isFlagged = true
    flaggingJob.value.flagReason = flagReasonInput.value.trim()
    flaggingJob.value = null
    toast.success('Listing flagged for moderation review.')
  } catch (err) {
    toast.error(err?.data?.statusMessage || 'Failed to flag listing.')
  } finally {
    isSubmittingFlag.value = false
  }
}

async function resolveFlag(j) {
  try {
    await $fetch('/api/admin/jobs/moderate', {
      method: 'POST',
      body: {
        jobId: j.id,
        action: 'DISMISS_FLAG',
      },
    })
    j.isFlagged = false
    j.flagReason = null
    toast.success('Flag resolved and listing cleared.')
  } catch (err) {
    toast.error(err?.data?.statusMessage || 'Failed to resolve flag.')
  }
}

function getJobStatusBadge(st) {
  if (st === 'completed') return 'badge-completed'
  if (st === 'in_progress' || st === 'approved') return 'badge-approved'
  if (st === 'quoted') return 'badge-quoted'
  if (st === 'lost' || st === 'suspended') return 'badge-lost'
  return 'badge-potential'
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch (e) {
    return isoStr
  }
}
</script>
