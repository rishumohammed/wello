<template>
  <div class="admin-logs-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">Audit Trail & Event Logs</h1>
        <p class="page-subtitle">Security events, OTP dispatches, verification attempts, and API delivery logs.</p>
      </div>

      <div class="flex items-center gap-3">
        <select v-model="filterType" class="form-input text-xs form-select-sm h-36">
          <option value="all">All Event Types</option>
          <option value="login_success">Login Success</option>
          <option value="register_success">Register Success</option>
          <option value="send_otp">OTP Dispatch</option>
          <option value="verify_failed">Verification Failures</option>
          <option value="test_email">Test Email</option>
        </select>
        <button @click="fetchLogs" class="btn btn-secondary btn-sm h-36">
          🔄 Refresh Logs
        </button>
      </div>
    </div>

    <!-- Logs Table Card -->
    <div class="card" id="admin-auth-logs-card">

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Email</th>
              <th>Status</th>
              <th>Details & Provider Payload</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="5" class="text-center py-8 text-tertiary">Loading audit logs…</td>
            </tr>
            <tr v-else-if="filteredLogs.length === 0">
              <td colspan="5" class="text-center py-8 text-tertiary">No logs recorded matching filter.</td>
            </tr>
            <tr v-for="log in filteredLogs" :key="log.id" :id="`log-row-${log.id}`">
              <td class="text-xs text-tertiary whitespace-nowrap">{{ formatTime(log.timestamp) }}</td>
              <td>
                <span class="badge" :class="getEventTypeBadge(log.type)">
                  {{ log.type }}
                </span>
              </td>
              <td class="text-xs fw-600 text-primary font-mono">{{ log.email }}</td>
              <td>
                <span class="badge" :class="log.status === 'success' ? 'badge-completed' : (log.status === 'failed' ? 'badge-lost' : 'badge-quoted')">
                  {{ log.status }}
                </span>
              </td>
              <td class="text-xs text-secondary max-w-lg">
                <div>{{ log.details }}</div>
                <div v-if="log.providerResponse" class="mt-1 text-tertiary font-mono text-2xs truncate">
                  Response: {{ JSON.stringify(log.providerResponse) }}
                </div>
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

const logs = ref([])
const filterType = ref('all')
const isLoading = ref(false)

const filteredLogs = computed(() => {
  if (filterType.value === 'all') return logs.value
  return logs.value.filter(l => l.type === filterType.value)
})

onMounted(async () => {
  await fetchLogs()
})

async function fetchLogs() {
  isLoading.value = true
  try {
    const res = await $fetch('/api/admin/logs')
    if (res?.logs) {
      logs.value = res.logs
    }
  } catch (err) {
    console.error('Failed to load logs', err)
  } finally {
    isLoading.value = false
  }
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch (e) {
    return isoStr
  }
}

function getEventTypeBadge(type) {
  if (type === 'login_success' || type === 'register_success') return 'badge-completed'
  if (type === 'verify_failed') return 'badge-lost'
  if (type === 'send_otp') return 'badge-job'
  return 'badge-quoted'
}
</script>
