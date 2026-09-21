<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="modal-overlay" @click.self="$emit('close')" id="modal-timer-overlay">
        <div class="modal modal-sm" id="modal-timer" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">
                {{ conflictActiveTimer ? 'Switch Active Timer' : (store.activeTimer ? 'Running Work Timer' : 'Start Work') }}
              </div>
              <div class="modal-subtitle" v-if="store.activeTimer && !conflictActiveTimer">
                {{ timerProjectName }}
              </div>
            </div>
            <button class="modal-close" @click="$emit('close')" id="btn-close-timer-modal" aria-label="Close">
              <IconX />
            </button>
          </div>

          <div class="modal-body">
            <!-- CONFLICT CONFIRMATION VIEW -->
            <div v-if="conflictActiveTimer" class="timer-conflict-state" id="timer-conflict-view">
              <div class="alert alert-warning mb-4 p-3 rounded-lg border flex gap-3 items-start">
                <span class="text-xl">⚠️</span>
                <div>
                  <div class="fw-700 text-sm">Active Timer Already Running</div>
                  <div class="text-xs mt-1 text-secondary">
                    You currently have an active timer running on
                    <strong class="text-primary">{{ conflictActiveTimer.projectName }}</strong>
                    ({{ store.fmtDuration(Math.round(conflictActiveTimer.elapsedSeconds / 60)) }}).
                  </div>
                  <div class="text-xs mt-1 text-tertiary">
                    Wello enforces one active timer per user to prevent accidental double counting.
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  class="btn btn-primary w-full justify-center"
                  @click="handleForceSwitchTimer"
                  id="btn-confirm-switch-timer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                  <span>Stop Previous & Switch to {{ newProjectName }}</span>
                </button>
                <button
                  type="button"
                  class="btn btn-secondary w-full justify-center"
                  @click="conflictActiveTimer = null"
                  id="btn-goto-running-timer"
                >
                  <span>Stay with Running Timer</span>
                </button>
                <button
                  type="button"
                  class="btn btn-ghost w-full justify-center text-secondary text-xs"
                  @click="$emit('close')"
                  id="btn-cancel-conflict"
                >
                  Cancel
                </button>
              </div>
            </div>

            <!-- ACTIVE TIMER RUNNING STATE -->
            <div v-else-if="store.activeTimer" class="timer-active-state" id="timer-running-view">
              <!-- STALE / FORGOTTEN TIMER WARNING BANNER -->
              <div v-if="isStaleTimer && !dismissedStale" class="alert alert-warning mb-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs">
                <div class="fw-700 text-amber-500 flex items-center gap-1.5 mb-1">
                  <span>⚠️</span>
                  <span>Long Running Timer (> {{ maxTimerHours }}h)</span>
                </div>
                <div class="text-secondary mb-2.5">
                  This timer has been running for {{ store.timerDisplay() }}. If you forgot to stop it, you can trim it to your last activity.
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="btn btn-xs btn-secondary text-amber-500 border-amber-500/40"
                    @click="handleStopAndTrimActivity"
                    id="btn-trim-last-activity"
                  >
                    Stop & Trim to Last Activity
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs btn-secondary text-amber-500 border-amber-500/40"
                    @click="handleStopAndTrimHours"
                    id="btn-trim-max-hours"
                  >
                    Trim to {{ maxTimerHours }}h
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs btn-ghost text-tertiary"
                    @click="dismissedStale = true"
                  >
                    Keep Running
                  </button>
                </div>
              </div>

              <!-- Project Name & Task -->
              <div class="text-center mb-1">
                <div class="fw-700 text-base text-primary">{{ timerProjectName }}</div>
                <div class="text-secondary text-xs mt-1">
                  {{ store.activeTimer.title }} · <span class="capitalize">{{ store.activeTimer.type }}</span>
                  <span v-if="store.activeTimer.paymentType === 'unpaid'" class="badge badge-unpaid ml-1 text-2xs px-1.5 py-0.5">Unpaid</span>
                  <span v-else-if="store.activeTimer.paymentType === 'paid'" class="badge badge-paid ml-1 text-2xs px-1.5 py-0.5">Paid</span>
                  <span v-else class="badge badge-intentional ml-1 text-2xs px-1.5 py-0.5">Intentional</span>
                </div>
              </div>

              <!-- Big Timer Display -->
              <div class="text-center py-5">
                <div class="timer-display" :class="{ running: !store.isTimerPaused, paused: store.isTimerPaused }" id="timer-clock-digits">
                  {{ store.timerDisplay() }}
                </div>
                <div class="text-xs text-tertiary mt-2 flex items-center justify-center gap-1">
                  <span class="timer-running-indicator" :style="{ background: store.isTimerPaused ? '#F59E0B' : 'var(--color-success)' }"></span>
                  <span>{{ store.isTimerPaused ? 'Timer Paused' : 'Timer Active & Logging' }}</span>
                </div>
              </div>

              <!-- Controls: Pause, Resume, Stop -->
              <div class="flex items-center justify-center gap-3 mt-3">
                <!-- Pause / Resume button -->
                <button
                  v-if="!store.isTimerPaused"
                  class="btn btn-secondary"
                  @click="store.pauseTimer()"
                  id="btn-pause-timer"
                  title="Pause timer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  <span>Pause</span>
                </button>
                <button
                  v-else
                  class="btn btn-secondary text-purple border-purple"
                  @click="store.resumeTimer()"
                  id="btn-resume-timer"
                  title="Resume timer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <span>Resume</span>
                </button>

                <!-- Stop & Save button -->
                <button class="btn btn-primary" @click="handleStopTimer" id="btn-stop-save-timer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                  <span>Stop & Save Work</span>
                </button>
              </div>
            </div>

            <!-- START NEW WORK TIMER FORM -->
            <form v-else @submit.prevent="handleStartTimer" novalidate id="form-start-timer">
              <!-- Project Selection (Required) -->
              <div class="form-group">
                <label class="form-label" for="timer-select-project">
                  Select Project <span class="required">*</span>
                </label>
                <select
                  id="timer-select-project"
                  v-model="form.projectId"
                  class="form-select"
                  :class="{ error: errors.projectId }"
                >
                  <option value="">Choose a project to log work…</option>
                  <option v-for="p in availableProjects" :key="p.id" :value="p.id">
                    {{ p.name }} {{ p.isJob ? '(Job)' : '' }} · {{ p.client?.name || 'Customer' }}
                  </option>
                </select>
                <span v-if="errors.projectId" class="form-error">{{ errors.projectId }}</span>
              </div>

              <!-- Task / Work Description -->
              <div class="form-group">
                <label class="form-label" for="timer-task-title">
                  What are you working on? <span class="required">*</span>
                </label>
                <input
                  id="timer-task-title"
                  v-model="form.title"
                  class="form-input"
                  :class="{ error: errors.title }"
                  type="text"
                  placeholder="e.g. Design meeting, UI prototyping, Backend APIs"
                  autocomplete="off"
                />
                <span v-if="errors.title" class="form-error">{{ errors.title }}</span>
              </div>

              <!-- Work Type (10 Complete Types) & Payment Classification -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="timer-work-type">Work Type</label>
                  <select id="timer-work-type" v-model="form.type" class="form-select">
                    <option value="meeting">Meeting</option>
                    <option value="call">Call</option>
                    <option value="discussion">Discussion</option>
                    <option value="planning">Planning</option>
                    <option value="proposal">Proposal</option>
                    <option value="travel">Travel</option>
                    <option value="production">Production / Development</option>
                    <option value="revision">Revision</option>
                    <option value="delivery">Delivery</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label" for="timer-payment-class">Payment Classification</label>
                  <select id="timer-payment-class" v-model="form.paymentType" class="form-select">
                    <option value="paid">Paid (Associated with revenue)</option>
                    <option value="unpaid">Unpaid client work (Discovery / Pre-payment)</option>
                    <option value="intentional_unpaid">Intentional unpaid (Learning / Strategic)</option>
                  </select>
                </div>
              </div>

              <!-- Unpaid Client Reason -->
              <div class="form-group" v-if="form.paymentType === 'unpaid'">
                <label class="form-label" for="timer-unpaid-client-reason">Unpaid Reason</label>
                <select id="timer-unpaid-client-reason" v-model="form.unpaidReason" class="form-select">
                  <option value="pitching">Pitching & Proposal</option>
                  <option value="scope_creep">Scope Creep</option>
                  <option value="revisions_beyond_scope">Revisions Beyond Scope</option>
                  <option value="client_friction">Client Friction / Extended Calls</option>
                  <option value="admin_overhead">Admin & Contract Overhead</option>
                  <option value="uncollectible">Uncollectible / Bad Debt</option>
                </select>
              </div>

              <!-- Intentional Unpaid Reason -->
              <div class="form-group" v-if="form.paymentType === 'intentional_unpaid'">
                <label class="form-label" for="timer-unpaid-reason">Intentional Reason</label>
                <select id="timer-unpaid-reason" v-model="form.unpaidReason" class="form-select">
                  <option value="learning">Learning / Skill-building</option>
                  <option value="portfolio">Portfolio / Showcase</option>
                  <option value="charity">Charity / Pro Bono</option>
                  <option value="strategic">Strategic Relationship</option>
                  <option value="personal">Personal Project</option>
                </select>
              </div>

              <div class="modal-footer pt-4 px-0 pb-0 border-none">
                <button type="button" class="btn btn-secondary" @click="$emit('close')" id="btn-cancel-timer">Cancel</button>
                <button type="submit" class="btn btn-primary" id="btn-start-timer-submit">
                  <IconClock :size="14" />
                  Start Work
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'
import { categorizeUnpaidReason } from '~/utils/metricsEngine'

