<template>
  <div class="connectivity-badge-wrap">
    <!-- Sync Conflict Alert -->
    <div
      v-if="store.activeConflict"
      class="conflict-badge-pill animate-pulse"
      id="conflict-badge"
      title="Click to resolve sync conflict"
      @click="openConflictModal"
    >
      <span class="conflict-dot">!</span>
      <span>Conflict</span>
    </div>

    <!-- Offline Mode Badge -->
    <div
      v-else-if="store.isOffline"
      class="offline-badge-pill"
      id="offline-badge"
      :title="`Offline Mode. ${store.pendingOutboxCount} changes queued.`"
    >
      <span class="offline-pulse-dot"></span>
      <span>Offline<template v-if="store.pendingOutboxCount > 0"> ({{ store.pendingOutboxCount }})</template></span>
    </div>

    <!-- Active Syncing Spinner -->
    <div
      v-else-if="store.isSyncing"
      class="sync-status-pill"
      id="syncing-indicator"
      title="Synchronizing with server"
    >
      <span class="sync-spinner"></span>
      <span>Syncing...</span>
    </div>

    <!-- Pending Changes Ready to Sync -->
    <div
      v-else-if="store.pendingOutboxCount > 0"
      class="pending-sync-pill"
      id="pending-sync-badge"
      title="Click to manually sync pending changes"
      @click="manualSync"
    >
      <span class="pending-sync-dot"></span>
      <span>Sync ({{ store.pendingOutboxCount }})</span>
    </div>
  </div>
</template>

<script setup>
import { useWelloStore } from '~/stores/wello'

const store = useWelloStore()

function manualSync() {
  store.flushOutbox()
}

function openConflictModal() {
  // Conflict modal is automatically rendered if store.activeConflict is non-null
}
</script>

<style scoped>
.connectivity-badge-wrap {
  display: flex;
  align-items: center;
}

.offline-badge-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #D97706;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  min-height: 28px;
}

.offline-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #F59E0B;
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
  animation: pulse-dot 1.8s infinite;
}

.sync-status-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 123, 255, 0.1);
  border: 1px solid rgba(0, 123, 255, 0.25);
  color: var(--color-blue);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  min-height: 28px;
}

.sync-spinner {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(0, 123, 255, 0.3);
  border-top-color: var(--color-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.pending-sync-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(122, 63, 246, 0.1);
  border: 1px solid rgba(122, 63, 246, 0.3);
  color: var(--color-purple);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  min-height: 28px;
  cursor: pointer;
}

.pending-sync-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-purple);
}

.conflict-badge-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: var(--color-error);
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: var(--radius-full);
  min-height: 28px;
  cursor: pointer;
}

.conflict-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-error);
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}
</style>
