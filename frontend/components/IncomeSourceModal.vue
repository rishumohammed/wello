<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="modal-overlay" @click.self="$emit('close')" id="modal-income-source-overlay">
        <div class="modal modal-md" id="modal-income-source" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">
                {{ isEdit ? 'Edit Income Source' : 'New Income Source' }}
              </div>
              <div class="modal-subtitle">
                Configure salaries, hourly jobs, gigs, retainers, and multi-employer streams
              </div>
            </div>
            <button class="modal-close" @click="$emit('close')" id="btn-close-income-source" aria-label="Close">
              <IconX />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="modal-body flex flex-col gap-4">
            <!-- 1. SOURCE TYPE SELECTOR -->
            <div class="form-group">
              <label class="form-label">Type of Income <span class="text-danger">*</span></label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  v-for="t in typeOptions"
                  :key="t.key"
                  type="button"
                  class="p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between"
                  :class="form.type === t.key ? 'border-primary bg-primary/10 shadow-sm' : 'border-neutral hover:border-secondary bg-surface'"
                  @click="form.type = t.key"
                >
                  <div class="flex items-center gap-1.5 fw-600 text-xs">
                    <span>{{ t.icon }}</span>
                    <span>{{ t.label }}</span>
                  </div>
                  <div class="text-[10px] text-tertiary mt-1 leading-tight">{{ t.desc }}</div>
                </button>
              </div>
            </div>

            <!-- 2. NAME & CURRENCY -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="form-label">Source / Employer Name <span class="text-danger">*</span></label>
                <input
                  v-model="form.name"
                  type="text"
                  required
                  placeholder="e.g. Acme Corp, Math Tutoring, Uber"
                  class="form-input"
                  id="input-source-name"
                />
              </div>

              <div>
                <label class="form-label">Currency <span class="text-danger">*</span></label>
                <select v-model="form.currency" class="form-select" id="select-source-currency">
                  <option v-for="c in currencyOptions" :key="c" :value="c">
                    {{ c }}
                  </option>
                </select>
              </div>
            </div>

            <!-- 3. PAY FREQUENCY -->
            <div class="form-group">
              <label class="form-label">Pay Frequency <span class="text-danger">*</span></label>
              <div class="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                <button
                  v-for="f in frequencyOptions"
                  :key="f.key"
                  type="button"
                  class="btn btn-xs"
                  :class="form.payFrequency === f.key ? 'btn-primary' : 'btn-secondary'"
                  @click="form.payFrequency = f.key"
                >
                  {{ f.label }}
                </button>
              </div>
            </div>

            <!-- 4. EXPECTED AMOUNT & HOURS (BENCHMARK) -->
            <div class="p-3 bg-tertiary/10 rounded-lg border border-neutral/60 flex flex-col gap-3">
              <div class="fw-600 text-xs text-secondary flex items-center justify-between">
                <span>Expected Income & Hours per {{ currentFrequencyLabel }}</span>
                <span class="text-[11px] text-tertiary">Used for True Rate benchmarking</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="form-label text-xs">Expected Amount ({{ form.currency }})</label>
                  <input
                    v-model.number="form.expectedAmount"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 5000"
                    class="form-input text-xs"
                    id="input-source-expected-amount"
                  />
                </div>

                <div>
                  <label class="form-label text-xs">Expected Hours per {{ currentFrequencyLabel }}</label>
                  <input
                    v-model.number="form.expectedHoursPerPeriod"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 160"
                    class="form-input text-xs"
                    id="input-source-expected-hours"
                  />
                </div>
              </div>

              <!-- BENCHMARK PREVIEW -->
              <div v-if="computedHourlyRate > 0" class="flex items-center justify-between text-xs pt-2 border-t border-neutral/30">
                <span class="text-secondary">Target Nominal Hourly Rate:</span>
                <span class="fw-700 text-primary">
                  {{ store.fmtCurrency(computedHourlyRate, form.currency) }}/hr
                </span>
              </div>
            </div>

            <!-- 5. NOTES -->
            <div class="form-group">
              <label class="form-label">Notes & Details</label>
              <textarea
                v-model="form.notes"
                rows="2"
                placeholder="Contract terms, overtime rate, retainer scope, etc."
                class="form-input text-xs"
                id="textarea-source-notes"
              ></textarea>
            </div>

            <!-- FOOTER -->
            <div class="modal-footer flex items-center justify-between pt-3 mt-1 border-t">
              <button
                v-if="isEdit"
                type="button"
                class="btn btn-danger btn-xs"
                @click="handleDelete"
                id="btn-delete-income-source"
              >
                Archive / Delete
              </button>
              <span v-else></span>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="btn btn-ghost text-xs"
                  @click="$emit('close')"
                  id="btn-cancel-income-source"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="!form.name || isSubmitting"
                  id="btn-submit-income-source"
                >
                  <span v-if="isSubmitting">Saving...</span>
                  <span v-else>{{ isEdit ? 'Update Source' : 'Create Source' }}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { ISO_CURRENCIES } from '~/utils/currencyUtils'