const props = defineProps({
  projectId: { type: [String, Number], default: '' },
})

const emit = defineEmits(['close', 'started', 'stopped'])
const store = useWelloStore()
const toast = useToast()

const conflictActiveTimer = ref(null)
const dismissedStale = ref(false)

const maxTimerHours = computed(() => Number(store.user?.maxTimerHours || 8))
const isStaleTimer = computed(() => {
  if (!store.activeTimer) return false
  return store.timerElapsed > maxTimerHours.value * 3600 || Boolean(store.activeTimer.isForgotten) || Boolean(store.activeTimer.isStale)
})

const availableProjects = computed(() =>
  store.projects.filter(p => p.status !== 'lost')
)

const form = reactive({
  projectId: props.projectId || (availableProjects.value[0]?.id || ''),
  title: '',
  type: 'production',
  paymentType: 'paid',
  unpaidReason: 'scope_creep',
})

watch(() => form.paymentType, (newVal) => {
  if (newVal === 'unpaid') {
    form.unpaidReason = 'scope_creep'
  } else if (newVal === 'intentional_unpaid') {
    form.unpaidReason = 'strategic'
  } else {
    form.unpaidReason = null
  }
})

const errors = reactive({ projectId: '', title: '' })

const timerProjectName = computed(() => {
  if (!store.activeTimer) return ''
  return store.getProject(store.activeTimer.projectId)?.name || 'Project'
})

