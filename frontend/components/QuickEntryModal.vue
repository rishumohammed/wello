<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="modal-overlay" @click.self="$emit('close')" id="modal-quick-entry-overlay">
        <div class="modal modal-md" id="modal-quick-entry" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title flex items-center gap-2">
                <span>⚡</span>
                <span>Quick Log</span>
              </div>
              <div class="modal-subtitle">Log work & earnings in 2 taps without quotes or clients</div>
            </div>
            <button class="modal-close" @click="$emit('close')" id="btn-close-quick-entry" aria-label="Close">
              <IconX />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="modal-body flex flex-col gap-4">
            <!-- 1. SELECT INCOME SOURCE -->
            <div class="form-group">
              <label class="form-label flex justify-between items-center">
                <span>Income Source <span class="text-danger">*</span></span>
                <button
                  type="button"
                  class="text-xs text-primary hover:underline flex items-center gap-1"
                  @click="openNewSource"
                  id="btn-quick-new-source"
                >
                  <span>+ New Source</span>
                </button>
              </label>

              <div v-if="sources.length === 0" class="p-3 bg-tertiary/20 rounded-lg border text-center text-xs">
                <div class="text-secondary mb-2">No income sources found yet.</div>
                <button
                  type="button"
                  class="btn btn-xs btn-primary"
                  @click="openNewSource"
                >
                  Create Your First Income Source
                </button>
              </div>

              <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  v-for="src in sources"
                  :key="src.id"
                  type="button"
                  class="p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between"
                  :class="selectedSourceId === src.id ? 'border-primary bg-primary/10 shadow-sm' : 'border-neutral hover:border-secondary bg-surface'"
                  @click="selectSource(src)"
                >
                  <div class="fw-600 text-sm truncate">{{ src.name }}</div>
                  <div class="flex items-center justify-between mt-1 text-xs text-tertiary">
                    <span class="capitalize">{{ formatType(src.type) }}</span>
                    <span class="fw-700 text-primary">{{ src.currency }}</span>
                  </div>
                </button>
              </div>
            </div>

            <!-- 2. HOURS WORKED (PRESETS + CUSTOM) -->
            <div class="form-group">
              <label class="form-label">Hours Worked <span class="text-danger">*</span></label>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <button
                  v-for="h in [0.5, 1, 2, 4, 6, 8]"
                  :key="h"
                  type="button"
                  class="btn btn-xs"
                  :class="hours === h ? 'btn-primary' : 'btn-secondary'"
                  @click="hours = h"
                >
                  {{ h }}h
                </button>
              </div>
              <div class="relative flex items-center">
                <input
                  v-model.number="hours"
                  type="number"
                  step="0.25"
                  min="0.1"
                  max="24"
                  required
                  placeholder="e.g. 4.5"
                  class="form-input pr-12"
                  id="input-quick-hours"
                />
                <span class="absolute right-3 text-xs text-tertiary">hours</span>
              </div>
            </div>

            <!-- 3. EARNINGS / AMOUNT -->
            <div class="form-group">
              <label class="form-label flex justify-between items-center">
                <span>Earnings for this shift/work</span>
                <span class="text-xs text-tertiary">{{ selectedSource?.currency || store.user.baseCurrency }}</span>
              </label>
              <div class="relative flex items-center mb-2">
                <span class="absolute left-3 text-xs text-tertiary">{{ selectedSource?.currency || store.user.baseCurrency }}</span>
                <input
                  v-model.number="amount"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0.00 (optional if fixed salary)"
                  class="form-input pl-12"
                  id="input-quick-amount"
                />
              </div>

              <!-- EXPECT PAYMENT LATER TOGGLE -->
              <label v-if="amount > 0" class="flex items-center gap-2 cursor-pointer text-xs text-secondary mt-1">
                <input
                  type="checkbox"
                  v-model="isExpected"
                  class="rounded border-neutral"
                  id="checkbox-quick-expected"
                />
                <span>Expect payment later (pending / unpaid yet)</span>
              </label>
            </div>

            <!-- 4. ACTIVITY TYPE -->
            <div class="form-group">
              <label class="form-label">Activity Type</label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="t in activityTypes"
                  :key="t.key"
                  type="button"
                  class="btn btn-xs"
                  :class="activityType === t.key ? 'btn-primary' : 'btn-secondary'"
                  @click="activityType = t.key"
                >
                  <span>{{ t.icon }}</span>
                  <span>{{ t.label }}</span>
                </button>
              </div>
            </div>

            <!-- 5. DATE & NOTES (COLLAPSIBLE / COMPACT) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-neutral/40">
              <div>
                <label class="form-label text-xs">Date</label>
                <input
                  v-model="date"
                  type="date"
                  class="form-input text-xs"
                  id="input-quick-date"
                />
              </div>
              <div>
                <label class="form-label text-xs">Notes (optional)</label>
                <input
                  v-model="notes"
                  type="text"
                  placeholder="e.g. morning shift, extra delivery"
                  class="form-input text-xs"
                  id="input-quick-notes"
                />
              </div>
            </div>

            <!-- FOOTER ACTIONS -->
            <div class="modal-footer flex items-center justify-between pt-3 mt-2 border-t">
              <button
                type="button"
                class="btn btn-ghost text-xs"
                @click="$emit('close')"
                id="btn-cancel-quick-entry"
              >
                Cancel
              </button>

              <button
                type="submit"
                class="btn btn-primary"
                :disabled="!selectedSourceId || !hours || hours <= 0 || isSubmitting"
                id="btn-submit-quick-entry"
              >
                <span v-if="isSubmitting">Logging...</span>
                <span v-else>Log {{ hours || 0 }}h to {{ selectedSource?.name || 'Source' }}</span>
              </button>
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

