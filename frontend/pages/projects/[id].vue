<template>
  <div class="project-detail-page animate-fade-in" v-if="proj">
    <!-- Breadcrumbs -->
    <div class="flex items-center gap-2 mb-4">
      <NuxtLink to="/projects" class="btn btn-ghost btn-sm pl-0" id="btn-back-projects">
        <IconBack :size="15" />
        Projects
      </NuxtLink>
      <span class="text-tertiary">/</span>
      <span class="text-sm fw-600 text-secondary">{{ proj.name }}</span>
    </div>

    <!-- LOST PROJECT BANNER (if marked Lost) -->
    <div v-if="proj.status === 'lost'" class="card card-padded mb-6 border-danger-subtle bg-danger-subtle" id="lost-project-banner">
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="badge badge-lost">Project Lost</span>
            <span class="fw-700 text-base text-primary">Time Investment Preserved</span>
          </div>
          <div class="text-sm text-secondary mt-1">
            <strong>{{ proj.totalHM }} invested</strong> before project conclusion · <strong>{{ store.fmtCurrency(proj.revenue) }} revenue</strong>
          </div>
          <div class="text-xs text-tertiary mt-1">
            Estimated time value: <strong>{{ store.fmtCurrency(Math.round(proj.estUnpaidValue)) }}</strong> (retained in your Insights and historical analytics).
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="changeStatus('potential')" id="btn-reopen-project">
          Reopen Project
        </button>
      </div>
    </div>

    <!-- PROJECT HEADER -->
    <div class="project-detail-header card card-padded mb-6" id="project-header-card">
      <div class="flex items-start justify-between flex-wrap gap-4">
        <div class="flex-1 min-width-0">
          <div class="flex items-center gap-3 mb-2 flex-wrap">
            <h1 class="page-title text-2xl" id="project-title">{{ proj.name }}</h1>
            <span v-if="proj.isJob" class="badge badge-job">Job</span>
            <StatusBadge :status="proj.status" />
          </div>

          <div class="flex items-center gap-3 text-secondary text-sm flex-wrap">
            <span class="fw-600 text-primary flex items-center gap-1">
              <IconUser :size="14" class="text-tertiary" />
              {{ proj.client?.name || 'Independent Client' }}
            </span>
            <span class="text-tertiary">·</span>
            <span>{{ proj.serviceCategory || 'General Service' }}</span>
            <span class="text-tertiary" v-if="proj.client?.email">· {{ proj.client?.email }}</span>
          </div>

          <p class="text-tertiary text-xs mt-2" v-if="proj.description">{{ proj.description }}</p>
        </div>

        <!-- Header Quick Actions -->
        <div class="flex items-center gap-2 flex-wrap">
          <button class="btn btn-secondary btn-sm" @click="createInvoiceFromProject" id="btn-create-invoice-project-header">
            <IconReceipt :size="14" /> Create Invoice
          </button>
          <button class="btn btn-secondary btn-sm" @click="startTimerOnProject" id="btn-start-timer-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Start Timer
          </button>
          <button class="btn btn-secondary btn-sm" @click="showQuoteModal = true" id="btn-quote-header">
            <IconEdit :size="14" /> {{ proj.quoteAmount ? 'Edit Quote' : 'Add Quote' }}
          </button>

          <!-- Convert to Job action -->
          <button
            v-if="!proj.isJob && (proj.status === 'approved' || proj.status === 'quoted' || proj.status === 'in_progress')"
            class="btn btn-primary btn-sm"
            @click="showConvertModal = true"
            id="btn-convert-job-header"
          >
            <IconBriefcase :size="14" /> Convert to Job
          </button>

          <!-- Edit & More Menu -->
          <button class="btn btn-ghost btn-sm" @click="showEditModal = true" title="Edit project details" id="btn-edit-project">
            <IconEdit :size="14" /> Edit
          </button>
          <button class="btn btn-ghost btn-sm text-error" @click="confirmDeleteProject = true" title="Delete project" id="btn-delete-project">
            <IconTrash :size="14" />
          </button>
        </div>
      </div>

      <!-- STATUS TRANSITION ACTIONS BAR -->
      <div class="status-actions-bar mt-5 pt-4 border-top-subtle" id="project-status-actions">
        <span class="text-xs text-tertiary fw-600 mr-2 uppercase tracking-wide">Lifecycle Status:</span>
        <div class="flex items-center gap-2 flex-wrap">
          <button
            v-for="st in statusFlow"
            :key="st.value"
            class="status-step-btn"
            :class="{ active: proj.status === st.value }"
            @click="handleStatusClick(st.value)"
            :id="`btn-set-status-${st.value}`"
          >
            <span class="status-step-dot" :style="{ background: st.color }"></span>
            <span>{{ st.label }}</span>
          </button>

          <!-- Mark Lost Button -->
          <button
            v-if="proj.status !== 'lost' && proj.status !== 'completed'"
            class="btn btn-ghost btn-sm text-xs text-error ml-auto"
            @click="confirmLostModal = true"
            id="btn-mark-lost"
          >
            Mark as Lost
          </button>
        </div>
      </div>
    </div>

    <!-- SUMMARY METRICS CARDS: TIME, MONEY, VALUE -->
    <div class="grid-3 mb-6" id="project-summary-cards">
      <!-- TIME CARD -->
      <div class="card card-padded" id="project-card-time">
        <div class="metric-label mb-2 flex items-center justify-between">
          <span>Time Summary</span>
          <IconClock :size="14" class="text-tertiary" />
        </div>
        <div class="flex items-baseline gap-2 mb-3">
          <div class="metric-value kpi-val-1">{{ proj.totalHM }}</div>
          <div class="text-tertiary text-xs">total logged</div>
        </div>
        <div class="metric-sub-breakdown">
          <div class="flex justify-between text-xs py-1 border-b">
            <span class="text-tertiary">Paid time:</span>
            <span class="fw-600 kpi-val-2">{{ proj.paidHM }}</span>
          </div>
          <div class="flex justify-between text-xs py-1 border-b">
            <span class="text-tertiary">Client unpaid:</span>
            <span class="fw-600 kpi-val-3">{{ proj.unpaidHM }}</span>
          </div>
          <div class="flex justify-between text-xs py-1">
            <span class="text-tertiary">Intentional unpaid:</span>
            <span class="fw-600 text-secondary">{{ proj.intentionalUnpaidHM || '0m' }}</span>
          </div>
        </div>
      </div>

      <!-- MONEY CARD -->
      <div class="card card-padded" id="project-card-money">
        <div class="metric-label mb-2 flex items-center justify-between">
          <span>Financials</span>
          <span class="text-xs text-tertiary fw-600">Net: {{ store.fmtCurrency(proj.netIncome) }}</span>
        </div>
        <div class="flex items-baseline gap-2 mb-3">
          <div class="metric-value kpi-val-2">
            {{ store.fmtCurrency(proj.collectedRevenue) }}
          </div>
          <div class="text-tertiary text-xs">collected</div>
        </div>
        <div class="metric-sub-breakdown">
          <div class="flex justify-between text-xs py-1 border-b">
            <span class="text-tertiary">Earned revenue:</span>
            <span class="fw-600">{{ store.fmtCurrency(proj.earnedRevenue) }}</span>
          </div>
          <div class="flex justify-between text-xs py-1 border-b" v-if="proj.outstandingRevenue > 0">
            <span class="text-tertiary">Outstanding:</span>
            <span class="fw-600 text-brand">+{{ store.fmtCurrency(proj.outstandingRevenue) }}</span>
          </div>
          <div class="flex justify-between text-xs py-1">
            <span class="text-tertiary">Project expenses:</span>
            <span class="fw-600 kpi-val-3">{{ store.fmtCurrency(proj.expenses) }}</span>
          </div>
        </div>
      </div>

      <!-- VALUE CARD -->
      <div class="card card-padded" id="project-card-value">
        <div class="metric-label mb-2 flex items-center justify-between">
          <span>Dual Rates</span>
          <span class="text-xs text-brand fw-600">Work-Value</span>
        </div>
        <div class="flex items-baseline gap-2 mb-3">
          <div class="metric-value kpi-val-3">
            {{ proj.clientWorkRate > 0 ? store.fmtHourly(proj.clientWorkRate) : (proj.isZeroHours ? '—' : store.fmtHourly(0)) }}
          </div>
          <div class="text-tertiary text-xs">client-work rate</div>
        </div>
        <div class="metric-sub-breakdown">
          <div class="flex justify-between text-xs py-1 border-b">
            <span class="text-tertiary">All-in rate:</span>
            <span class="fw-600 text-primary">{{ proj.allInRate > 0 ? store.fmtHourly(proj.allInRate) : (proj.isZeroHours ? '—' : store.fmtHourly(0)) }}</span>
          </div>
          <div class="flex justify-between text-xs py-1 border-b">
            <span class="text-tertiary">Unpaid time value:</span>
            <span class="fw-600 kpi-val-3">{{ store.fmtCurrency(Math.round(proj.estUnpaidValue)) }}</span>
          </div>
          <div class="flex justify-between text-xs py-1">
            <span class="text-tertiary">Implied quote rate:</span>
            <span class="fw-600" v-if="proj.quoteAmount && proj.quoteEstHours">
              {{ store.fmtHourly(proj.quoteAmount / proj.quoteEstHours) }}
            </span>
            <span class="text-tertiary" v-else>—</span>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN 2-COLUMN VIEW: ACTIVITY TIMELINE & MANAGEMENT -->
    <div class="grid-2 mb-6">
      <!-- ACTIVITY TIMELINE (Chronological Project Activity) -->
      <div class="card" id="project-activity-timeline-card">
        <div class="card-header">
          <div>
            <div class="card-title">Activity Timeline</div>
            <div class="card-subtitle">Chronological project stream & events</div>
          </div>
          <button class="btn btn-secondary btn-sm" @click="showSessionModal = true" id="btn-add-activity">
            <IconPlus :size="13" /> Log Session
          </button>
        </div>

        <div class="card-body p-4">
          <div v-if="timelineEvents.length === 0" class="empty-state py-8 px-4">
            <div class="empty-icon"><IconClock /></div>
            <div class="empty-title">No activity recorded yet</div>
            <div class="empty-desc">Log your first meeting, discussion, or work session.</div>
          </div>

          <div v-else class="project-timeline-stream">
            <div
              v-for="ev in timelineEvents"
              :key="ev.id"
              class="timeline-event-row"
              :id="`timeline-event-${ev.id}`"
            >
              <!-- Event Icon -->
              <div class="timeline-event-icon" :style="{ background: ev.iconBg, color: ev.iconColor }">
                <component :is="ev.icon" :size="14" />
              </div>

              <!-- Event Content -->
              <div class="timeline-event-content flex-1 min-width-0">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="fw-600 text-sm text-primary">{{ ev.title }}</div>
                  <div class="text-tertiary text-xs">{{ ev.formattedDate }}</div>
                </div>

                <div class="text-secondary text-xs mt-1" v-if="ev.description">
                  {{ ev.description }}
                </div>

                <!-- Event Badges & Financial Info -->
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                  <span v-if="ev.durationHM" class="badge badge-subtle">
                    {{ ev.durationHM }}
                  </span>
                  <span v-if="ev.paymentType === 'unpaid'" class="badge badge-unpaid">
                    Unpaid
                  </span>
                  <span v-else-if="ev.paymentType === 'paid'" class="badge badge-paid">
                    Paid
                  </span>
                  <span v-if="ev.amountStr" class="fw-700 text-xs text-brand">
                    {{ ev.amountStr }}
                  </span>
                </div>
              </div>

              <!-- Delete Action for sessions -->
              <div v-if="ev.type === 'session'" class="timeline-event-actions">
                <button class="btn btn-ghost btn-icon" @click="confirmDeleteSession(ev.rawId)" title="Delete session">
                  <IconTrash :size="12" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: FINANCIALS & QUOTE DETAILS -->
      <div class="flex flex-col gap-6">
        <!-- QUOTE DETAILS CARD -->
        <div class="card" id="project-quote-management-card">
          <div class="card-header">
            <div>
              <div class="card-title">Quote & Proposal</div>
              <div class="card-subtitle">Scope estimate & pricing</div>
            </div>
            <button class="btn btn-secondary btn-sm" @click="showQuoteModal = true" id="btn-edit-quote-box">
              <IconEdit :size="13" /> {{ proj.quoteAmount ? 'Edit' : 'Add' }}
            </button>
          </div>
          <div class="card-body">
            <template v-if="proj.quoteAmount">
              <div class="value-row">
                <span class="value-row-label">Quote Amount</span>
                <span class="value-row-amount fw-700">{{ store.fmtCurrency(proj.quoteAmount) }}</span>
              </div>
              <div class="value-row" v-if="proj.quoteEstHours">
                <span class="value-row-label">Estimated Hours</span>
                <span class="value-row-amount">{{ proj.quoteEstHours }} hours</span>
              </div>
              <div class="value-row" v-if="proj.quoteAmount && proj.quoteEstHours">
                <span class="value-row-label">Implied Rate</span>
                <span class="value-row-amount text-brand fw-700">
                  {{ store.fmtHourly(proj.quoteAmount / proj.quoteEstHours) }}
                </span>
              </div>
              <div class="value-row" v-if="proj.quoteDate">
                <span class="value-row-label">Quote Date</span>
                <span class="value-row-amount">{{ fmtDate(proj.quoteDate) }}</span>
              </div>
              <div class="value-row" v-if="proj.quoteNotes">
                <span class="value-row-label">Scope Notes</span>
                <span class="text-xs text-secondary">{{ proj.quoteNotes }}</span>
              </div>
            </template>
            <div v-else class="text-center py-4 text-tertiary text-sm">
              No formal quote created yet.
              <div class="mt-2">
                <button class="btn btn-primary btn-sm" @click="showQuoteModal = true">Create Quote</button>
              </div>
            </div>
          </div>
        </div>

        <!-- REVENUE & PAYMENTS CARD -->
        <div class="card" id="project-payments-management-card">
          <div class="card-header">
            <div>
              <div class="card-title">Revenue & Payments</div>
              <div class="card-subtitle">{{ proj.paymentsHistory?.length || 0 }} payment recorded</div>
            </div>
            <button class="btn btn-secondary btn-sm" @click="showPaymentModal = true" id="btn-add-payment-detail">
              <IconPlus :size="13" /> Add Payment
            </button>
          </div>
          <div class="card-body p-0">
            <div v-if="!proj.paymentsHistory || proj.paymentsHistory.length === 0" class="p-4 text-center text-tertiary text-xs">
              No payments recorded for this project yet.
            </div>
            <table class="table" v-else>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="pmt in proj.paymentsHistory" :key="pmt.id">
                  <td class="text-xs">{{ fmtDate(pmt.paidDate) }}</td>
                  <td class="fw-700 text-sm text-success">{{ store.fmtCurrency(pmt.amount) }}</td>
                  <td class="text-xs text-secondary">{{ pmt.notes || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- EXPENSES CARD -->
        <div class="card" id="project-expenses-management-card">
          <div class="card-header">
            <div>
              <div class="card-title">Expenses</div>
              <div class="card-subtitle">{{ proj.expensesHistory?.length || 0 }} expense recorded</div>
            </div>
            <button class="btn btn-secondary btn-sm" @click="showExpenseModal = true" id="btn-add-expense-detail">
              <IconPlus :size="13" /> Add Expense
            </button>
          </div>
          <div class="card-body p-0">
            <div v-if="!proj.expensesHistory || proj.expensesHistory.length === 0" class="p-4 text-center text-tertiary text-xs">
              No direct expenses recorded yet.
            </div>
            <table class="table" v-else>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="exp in proj.expensesHistory" :key="exp.id">
                  <td>
                    <div class="fw-600 text-xs">{{ exp.description }}</div>
                    <div class="text-tertiary text-2xs">{{ fmtDate(exp.date) }}</div>
                  </td>
                  <td class="fw-700 text-sm text-danger">{{ store.fmtCurrency(exp.amount) }}</td>
                  <td class="text-xs text-secondary">{{ exp.category || 'General' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- CONVERT TO JOB CONFIRMATION MODAL -->
    <Teleport to="body">
      <div v-if="showConvertModal" class="modal-overlay" @click.self="showConvertModal = false" id="modal-convert-job-overlay">
        <div class="modal modal-sm" id="modal-convert-job" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">Convert to Job</div>
              <div class="modal-subtitle">{{ proj.name }}</div>
            </div>
            <button class="modal-close" @click="showConvertModal = false" aria-label="Close"><IconX /></button>
          </div>
          <div class="modal-body">
            <div class="card card-padded mb-4 card-offwhite">
              <p class="text-sm text-primary fw-500 mb-2">
                This project contains <strong>{{ proj.totalHM }}</strong> of previously recorded time.
              </p>
              <p class="text-xs text-secondary">
                This time will remain part of the project's total history. No sessions will be duplicated, and all historical discovery, meetings, and notes are preserved.
              </p>
            </div>
            <div class="text-xs text-tertiary">
              Converting promotes this engagement to an active Job with revenue, expenses, and net profit tracking.
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="showConvertModal = false">Cancel</button>
            <button type="button" class="btn btn-primary" @click="executeConvertToJob" id="btn-confirm-convert-job">
              <IconBriefcase :size="14" />
              Confirm & Convert to Job
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- MARK AS LOST CONFIRMATION MODAL -->
    <Teleport to="body">
      <div v-if="confirmLostModal" class="modal-overlay" @click.self="confirmLostModal = false" id="modal-confirm-lost-overlay">
        <div class="modal modal-sm" id="modal-confirm-lost" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">Mark Project as Lost?</div>
              <div class="modal-subtitle">{{ proj.name }}</div>
            </div>
            <button class="modal-close" @click="confirmLostModal = false" aria-label="Close"><IconX /></button>
          </div>
          <div class="modal-body">
            <p class="text-sm text-secondary mb-3">
              Marking this project as Lost will retain all <strong>{{ proj.totalHM }}</strong> of logged time (estimated value: <strong>{{ store.fmtCurrency(Math.round(proj.estUnpaidValue)) }}</strong>).
            </p>
            <p class="text-xs text-tertiary">
              The project is NOT deleted. Its time investment data remains part of your historical analytics and Insights. You can reopen it anytime.
            </p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="confirmLostModal = false">Cancel</button>
            <button type="button" class="btn btn-danger" @click="executeMarkLost" id="btn-confirm-mark-lost">
              Mark as Lost
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- EDIT PROJECT MODAL -->
    <ProjectFormModal
      v-if="showEditModal"
      :project="proj"
      @close="showEditModal = false"
      @updated="showEditModal = false"
    />

    <!-- OTHER MODALS -->
    <SessionModal
      v-if="showSessionModal"
      :project-id="proj.id"
      @close="showSessionModal = false"
      @saved="showSessionModal = false"
    />

    <TimerModal
      v-if="showTimerModal"
      @close="showTimerModal = false"
    />

    <QuoteModal
      v-if="showQuoteModal"
      :project="proj"
      @close="showQuoteModal = false"
      @saved="showQuoteModal = false"
    />

    <PaymentModal
      v-if="showPaymentModal"
      :project-id="proj.id"
      @close="showPaymentModal = false"
      @saved="showPaymentModal = false"
    />

    <ExpenseModal
      v-if="showExpenseModal"
      :project-id="proj.id"
      @close="showExpenseModal = false"
      @saved="showExpenseModal = false"
    />

    <!-- DELETE PROJECT CONFIRMATION -->
    <ConfirmDialog
      v-if="confirmDeleteProject"
      title="Delete Project?"
      message="Are you sure you want to delete this project? All associated sessions and payments will be permanently removed. If you lost the client, we recommend using 'Mark as Lost' instead."
      confirm-text="Delete Project"
      danger
      @confirm="executeDeleteProject"
      @cancel="confirmDeleteProject = false"
    />

    <!-- DELETE SESSION CONFIRMATION -->
    <ConfirmDialog
      v-if="sessionToDelete"
      title="Delete Work Session?"
      message="This session and its logged time will be permanently removed."
      danger
      @confirm="executeDeleteSession"
      @cancel="sessionToDelete = null"
    />
  </div>

  <div v-else class="empty-state">
    <div class="empty-title">Project not found</div>
    <NuxtLink to="/projects" class="btn btn-primary mt-3">Back to Projects</NuxtLink>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'
import IconFolders from '~/components/IconFolders.vue'
import IconClock from '~/components/IconClock.vue'
import IconEdit from '~/components/IconEdit.vue'
import IconBriefcase from '~/components/IconBriefcase.vue'
import IconAlert from '~/components/IconAlert.vue'

const route = useRoute()
const router = useRouter()
const store = useWelloStore()
const authStore = useAuthStore()
const toast = useToast()

async function createInvoiceFromProject() {
  if (!proj.value) return
  try {
    const res = await $fetch('/api/invoices/from-job', {
      method: 'POST',
      body: {
        jobId: proj.value.id,
        jobName: proj.value.name,
        jobDescription: proj.value.description,
        clientName: proj.value.client?.name || 'Valued Client',
        clientContact: proj.value.client?.email || proj.value.client?.phone || '',
        quoteAmount: proj.value.quoteAmount,
        hoursWorked: Math.round((proj.value.totalMin || 60) / 60),
        rate: proj.value.netHrVal || 500,
        userId: authStore.user?.id || 'u1',
      }
    })

    if (res?.invoice) {
      router.push(`/invoicing/${res.invoice.id}`)
    }
  } catch (err) {
    console.error('Failed to create invoice from project:', err)
  }
}

const projectId = computed(() => route.params.id)

// Find enriched project from store
const proj = computed(() => {
  const p = store.getProject(projectId.value)
  return p ? store.enrichProject(p) : null
})

// Modals
const showSessionModal     = ref(false)
const showTimerModal       = ref(false)
const showQuoteModal       = ref(false)
const showPaymentModal     = ref(false)
const showExpenseModal     = ref(false)
const showEditModal        = ref(false)
const showConvertModal     = ref(false)
const confirmLostModal     = ref(false)
const confirmDeleteProject = ref(false)
const sessionToDelete      = ref(null)

// Lifecycle Status Steps
const statusFlow = [
  { value: 'potential',   label: 'Potential',   color: '#6B7280' },
  { value: 'quoted',      label: 'Quoted',      color: '#D97706' },
  { value: 'approved',    label: 'Approved',    color: '#2563EB' },
  { value: 'in_progress', label: 'In Progress', color: '#7A3FF6' },
  { value: 'completed',   label: 'Completed',   color: '#059669' },
]

function handleStatusClick(newStatus) {
  if (!proj.value) return
  if (proj.value.status === newStatus) return

  // If transitioning to In Progress from Approved and not a Job, offer Convert to Job
  if (newStatus === 'in_progress' && !proj.value.isJob && proj.value.status === 'approved') {
    showConvertModal.value = true
    return
  }

  changeStatus(newStatus)
}

function changeStatus(newStatus) {
  if (!proj.value) return
  store.updateProjectStatus(proj.value.id, newStatus)
  toast.success(`Project status updated to ${newStatus.replace('_', ' ')}.`)
}

function startTimerOnProject() {
  if (!proj.value) return
  store.startTimer({
    projectId: proj.value.id,
    title: `Working on ${proj.value.name}`,
    type: 'production',
    paymentType: proj.value.isJob ? 'paid' : 'unpaid',
  })
  toast.success('Timer started for ' + proj.value.name)
}

function executeConvertToJob() {
  if (!proj.value) return
  store.convertToJob(proj.value.id)
  showConvertModal.value = false
  toast.success(`Converted "${proj.value.name}" to Job. All previous time preserved.`)
}

function executeMarkLost() {
  if (!proj.value) return
  store.updateProjectStatus(proj.value.id, 'lost')
  confirmLostModal.value = false
  toast.info(`Project marked as Lost. Time investment preserved in Analytics.`)
}

function executeDeleteProject() {
  if (!proj.value) return
  const name = proj.value.name
  store.projects = store.projects.filter(p => p.id !== proj.value.id)
  store.sessions = store.sessions.filter(s => s.projectId !== proj.value.id)
  store.payments = store.payments.filter(p => p.projectId !== proj.value.id)
  store.expenses = store.expenses.filter(e => e.projectId !== proj.value.id)
  confirmDeleteProject.value = false
  toast.success(`Project "${name}" deleted.`)
  router.push('/projects')
}

function confirmDeleteSession(sessId) {
  sessionToDelete.value = sessId
}

function executeDeleteSession() {
  if (sessionToDelete.value) {
    store.deleteSession(sessionToDelete.value)
    sessionToDelete.value = null
    toast.success('Work session deleted.')
  }
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Chronological Timeline Generator ────────────────────────────────────────

const timelineEvents = computed(() => {
  if (!proj.value) return []
  const events = []

  // 1. Project Creation Event
  if (proj.value.createdAt) {
    events.push({
      id: 'created-' + proj.value.id,
      date: new Date(proj.value.createdAt),
      formattedDate: fmtDate(proj.value.createdAt),
      title: 'Project created',
      description: `Created for ${proj.value.client?.name || 'Customer'} with initial status "${proj.value.status}".`,
      type: 'creation',
      icon: IconFolders,
      iconBg: 'rgba(107,114,128,0.1)',
      iconColor: '#6B7280',
    })
  }

  // 2. Work Sessions
  if (proj.value.sessions && proj.value.sessions.length > 0) {
    proj.value.sessions.forEach(s => {
      events.push({
        id: 'sess-' + s.id,
        rawId: s.id,
        date: new Date(s.startedAt || proj.value.createdAt),
        formattedDate: fmtDate(s.startedAt),
        title: s.title || 'Work session',
        description: s.notes || (s.unpaidReason ? `Reason: ${s.unpaidReason}` : ''),
        type: 'session',
        durationHM: store.minutesToHM(s.durationMin),
        paymentType: s.paymentType,
        icon: IconClock,
        iconBg: s.paymentType === 'paid' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
        iconColor: s.paymentType === 'paid' ? '#059669' : '#D97706',
      })
    })
  }

  // 3. Quote Event (if present)
  if (proj.value.quoteAmount) {
    events.push({
      id: 'quote-' + proj.value.id,
      date: new Date(proj.value.quoteDate || proj.value.createdAt),
      formattedDate: fmtDate(proj.value.quoteDate),
      title: `Quote: ${store.fmtCurrency(proj.value.quoteAmount)}`,
      description: proj.value.quoteNotes || (proj.value.quoteEstHours ? `Estimated effort: ${proj.value.quoteEstHours} hours` : 'Quote prepared and sent to customer.'),
      type: 'quote',
      amountStr: store.fmtCurrency(proj.value.quoteAmount),
      icon: IconEdit,
      iconBg: 'rgba(122,63,246,0.1)',
      iconColor: '#7A3FF6',
    })
  }

  // 4. Payments
  if (proj.value.paymentsHistory && proj.value.paymentsHistory.length > 0) {
    proj.value.paymentsHistory.forEach(pmt => {
      events.push({
        id: 'pmt-' + pmt.id,
        date: new Date(pmt.paidDate),
        formattedDate: fmtDate(pmt.paidDate),
        title: `Payment received: ${store.fmtCurrency(pmt.amount)}`,
        description: pmt.notes || 'Revenue recorded',
        type: 'payment',
        amountStr: store.fmtCurrency(pmt.amount),
        icon: IconBriefcase,
        iconBg: 'rgba(16,185,129,0.12)',
        iconColor: '#059669',
      })
    })
  }

  // 5. Expenses
  if (proj.value.expensesHistory && proj.value.expensesHistory.length > 0) {
    proj.value.expensesHistory.forEach(exp => {
      events.push({
        id: 'exp-' + exp.id,
        date: new Date(exp.date),
        formattedDate: fmtDate(exp.date),
        title: `Expense: ${store.fmtCurrency(exp.amount)} (${exp.description})`,
        description: `Category: ${exp.category || 'General'}`,
        type: 'expense',
        amountStr: store.fmtCurrency(exp.amount),
        icon: IconAlert,
        iconBg: 'rgba(239,68,68,0.1)',
        iconColor: '#DC2626',
      })
    })
  }

  // Sort descending or ascending
  return events.sort((a, b) => b.date - a.date)
})
</script>
