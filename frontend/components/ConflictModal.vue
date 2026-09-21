<template>
  <div v-if="conflict" class="modal-overlay" @click.self="dismiss">
    <div class="modal conflict-modal animate-slide-up" role="dialog" aria-modal="true" id="conflict-modal">
      <div class="modal-header bg-warning-subtle">
        <div class="flex items-center gap-2">
          <div class="conflict-alert-icon">⚠️</div>
          <div>
            <h3 class="modal-title text-warning-dark">Sync Conflict Detected</h3>
            <p class="modal-subtitle">A financial record was modified on another device.</p>
          </div>
        </div>
        <button type="button" class="modal-close-btn" @click="dismiss" aria-label="Close">✕</button>
      </div>

      <div class="modal-body">
        <div class="conflict-card-grid">
          <!-- Server Version -->
          <div class="conflict-side-card server-version">
            <div class="conflict-side-header">
              <span class="badge badge-server">Server Version</span>
              <span class="text-2xs text-tertiary">{{ formatTimestamp(conflict.serverRecord?.updatedAt) }}</span>
            </div>
            <div class="conflict-details">
              <div class="conflict-detail-row">
                <span class="label">Amount:</span>
                <span class="val fw-700 text-primary">{{ conflict.serverRecord?.currency }} {{ conflict.serverRecord?.amount }}</span>
              </div>
              <div class="conflict-detail-row" v-if="conflict.serverRecord?.notes">
                <span class="label">Notes:</span>
                <span class="val text-secondary">{{ conflict.serverRecord?.notes }}</span>
              </div>
            </div>
          </div>

          <!-- Local Offline Version -->
          <div class="conflict-side-card local-version">
            <div class="conflict-side-header">
              <span class="badge badge-local">Your Offline Change</span>
              <span class="text-2xs text-tertiary">Pending Local Outbox</span>
            </div>
            <div class="conflict-details">
              <div class="conflict-detail-row">
                <span class="label">Amount:</span>
                <span class="val fw-700 text-sunrise">{{ conflict.clientPayload?.currency || conflict.serverRecord?.currency }} {{ conflict.clientPayload?.amount }}</span>
              </div>
              <div class="conflict-detail-row" v-if="conflict.clientPayload?.notes">
                <span class="label">Notes:</span>
                <span class="val text-secondary">{{ conflict.clientPayload?.notes }}</span>
              </div>
            </div>
          </div>
        </div>

        <p class="text-xs text-secondary mt-3">
          Choose how you want to resolve this conflict. Money rows are never automatically overwritten to protect your financial records.
        </p>
      </div>

      <div class="modal-footer flex-col sm:flex-row gap-2">
        <button
          type="button"
          class="btn btn-secondary w-full sm:w-auto text-xs"
          @click="resolveKeepServer"
          id="btn-conflict-keep-server"
        >
          Accept Server Version
        </button>
        <button
          type="button"
          class="btn btn-outline-sunrise w-full sm:w-auto text-xs"
          @click="resolveKeepBoth"
          id="btn-conflict-keep-both"
        >
          Keep Both Entries
        </button>
        <button
          type="button"
          class="btn btn-primary w-full sm:w-auto text-xs"
          @click="resolveKeepLocal"
          id="btn-conflict-keep-local"
        >
          Keep My Version
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useWelloStore } from '~/stores/wello'

const store = useWelloStore()
const conflict = computed(() => store.activeConflict)

function formatTimestamp(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function dismiss() {
  store.dismissConflict()
}

async function resolveKeepServer() {
  if (conflict.value) {
    await store.resolveConflict(conflict.value, 'ACCEPT_SERVER')
  }
}

async function resolveKeepLocal() {
  if (conflict.value) {
    await store.resolveConflict(conflict.value, 'KEEP_LOCAL')
  }
}

async function resolveKeepBoth() {
  if (conflict.value) {
    await store.resolveConflict(conflict.value, 'KEEP_BOTH')
  }
}
</script>

<style scoped>
.conflict-modal {
  max-width: 540px;
}
.conflict-alert-icon {
  font-size: 24px;
}
.bg-warning-subtle {
  background: rgba(245, 158, 11, 0.08);
}
.text-warning-dark {
  color: #B45309;
}
.conflict-card-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 480px) {
  .conflict-card-grid {
    grid-template-columns: 1fr;
  }
}
.conflict-side-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px;
  background: var(--surface-card);
}
.conflict-side-card.server-version {
  border-left: 4px solid var(--color-blue);
}
.conflict-side-card.local-version {
  border-left: 4px solid var(--color-sunrise);
}
.conflict-side-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.badge-server {
  background: rgba(0, 123, 255, 0.1);
  color: var(--color-blue);
}
.badge-local {
  background: rgba(255, 159, 28, 0.15);
  color: #D97706;
}
.conflict-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.conflict-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.conflict-detail-row .label {
  color: var(--text-tertiary);
}
</style>
