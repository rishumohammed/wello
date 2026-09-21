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
                class="p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between"
                :class="selectedPersona === p.key ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary' : 'border-neutral hover:border-secondary bg-surface'"
                @click="selectedPersona = p.key"
                :id="`btn-persona-${p.key}`"
              >
                <div>
                  <div class="flex items-center justify-between mb-1.5">
                    <span class="text-2xl">{{ p.icon }}</span>
                    <span v-if="selectedPersona === p.key" class="badge badge-primary text-2xs font-bold">Selected</span>
                  </div>
                  <div class="fw-700 text-sm text-primary mb-1">{{ p.title }}</div>
                  <div class="text-xs text-tertiary leading-normal">{{ p.description }}</div>
                </div>

                <div class="mt-3 pt-2 border-t border-neutral/60 text-[11px] text-secondary flex items-center gap-1.5">
                  <span class="text-primary font-bold">Key features:</span>
                  <span>{{ p.highlights }}</span>
                </div>
              </div>
            </div>

            <!-- Overhead Inclusion Option -->
            <div class="p-4 bg-tertiary/10 rounded-xl border border-neutral/60 flex items-center justify-between gap-4 flex-wrap">
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