const emit = defineEmits(['close', 'openNewSource'])

const store = useWelloStore()

const sources = computed(() => store.activeIncomeSources)

const selectedSourceId = ref(null)
const hours = ref(4)
const amount = ref(null)
const isExpected = ref(false)
const activityType = ref('production')
const date = ref(store.userToday())
const notes = ref('')
const isSubmitting = ref(false)

const activityTypes = [
  { key: 'production', label: 'Work', icon: '🔨' },
  { key: 'travel', label: 'Commute / Travel', icon: '🚗' },
  { key: 'admin', label: 'Admin / Prep', icon: '📋' },
  { key: 'meeting', label: 'Meeting / Call', icon: '📞' },
  { key: 'learning', label: 'Upskilling', icon: '📚' },
]

const selectedSource = computed(() => {
  return sources.value.find(s => s.id === selectedSourceId.value) || null
})

onMounted(() => {
  if (sources.value.length > 0) {
    selectedSourceId.value = sources.value[0].id
    // Auto-calculate suggested amount if hourly/daily wage
    suggestAmountForSource(sources.value[0])
  }
})

function selectSource(src) {
  selectedSourceId.value = src.id
  suggestAmountForSource(src)
}

function suggestAmountForSource(src) {
  if (!src) return
  if (src.type === 'hourly_wage' && src.expectedAmount && src.expectedHoursPerPeriod) {
    const hourlyRate = src.expectedAmount / src.expectedHoursPerPeriod
    amount.value = Math.round(hourlyRate * hours.value)
  } else if (src.type === 'daily_wage' && src.expectedAmount) {
    amount.value = src.expectedAmount
  }
}

function formatType(type) {
  const map = {
    salary: 'Salaried',
    hourly_wage: 'Hourly Wage',
    daily_wage: 'Daily Wage',
    retainer: 'Retainer',
    gig: 'Gig / Per Job',
    project: 'Project',
    other: 'Income Source',
  }
  return map[type] || type
}

function openNewSource() {
  emit('close')
  emit('openNewSource')
}

async function handleSubmit() {
  if (!selectedSourceId.value || !hours.value) return
  isSubmitting.value = true
  try {
    await store.quickEntry({
      incomeSourceId: selectedSourceId.value,
      hours: hours.value,
      amount: amount.value ? Number(amount.value) : null,
      isExpected: isExpected.value,
      type: activityType.value,
      date: date.value,
      notes: notes.value,
    })
    emit('close')
  } catch (err) {
    // handled in store toast
  } finally {
    isSubmitting.value = false
  }
}
</script>
