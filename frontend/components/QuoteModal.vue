<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('close')" id="modal-quote-overlay">
      <div class="modal modal-sm" id="modal-quote" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div>
            <div class="modal-title">{{ project.quoteAmount ? 'Edit Quote' : 'Create Quote' }}</div>
            <div class="modal-subtitle">{{ project.name }}</div>
          </div>
          <button class="modal-close" @click="$emit('close')" aria-label="Close"><IconX /></button>
        </div>

        <form @submit.prevent="handleSubmit" novalidate id="form-quote-entry">
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="quote-amount">
                  Quote Amount ({{ store.currency }}) <span class="required">*</span>
                </label>
                <input
                  id="quote-amount"
                  v-model.number="form.amount"
                  class="form-input"
                  :class="{ error: errors.amount }"
                  type="number"
                  min="1"
                  step="100"
                  placeholder="e.g. 25000"
                  autocomplete="off"
                />
                <span v-if="errors.amount" class="form-error">{{ errors.amount }}</span>
              </div>

              <div class="form-group">
                <label class="form-label" for="quote-est-hours">Estimated Hours</label>
                <input
                  id="quote-est-hours"
                  v-model.number="form.estHours"
                  class="form-input"
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="e.g. 30"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="quote-date">Quote Date</label>
                <input id="quote-date" v-model="form.date" class="form-input" type="date" />
              </div>

              <div class="form-group">
                <label class="form-label" for="quote-status">Quote Status</label>
                <select id="quote-status" v-model="form.status" class="form-select">
                  <option value="draft">Draft (Preparing)</option>
                  <option value="sent">Sent to Customer</option>
                  <option value="accepted">Accepted (Ready to Convert)</option>
                  <option value="rejected">Rejected / Lost</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="quote-notes">Scope Inclusions & Notes</label>
              <textarea
                id="quote-notes"
                v-model="form.notes"
                class="form-textarea"
                placeholder="Scope description, deliverables, milestones, payment schedule…"
                rows="2"
              ></textarea>
            </div>

            <!-- Implied rate display -->
            <div v-if="form.amount && form.estHours" class="implied-rate-box mt-3" id="quote-implied-rate-box">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs text-tertiary">Implied hourly quote rate</div>
                  <div class="fw-700 text-brand text-xl">
                    {{ store.fmtHourly(form.amount / form.estHours) }}
                  </div>
                </div>
                <div class="text-right" v-if="store.user.targetHourly">
                  <div class="text-xs text-tertiary">Your target rate</div>
                  <div class="fw-600 text-sm" :class="(form.amount / form.estHours) >= store.user.targetHourly ? 'text-success' : 'text-warning'">
                    {{ store.fmtHourly(store.user.targetHourly) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="$emit('close')" id="btn-cancel-quote">Cancel</button>
            <button type="submit" class="btn btn-primary" :disabled="saving" id="btn-save-quote">
              <span v-if="saving">Saving…</span>
              <span v-else>Save Quote</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  project: { type: Object, required: true },
})

const emit = defineEmits(['close', 'saved'])
const store = useWelloStore()
const toast = useToast()
const saving = ref(false)

const form = reactive({
  amount:   props.project.quoteAmount || null,
  estHours: props.project.quoteEstHours || null,
  date:     props.project.quoteDate || new Date().toISOString().slice(0, 10),
  status:   props.project.quoteStatus || 'sent',
  notes:    props.project.quoteNotes || '',
})

const errors = reactive({ amount: '' })

async function handleSubmit() {
  errors.amount = ''
  if (!form.amount || form.amount <= 0) {
    errors.amount = 'Quote amount is required.'
    return
  }

  saving.value = true
  try {
    store.saveQuote(props.project.id, {
      amount: form.amount,
      date: form.date,
      estHours: form.estHours,
      notes: form.notes,
    })

    // If accepted, also mark project status as approved
    if (form.status === 'accepted') {
      store.updateProject(props.project.id, {
        quoteStatus: 'accepted',
        status: 'approved',
      })
      toast.success('Quote marked as Accepted! Ready to convert to Job.')
    } else if (form.status === 'rejected') {
      store.updateProject(props.project.id, {
        quoteStatus: 'rejected',
        status: 'lost',
      })
      toast.info('Quote marked as Rejected. Project retained in analytics.')
    } else {
      store.updateProject(props.project.id, {
        quoteStatus: form.status,
        status: 'quoted',
      })
      toast.success('Quote saved.')
    }

    emit('saved')
    emit('close')
  } finally {
    saving.value = false
  }
}
</script>
