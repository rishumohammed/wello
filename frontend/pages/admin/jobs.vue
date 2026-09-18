<template>
  <div class="admin-jobs-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">Jobs & Services Moderation</h1>
        <p class="page-subtitle">Inspect job posts, service quotes, active contracts, and status progression across Wello.</p>
      </div>

      <div class="flex items-center gap-3">
        <input v-model="searchQuery" type="text" class="form-input text-xs w-240 h-36" placeholder="Search jobs by title or provider…" />
        <button @click="fetchJobs" class="btn btn-secondary btn-sm h-36">
          🔄 Refresh
        </button>
      </div>
    </div>

    <!-- Jobs Table Card -->
    <div class="card" id="jobs-table-card">

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Job / Service Title</th>
              <th>Provider / User</th>
              <th>Category</th>
              <th>Status</th>
              <th class="table-text-right">Quote Value</th>
              <th class="table-text-right">Est. Hours</th>
              <th>Created Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredJobs.length === 0">
              <td colspan="7" class="text-center py-8 text-tertiary">No jobs found matching search.</td>
            </tr>
            <tr v-for="j in filteredJobs" :key="j.id">
              <td>
                <div class="fw-700 text-sm text-primary">{{ j.title }}</div>
                <div class="text-xs text-tertiary font-mono">ID: {{ j.id }}</div>
              </td>
              <td>
                <div class="fw-600 text-xs text-primary">{{ j.userName }}</div>
                <div class="text-xs text-tertiary font-mono">{{ j.userEmail }}</div>
              </td>
              <td class="text-xs text-secondary">{{ j.category }}</td>
              <td>
                <span class="badge" :class="getJobStatusBadge(j.status)">
                  {{ j.status.toUpperCase() }}
                </span>
              </td>
              <td class="table-text-right fw-700 tabular text-sm">
                {{ store.currency }}{{ j.quoteAmount.toLocaleString() }}
              </td>
              <td class="table-text-right text-xs tabular fw-600">{{ j.estHours }} hrs</td>
              <td class="text-xs text-tertiary">{{ formatTime(j.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const store = useWelloStore()
const jobs = ref([])
const searchQuery = ref('')

const filteredJobs = computed(() => {
  if (!searchQuery.value.trim()) return jobs.value
  const q = searchQuery.value.toLowerCase().trim()
  return jobs.value.filter(j =>
    j.title.toLowerCase().includes(q) ||
    j.userName.toLowerCase().includes(q) ||
    j.userEmail.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  await fetchJobs()
})

async function fetchJobs() {
  try {
    const res = await $fetch('/api/admin/jobs')
    if (res?.jobs) jobs.value = res.jobs
  } catch (err) {
    console.error(err)
  }
}

function getJobStatusBadge(st) {
  if (st === 'completed') return 'badge-completed'
  if (st === 'in_progress') return 'badge-approved'
  if (st === 'quoted') return 'badge-quoted'
  if (st === 'lost') return 'badge-lost'
  return 'badge-potential'
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch (e) {
    return isoStr
  }
}
</script>
