<template>
  <ClientOnly>
    <Teleport to="body">
      <div class="modal-overlay" @click.self="$emit('close')" id="modal-persona-overlay">
        <div class="modal modal-lg" id="modal-persona" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div>
              <div class="modal-title">Choose Your Earning Persona</div>
              <div class="modal-subtitle">
                Customize Wello's dashboard, terminology, and tracking tools to match how you earn
              </div>
            </div>
            <button class="modal-close" @click="$emit('close')" id="btn-close-persona-modal" aria-label="Close">
              <IconX />
            </button>
          </div>

          <form @submit.prevent="handleSave" class="modal-body flex flex-col gap-5">
            <!-- Persona Cards Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="p in personas"
                :key="p.key"
                class="persona-select-card"
                :class="{ selected: selectedPersona === p.key }"
                @click="selectedPersona = p.key"
                :id="`btn-persona-${p.key}`"
              >
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-2xl">{{ p.icon }}</span>
                    <span v-if="selectedPersona === p.key" class="badge badge-purple text-2xs font-bold">Selected</span>
                  </div>
                  <div class="fw-700 text-sm text-primary mb-1">{{ p.title }}</div>
                  <div class="text-xs text-tertiary leading-normal">{{ p.description }}</div>
                </div>

                <div class="persona-highlight-row">
                  <span class="text-primary font-bold">Key features:</span>
                  <span>{{ p.highlights }}</span>
                </div>
              </div>
            </div>

            <!-- Overhead Inclusion Option -->
            <div class="overhead-toggle-box">
              <div>
                <div class="fw-700 text-sm text-primary flex items-center gap-1.5">
                  <span>Factor Overhead Costs into Effective Hourly Rate</span>
                </div>
                <div class="text-xs text-tertiary mt-0.5">
                  Automatically deduct commute, software, tool, and equipment costs from your net rate calculations
                </div>
              </div>
              <label class="toggle-switch">
                <input
                  v-model="includeOverhead"
                  type="checkbox"
                  id="toggle-persona-overhead"
                />
                <span class="toggle-slider"></span>
              </label>
            </div>

            <div class="modal-footer flex items-center justify-between pt-2">
              <button
                type="button"
                class="btn btn-ghost text-xs"
                @click="$emit('close')"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="isSaving"
                id="btn-save-persona"
              >
                <span v-if="isSaving">Saving...</span>
                <span v-else>Save Preference</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'

const emit = defineEmits(['close', 'saved'])
const store = useWelloStore()
const toast = useToast()

const isSaving = ref(false)
const selectedPersona = ref(store.user?.earningPersona || 'freelancer_projects')
const includeOverhead = ref(store.user?.includeOverheadInMetrics ?? true)

const personas = [
  {
    key: 'freelancer_projects',
    icon: '💼',
    title: 'Freelancer / Project-Based',
    description: 'For designers, developers, and consultants working with multiple clients, quotes, and project deliverables.',
    highlights: 'Project quotes, milestone payments, unpaid discovery time',
  },
  {
    key: 'salaried',
    icon: '🏢',
    title: 'Salaried Employee',
    description: 'For full-time professionals with fixed monthly salaries looking to uncover their true rate after commute and unpaid hours.',
    highlights: 'True salaried rate, commute drag, recurring pay cycle',
  },
  {
    key: 'daily_hourly_wage',
    icon: '⏱️',
    title: 'Daily & Hourly Worker',
    description: 'For tradespeople, contractors, tutors, and technicians working with several employers across daily or hourly shifts.',
    highlights: '2-tap quick entry, multi-employer comparison, shift tracking',
  },
  {
    key: 'gig_retainer',
    icon: '🛵',
    title: 'Gig Worker & Retainers',
    description: 'For couriers, drivers, creators, and consultants on recurring retainers or dynamic platform tasks.',
    highlights: 'Platform comparison, instant earnings, recurring retainers',
  },
  {
    key: 'mixed_hybrid',
    icon: '⚡',
    title: 'Mixed / Hybrid Portfolio',
    description: 'For hybrid earners combining a salaried base, side freelancing gigs, and monthly retainers.',
    highlights: 'Unified metrics, multi-source breakdown, all-in returns',
  },
]

async function handleSave() {
  isSaving.value = true
  try {
    await store.updateEarningPersona(selectedPersona.value, includeOverhead.value)
    toast.success('Earning persona and preferences updated!')
    emit('saved')
    emit('close')
  } catch (err) {
    console.error('Failed to update persona:', err)
    toast.error(err?.data?.message || err?.message || 'Failed to update earning persona.')
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.persona-select-card {
  background: var(--color-off-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  transition: all var(--transition-apple-ease);
}

.persona-select-card:hover {
  background: var(--color-white);
  border-color: rgba(122, 63, 246, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.05);
}

.persona-select-card.selected {
  background: rgba(122, 63, 246, 0.05);
  border-color: var(--color-purple);
  box-shadow: 0 0 0 2px rgba(122, 63, 246, 0.2);
}

.persona-highlight-row {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.overhead-toggle-box {
  padding: 16px;
  background: var(--color-off-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
</style>
