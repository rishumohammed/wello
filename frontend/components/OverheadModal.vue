<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="modal-overlay" @click.self="$emit('close')" id="modal-overhead-overlay">
        <div class="modal modal-md" id="modal-overhead" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">
                {{ isEdit ? 'Edit Overhead Cost' : 'Add Overhead & Non-Project Cost' }}
              </div>
              <div class="modal-subtitle">
                Track commute, tools, equipment, software, and licenses to compute your All-In real rate
              </div>
            </div>
            <button class="modal-close" @click="$emit('close')" id="btn-close-overhead-modal" aria-label="Close">
              <IconX />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="modal-body flex flex-col gap-4">
            <!-- 1. CATEGORY SELECTOR -->
            <div class="form-group">
              <label class="form-label">Cost Category <span class="text-danger">*</span></label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  v-for="cat in categoryOptions"
                  :key="cat.key"
                  type="button"
                  class="p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between"
                  :class="form.category === cat.key ? 'border-primary bg-primary/10 shadow-sm' : 'border-neutral hover:border-secondary bg-surface'"
                  @click="form.category = cat.key"
                  :id="`btn-overhead-cat-${cat.key}`"
                >
                  <div class="flex items-center gap-1.5 fw-600 text-xs">
                    <span>{{ cat.icon }}</span>
                    <span>{{ cat.label }}</span>
                  </div>
                  <div class="text-[10px] text-tertiary mt-1 leading-tight">{{ cat.desc }}</div>
                </button>
              </div>
            </div>

            <!-- 2. NAME, AMOUNT & CURRENCY -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="sm:col-span-2">
                <label class="form-label">Expense Name <span class="text-danger">*</span></label>
                <input
                  v-model="form.name"
                  type="text"
                  required
                  placeholder="e.g. Monthly Transit Pass, JetBrains License, Safety Boots"
                  class="form-input"
                  id="input-overhead-name"
                />
              </div>

              <div>
                <label class="form-label">Currency <span class="text-danger">*</span></label>
                <select v-model="form.currency" class="form-select" id="select-overhead-currency">
                  <option v-for="c in currencyOptions" :key="c" :value="c">
                    {{ c }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="form-label">Amount ({{ form.currency }}) <span class="text-danger">*</span></label>
                <input
                  v-model.number="form.amount"
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="e.g. 120.00"
                  class="form-input"
                  id="input-overhead-amount"
                />
              </div>

              <div>
                <label class="form-label">Expense Recurrence <span class="text-danger">*</span></label>
                <select v-model="form.frequency" class="form-select" id="select-overhead-frequency">
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                  <option value="yearly">Yearly / Annual</option>
                  <option value="one_off">One-Off / One-Time</option>
                </select>
              </div>
            </div>

            <!-- 3. ALLOCATION RULE & SOURCE LINKING -->
            <div class="p-3 bg-tertiary/10 rounded-lg border border-neutral/60 flex flex-col gap-3">
              <div class="fw-600 text-xs text-secondary flex items-center justify-between">
                <span>Cost Allocation Rule</span>
                <span class="text-[11px] text-tertiary">How this cost impacts your net hourly rate</span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  v-for="rule in allocationRuleOptions"
                  :key="rule.key"
                  type="button"
                  class="btn btn-xs"
                  :class="form.allocationRule === rule.key ? 'btn-primary' : 'btn-secondary'"
                  @click="form.allocationRule = rule.key"
                  :id="`btn-overhead-rule-${rule.key}`"
                >
                  {{ rule.label }}
                </button>
              </div>

              <div v-if="form.allocationRule === 'per_source'" class="pt-2">
                <label class="form-label text-xs">Link to Specific Income Source / Employer <span class="text-danger">*</span></label>
                <select
                  v-model="form.incomeSourceId"
                  class="form-select text-xs"
                  required
                  id="select-overhead-income-source"
                >
                  <option value="" disabled>Select Income Source...</option>
                  <option v-for="s in store.incomeSources" :key="s.id" :value="s.id">
                    {{ s.name }} ({{ s.type }})
                  </option>
                </select>
              </div>

              <div class="text-[11px] text-tertiary leading-normal">
                {{ allocationRuleDescription }}
              </div>
            </div>

            <!-- 4. NOTES -->
            <div>
              <label class="form-label text-xs">Notes / Details (Optional)</label>
              <textarea
                v-model="form.notes"
                rows="2"
                placeholder="Optional notes or receipt references..."
                class="form-input text-xs"
                id="input-overhead-notes"
              ></textarea>
            </div>

            <div class="modal-footer flex items-center justify-between pt-2">
              <button
                type="button"
                class="btn btn-ghost text-xs"
                @click="$emit('close')"
                id="btn-cancel-overhead"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="isSubmitting"
                id="btn-submit-overhead"
              >
                <span v-if="isSubmitting">Saving...</span>
                <span v-else>{{ isEdit ? 'Update Overhead' : 'Save Overhead' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const props = defineProps({
  overhead: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['close', 'saved'])
const store = useWelloStore()
const toast = useToast()

const isEdit = computed(() => !!props.overhead?.id)
const isSubmitting = ref(false)

const currencyOptions = ['USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'INR', 'JPY', 'CHF', 'SGD']

const categoryOptions = [
  { key: 'commute', label: 'Commute & Travel', icon: '🚆', desc: 'Transit passes, fuel, tolls, parking' },
  { key: 'tool', label: 'Tools & Hardware', icon: '🔨', desc: 'Work equipment, hand tools, hardware' },
  { key: 'software', label: 'Software & SaaS', icon: '💻', desc: 'Subscriptions, IDEs, design tools' },
  { key: 'phone_internet', label: 'Phone & Internet', icon: '📱', desc: 'Cellular plans, broadband, data' },
  { key: 'equipment', label: 'Equipment & Rig', icon: '🎧', desc: 'Computers, monitors, office furniture' },
  { key: 'uniform', label: 'Uniform & Safety', icon: '🦺', desc: 'Protective gear, apparel, boots' },
  { key: 'license', label: 'Licenses & Fees', icon: '📜', desc: 'Certifications, memberships, permits' },
  { key: 'other', label: 'Other Overhead', icon: '📦', desc: 'General non-project business overhead' },
]

const allocationRuleOptions = [
  { key: 'per_hour_worked', label: 'Per Hour Worked' },
  { key: 'per_period', label: 'Per Period' },
  { key: 'per_source', label: 'Per Income Source' },
  { key: 'none', label: 'Unallocated (Record only)' },
]

const form = reactive({
  name: props.overhead?.name || '',
  category: props.overhead?.category || 'commute',
  amount: props.overhead?.amount != null ? Number(props.overhead.amount) : '',
  currency: props.overhead?.currency || store.currency || 'USD',
  frequency: props.overhead?.frequency || 'monthly',
  allocationRule: props.overhead?.allocationRule || 'per_hour_worked',
  incomeSourceId: props.overhead?.incomeSourceId || '',
  notes: props.overhead?.notes || '',
})

const allocationRuleDescription = computed(() => {
  switch (form.allocationRule) {
    case 'per_hour_worked':
      return 'Deducts a distributed hourly cost slice across all active work hours recorded in this period.'
    case 'per_period':
      return 'Deducts the flat cost directly from your total net earnings for the selected period.'
    case 'per_source':
      return 'Allocates and deducts this expense exclusively against the selected employer/income source.'
    case 'none':
    default:
      return 'Tracks the expense for records without automatically factoring it into your effective hourly rate.'
  }
})

async function handleSubmit() {
  if (!form.name || !form.amount) {
    toast.error('Please specify the expense name and amount.')
    return
  }

  if (form.allocationRule === 'per_source' && !form.incomeSourceId) {
    toast.error('Please select an income source to link this expense.')
    return
  }

  isSubmitting.value = true
  try {
    const payload = {
      name: form.name,
      category: form.category,
      amount: form.amount,
      currency: form.currency,
      frequency: form.frequency,
      allocationRule: form.allocationRule,
      incomeSourceId: form.allocationRule === 'per_source' ? form.incomeSourceId : null,
      notes: form.notes || null,
    }

    if (isEdit.value) {
      await store.updateOverhead(props.overhead.id, payload)
      toast.success('Overhead expense updated.')
    } else {
      await store.createOverhead(payload)
      toast.success('Overhead expense added.')
    }

    emit('saved')
    emit('close')
  } catch (err) {
    console.error('Failed to save overhead:', err)
    toast.error(err?.data?.message || err?.message || 'Failed to save overhead expense.')
  } finally {
    isSubmitting.value = false
  }
}
</script>
