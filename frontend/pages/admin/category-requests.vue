<template>
  <div class="admin-requests-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">User Category Request Queue</h1>
        <p class="page-subtitle">Review category creation requests submitted by public Wello users to identify real service market demand.</p>
      </div>

      <div class="flex items-center gap-3">
        <select v-model="statusFilter" class="form-input text-xs form-select-sm h-36">
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending ({{ countStatus('PENDING') }})</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="MERGED">Merged</option>
        </select>
        <button @click="fetchRequests" class="btn btn-secondary btn-sm h-36">
          🔄 Refresh
        </button>
      </div>
    </div>

    <!-- Alert / Toast -->
    <div v-if="alertMessage" class="auth-alert mb-5" :class="alertType">
      <span>{{ alertMessage }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="alertMessage = ''">✕</button>
    </div>

    <!-- Requests Table Card -->
    <div class="card" id="requests-table-card">

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Requested Category</th>
              <th>Requester Email</th>
              <th class="table-text-right">Demand Count</th>
              <th>Status</th>
              <th>Submitted Date</th>
              <th class="table-text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredRequests.length === 0">
              <td colspan="6" class="text-center py-8 text-tertiary">No category requests matching filter.</td>
            </tr>
            <tr v-for="req in filteredRequests" :key="req.id">
              <td>
                <div>
                  <div class="fw-700 text-sm text-primary">{{ req.requestedName }}</div>
                  <div v-if="req.description" class="text-xs text-tertiary max-w-sm truncate">{{ req.description }}</div>
                </div>
              </td>
              <td class="text-xs font-mono text-secondary">{{ req.userEmail }}</td>
              <td class="table-text-right">
                <span class="badge badge-job fw-700">{{ req.requestCount }} Requests</span>
              </td>
              <td>
                <span class="badge" :class="getStatusBadge(req.status)">
                  {{ req.status }}
                </span>
              </td>
              <td class="text-xs text-tertiary">{{ formatTime(req.createdAt) }}</td>
              <td class="table-text-right">
                <div v-if="req.status === 'PENDING' || req.status === 'UNDER_REVIEW'" class="flex items-center justify-end gap-1">
                  <button @click="processRequest(req.id, 'APPROVE')" class="btn btn-secondary btn-sm text-xs text-success">
                    ✓ Approve
                  </button>
                  <button @click="processRequest(req.id, 'REJECT')" class="btn btn-ghost btn-sm text-xs text-danger">
                    ✕ Reject
                  </button>
                </div>
                <span v-else class="text-xs text-tertiary italic">Processed by {{ req.processedBy }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const requests = ref([])
const statusFilter = ref('ALL')
const alertMessage = ref('')
const alertType = ref('success')

const filteredRequests = computed(() => {
  if (statusFilter.value === 'ALL') return requests.value
  return requests.value.filter(r => r.status === statusFilter.value)
})

onMounted(async () => {
  await fetchRequests()
})

async function fetchRequests() {
  try {
    const res = await $fetch('/api/admin/category-requests')
    if (res?.requests) requests.value = res.requests
  } catch (err) {
    console.error(err)
  }
}

async function processRequest(requestId, action) {
  try {
    const res = await $fetch('/api/admin/category-requests', {
      method: 'POST',
      body: { requestId, action },
    })

    if (res?.success) {
      alertMessage.value = res.message
      alertType.value = 'success'
      await fetchRequests()
    }
  } catch (err) {
    alertMessage.value = err?.data?.statusMessage || 'Failed to process request.'
    alertType.value = 'error'
  }
}

function countStatus(st) {
  return requests.value.filter(r => r.status === st).length
}

function getStatusBadge(st) {
  if (st === 'APPROVED') return 'badge-completed'
  if (st === 'REJECTED') return 'badge-lost'
  if (st === 'UNDER_REVIEW') return 'badge-quoted'
  if (st === 'MERGED') return 'badge-job'
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
