<template>
  <ClientOnly>
    <div
      v-if="isVisible"
      class="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 animate-slide-up p-4.5 rounded-2xl bg-surface/95 backdrop-blur-md border border-neutral/80 shadow-2xl flex flex-col gap-3"
      id="banner-cookie-consent"
      role="dialog"
      aria-live="polite"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">🍪</span>
          <div class="font-bold text-xs text-primary">Your Privacy & Analytics Consent</div>
        </div>
        <button
          class="text-tertiary hover:text-primary text-xs"
          @click="acceptEssential"
          aria-label="Dismiss with essential only"
        >
          &times;
        </button>
      </div>

      <p class="text-2xs text-secondary leading-relaxed">
        Wello uses strictly essential storage to keep you logged in and preserve offline work timers.
        Optional anonymous telemetry helps us build better free features. You can change your choice anytime in
        <NuxtLink to="/privacy" class="text-primary font-bold hover:underline">Privacy Policy</NuxtLink>.
      </p>

      <div class="flex items-center gap-2 justify-end pt-1">
        <button
          type="button"
          class="btn btn-ghost btn-xs text-2xs font-semibold"
          @click="acceptEssential"
          id="btn-consent-essential"
        >
          Essential Only
        </button>
        <button
          type="button"
          class="btn btn-primary btn-xs text-2xs font-bold"
          @click="acceptAll"
          id="btn-consent-accept-all"
        >
          Accept All
        </button>
      </div>
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'

const store = useWelloStore()
const isVisible = ref(false)

onMounted(() => {
  if (typeof window !== 'undefined') {
    const localConsent = localStorage.getItem('wello_cookie_consent')
    if (!localConsent && !store.user?.cookieConsent) {
      isVisible.value = true
    }
  }
})

async function acceptAll() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('wello_cookie_consent', 'accepted')
  }
  isVisible.value = false
  try {
    await store.updatePrivacySettings({
      cookieConsent: 'accepted',
      analyticsConsent: true,
    })
  } catch {}
}

async function acceptEssential() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('wello_cookie_consent', 'essential_only')
  }
  isVisible.value = false
  try {
    await store.updatePrivacySettings({
      cookieConsent: 'essential_only',
      analyticsConsent: false,
    })
  } catch {}
}
</script>
