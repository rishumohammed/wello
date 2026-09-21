<template>
  <div
    v-if="isVisible"
    class="card p-5 bg-gradient-to-r from-primary/5 via-surface to-primary/5 border border-primary/20 rounded-2xl animate-fade-in mb-6"
    id="card-first-run-tour"
  >
    <div class="flex items-center justify-between gap-4 mb-3">
      <div class="flex items-center gap-2.5">
        <span class="text-xl">🚀</span>
        <div>
          <h3 class="font-extrabold text-sm text-primary">Getting Started with Wello</h3>
          <p class="text-2xs text-tertiary">Complete these 4 quick steps to unlock your full effective rate analytics</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-xs font-bold text-primary font-mono">{{ completedCount }}/4 Completed</span>
        <button
          class="text-tertiary hover:text-primary text-xs font-semibold"
          @click="dismissTour"
          id="btn-dismiss-tour"
        >
          Dismiss &times;
        </button>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="w-full bg-neutral/40 h-1.5 rounded-full mb-4 overflow-hidden">
      <div
        class="bg-primary h-full transition-all duration-500 rounded-full"
        :style="{ width: `${(completedCount / 4) * 100}%` }"
      ></div>
    </div>

    <!-- 4 Checklist Items Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div
        v-for="step in steps"
        :key="step.id"
        class="p-3 rounded-xl border transition-all text-left flex flex-col justify-between"
        :class="step.isDone ? 'border-success/30 bg-success/5 text-secondary' : 'border-neutral bg-surface hover:border-primary/50'"
      >
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-lg">{{ step.icon }}</span>
            <span
              class="badge text-[10px] font-bold"
              :class="step.isDone ? 'badge-success' : 'badge-secondary'"
            >
              {{ step.isDone ? '✓ Done' : 'Pending' }}
            </span>
          </div>
          <div class="font-bold text-xs text-primary mb-1">{{ step.title }}</div>
          <div class="text-2xs text-tertiary leading-normal">{{ step.description }}</div>
        </div>

        <NuxtLink
          v-if="!step.isDone && step.link"
          :to="step.link"
          class="text-[11px] font-bold text-primary hover:underline mt-3 inline-flex items-center gap-1"
        >
          <span>{{ step.actionText }} &rarr;</span>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'

const store = useWelloStore()
const isDismissed = ref(false)

onMounted(() => {
  if (typeof window !== 'undefined') {
    isDismissed.value = localStorage.getItem('wello_tour_dismissed') === 'true'
  }
})

function dismissTour() {
  isDismissed.value = true
  if (typeof window !== 'undefined') {
    localStorage.setItem('wello_tour_dismissed', 'true')
  }
}

const steps = computed(() => [
  {
    id: 'profile',
    icon: '⚙️',
    title: '1. Regional & Earning Model',
    description: 'Set your timezone, currency, and earning persona.',
    isDone: Boolean(store.user?.onboardingCompletedAt || store.user?.timezone),
    link: '/settings',
    actionText: 'Configure Baseline',
  },
  {
    id: 'client',
    icon: '📁',
    title: '2. Create First Client / Project',
    description: 'Organize your work with clients and proposals.',
    isDone: (store.clients?.length || 0) > 0 || (store.projects?.length || 0) > 0,
    link: '/work',
    actionText: 'Add Client/Project',
  },
  {
    id: 'session',
    icon: '⏱️',
    title: '3. Track Your First Work Hour',
    description: 'Start a live timer or log a completed session.',
    isDone: (store.sessions?.length || 0) > 0,
    link: '/work',
    actionText: 'Start Live Timer',
  },
  {
    id: 'addons',
    icon: '🛒',
    title: '4. Activate Free Store Addons',
    description: 'Invoicing, reports, pricing calculator & retainers.',
    isDone: (store.addons?.filter(a => a.isActivated).length || 0) > 0,
    link: '/store',
    actionText: 'Explore Free Store',
  },
])

const completedCount = computed(() => steps.value.filter((s) => s.isDone).length)
const isVisible = computed(() => !isDismissed.value && completedCount.value < 4)
</script>