const props = defineProps({
  source: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'saved'])

const store = useWelloStore()
const isEdit = computed(() => !!props.source?.id)
const isSubmitting = ref(false)

const currencyOptions = ISO_CURRENCIES || ['USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'INR', 'SGD', 'JPY']

const typeOptions = [
  { key: 'salary', label: 'Salary', icon: '💼', desc: 'Full-time or part-time salaried employment' },
  { key: 'hourly_wage', label: 'Hourly Wage', icon: '⏱️', desc: 'Shifts, hourly rates & multiple employers' },
  { key: 'daily_wage', label: 'Daily Wage', icon: '📅', desc: 'Daily rate jobs, day labor, contractors' },
  { key: 'retainer', label: 'Retainer', icon: '🔄', desc: 'Recurring advisory, maintenance or retainer' },
  { key: 'gig', label: 'Gig / Platform', icon: '🚗', desc: 'Rideshare, delivery, freelance platforms' },
  { key: 'project', label: 'Client / Project', icon: '📁', desc: 'Standard project-based freelance clients' },
]

const frequencyOptions = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'biweekly', label: 'Bi-weekly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'daily', label: 'Daily' },
  { key: 'hourly', label: 'Hourly' },
]

const form = ref({
  type: 'salary',
  name: '',
  currency: store.user.baseCurrency || 'USD',
  payFrequency: 'monthly',
  expectedAmount: null,
  expectedHoursPerPeriod: null,
  notes: '',
})

onMounted(() => {
  if (props.source) {
    form.value = {
      type: props.source.type || 'salary',
      name: props.source.name || '',
      currency: props.source.currency || store.user.baseCurrency || 'USD',
      payFrequency: props.source.payFrequency || 'monthly',
      expectedAmount: props.source.expectedAmount !== null ? Number(props.source.expectedAmount) : null,
      expectedHoursPerPeriod: props.source.expectedHoursPerPeriod !== null ? Number(props.source.expectedHoursPerPeriod) : null,
      notes: props.source.notes || '',
    }
  }
})

const currentFrequencyLabel = computed(() => {
  const map = {
    monthly: 'Month',
    biweekly: '2 Weeks',
    weekly: 'Week',
    daily: 'Day',
    hourly: 'Hour',
    annual: 'Year',
    per_job: 'Job',
    one_off: 'One-off',
  }
  return map[form.value.payFrequency] || 'Period'
})

const computedHourlyRate = computed(() => {
  if (form.value.expectedAmount && form.value.expectedHoursPerPeriod && form.value.expectedHoursPerPeriod > 0) {
    return Math.round((form.value.expectedAmount / form.value.expectedHoursPerPeriod) * 100) / 100
  }
  return 0
})

async function handleSubmit() {
  if (!form.value.name) return
  isSubmitting.value = true

  try {
    if (isEdit.value) {
      await store.updateIncomeSource(props.source.id, form.value)
    } else {
      await store.createIncomeSource(form.value)
    }
    emit('saved')
    emit('close')
  } catch (err) {
    // handled in store toast
  } finally {
    isSubmitting.value = false
  }
}

async function handleDelete() {
  if (!isEdit.value) return
  if (confirm(`Are you sure you want to remove or archive "${props.source.name}"?`)) {
    await store.deleteIncomeSource(props.source.id)
    emit('saved')
    emit('close')
  }
}
</script>
