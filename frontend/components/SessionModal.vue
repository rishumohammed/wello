<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="modal-overlay" @click.self="handleClose" id="modal-session-overlay">
        <div class="modal" id="modal-session" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">{{ isEdit ? 'Edit Work Session' : 'Log Work Session' }}</div>
              <div class="modal-subtitle" v-if="selectedProject">{{ selectedProject.name }}</div>
            </div>
            <button class="modal-close" @click="handleClose" id="btn-close-session-modal" aria-label="Close">
              <IconX />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" novalidate id="form-session-entry">
            <div class="modal-body">
              <!-- Project Selection (Required) -->
              <div class="form-group" v-if="!projectId || isEdit">
                <label class="form-label" for="sess-project">
                  Project <span class="required">*</span>
                </label>
                <select
                  id="sess-project"
                  v-model="form.projectId"
                  class="form-select"
                  :class="{ error: errors.projectId }"
                >
                  <option value="">Select project…</option>
                  <option v-for="p in availableProjects" :key="p.id" :value="p.id">
                    {{ p.name }} {{ p.isJob ? '(Job)' : '' }} · {{ p.client?.name || 'Customer' }}
                  </option>
                </select>
                <span v-if="errors.projectId" class="form-error">{{ errors.projectId }}</span>
              </div>

              <!-- Task Description / Title -->
              <div class="form-group">
                <label class="form-label" for="sess-title">
                  Task / Description <span class="required">*</span>
                </label>
                <input
                  id="sess-title"
                  v-model="form.title"
                  class="form-input"
                  :class="{ error: errors.title }"
                  type="text"
                  placeholder="e.g. Discovery call, Wireframe review, Sprint development"
                  autocomplete="off"
                />
                <span v-if="errors.title" class="form-error">{{ errors.title }}</span>
              </div>

              <!-- Work Type (10 Types) & Payment Classification -->
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="sess-work-type">Work Type</label>
                  <select id="sess-work-type" v-model="form.type" class="form-select">
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
                  <label class="form-label" for="sess-payment-class">Payment Classification</label>
                  <select id="sess-payment-class" v-model="form.paymentType" class="form-select">
                    <option value="paid">Paid (Associated with revenue)</option>
                    <option value="unpaid">Unpaid client work (Discovery / Pre-payment)</option>
                    <option value="intentional_unpaid">Intentional unpaid (Learning / Strategic)</option>
                  </select>
                </div>
              </div>

              <!-- Unpaid Client Reason -->
              <div class="form-group" v-if="form.paymentType === 'unpaid'">
                <label class="form-label" for="sess-unpaid-client-reason">Unpaid Reason</label>
                <select id="sess-unpaid-client-reason" v-model="form.unpaidReason" class="form-select">
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
                <label class="form-label" for="sess-unpaid-reason">Intentional Reason</label>
                <select id="sess-unpaid-reason" v-model="form.unpaidReason" class="form-select">
                  <option value="learning">Learning / Skill-building</option>
                  <option value="portfolio">Portfolio / Showcase</option>
                  <option value="charity">Charity / Pro Bono</option>
                  <option value="strategic">Strategic Relationship</option>
                  <option value="personal">Personal Project</option>
                </select>
              </div>

              <!-- Time Details: Date, Start Time, End Time, Duration -->
              <div class="form-divider"><span>Date & Duration</span></div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="sess-date">Date</label>
                  <input id="sess-date" v-model="form.date" type="date" class="form-input" :max="todayStr" />
                </div>

                <div class="form-group">
                  <label class="form-label" for="sess-duration-h">
                    Duration (hours) <span class="required">*</span>
                  </label>
                  <input
                    id="sess-duration-h"
                    v-model.number="form.durationH"
                    class="form-input"
                    :class="{ error: errors.duration }"
                    type="number"
                    min="0.05"
                    step="0.25"
                    placeholder="e.g. 1.5"
                    @input="onDurationInput"
                  />
                  <span v-if="errors.duration" class="form-error">{{ errors.duration }}</span>
                  <span class="form-hint" v-if="form.durationH">{{ formattedDurationLabel }}</span>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="sess-start-time">Start Time (Optional)</label>
                  <input
                    id="sess-start-time"
                    v-model="form.startTime"
                    type="time"
                    class="form-input"
                    @change="onTimeRangeChange"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" for="sess-end-time">End Time (Optional)</label>
                  <input
                    id="sess-end-time"
                    v-model="form.endTime"
                    type="time"
                    class="form-input"
                    @change="onTimeRangeChange"
                  />
                </div>
              </div>

              <!-- Notes -->
              <div class="form-group">
                <label class="form-label" for="sess-notes">Notes / Meeting Summary</label>
                <textarea
                  id="sess-notes"
                  v-model="form.notes"
                  class="form-textarea"
                  placeholder="Key takeaways, deliverables, or client feedback…"
                  rows="2"
                ></textarea>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="handleClose" id="btn-cancel-session">Cancel</button>
              <button type="submit" class="btn btn-primary" :disabled="saving" id="btn-save-session-submit">
                <span v-if="saving">Saving…</span>
                <span v-else>{{ isEdit ? 'Update Session' : 'Save Session' }}</span>
              </button>
            </div>
          </form>
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
  projectId: { type: String, default: null },
  session: { type: Object, default: null },
})

