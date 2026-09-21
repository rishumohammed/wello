<template>
  <div class="admin-feedback-page animate-fade-in flex flex-col gap-6">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">User Feedback & Support Tickets</h1>
        <p class="page-subtitle">Inspect user bug reports, feature suggestions, and support questions.</p>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn btn-secondary btn-sm" @click="fetchFeedback" :disabled="isLoading">
          <span>🔄 Refresh</span>
        </button>
      </div>
    </div>

    <!-- Filters Strip -->
    <div class="card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
        <button
          v-for="s in statusOptions"
          :key="s.id"
          class="filter-chip text-xs"
          :class="{ active: filterStatus === s.id }"
          @click="filterStatus = s.id; fetchFeedback()"
        >
          {{ s.label }}
        </button>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto">
        <label class="text-xs text-tertiary font-semibold whitespace-nowrap">Category:</label>
        <select v-model="filterCategory" @change="fetchFeedback" class="form-select text-xs py-1 px-2.5 rounded-lg">
          <option value="all">All Categories</option>
          <option value="bug">Bug Reports</option>
          <option value="feature">Feature Ideas</option>
          <option value="question">Questions</option>
          <option value="support">Support</option>
          <option value="general">General</option>
        </select>
      </div>
    </div>

    <!-- Feedback Tickets List -->
    <div class="space-y-4">
      <div
        v-for="item in feedbackList"
        :key="item.id"
        class="card p-5 border-neutral/60 bg-surface flex flex-col gap-4"
      >
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="badge text-2xs font-bold" :class="getCategoryBadge(item.category)">
                {{ item.category.toUpperCase() }}
              </span>
              <span class="badge text-2xs font-bold" :class="getStatusBadge(item.status)">
                {{ item.status.replace('_', ' ').toUpperCase() }}
              </span>
              <span class="text-xs font-mono text-tertiary">#{{ item.id }}</span>
            </div>
            <div class="font-extrabold text-sm text-primary">
              {{ item.subject || 'User Message' }}
            </div>
            <div class="text-xs text-tertiary mt-0.5">
              From: <strong class="text-secondary">{{ item.user_name || item.user_email }}</strong> ({{ item.user_email }}) &bull; {{ formatDate(item.created_at) }}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <select
              v-model="item.status"
              @change="updateStatus(item)"
              class="form-select text-xs py-1 px-2 rounded-lg"
            >
              <option value="open">Open</option>
              <option value="in_review">In Review</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div class="p-3.5 bg-neutral/20 rounded-xl text-xs text-secondary leading-relaxed font-sans whitespace-pre-wrap">
          {{ item.message }}
        </div>

        <!-- Admin Response Note -->
        <div class="pt-2 border-t border-neutral/40 flex flex-col gap-2">
          <label class="text-2xs font-bold text-tertiary uppercase">Admin / Support Resolution Notes</label>
          <div class="flex items-center gap-2">
            <input
              v-model="item.admin_response"
              type="text"
              class="form-input text-xs py-1 px-3 rounded-lg flex-1"
              placeholder="Internal resolution note or response status..."
            />
            <button
              class="btn btn-primary btn-xs font-bold whitespace-nowrap"
              @click="updateResponse(item)"
            >
              Save Note
            </button>
          </div>
        </div>
      </div>

      <div v-if="feedbackList.length === 0 && !isLoading" class="text-center py-12 card border-dashed">
        <div class="text-3xl mb-2">💬</div>
        <div class="font-bold text-sm text-primary">No feedback tickets in this filter</div>
        <div class="text-xs text-tertiary mt-1">All user feedback messages have been reviewed!</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const authStore = useAuthStore()
const toast = useToast()

const feedbackList = ref([])
const isLoading = ref(false)
const filterStatus = ref('all')
const filterCategory = ref('all')

const statusOptions = [
  { id: 'all', label: 'All Statuses' },
  { id: 'open', label: 'Open' },
  { id: 'in_review', label: 'In Review' },
  { id: 'resolved', label: 'Resolved' },
]

function getCategoryBadge(cat) {
  if (cat === 'bug') return 'badge-danger'
  if (cat === 'feature') return 'badge-primary'
  if (cat === 'support') return 'badge-warning'
  return 'badge-secondary'
}

function getStatusBadge(st) {
  if (st === 'resolved') return 'badge-success'
  if (st === 'in_review') return 'badge-warning'
  return 'badge-primary'
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleString()
}

async function fetchFeedback() {
  isLoading.value = true
  try {
    const query = new URLSearchParams()
    if (filterStatus.value !== 'all') query.set('status', filterStatus.value)
    if (filterCategory.value !== 'all') query.set('category', filterCategory.value)

    const res = await $fetch(`/api/admin/feedback?${query.toString()}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    feedbackList.value = res.data?.feedback || res.feedback || []
  } catch (err) {
    toast.error(err?.data?.message || 'Failed to fetch feedback.')
  } finally {
    isLoading.value = false
  }
}

async function updateStatus(item) {
  try {
    await $fetch(`/api/admin/feedback/${item.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: { status: item.status },
    })
    toast.success(`Feedback #${item.id} status updated to ${item.status}.`)
  } catch (err) {
    toast.error(err?.data?.message || 'Failed to update status.')
  }
}

async function updateResponse(item) {
  try {
    await $fetch(`/api/admin/feedback/${item.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: { adminResponse: item.admin_response },
    })
    toast.success(`Resolution notes saved for feedback #${item.id}.`)
  } catch (err) {
    toast.error(err?.data?.message || 'Failed to save resolution note.')
  }
}

onMounted(() => {
  fetchFeedback()
})
</script>
