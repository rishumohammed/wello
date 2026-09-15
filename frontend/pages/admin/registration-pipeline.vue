<template>
  <div class="admin-funnel-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">User Registration Pipeline & Funnel</h1>
        <p class="page-subtitle">Track user onboarding progression across 11 stages to identify drop-off points and conversion rates.</p>
      </div>

      <div class="flex items-center gap-3">
        <input v-model="startDate" type="date" class="form-input text-xs" style="height:36px;" />
        <span class="text-xs text-tertiary">to</span>
        <input v-model="endDate" type="date" class="form-input text-xs" style="height:36px;" />
        <button @click="fetchFunnel" class="btn btn-secondary btn-sm" style="height:36px;">
          Apply Filter
        </button>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid-4 gap-4 mb-6" id="funnel-summary-cards">
      <div class="card card-padded">
        <div class="text-xs text-tertiary fw-600 uppercase mb-1">Funnel Entrants</div>
        <div class="metric-value kpi-val-1 mb-1">{{ summary.totalStarted }}</div>
        <div class="text-xs text-secondary">Stage 1: Registration Started</div>
      </div>
      <div class="card card-padded">
        <div class="text-xs text-tertiary fw-600 uppercase mb-1">Fully Registered</div>
        <div class="metric-value kpi-val-2 mb-1">{{ summary.totalCompleted }}</div>
        <div class="text-xs text-secondary">Completed All Onboarding Steps</div>
      </div>
      <div class="card card-padded">
        <div class="text-xs text-tertiary fw-600 uppercase mb-1">Overall Conversion Rate</div>
        <div class="metric-value kpi-val-3 mb-1">{{ summary.overallConversionRate }}%</div>
        <div class="text-xs text-secondary">Entrants to Completed Users</div>
      </div>
      <div class="card card-padded">
        <div class="text-xs text-tertiary fw-600 uppercase mb-1">Overall Drop-off Rate</div>
        <div class="metric-value kpi-val-4 mb-1">{{ summary.overallDropOffRate }}%</div>
        <div class="text-xs text-secondary">Abandonment Across Journey</div>
      </div>
    </div>

    <!-- Stage-by-Stage Funnel Table -->
    <div class="card" id="funnel-table-card">
      <div class="card-header flex items-center justify-between">
        <div>
          <div class="card-title">11-Stage Onboarding Conversion Breakdown</div>
          <div class="card-subtitle">Real application analytics event data tracking user onboarding milestones</div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Onboarding Stage</th>
              <th class="table-text-right">Users</th>
              <th class="table-text-right">Conversion Rate</th>
              <th class="table-text-right">Drop-off Rate</th>
              <th>Visual Progression Bar</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="5" class="text-center py-8 text-tertiary">Calculating funnel metrics…</td>
            </tr>
            <tr v-for="stage in funnel" :key="stage.stageKey">
              <td class="fw-600 text-sm text-primary">{{ stage.stageName }}</td>
              <td class="table-text-right fw-700 text-sm tabular">{{ stage.count }}</td>
              <td class="table-text-right fw-600 text-sm tabular" style="color:var(--color-purple);">
                {{ stage.conversionRate }}%
              </td>
              <td class="table-text-right text-xs tabular" :style="{ color: stage.dropOffRate > 20 ? 'var(--color-pink)' : 'var(--text-tertiary)' }">
                {{ stage.dropOffRate }}%
              </td>
              <td>
                <div style="width:100%;height:10px;background:var(--color-soft-gray);border-radius:999px;overflow:hidden;">
                  <div
                    :style="{ width: stage.conversionRate + '%', background: 'var(--grad-brand)', height: '100%' }"
                  ></div>
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
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const funnel = ref([])
const summary = ref({
  totalStarted: 0,
  totalCompleted: 0,
  overallConversionRate: 0,
  overallDropOffRate: 0,
})
const startDate = ref('')
const endDate = ref('')
const isLoading = ref(false)

onMounted(async () => {
  await fetchFunnel()
})

async function fetchFunnel() {
  isLoading.value = true
  try {
    let url = '/api/admin/funnel'
    const query = new URLSearchParams()
    if (startDate.value) query.append('startDate', startDate.value)
    if (endDate.value) query.append('endDate', endDate.value)
    if (query.toString()) url += '?' + query.toString()

    const res = await $fetch(url)
    if (res?.funnel) {
      funnel.value = res.funnel
      summary.value = res.summary
    }
  } catch (err) {
    console.error('Failed to load funnel', err)
  } finally {
    isLoading.value = false
  }
}
</script>
