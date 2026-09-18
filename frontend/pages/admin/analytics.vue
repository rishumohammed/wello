<template>
  <div class="admin-analytics-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">Wello Platform Analytics Center</h1>
        <p class="page-subtitle">Real-time database analytics covering user growth, onboarding funnels, category demand, and geographic distribution.</p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <button
          v-for="r in ranges"
          :key="r.key"
          class="filter-chip"
          :class="{ active: selectedRange === r.key }"
          @click="changeRange(r.key)"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <!-- Custom Date Range Bar for Admin Analytics -->
    <div v-if="selectedRange === 'custom'" class="card card-padded mb-6 animate-fade-in" id="admin-custom-date-bar">
      <div class="flex items-center gap-3 flex-wrap text-xs text-secondary">
        <span class="fw-600 text-primary">Custom Window:</span>
        <span>From</span>
        <input v-model="customStart" type="date" class="form-input form-input-sm" @change="fetchAnalytics" />
        <span>To</span>
        <input v-model="customEnd" type="date" class="form-input form-input-sm" @change="fetchAnalytics" />
      </div>
    </div>

    <!-- Analytics Key Performance Overview -->
    <div class="grid-4 gap-4 mb-6" id="analytics-kpi-grid">
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">User Verification Rate</span>
          <div class="metric-icon-box kpi-icon-1">
            <IconUser :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-1">{{ overview.verifiedRatePercent }}%</div>
        <div class="metric-secondary">Verified OTP Authenticated Accounts</div>
      </div>
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Job Completion Rate</span>
          <div class="metric-icon-box kpi-icon-2">
            <IconBriefcase :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-2">{{ overview.jobCompletionRatePercent }}%</div>
        <div class="metric-secondary">Successful Contract Delivery</div>
      </div>
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Connection Conversion</span>
          <div class="metric-icon-box kpi-icon-3">
            <IconInsights :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-3">{{ overview.connectionConversionRatePercent }}%</div>
        <div class="metric-secondary">Requests to Matches Conversion</div>
      </div>
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Active Platform Users</span>
          <div class="metric-icon-box kpi-icon-4">
            <IconUser :size="18" />
          </div>
        </div>
        <div class="metric-value kpi-val-4">{{ overview.activeUsers }}</div>
        <div class="metric-secondary">Active User Profiles</div>
      </div>
    </div>

    <!-- Geographic Analytics Table -->
    <div class="card mb-6" id="geo-analytics-card">
      <div class="card-header flex items-center justify-between">
        <div>
          <div class="card-title">Geographic Aggregated Distribution</div>
          <div class="card-subtitle">Anonymized geographic user density and active job distribution</div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Country</th>
              <th>State / Region</th>
              <th>City / Area</th>
              <th class="table-text-right">Users Count</th>
              <th class="table-text-right">Active Jobs</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in geography" :key="g.city">
              <td class="fw-600 text-sm text-primary">{{ g.country }}</td>
              <td class="text-xs text-secondary">{{ g.state }}</td>
              <td class="text-xs fw-600 text-primary">{{ g.city }}</td>
              <td class="table-text-right text-xs tabular fw-700">{{ g.users }}</td>
              <td class="table-text-right text-xs tabular fw-700 text-purple">{{ g.activeJobs }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Category Demand & Supply Imbalance (Monetisation Foundation) -->
    <div class="card card-padded">
      <div class="card-title mb-1">Future Monetisation & Category Demand Insights</div>
      <div class="card-subtitle mb-4">Evaluate supply/demand imbalance, provider repeat usage, and high-growth category sectors</div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Category</th>
              <th class="table-text-right">Total Requests</th>
              <th class="table-text-right">Connections</th>
              <th class="table-text-right">Supply/Demand Ratio</th>
              <th class="table-text-right">Growth Index</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cd in categoryDemand" :key="cd.categoryId">
              <td class="fw-700 text-sm text-primary">{{ cd.categoryName }}</td>
              <td class="table-text-right text-xs tabular fw-600">{{ cd.totalRequests }}</td>
              <td class="table-text-right text-xs tabular fw-600 text-purple">{{ cd.successfulConnections }}</td>
              <td class="table-text-right text-xs tabular fw-600">
                {{ (cd.providerCount / (cd.totalJobs || 1)).toFixed(2) }}
              </td>
              <td class="table-text-right text-xs tabular fw-700 text-success">+{{ cd.growthRatePercent }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const selectedRange = ref('30days')
const customStart = ref(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
const customEnd = ref(new Date().toISOString().slice(0, 10))

const ranges = [
  { key: 'today', label: 'Today' },
  { key: '7days', label: '7 Days' },
  { key: '30days', label: '30 Days' },
  { key: '90days', label: '90 Days' },
  { key: 'custom', label: 'Custom' },
]

const overview = ref({
  totalUsers: 0,
  activeUsers: 0,
  verifiedRatePercent: 0,
  jobCompletionRatePercent: 0,
  connectionConversionRatePercent: 0,
})

const geography = ref([])
const categoryDemand = ref([])

onMounted(async () => {
  await fetchAnalytics()
})

async function changeRange(key) {
  selectedRange.value = key
  await fetchAnalytics()
}

async function fetchAnalytics() {
  try {
    const url = selectedRange.value === 'custom'
      ? `/api/admin/analytics?range=custom&start=${customStart.value}&end=${customEnd.value}`
      : `/api/admin/analytics?range=${selectedRange.value}`
    const res = await $fetch(url)
    if (res?.success) {
      overview.value = res.overview
      geography.value = res.geography
      categoryDemand.value = res.categoryDemand
    }
  } catch (err) {
    console.error(err)
  }
}
</script>
