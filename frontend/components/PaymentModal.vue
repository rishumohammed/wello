<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')" id="modal-payment-overlay">
      <div class="modal modal-sm" id="modal-payment" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <div class="modal-title">Record Payment / Income</div>
            <div class="modal-subtitle" v-if="selectedProject">{{ selectedProject.name }}</div>
          </div>
          <button class="modal-close" @click="$emit('close')" id="btn-close-payment-modal" aria-label="Close"><IconX /></button>
        </div>
        <form @submit.prevent="handleSubmit" novalidate>
          <div class="modal-body">
            <!-- Project selector if not preset -->
            <div class="form-group" v-if="!projectId">
              <label class="form-label" for="pay-project">Project <span class="required">*</span></label>
              <select id="pay-project" v-model="form.projectId" class="form-select" :class="{ error: errors.projectId }">
                <option value="">Select project…</option>
                <option v-for="p in availableProjects" :key="p.id" :value="p.id">
                  {{ p.name }} {{ p.isJob ? '(Job)' : '' }}
                </option>
              </select>
              <span v-if="errors.projectId" class="form-error">{{ errors.projectId }}</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="pay-amount">Amount ({{ store.currency }}) <span class="required">*</span></label>
              <input
                id="pay-amount"
                v-model.number="form.amount"
                class="form-input"
                :class="{ error: errors.amount }"
                type="number"
                min="1"
                step="50"
                placeholder="e.g. 2500"
                autocomplete="off"
              />
              <span v-if="errors.amount" class="form-error">{{ errors.amount }}</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="pay-date">Date Received</label>
              <input id="pay-date" v-model="form.date" class="form-input" type="date" :max="todayStr" />
            </div>

            <div class="form-group">
              <label class="form-label" for="pay-notes">Notes</label>
              <input id="pay-notes" v-model="form.notes" class="form-input" type="text" placeholder="e.g. Milestone 1 payment, Advance, Retainer" />
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="$emit('close')" id="btn-cancel-payment">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btn-save-payment">Record Payment</button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  projectId: { type: String, default: '' },
})

const emit = defineEmits(['close', 'saved'])
const store = useWelloStore()
const toast = useToast()
const todayStr = new Date().toISOString().slice(0, 10)

const availableProjects = computed(() =>
  store.projects.filter(p => p.status !== 'lost')
)

const form = reactive({
  projectId: props.projectId || (availableProjects.value[0]?.id || ''),
  amount: null,
  date: todayStr,
  notes: '',
})

const errors = reactive({ projectId: '', amount: '' })

const selectedProject = computed(() =>
  store.getProject(props.projectId || form.projectId)
)

function handleSubmit() {
  errors.projectId = ''
  errors.amount = ''

  const targetProjId = props.projectId || form.projectId
  if (!targetProjId) {
    errors.projectId = 'Please select a project.'
    return
  }

  if (!form.amount || form.amount <= 0) {
    errors.amount = 'Enter a valid payment amount.'
    return
  }

  store.addPayment(targetProjId, {
    amount: form.amount,
    paidDate: form.date || todayStr,
    notes: form.notes,
  })

  toast.success(`Payment of ${store.fmtCurrency(form.amount)} recorded.`)
  emit('saved')
  emit('close')
}
</script>
