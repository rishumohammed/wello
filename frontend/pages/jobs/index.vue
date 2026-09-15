<template>
  <div class="jobs-page animate-fade-in">
    <!-- Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-4">
      <div>
        <h1 class="page-title">Jobs & Revenue</h1>
        <p class="page-subtitle">Approved work with promised quotes, collected payments, expenses, and net hourly value.</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-secondary btn-sm" @click="showExpenseModalFor = ''" id="btn-add-expense-jobs-top">
          <IconPlus :size="14" /> Add Expense
        </button>
        <button class="btn btn-primary btn-sm" @click="showPaymentModalFor = ''" id="btn-add-payment-jobs-top">
          <IconPlus :size="14" /> Record Payment
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="jobs.length === 0" class="empty-state" id="jobs-empty-state">
      <div class="empty-icon"><IconBriefcase /></div>
      <div class="empty-title">No active jobs yet</div>
      <div class="empty-desc">A Job is created when a Project proposal is accepted and converted. Start by creating a project.</div>
      <NuxtLink to="/projects" class="btn btn-primary btn-sm mt-3" id="link-to-projects-from-jobs">Go to Projects</NuxtLink>
    </div>

    <div v-else>
      <!-- Summary Metrics (4 Cards) -->
      <div class="grid-4 mb-6" id="jobs-summary-metrics">
        <!-- Revenue Received -->
        <div class="metric-card hover-lift" id="metric-total-revenue">
          <div class="metric-header">
            <span class="metric-label">Revenue Received</span>
            <div class="metric-icon-box kpi-icon-1">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            </div>
          </div>
          <div class="metric-value kpi-val-1">{{ store.fmtCurrency(totalRevenueReceived) }}</div>
          <div class="metric-secondary">Collected from {{ totalPaymentsCount }} payments</div>
        </div>

        <!-- Outstanding Balance -->
        <div class="metric-card hover-lift" id="metric-total-outstanding">
          <div class="metric-header">
            <span class="metric-label">Outstanding Balance</span>
            <div class="metric-icon-box kpi-icon-2">
              <IconAlert :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-2">{{ store.fmtCurrency(totalOutstanding) }}</div>
          <div class="metric-secondary">Promised quote: {{ store.fmtCurrency(totalPromisedQuote) }}</div>
        </div>

        <!-- Expenses & Net -->
        <div class="metric-card hover-lift" id="metric-total-net">
          <div class="metric-header">
            <span class="metric-label">Net Profit (All Jobs)</span>
            <div class="metric-icon-box kpi-icon-3">
              <IconInsights :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-3">{{ store.fmtCurrency(totalNetIncome) }}</div>
          <div class="metric-secondary">After {{ store.fmtCurrency(totalExpenses) }} expenses</div>
        </div>

        <!-- Overall Effective Value -->
        <div class="metric-card hover-lift" id="metric-total-eff-val">
          <div class="metric-header">
            <span class="metric-label">Overall Effective Rate</span>
            <div class="metric-icon-box kpi-icon-4">
              <IconClock :size="18" />
            </div>
          </div>
          <div class="metric-value kpi-val-4">{{ store.fmtHourly(overallEffectiveHourly) }}</div>
          <div class="metric-secondary">Across {{ totalJobHours.toFixed(1) }}h total project time</div>
        </div>
      </div>

      <!-- Jobs Table Card -->
      <div class="card mb-6" id="jobs-table-card">
        <div class="card-header">
          <div>
            <div class="card-title">All Revenue Jobs</div>
            <div class="card-subtitle">Active contracts, multiple payment milestones, and true net hourly yield</div>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Job & Customer</th>
                <th>Status</th>
                <th class="table-text-right">Quote (Promised)</th>
                <th class="table-text-right">Revenue (Received)</th>
                <th class="table-text-right">Outstanding</th>
                <th class="table-text-right">Expenses</th>
                <th class="table-text-right">Net Income</th>
                <th class="table-text-right">Total Time</th>
                <th class="table-text-right">Effective Value</th>
                <th class="table-text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="job in jobs" :key="job.id">
                <tr
                  :id="`job-row-${job.id}`"
                  style="cursor:pointer;"
                  @click="toggleExpand(job.id)"
                  :class="{ 'expanded-row': expandedJobs.has(job.id) }"
                >
                  <!-- Job & Customer -->
                  <td>
                    <div class="flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                        :style="{ transform: expandedJobs.has(job.id) ? 'rotate(90deg)' : 'none', transition: 'transform 180ms', color: 'var(--text-tertiary)' }">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                      <div>
                        <div class="fw-700 text-sm text-primary">{{ job.name }}</div>
                        <div class="text-tertiary text-xs">{{ job.client?.name || 'Customer' }} · {{ job.serviceCategory || 'Service' }}</div>
                      </div>
                    </div>
                  </td>

                  <!-- Status -->
                  <td>
                    <StatusBadge :status="job.status" />
                  </td>

                  <!-- Quote Promised -->
                  <td class="table-text-right tabular text-sm">
                    {{ job.quoteAmount ? store.fmtCurrency(job.quoteAmount) : '—' }}
                  </td>

                  <!-- Revenue Received -->
                  <td class="table-text-right tabular fw-700 text-sm" style="color:var(--color-success);">
                    {{ store.fmtCurrency(job.revenue) }}
                    <!-- Progress bar towards quote -->
                    <div v-if="job.quoteAmount" class="progress-bar mt-1" style="height:3px;">
                      <div class="progress-fill" :style="{ width: Math.min((job.revenue / job.quoteAmount) * 100, 100) + '%', background: 'var(--color-success)' }"></div>
                    </div>
                  </td>

                  <!-- Outstanding Balance -->
                  <td class="table-text-right tabular text-sm">
                    <span :class="jobOutstanding(job) > 0 ? 'text-warning fw-600' : 'text-tertiary'">
                      {{ store.fmtCurrency(jobOutstanding(job)) }}
                    </span>
                  </td>

                  <!-- Expenses -->
                  <td class="table-text-right tabular text-sm text-secondary">
                    <span v-if="job.expenses > 0" style="color:#DC2626;">{{ store.fmtCurrency(job.expenses) }}</span>
                    <span v-else class="text-tertiary">₹0</span>
                  </td>

                  <!-- Net Income -->
                  <td class="table-text-right tabular fw-700 text-sm gradient">
                    {{ store.fmtCurrency(job.netIncome) }}
                  </td>

                  <!-- Total Time (Pre-job + Job) -->
                  <td class="table-text-right tabular text-sm">
                    <div class="fw-600">{{ job.totalHM }}</div>
                    <div class="text-tertiary" style="font-size:10px;" v-if="job.unpaidMin > 0">
                      {{ job.unpaidHM }} pre-job
                    </div>
                  </td>

                  <!-- Effective Hourly Value -->
                  <td class="table-text-right">
                    <span v-if="job.netHrVal > 0" class="fw-700 text-brand text-sm">{{ store.fmtHourly(job.netHrVal) }}</span>
                    <span v-else class="text-tertiary text-sm">—</span>
                  </td>

                  <!-- Actions -->
                  <td class="table-text-right" @click.stop>
                    <div class="flex items-center justify-end gap-1">
                      <button class="btn btn-ghost btn-icon text-brand" @click="handleCreateInvoiceFromJob(job)" title="Create Invoice from Job" :id="`btn-inv-${job.id}`">
                        <IconReceipt :size="13" />
                      </button>
                      <button class="btn btn-ghost btn-icon text-success" @click="showPaymentFor(job.id)" title="Record payment" :id="`btn-pay-${job.id}`">
                        <IconPlus :size="13" />
                      </button>
                      <button class="btn btn-ghost btn-icon" @click="showExpenseFor(job.id)" title="Add expense" :id="`btn-exp-${job.id}`">
                        <IconAlert :size="13" />
                      </button>
                      <NuxtLink :to="`/projects/${job.id}`" class="btn btn-ghost btn-sm" :id="`btn-view-job-${job.id}`">
                        Open
                      </NuxtLink>
                    </div>
                  </td>
                </tr>

                <!-- EXPANDED JOB DRAWER -->
                <tr v-if="expandedJobs.has(job.id)" class="job-expanded-drawer" :key="`drawer-${job.id}`">
                  <td colspan="10" style="padding: var(--space-4); background: var(--color-off-white);">
                    <!-- Calculation Formula Callout -->
                    <div class="card card-padded mb-4" style="background:var(--color-white); border-color:var(--color-soft-gray);">
                      <div class="flex items-center justify-between flex-wrap gap-4 text-xs">
                        <div>
                          <span class="text-tertiary uppercase fw-600" style="letter-spacing:0.04em;">Economic Formula:</span>
                          <span class="ml-2 text-secondary">
                            Revenue ({{ store.fmtCurrency(job.revenue) }}) - Expenses ({{ store.fmtCurrency(job.expenses) }}) = Net Income (<strong>{{ store.fmtCurrency(job.netIncome) }}</strong>)
                          </span>
                        </div>
                        <div class="fw-700 text-sm text-brand">
                          Effective Value = {{ store.fmtCurrency(job.netIncome) }} / {{ (job.totalMin / 60).toFixed(1) }}h = {{ store.fmtHourly(job.netHrVal) }}
                        </div>
                      </div>
                    </div>

                    <div class="grid-3 gap-4">
                      <!-- Payment History (Multiple Payments) -->
                      <div class="card" style="background:var(--color-white);">
                        <div class="card-header py-2 px-3 flex justify-between items-center">
                          <span class="fw-600 text-xs text-primary">Payment History ({{ job.paymentsHistory?.length || 0 }})</span>
                          <button class="btn btn-ghost btn-sm text-xs text-success" @click="showPaymentFor(job.id)">+ Add Payment</button>
                        </div>
                        <div class="card-body p-0">
                          <div v-if="!job.paymentsHistory || job.paymentsHistory.length === 0" class="p-3 text-center text-tertiary text-xs">
                            No payments recorded yet.
                          </div>
                          <div v-else class="p-2 flex flex-col gap-1">
                            <div v-for="(pmt, pIdx) in job.paymentsHistory" :key="pmt.id" class="flex justify-between items-center text-xs p-1 border-b">
                              <div>
                                <span class="fw-600 text-primary">Payment {{ pIdx + 1 }}:</span>
                                <span class="text-tertiary ml-1">{{ fmtDate(pmt.paidDate) }}</span>
                                <div class="text-tertiary" style="font-size:10px;" v-if="pmt.notes">{{ pmt.notes }}</div>
                              </div>
                              <span class="fw-700 text-success">{{ store.fmtCurrency(pmt.amount) }}</span>
                            </div>
                            <div class="flex justify-between items-center text-xs p-1 font-bold">
                              <span>Total Collected:</span>
                              <span class="text-success">{{ store.fmtCurrency(job.revenue) }}</span>
                            </div>
                            <div class="flex justify-between items-center text-xs p-1" style="color:#D97706;">
                              <span>Outstanding Balance:</span>
                              <span>{{ store.fmtCurrency(jobOutstanding(job)) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Expenses History -->
                      <div class="card" style="background:var(--color-white);">
                        <div class="card-header py-2 px-3 flex justify-between items-center">
                          <span class="fw-600 text-xs text-primary">Job Expenses ({{ job.expensesHistory?.length || 0 }})</span>
                          <button class="btn btn-ghost btn-sm text-xs" style="color:#DC2626;" @click="showExpenseFor(job.id)">+ Add Expense</button>
                        </div>
                        <div class="card-body p-0">
                          <div v-if="!job.expensesHistory || job.expensesHistory.length === 0" class="p-3 text-center text-tertiary text-xs">
                            No direct expenses logged.
                          </div>
                          <div v-else class="p-2 flex flex-col gap-1">
                            <div v-for="exp in job.expensesHistory" :key="exp.id" class="flex justify-between items-center text-xs p-1 border-b">
                              <div>
                                <div class="fw-600 text-primary">{{ exp.description }}</div>
                                <div class="text-tertiary" style="font-size:10px;">{{ exp.category }} · {{ fmtDate(exp.date) }}</div>
                              </div>
                              <span class="fw-700" style="color:#DC2626;">{{ store.fmtCurrency(exp.amount) }}</span>
                            </div>
                            <div class="flex justify-between items-center text-xs p-1 font-bold" style="color:#DC2626;">
                              <span>Total Expenses:</span>
                              <span>{{ store.fmtCurrency(job.expenses) }}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Work Time Breakdown (Pre-job & Job) -->
                      <div class="card" style="background:var(--color-white);">
                        <div class="card-header py-2 px-3 flex justify-between items-center">
                          <span class="fw-600 text-xs text-primary">Time Investment</span>
                          <NuxtLink :to="`/projects/${job.id}`" class="text-xs text-brand">View All ({{ job.sessions.length }}) →</NuxtLink>
                        </div>
                        <div class="card-body p-2 flex flex-col gap-1 text-xs">
                          <div class="flex justify-between p-1 border-b">
                            <span class="text-tertiary">Pre-Job Unpaid Time:</span>
                            <span class="fw-600 text-warning">{{ job.unpaidHM }}</span>
                          </div>
                          <div class="flex justify-between p-1 border-b">
                            <span class="text-tertiary">Paid Production Time:</span>
                            <span class="fw-600 text-success">{{ job.paidHM }}</span>
                          </div>
                          <div class="flex justify-between p-1 font-bold">
                            <span>Total Lifetime Hours:</span>
                            <span class="text-brand">{{ job.totalHM }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <PaymentModal
      v-if="showPaymentModalFor !== null"
      :project-id="showPaymentModalFor"
      @close="showPaymentModalFor = null"
      @saved="showPaymentModalFor = null"
    />

    <ExpenseModal
      v-if="showExpenseModalFor !== null"
      :project-id="showExpenseModalFor"
      @close="showExpenseModalFor = null"
      @saved="showExpenseModalFor = null"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'

const store = useWelloStore()
const authStore = useAuthStore()
const router = useRouter()

async function handleCreateInvoiceFromJob(job) {
  try {
    const res = await $fetch('/api/invoices/from-job', {
      method: 'POST',
      body: {
        jobId: job.id,
        jobName: job.name,
        jobDescription: job.description,
        clientName: job.client?.name || 'Valued Client',
        clientContact: job.client?.email || job.client?.phone || '',
        quoteAmount: job.quoteAmount,
        hoursWorked: Math.round((job.totalMin || 60) / 60),
        rate: job.netHrVal || 500,
        userId: authStore.user?.id || 'u1',
      }
    })

    if (res?.invoice) {
      router.push(`/invoicing/${res.invoice.id}`)
    }
  } catch (err) {
    console.error('Failed to create invoice from job:', err)
  }
}

const showPaymentModalFor = ref(null)
const showExpenseModalFor = ref(null)
const expandedJobs        = ref(new Set())

const jobs = computed(() =>
  store.enrichedProjects
    .filter(p => p.isJob)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
)

const totalPromisedQuote = computed(() =>
  jobs.value.reduce((s, j) => s + (j.quoteAmount || 0), 0)
)

const totalRevenueReceived = computed(() =>
  jobs.value.reduce((s, j) => s + (j.revenue || 0), 0)
)

const totalExpenses = computed(() =>
  jobs.value.reduce((s, j) => s + (j.expenses || 0), 0)
)

const totalNetIncome = computed(() =>
  jobs.value.reduce((s, j) => s + (j.netIncome || 0), 0)
)

const totalOutstanding = computed(() =>
  jobs.value.reduce((s, j) => s + jobOutstanding(j), 0)
)

const totalJobHours = computed(() =>
  jobs.value.reduce((s, j) => s + (j.totalMin / 60), 0)
)

const overallEffectiveHourly = computed(() => {
  if (totalJobHours.value <= 0) return 0
  return Math.round(totalNetIncome.value / totalJobHours.value)
})

const totalPaymentsCount = computed(() =>
  jobs.value.reduce((s, j) => s + (j.paymentsHistory?.length || 0), 0)
)

function jobOutstanding(job) {
  return Math.max(0, (job.quoteAmount || 0) - (job.revenue || 0))
}

function showPaymentFor(id) {
  showPaymentModalFor.value = id
}

function showExpenseFor(id) {
  showExpenseModalFor.value = id
}

function toggleExpand(id) {
  if (expandedJobs.value.has(id)) {
    expandedJobs.value.delete(id)
  } else {
    expandedJobs.value.add(id)
  }
}

function fmtDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return d
  }
}
</script>

<style scoped>
.jobs-page {
  max-width: 1140px;
  margin: 0 auto;
}

.expanded-row {
  background: var(--color-off-white);
}

.job-expanded-drawer td {
  border-top: none;
}
</style>
