<template>
  <div
    v-if="showBanner"
    class="pwa-install-banner animate-slide-up"
    id="pwa-install-banner"
  >
    <div class="pwa-banner-content">
      <div class="pwa-banner-icon">
        <img src="/icons/icon-192x192.png" alt="Wello" class="w-10 h-10 rounded-xl" />
      </div>
      <div class="pwa-banner-text">
        <div class="fw-700 text-xs text-primary">Install Wello App</div>
        <div class="text-2xs text-tertiary">1-tap timer, instant launch & 100% offline mode</div>
      </div>
    </div>
    <div class="pwa-banner-actions">
      <button
        type="button"
        class="btn btn-primary btn-sm text-xs h-32 px-3 fw-600"
        @click="handleInstall"
        id="btn-pwa-install"
      >
        Install
      </button>
      <button
        type="button"
        class="pwa-dismiss-btn"
        @click="dismiss"
        aria-label="Dismiss install banner"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { deferredInstallPrompt, isPwaInstallable, isPwaInstalled } from '~/plugins/pwa.client'

const isDismissed = ref(false)

onMounted(() => {
  if (typeof window !== 'undefined') {
    isDismissed.value = sessionStorage.getItem('wello_pwa_banner_dismissed') === 'true'
  }
})

const showBanner = computed(() => {
  return isPwaInstallable.value && !isPwaInstalled.value && !isDismissed.value
})

async function handleInstall() {
  if (deferredInstallPrompt.value) {
    try {
      deferredInstallPrompt.value.prompt()
      const choiceResult = await deferredInstallPrompt.value.userChoice
      if (choiceResult.outcome === 'accepted') {
        console.log('[Wello PWA] User accepted the install prompt')
      }
      deferredInstallPrompt.value = null
      isPwaInstallable.value = false
    } catch (err) {
      console.warn('[Wello PWA] Install prompt error:', err)
    }
  }
}

function dismiss() {
  isDismissed.value = true
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('wello_pwa_banner_dismissed', 'true')
  }
}
</script>

<style scoped>
.pwa-install-banner {
  position: fixed;
  bottom: 74px;
  left: 12px;
  right: 12px;
  max-width: 480px;
  margin: 0 auto;
  background: var(--surface-card);
  border: 1px solid rgba(255, 159, 28, 0.3);
  border-radius: var(--radius-lg);
  padding: 10px 14px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 4px 10px -2px rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  z-index: 900;
  backdrop-filter: blur(12px);
}
@media (min-width: 769px) {
  .pwa-install-banner {
    bottom: 24px;
    right: 24px;
    left: auto;
    width: 360px;
  }
}
.pwa-banner-content {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pwa-banner-icon img {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
.pwa-banner-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pwa-dismiss-btn {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: 13px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pwa-dismiss-btn:hover {
  color: var(--text-primary);
}
</style>
