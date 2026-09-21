<template>
  <div v-if="store.showMigrationPrompt && migrationCounts.total > 0" class="migration-banner" id="migration-banner">
    <div class="migration-banner-left">
      <div class="migration-banner-icon">
        <IconDownload :size="18" />
      </div>
      <div>
        <div class="migration-banner-title">
          Import Legacy Data to Cloud
        </div>
        <div class="migration-banner-desc">
          Found {{ migrationCounts.clients }} clients, {{ migrationCounts.projects }} projects, and {{ migrationCounts.sessions }} work sessions in local browser storage.
        </div>
      </div>
    </div>
    <div class="migration-banner-actions">
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="isMigrating"
        @click="handleDismiss"
        id="dismiss-migration-btn"
      >
        Dismiss
      </button>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="isMigrating"
        @click="handleImport"
        id="import-migration-btn"
      >
        <span v-if="isMigrating" class="sync-spinner mr-1"></span>
        <span>{{ isMigrating ? 'Importing...' : 'Import to Cloud' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'

const store = useWelloStore()
const isMigrating = ref(false)

const migrationCounts = computed(() => {
  const data = store.migrationData || {}
  const clients = data.clients?.length || 0
  const projects = data.projects?.length || 0
  const sessions = data.sessions?.length || 0
  return {
    clients,
    projects,
    sessions,
    total: clients + projects + sessions,
  }
})

async function handleImport() {
  isMigrating.value = true
  try {
    await store.importLegacyData()
  } finally {
    isMigrating.value = false
  }
}

function handleDismiss() {
  store.dismissMigration()
}
</script>
