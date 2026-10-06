<template>
  <div
    v-if="isVisible"
    class="tour-card animate-fade-in"
    id="card-first-run-tour"
  >
    <!-- Background subtle ambient glow -->
    <div class="tour-glow-bg"></div>

    <!-- Header & Progress Stats -->
    <div class="tour-header">
      <div class="tour-title-wrap">
        <div class="tour-rocket-box">
          <span>🚀</span>
        </div>
        <div>
          <h3 class="tour-heading">Getting Started with Wello</h3>
          <p class="tour-subheading">Complete these 4 quick steps to unlock your full effective rate analytics</p>
        </div>
      </div>

      <div class="tour-actions-wrap">
        <span class="tour-counter-badge">{{ completedCount }}/4 Completed</span>
        <button
          class="tour-dismiss-btn"
          @click="dismissTour"
          id="btn-dismiss-tour"
          title="Dismiss onboarding checklist"
        >
          Dismiss &times;
        </button>
      </div>
    </div>

    <!-- Progress Track Bar -->
    <div class="tour-progress-track">
      <div
        class="tour-progress-fill"
        :style="{ width: `${(completedCount / 4) * 100}%` }"
      ></div>
    </div>

    <!-- 4 Checklist Items Grid -->
    <div class="tour-steps-grid">
      <div
        v-for="step in steps"
        :key="step.id"
        class="tour-step-card"
        :class="{ 'is-done': step.isDone }"
      >
        <div class="tour-step-header">
          <div class="tour-step-icon-box" :class="step.iconClass">
            <component :is="step.iconComponent" :size="16" />
          </div>
          <span
            class="tour-status-pill"
            :class="step.isDone ? 'done' : 'pending'"
          >
            {{ step.isDone ? '✓ Done' : 'Pending' }}
          </span>
        </div>

        <div class="tour-step-content">
          <div class="tour-step-title">{{ step.title }}</div>
          <div class="tour-step-desc">{{ step.description }}</div>
        </div>

        <div class="tour-step-footer">
          <NuxtLink
            v-if="!step.isDone && step.link"
            :to="step.link"
            class="tour-step-link"
          >
            <span>{{ step.actionText }}</span>
            <span class="cta-arrow">→</span>
          </NuxtLink>
          <span v-else class="tour-step-completed-text">
            <span>Completed</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import IconUser from '~/components/IconUser.vue'
import IconFolders from '~/components/IconFolders.vue'
import IconClock from '~/components/IconClock.vue'
import IconReceipt from '~/components/IconReceipt.vue'

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
    iconComponent: IconUser,
    iconClass: 'purple',
    title: '1. Regional & Earning Model',
    description: 'Set your timezone, currency, and earning persona.',
    isDone: Boolean(store.user?.onboardingCompletedAt || store.user?.timezone),
    link: '/settings',
    actionText: 'Configure Baseline',
  },
  {
    id: 'client',
    iconComponent: IconFolders,
    iconClass: 'sunrise',
    title: '2. Create First Client / Project',
    description: 'Organize your work with clients and proposals.',
    isDone: (store.clients?.length || 0) > 0 || (store.projects?.length || 0) > 0,
    link: '/work',
    actionText: 'Add Client/Project',
  },
  {
    id: 'session',
    iconComponent: IconClock,
    iconClass: 'blue',
    title: '3. Track Your First Work Hour',
    description: 'Start a live timer or log a completed session.',
    isDone: (store.sessions?.length || 0) > 0,
    link: '/work',
    actionText: 'Start Live Timer',
  },
  {
    id: 'invoicing',
    iconComponent: IconReceipt,
    iconClass: 'pink',
    title: '4. Rate & Invoice Intelligence',
    description: 'Issue invoices and reveal true hourly rate yields.',
    isDone: (store.payments?.length || 0) > 0 || (store.expectedPayments?.length || 0) > 0,
    link: '/invoicing',
    actionText: 'Explore Invoicing',
  },
])

const completedCount = computed(() => steps.value.filter((s) => s.isDone).length)
const isVisible = computed(() => !isDismissed.value && completedCount.value < 4)
</script>

<style scoped>
.tour-card {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: 20px 24px;
  box-shadow: var(--shadow-sm);
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
  transition: all var(--transition-apple-ease);
}

.tour-glow-bg {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, rgba(255, 159, 28, 0.08) 0%, rgba(122, 63, 246, 0.06) 50%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}

.tour-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.tour-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tour-rocket-box {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgba(255, 159, 28, 0.15) 0%, rgba(255, 56, 125, 0.12) 100%);
  border: 1px solid rgba(255, 159, 28, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.tour-heading {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.2px;
  margin: 0;
}

.tour-subheading {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 2px 0 0 0;
}

.tour-actions-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tour-counter-badge {
  font-size: 11px;
  font-weight: 700;
  color: var(--color-purple);
  background: rgba(122, 63, 246, 0.08);
  border: 1px solid rgba(122, 63, 246, 0.2);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  letter-spacing: 0.2px;
}

.tour-dismiss-btn {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.tour-dismiss-btn:hover {
  color: var(--text-primary);
  background: var(--color-off-white);
}

.tour-progress-track {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 6px;
  background: var(--color-soft-gray);
  border-radius: var(--radius-full);
  overflow: hidden;
  margin-bottom: 18px;
}

.tour-progress-fill {
  height: 100%;
  background: var(--grad-brand);
  border-radius: var(--radius-full);
  transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.tour-steps-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 992px) {
  .tour-steps-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .tour-steps-grid {
    grid-template-columns: 1fr;
  }
}

.tour-step-card {
  background: var(--color-off-white);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  transition: all var(--transition-apple-ease);
  position: relative;
}

.tour-step-card:hover {
  background: var(--color-white);
  border-color: rgba(122, 63, 246, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(17, 24, 39, 0.05);
}

.tour-step-card.is-done {
  background: rgba(16, 185, 129, 0.03);
  border-color: rgba(16, 185, 129, 0.25);
}

.tour-step-card.is-done:hover {
  background: rgba(16, 185, 129, 0.06);
  border-color: rgba(16, 185, 129, 0.4);
}

.tour-step-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tour-step-icon-box {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tour-step-icon-box.purple  { background: rgba(122, 63, 246, 0.1); color: var(--color-purple); }
.tour-step-icon-box.sunrise { background: rgba(255, 159, 28, 0.12); color: #FF9F1C; }
.tour-step-icon-box.blue    { background: rgba(0, 123, 255, 0.1); color: #007BFF; }
.tour-step-icon-box.pink    { background: rgba(255, 56, 125, 0.1); color: #FF387D; }

.tour-status-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  letter-spacing: 0.2px;
}

.tour-status-pill.done {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.tour-status-pill.pending {
  background: rgba(107, 114, 128, 0.08);
  color: #6B7280;
  border: 1px solid rgba(107, 114, 128, 0.18);
}

.tour-step-content {
  flex: 1;
}

.tour-step-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.35;
  margin-bottom: 4px;
}

.tour-step-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.45;
}

.tour-step-footer {
  margin-top: auto;
  padding-top: 6px;
}

.tour-step-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-purple);
  text-decoration: none;
  transition: all var(--transition-fast);
}

.tour-step-link:hover {
  color: var(--color-pink);
}

.tour-step-link:hover .cta-arrow {
  transform: translateX(3px);
}

.cta-arrow {
  display: inline-block;
  transition: transform var(--transition-fast);
}

.tour-step-completed-text {
  font-size: 11px;
  font-weight: 600;
  color: #059669;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
