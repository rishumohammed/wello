<template>
  <div v-if="authStore.isAuthenticated" class="trial-pill-container">
    <!-- Active Paid Pro Badge -->
    <div
      v-if="billingState.isSubscriptionActive || billingState.isComped"
      class="pro-status-badge"
      @click="openModal"
      title="Wello Pro Active Subscription"
      id="topbar-pro-badge"
    >
      <span class="pro-sparkle">💎</span>
      <span class="pro-label">Wello Pro</span>
      <span v-if="billingState.subscription?.cancelAtPeriodEnd" class="pro-cancelling-tag">Cancels soon</span>
    </div>

    <!-- Active Trial Countdown Pill -->
    <div
      v-else-if="billingState.isTrialActive"
      class="trial-countdown-pill"
      :class="{ 'warning-near': billingState.daysLeftInTrial <= 10 }"
      @click="openModal"
      title="Click to view subscription & upgrade"
      id="topbar-trial-pill"
    >
      <span class="trial-icon">{{ billingState.daysLeftInTrial <= 10 ? '⏳' : '✨' }}</span>
      <span class="trial-text">
        <strong>{{ billingState.daysLeftInTrial }}d</strong> trial left
      </span>
      <span class="trial-cta-btn">Upgrade</span>
    </div>

    <!-- Expired Trial Pill -->
    <div
      v-else
      class="trial-expired-pill"
      @click="openModal"
      title="Trial expired. Subscribe to continue tracking work."
      id="topbar-expired-pill"
    >
      <span class="trial-icon">⚠️</span>
      <span class="trial-text">Trial Expired</span>
      <span class="trial-cta-btn">Subscribe</span>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useWelloStore } from '~/stores/wello'

const authStore = useAuthStore()
const welloStore = useWelloStore()

const billingState = computed(() => welloStore.billing || {
  status: 'trialing',
  isTrialActive: true,
  isSubscriptionActive: false,
  isComped: false,
  daysLeftInTrial: 90,
  plan: { baseAmount: 1.00, taxAmount: 0.18, gatewayFeeAmount: 0.03, amount: 1.21, currency: 'USD' },
})

function openModal() {
  welloStore.showPaywallModal = true
}

onMounted(() => {
  if (authStore.isAuthenticated) {
    welloStore.fetchBillingStatus().catch(() => {})
  }
})
</script>

<style scoped>
.trial-pill-container {
  display: inline-flex;
  align-items: center;
}

.pro-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, rgba(255, 159, 28, 0.12) 0%, rgba(122, 63, 246, 0.12) 100%);
  border: 1px solid rgba(122, 63, 246, 0.3);
  color: var(--color-purple);
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-xs);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-apple-ease);
  box-shadow: 0 1px 3px rgba(122, 63, 246, 0.1);
}

.pro-status-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(122, 63, 246, 0.2);
  border-color: var(--color-purple);
}

.pro-sparkle {
  font-size: 11px;
}

.pro-cancelling-tag {
  font-size: 10px;
  font-weight: 600;
  background: rgba(245, 158, 11, 0.15);
  color: #D97706;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  margin-left: 2px;
}

.trial-countdown-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-off-white);
  border: 1px solid var(--border-color);
  padding: 4px 8px 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-xs);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-apple-ease);
}

.trial-countdown-pill:hover {
  background: var(--color-white);
  border-color: var(--color-purple);
  box-shadow: var(--shadow-xs);
  transform: translateY(-1px);
}

.trial-countdown-pill.warning-near {
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.3);
  color: #B45309;
}

.trial-icon {
  font-size: 12px;
  flex-shrink: 0;
}

.trial-text {
  font-size: var(--font-xs);
  font-weight: 500;
  white-space: nowrap;
}

.trial-text strong {
  font-weight: 700;
  color: var(--color-purple);
}

.warning-near .trial-text strong {
  color: #D97706;
}

.trial-cta-btn {
  background: var(--grad-brand);
  color: var(--color-white);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2px;
  box-shadow: 0 1px 4px rgba(122, 63, 246, 0.25);
}

.trial-expired-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--color-error);
  padding: 4px 8px 4px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-xs);
  font-weight: 700;
  cursor: pointer;
  transition: all var(--transition-apple-ease);
  animation: pulse-border 2s infinite;
}

.trial-expired-pill:hover {
  background: rgba(239, 68, 68, 0.15);
  transform: translateY(-1px);
}

.trial-expired-pill .trial-cta-btn {
  background: var(--color-error);
}

@keyframes pulse-border {
  0%, 100% { border-color: rgba(239, 68, 68, 0.3); }
  50% { border-color: rgba(239, 68, 68, 0.7); }
}
</style>
