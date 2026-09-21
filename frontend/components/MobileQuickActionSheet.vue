<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="close">
    <div class="modal mobile-quick-sheet animate-slide-up" role="dialog" aria-modal="true" id="mobile-quick-action-sheet">
      <div class="sheet-pull-bar"></div>
      
      <div class="sheet-header">
        <h3 class="sheet-title">Quick Action</h3>
        <button type="button" class="sheet-close-btn" @click="close" aria-label="Close">✕</button>
      </div>

      <div class="sheet-actions-grid">
        <button
          type="button"
          class="sheet-action-btn action-timer"
          @click="handleAction('timer')"
          id="sheet-action-timer"
        >
          <div class="action-icon-circle bg-sunrise-subtle">
            <IconClock :size="22" class="text-sunrise" />
          </div>
          <div class="action-text">
            <span class="action-name">Start Timer</span>
            <span class="action-desc">Track billable work in real-time</span>
          </div>
        </button>

        <button
          type="button"
          class="sheet-action-btn action-session"
          @click="handleAction('session')"
          id="sheet-action-session"
        >
          <div class="action-icon-circle bg-purple-subtle">
            <IconBriefcase :size="22" class="text-purple" />
          </div>
          <div class="action-text">
            <span class="action-name">Log Work Session</span>
            <span class="action-desc">Manual time entry with unpaid breakdown</span>
          </div>
        </button>

        <button
          type="button"
          class="sheet-action-btn action-payment"
          @click="handleAction('payment')"
          id="sheet-action-payment"
        >
          <div class="action-icon-circle bg-success-subtle">
            <IconReceipt :size="22" class="text-success" />
          </div>
          <div class="action-text">
            <span class="action-name">Record Payment</span>
            <span class="action-desc">Log income received from client</span>
          </div>
        </button>

        <button
          type="button"
          class="sheet-action-btn action-expense"
          @click="handleAction('expense')"
          id="sheet-action-expense"
        >
          <div class="action-icon-circle bg-danger-subtle">
            <IconReceipt :size="22" class="text-danger" />
          </div>
          <div class="action-text">
            <span class="action-name">Record Expense</span>
            <span class="action-desc">Direct cost or business overhead</span>
          </div>
        </button>

        <button
          type="button"
          class="sheet-action-btn action-invoice"
          @click="handleAction('invoice')"
          id="sheet-action-invoice"
        >
          <div class="action-icon-circle bg-blue-subtle">
            <IconFileText :size="22" class="text-blue" />
          </div>
          <div class="action-text">
            <span class="action-name">New Invoice</span>
            <span class="action-desc">Create and send invoice to client</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import IconClock from '~/components/IconClock.vue'
import IconBriefcase from '~/components/IconBriefcase.vue'
import IconReceipt from '~/components/IconReceipt.vue'
import IconFileText from '~/components/IconFileText.vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close', 'trigger'])

function close() {
  emit('close')
}

function handleAction(type) {
  emit('trigger', type)
  close()
}
</script>

<style scoped>
.mobile-quick-sheet {
  max-width: 480px;
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  padding: 12px 16px 24px;
}
.sheet-pull-bar {
  width: 36px;
  height: 4px;
  background: var(--color-gray-300);
  border-radius: var(--radius-full);
  margin: 0 auto 12px;
}
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.sheet-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.sheet-close-btn {
  background: transparent;
  border: none;
  font-size: 16px;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  min-height: 44px;
  min-width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-actions-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.sheet-action-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background: var(--surface-card);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-apple-fast);
  min-height: 56px;
}
.sheet-action-btn:hover,
.sheet-action-btn:active {
  background: var(--color-off-white);
  border-color: var(--color-sunrise);
  transform: translateY(-1px);
}
.action-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bg-sunrise-subtle { background: rgba(255, 159, 28, 0.12); }
.bg-purple-subtle { background: rgba(122, 63, 246, 0.12); }
.bg-success-subtle { background: rgba(16, 185, 129, 0.12); }
.bg-danger-subtle { background: rgba(239, 68, 68, 0.12); }
.bg-blue-subtle { background: rgba(0, 123, 255, 0.12); }
.text-sunrise { color: var(--color-sunrise); }
.text-purple { color: var(--color-purple); }
.text-success { color: var(--color-success); }
.text-danger { color: var(--color-danger); }
.text-blue { color: var(--color-blue); }
.action-text {
  display: flex;
  flex-direction: column;
}
.action-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.action-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 1px;
}
</style>