const newProjectName = computed(() => {
  return store.getProject(form.projectId)?.name || 'New Project'
})

function validate() {
  errors.projectId = ''
  errors.title = ''
  let ok = true

  if (!form.projectId) {
    errors.projectId = 'Please select a valid project.'
    ok = false
  }
  if (!form.title.trim()) {
    errors.title = 'Please enter a task or session description.'
    ok = false
  }

  return ok
}

async function handleStartTimer() {
  if (!validate()) return

  const unpaidCat = categorizeUnpaidReason(form.unpaidReason, form.paymentType)

  const result = await store.startTimer({
    projectId: Number(form.projectId),
    title: form.title.trim(),
    type: form.type,
    paymentType: form.paymentType,
    unpaidReason: form.paymentType === 'paid' ? null : form.unpaidReason,
    unpaidCategory: unpaidCat,
  })

  if (result?.conflict) {
    conflictActiveTimer.value = result.activeTimer || {
      projectName: 'Another Project',
      elapsedSeconds: 0,
    }
    return
  }

  toast.success(`Work timer started for ${store.getProject(form.projectId)?.name || 'project'}.`)
  emit('started')
  emit('close')
}

async function handleForceSwitchTimer() {
  const unpaidCat = categorizeUnpaidReason(form.unpaidReason, form.paymentType)

  const result = await store.startTimer({
    projectId: Number(form.projectId),
    title: form.title.trim(),
    type: form.type,
    paymentType: form.paymentType,
    unpaidReason: form.paymentType === 'paid' ? null : form.unpaidReason,
    unpaidCategory: unpaidCat,
    forceSwitch: true,
  })

  conflictActiveTimer.value = null
  toast.success(`Switched active timer to ${store.getProject(form.projectId)?.name || 'project'}.`)
  emit('started')
  emit('close')
}

async function handleStopTimer() {
  const result = await store.stopTimer()
  if (result) {
    const mins = result.session?.durationMin || result.session?.durationMinutes || 1
    toast.success(`Work session saved (${store.minutesToHM(mins)}).`)
  }
  emit('stopped')
  emit('close')
}

async function handleStopAndTrimActivity() {
  const result = await store.stopTimer({ trimToLastActivity: true })
  if (result) {
    const mins = result.session?.durationMin || result.session?.durationMinutes || 1
    toast.success(`Work session trimmed to last activity and saved (${store.minutesToHM(mins)}).`)
  }
  emit('stopped')
  emit('close')
}

async function handleStopAndTrimHours() {
  const result = await store.stopTimer({ trimToHours: maxTimerHours.value })
  if (result) {
    const mins = result.session?.durationMin || result.session?.durationMinutes || 1
    toast.success(`Work session trimmed to ${maxTimerHours.value}h and saved.`)
  }
  emit('stopped')
  emit('close')
}
</script>
