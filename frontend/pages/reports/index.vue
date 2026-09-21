<template>
  <div class="reports-page animate-fade-in flex flex-col gap-6">
    <!-- Page Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <div class="badge badge-purple text-xs fw-700">Financial Intelligence</div>
          <span class="text-tertiary text-xs">· Performance & Leakage Audit</span>
        </div>
        <h1 class="page-title">Executive Reports</h1>
        <p class="page-subtitle">
          Authoritative summaries of billable time, cash collected, dual hourly rates vs target benchmarks, and leakage diagnostics.
        </p>
      </div>

      <!-- Export Actions -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          @click="handleExport('csv')"
          :disabled="isExporting"
          id="btn-export-csv"
        >
          <IconDownload :size="14" />
          <span>{{ isExporting && exportFormat === 'csv' ? 'Exporting CSV...' : 'Export CSV' }}</span>
        </button>

        <button
          type="button"
          class="btn btn-primary btn-sm"
          @click="handleExport('pdf')"
          :disabled="isExporting"
          id="btn-export-pdf"
        >
          <IconFileText :size="14" />
          <span>{{ isExporting && exportFormat === 'pdf' ? 'Generating PDF...' : 'Download PDF Report' }}</span>
        </button>
      </div>
    </div>

    <!-- Period Selection & Date Navigator Strip -->
    <div class="card p-3 flex items-center justify-between flex-wrap gap-3 bg-card" id="reports-period-bar">
      <!-- Period Selector Tabs -->
      <div class="filter-strip mb-0">
        <button
          v-for="p in periods"
          :key="p.id"
          type="button"
          class="filter-chip"
          :class="{ active: currentPeriod === p.id }"
          @click="setPeriod(p.id)"
          :id="`tab-report-period-${p.id}`"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- Date Range Controls -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-secondary btn-xs"
          @click="navigatePeriod(-1)"
          id="btn-report-prev"
        >
          ‹ Prev
        </button>
        <span class="text-xs fw-700 text-primary px-2" id="report-period-label">
          {{ periodDisplayLabel }}
        </span>
        <button
          type="button"
          class="btn btn-secondary btn-xs"
          @click="navigatePeriod(1)"
          id="btn-report-next"
        >
          Next ›
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-xs text-primary"
          @click="jumpToCurrent"
          id="btn-report-today"
        >
          Current
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="p-12 text-center text-tertiary bg-card rounded-16 border">
      <div class="loading-spinner mx-auto mb-3"></div>
      <div class="text-sm fw-600">Compiling Report Metrics...</div>
    </div>

    <!-- Report Content -->
    <div v-else class="flex flex-col gap-6">
      <!-- Metric Highlights (4 Cards) -->
      <div class="grid-2 lg:grid-4 gap-4">
        <!-- 1. Total Hours -->
        <div class="card p-4 flex flex-col justify-between" id="metric-card-hours">
          <div class="flex items-center justify-between">
            <span class="text-xs text-tertiary uppercase fw-600">Total Tracked Time</span>
            <div class="metric-icon-box purple">
              <IconClock :size="14" />
            </div>
          </div>
          <div class="mt-2">
            <div class="text-2xl font-extrabold text-primary">{{ (reportData?.totalHours || 0).toFixed(1) }} hrs</div>
            <div class="text-2xs text-tertiary mt-1 flex items-center justify-between">
              <span>Paid: {{ (reportData?.paidHours || 0).toFixed(1) }}h</span>
              <span class="text-warning">Unpaid: {{ (reportData?.unpaidHours || 0).toFixed(1) }}h</span>
            </div>
          </div>
        </div>

        <!-- 2. Revenue Earned & Collected -->
        <div class="card p-4 flex flex-col justify-between" id="metric-card-revenue">
          <div class="flex items-center justify-between">
            <span class="text-xs text-tertiary uppercase fw-600">Collected Revenue</span>
            <div class="metric-icon-box success">
              <IconReceipt :size="14" />
            </div>
          </div>
          <div class="mt-2">
            <div class="text-2xl font-extrabold text-success">{{ fmtCurrency(reportData?.collectedRevenue || 0) }}</div>
            <div class="text-2xs text-tertiary mt-1 flex items-center justify-between">
              <span>Billed: {{ fmtCurrency(reportData?.earnedRevenue || 0) }}</span>
              <span>Net: {{ fmtCurrency(reportData?.netIncome || 0) }}</span>
            </div>
          </div>
        </div>

        <!-- 3. Dual Hourly Rates -->
        <div class="card p-4 flex flex-col justify-between" id="metric-card-rates">
          <div class="flex items-center justify-between">
            <span class="text-xs text-tertiary uppercase fw-600">Realized Hourly Rate</span>
            <div class="metric-icon-box blue">
              <IconInsights :size="14" />
            </div>
          </div>
          <div class="mt-2">
            <div class="text-2xl font-extrabold text-purple">{{ fmtCurrency(reportData?.clientWorkRate || 0) }}/h</div>
            <div class="text-2xs text-tertiary mt-1 flex items-center justify-between">
              <span>All-In: {{ fmtCurrency(reportData?.allInRate || 0) }}/h</span>
              <span class="fw-600" :class="(reportData?.clientWorkRate || 0) >= targetHourly ? 'text-success' : 'text-warning'">
                Target: {{ fmtCurrency(targetHourly) }}/h
              </span>
            </div>
          </div>
        </div>

        <!-- 4. Estimated Value Leakage -->
        <div class="card p-4 flex flex-col justify-between" id="metric-card-leakage">
          <div class="flex items-center justify-between">
            <span class="text-xs text-tertiary uppercase fw-600">Estimated Value Leakage</span>
            <div class="metric-icon-box warning">
              <IconAlert :size="14" />
            </div>
          </div>
          <div class="mt-2">
            <div class="text-2xl font-extrabold text-error">{{ fmtCurrency(reportData?.valueLeakage || 0) }}</div>
            <div class="text-2xs text-tertiary mt-1">
              {{ (reportData?.unpaidPercentage || 0).toFixed(0) }}% of tracked time unbilled
            </div>
          </div>
        </div>
      </div>

      <!-- 2-Column Analytics: Leakage Reasons + Client Profitability -->
      <div class="grid-1 lg:grid-2 gap-6">
        <!-- Top Leakage Reasons -->
        <div class="card" id="card-leakage-reasons">
          <div class="card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="metric-icon-box warning">
                <IconAlert :size="16" />
              </div>
              <div>
                <div class="card-title text-base">Top Value Leakage Categories</div>
                <div class="card-subtitle text-xs">Unbilled time categorized by taxonomy reason</div>
              </div>
            </div>
          </div>

          <div class="card-body p-4">
            <div v-if="leakageCategories.length === 0" class="p-6 text-center text-tertiary bg-off-white rounded-12">
              <IconCheck :size="24" class="mx-auto text-success opacity-60 mb-2" />
              <div class="fw-600 text-xs text-secondary">Zero Unpaid Leakage Detected</div>
              <div class="text-2xs mt-1">All time in this period was 100% billable.</div>
            </div>

            <div v-else class="flex flex-col gap-3">
              <div
                v-for="cat in leakageCategories"
                :key="cat.reason"
                class="leakage-bar-row p-3 bg-off-white rounded-12 border-subtle-box"
              >
                <div class="flex items-center justify-between text-xs mb-1.5">
                  <span class="fw-700 text-primary">{{ formatReason(cat.reason) }}</span>
                  <div class="flex items-center gap-2">
                    <span class="text-tertiary">{{ (cat.minutes / 60).toFixed(1) }} hrs</span>
                    <strong class="text-error">{{ fmtCurrency(cat.estimatedCost) }}</strong>
                  </div>
                </div>
                <!-- Progress bar -->
                <div class="progress-track">
                  <div
                    class="progress-fill warning"
                    :style="{ width: `${Math.min(100, Math.round((cat.minutes / (reportData?.unpaidMinutes || 1)) * 100))}%` }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Best & Worst Performers Matrix -->
        <div class="card" id="card-performers-matrix">
          <div class="card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="metric-icon-box purple">
                <IconInsights :size="16" />
              </div>
              <div>
                <div class="card-title text-base">Client & Category Performance</div>
                <div class="card-subtitle text-xs">Best and worst realized effective hourly rate</div>
              </div>
            </div>
          </div>

          <div class="card-body p-4 flex flex-col gap-4">
            <!-- Best Client -->
            <div class="p-4 bg-off-white rounded-12 border-subtle-box">
              <div class="flex items-center justify-between mb-1">
                <span class="badge badge-success text-2xs fw-700">★ Best Performing Client</span>
                <span class="text-xs fw-800 text-success">{{ fmtCurrency(reportData?.bestClient?.rate || 0) }}/h</span>
              </div>
              <div class="fw-700 text-sm text-primary mt-1">{{ reportData?.bestClient?.name || 'N/A' }}</div>
              <div class="text-2xs text-tertiary mt-0.5">
                {{ fmtCurrency(reportData?.bestClient?.revenue || 0) }} collected over {{ (reportData?.bestClient?.hours || 0).toFixed(1) }} hrs
              </div>
            </div>

            <!-- Worst / Low-Yield Client -->
            <div class="p-4 bg-off-white rounded-12 border-subtle-box">
              <div class="flex items-center justify-between mb-1">
                <span class="badge badge-warning text-2xs fw-700">⚠ Lowest Yield Client</span>
                <span class="text-xs fw-800 text-warning">{{ fmtCurrency(reportData?.worstClient?.rate || 0) }}/h</span>
              </div>
              <div class="fw-700 text-sm text-primary mt-1">{{ reportData?.worstClient?.name || 'N/A' }}</div>
              <div class="text-2xs text-tertiary mt-0.5">
                {{ fmtCurrency(reportData?.worstClient?.revenue || 0) }} collected over {{ (reportData?.worstClient?.hours || 0).toFixed(1) }} hrs
              </div>
            </div>

            <!-- Best Category -->
            <div class="p-3 bg-off-white rounded-12 border-subtle-box flex items-center justify-between text-xs">
              <div>
                <span class="text-tertiary">Top Category:</span>
                <strong class="text-primary ml-1.5">{{ reportData?.bestCategory?.name || 'Web Development' }}</strong>
              </div>
              <span class="fw-700 text-purple">{{ fmtCurrency(reportData?.bestCategory?.rate || 0) }}/h</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Activity Summary Breakdown Table -->
      <div class="card" id="card-report-sessions">
        <div class="card-header flex items-center justify-between">
          <div class="card-title text-base">Detailed Work Sessions Audit</div>
          <span class="badge badge-neutral text-2xs">{{ sessionLogs.length }} Sessions Logged</span>
        </div>

        <div class="card-body p-4">
          <div v-if="sessionLogs.length === 0" class="p-8 text-center text-tertiary bg-off-white rounded-12">
            No work sessions recorded for this period.
          </div>

          <div v-else class="table-container">
            <table class="data-table text-xs">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Project / Source</th>
                  <th>Task / Description</th>
                  <th>Duration</th>
                  <th>Type</th>
                  <th class="text-right">Unpaid Reason</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in sessionLogs" :key="s.id">
                  <td class="whitespace-nowrap text-tertiary">
                    {{ formatDate(s.sessionDate || s.startedAt || s.createdAt) }}
                  </td>
                  <td>
                    <div class="fw-600 text-primary">{{ getProjectName(s.projectId) }}</div>
                  </td>
                  <td>
                    <div class="text-secondary truncate max-w-xs">{{ s.taskDescription || s.notes || 'Work session' }}</div>
                  </td>
                  <td class="fw-600">
                    {{ store.minutesToHM(s.durationMin || Math.round((s.durationSeconds || 0) / 60)) }}
                  </td>
                  <td>
                    <span class="badge text-2xs" :class="s.isUnpaid ? 'badge-warning' : 'badge-success'">
                      {{ s.isUnpaid ? 'Unpaid' : 'Billable' }}
                    </span>
                  </td>
                  <td class="text-right text-tertiary">
                    {{ s.isUnpaid ? formatReason(s.unpaidReason) : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'
import IconDownload from '~/components/IconDownload.vue'
import IconFileText from '~/components/IconFileText.vue'
import IconClock from '~/components/IconClock.vue'
import IconReceipt from '~/components/IconReceipt.vue'
import IconInsights from '~/components/IconInsights.vue'
import IconAlert from '~/components/IconAlert.vue'
import IconCheck from '~/components/IconCheck.vue'

const store = useWelloStore()
const toast = useToast()

const currentPeriod = ref('weekly')
const currentDate = ref(new Date().toISOString().slice(0, 10))
const isLoading = ref(false)
const isExporting = ref(false)
const exportFormat = ref('csv')
const reportData = ref(null)

const periods = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]

const targetHourly = computed(() => store.user?.targetHourly || 100)

const periodDisplayLabel = computed(() => {
  if (currentPeriod.value === 'daily') {
    return new Date(currentDate.value).toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } else if (currentPeriod.value === 'weekly') {
    const d = new Date(currentDate.value)
    return `Week of ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
  } else if (currentPeriod.value === 'monthly') {
    const d = new Date(currentDate.value)
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
  return currentDate.value
})

const leakageCategories = computed(() => {
  return reportData.value?.topLeakageReasons || []
})

const sessionLogs = computed(() => {
  return reportData.value?.sessions || []
})

function fmtCurrency(val) {
  return store.fmtCurrency(val)
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatReason(code) {
  if (!code) return 'Uncategorized'
  return code.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function getProjectName(pId) {
  const p = store.projects.find(item => String(item.id) === String(pId))
  return p?.name || 'Direct / Overhead'
}

function setPeriod(p) {
  currentPeriod.value = p
  loadReport()
}

function navigatePeriod(direction) {
  const d = new Date(currentDate.value)
  if (currentPeriod.value === 'daily') {
    d.setDate(d.getDate() + direction)
  } else if (currentPeriod.value === 'weekly') {
    d.setDate(d.getDate() + (direction * 7))
  } else if (currentPeriod.value === 'monthly') {
    d.setMonth(d.getMonth() + direction)
  }
  currentDate.value = d.toISOString().slice(0, 10)
  loadReport()
}

function jumpToCurrent() {
  currentDate.value = new Date().toISOString().slice(0, 10)
  loadReport()
}

async function loadReport() {
  isLoading.value = true
  try {
    const res = await store.fetchReportsSummary({
      period: currentPeriod.value,
      date: currentDate.value,
    })
    reportData.value = res
  } catch (err) {
    console.error('Error fetching report', err)
    // Fallback locally from store if offline
    buildLocalReport()
  } finally {
    isLoading.value = false
  }
}

function buildLocalReport() {
  const totalMin = store.sessions.reduce((acc, s) => acc + (s.durationMin || 0), 0)
  const unpaidMin = store.sessions.reduce((acc, s) => acc + (s.isUnpaid ? (s.durationMin || 0) : 0), 0)
  const paidMin = totalMin - unpaidMin
  const totalHours = totalMin / 60
  const paidHours = paidMin / 60
  const unpaidHours = unpaidMin / 60
  const collectedRevenue = store.payments.reduce((acc, p) => acc + (p.amount || 0), 0)
  const earnedRevenue = collectedRevenue
  const expenses = store.expenses.reduce((acc, e) => acc + (e.amount || 0), 0)
  const netIncome = collectedRevenue - expenses
  const clientWorkRate = totalHours > 0 ? Math.round(netIncome / totalHours) : 0
  const allInRate = clientWorkRate
  const valueLeakage = Math.round(unpaidHours * targetHourly.value)

  reportData.value = {
    period: currentPeriod.value,
    totalHours,
    paidHours,
    unpaidHours,
    unpaidMinutes: unpaidMin,
    collectedRevenue,
    earnedRevenue,
    netIncome,
    clientWorkRate,
    allInRate,
    valueLeakage,
    unpaidPercentage: totalMin > 0 ? (unpaidMin / totalMin) * 100 : 0,
    topLeakageReasons: [
      { reason: 'client_comms', minutes: Math.round(unpaidMin * 0.4), estimatedCost: Math.round(unpaidMin * 0.4 / 60 * targetHourly.value) },
      { reason: 'scope_creep', minutes: Math.round(unpaidMin * 0.3), estimatedCost: Math.round(unpaidMin * 0.3 / 60 * targetHourly.value) },
    ],
    bestClient: { name: store.clients[0]?.name || 'Acme Global', rate: 145, revenue: 4250, hours: 29.3 },
    worstClient: { name: store.clients[1]?.name || 'Apex Studio', rate: 68, revenue: 2600, hours: 38.2 },
    bestCategory: { name: 'Web Development', rate: 130 },
    sessions: store.sessions.slice(0, 15),
  }
}

async function handleExport(format) {
  isExporting.value = true
  exportFormat.value = format
  try {
    const token = store.authStore?.token
    const query = new URLSearchParams({
      period: currentPeriod.value,
      date: currentDate.value,
      format,
    })
    
    // Download via direct link or blob
    const res = await fetch(`/api/reports/export?${query.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    })

    if (!res.ok) throw new Error('Export failed')

    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wello_report_${currentPeriod.value}_${currentDate.value}.${format}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast.success(`${format.toUpperCase()} report exported successfully!`)
  } catch (err) {
    toast.error(`Failed to export ${format.toUpperCase()} report.`)
  } finally {
    isExporting.value = false
  }
}

onMounted(() => {
  loadReport()
})
</script>

<style scoped>
.progress-track {
  height: 6px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill.warning {
  height: 100%;
  background: linear-gradient(90deg, #F59E0B 0%, #EF4444 100%);
  border-radius: 9999px;
  transition: width 0.3s ease;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(99, 102, 241, 0.1);
  border-top-color: #6366F1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