const emit = defineEmits(['close', 'saved'])
const store = useWelloStore()
const toast = useToast()
const saving = ref(false)

const todayStr = new Date().toISOString().slice(0, 10)
const isEdit = computed(() => !!props.session)

const availableProjects = computed(() =>
  store.projects.filter(p => p.status !== 'lost')
)

// Initial values
const initDate = props.session?.startedAt ? props.session.startedAt.slice(0, 10) : todayStr
const initDurationH = props.session?.durationMin ? Number((props.session.durationMin / 60).toFixed(2)) : 1.0
const initStartTime = props.session?.startedAt ? props.session.startedAt.slice(11, 16) : '09:00'
const initEndTime = props.session?.endedAt ? props.session.endedAt.slice(11, 16) : '10:00'

const form = reactive({
  projectId: props.session?.projectId || props.projectId || (availableProjects.value[0]?.id || ''),
  title: props.session?.title || '',
  type: props.session?.type || 'production',
  paymentType: props.session?.paymentType || 'paid',
  unpaidReason: props.session?.unpaidReason || (props.session?.paymentType === 'unpaid' ? 'scope_creep' : 'strategic'),
  date: initDate,
  durationH: initDurationH,
  startTime: initStartTime,
  endTime: initEndTime,
  notes: props.session?.notes || '',
})

watch(() => form.paymentType, (newVal) => {
  if (newVal === 'unpaid') {
    if (!form.unpaidReason || ['learning', 'portfolio', 'charity', 'strategic', 'personal'].includes(form.unpaidReason)) {
      form.unpaidReason = 'scope_creep'
    }
  } else if (newVal === 'intentional_unpaid') {
    if (!form.unpaidReason || ['scope_creep', 'revisions_beyond_scope', 'pitching', 'client_friction', 'admin_overhead', 'uncollectible'].includes(form.unpaidReason)) {
      form.unpaidReason = 'strategic'
    }
  } else {
    form.unpaidReason = null
  }
})

const errors = reactive({ projectId: '', title: '', duration: '' })

const selectedProject = computed(() =>
  store.getProject(props.projectId || form.projectId)
)

const formattedDurationLabel = computed(() => {
  if (!form.durationH || form.durationH <= 0) return ''
  const totalMins = Math.round(form.durationH * 60)
  return store.minutesToHM(totalMins)
})

function onTimeRangeChange() {
  if (form.startTime && form.endTime) {
    const [sh, sm] = form.startTime.split(':').map(Number)
    const [eh, em] = form.endTime.split(':').map(Number)
    const startM = sh * 60 + sm
    const endM = eh * 60 + em
    if (endM > startM) {
      const diffM = endM - startM
      form.durationH = Number((diffM / 60).toFixed(2))
    }
  }
}

function onDurationInput() {
  if (form.startTime && form.durationH > 0) {
    const [sh, sm] = form.startTime.split(':').map(Number)
    const startM = sh * 60 + sm
    const totalEndM = startM + Math.round(form.durationH * 60)
    const endH = Math.floor(totalEndM / 60) % 24
    const endM = totalEndM % 60
    form.endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  }
}

function validate() {
  errors.projectId = ''
  errors.title = ''
  errors.duration = ''
  let ok = true

  if (!form.projectId) {
    errors.projectId = 'Please select a project.'
    ok = false
  }
  if (!form.title.trim()) {
    errors.title = 'Please enter a description for this session.'
    ok = false
  }
  if (!form.durationH || form.durationH <= 0) {
    errors.duration = 'Enter a valid duration.'
    ok = false
  }

  return ok
}

async function handleSubmit() {
  if (!validate()) return
  saving.value = true

  try {
    const durationMin = Math.round(form.durationH * 60)
    const startIso = `${form.date}T${form.startTime || '09:00'}:00`
    const endIso = `${form.date}T${form.endTime || '10:00'}:00`
    const unpaidCategory = categorizeUnpaidReason(form.unpaidReason, form.paymentType)

    if (isEdit.value) {
      store.updateSession(props.session.id, {
        projectId: form.projectId,
        title: form.title.trim(),
        type: form.type,
        paymentType: form.paymentType,
        unpaidReason: form.paymentType === 'paid' ? null : form.unpaidReason,
        unpaidCategory,
        durationMin,
        startedAt: startIso,
        endedAt: endIso,
        notes: form.notes.trim(),
      })
      toast.success('Session updated.')
    } else {
      store.addSession({
        projectId: form.projectId,
        title: form.title.trim(),
        type: form.type,
        paymentType: form.paymentType,
        unpaidReason: form.paymentType === 'paid' ? null : form.unpaidReason,
        unpaidCategory,
        durationMin,
        startedAt: startIso,
        endedAt: endIso,
        notes: form.notes.trim(),
      })
      toast.success(`Logged ${store.minutesToHM(durationMin)} work session.`)
    }

    emit('saved')
    emit('close')
  } finally {
    saving.value = false
  }
}

function handleClose() {
  emit('close')
}
</script>
