<template>
  <div>
    <div v-if="store.isOffline" class="offline-badge-pill" id="offline-badge" title="Working from local offline cache">
      <span class="offline-pulse-dot"></span>
      <span>Offline Mode</span>
    </div>
    <div v-else-if="store.isSyncing" class="sync-status-pill" id="syncing-indicator" title="Synchronizing with server">
      <span class="sync-spinner"></span>
      <span>Syncing...</span>
    </div>
  </div>
</template>

<script setup>
import { useWelloStore } from '~/stores/wello'

const store = useWelloStore()
</script>
