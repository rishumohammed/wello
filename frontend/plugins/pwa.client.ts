// frontend/plugins/pwa.client.ts
import { defineNuxtPlugin } from '#app'
import { ref } from 'vue'

export const deferredInstallPrompt = ref<any>(null)
export const isPwaInstallable = ref(false)
export const isPwaInstalled = ref(false)

export default defineNuxtPlugin((nuxtApp) => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  // 1. Register Service Worker
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      console.log('[Wello PWA] Service Worker registered with scope:', reg.scope)
    } catch (err) {
      console.warn('[Wello PWA] Service Worker registration failed:', err)
    }
  })

  // 2. Check standalone / installed mode
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')

  isPwaInstalled.value = isStandalone

  // 3. Capture beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (event: any) => {
    event.preventDefault()
    deferredInstallPrompt.value = event
    isPwaInstallable.value = true

    // Track analytics event
    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: 'pwa_install_prompt_shown' }),
      }).catch(() => {})
    } catch {}
  })

  // 4. Capture appinstalled
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt.value = null
    isPwaInstallable.value = false
    isPwaInstalled.value = true

    try {
      fetch('/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventName: 'pwa_installed' }),
      }).catch(() => {})
    } catch {}
  })
})
