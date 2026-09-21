<template>
  <div v-if="store.showAddonModal" class="modal-overlay animate-fade-in" @click.self="closeModal">
    <div class="modal-card max-w-md animate-scale-up" id="addon-activation-modal">
      <div class="modal-header flex items-center justify-between border-b pb-3 mb-4">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
            <IconPackage :size="18" />
          </div>
          <div>
            <h3 class="modal-title font-bold text-base text-primary">Activate Free Addon</h3>
            <p class="text-xs text-tertiary">Official Wello Modular Platform</p>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm p-1 text-tertiary hover:text-primary" @click="closeModal">
          <IconX :size="18" />
        </button>
      </div>

      <div class="modal-body flex flex-col gap-4 py-2">
        <div class="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div class="flex items-center justify-between mb-2">
            <span class="font-extrabold text-sm text-primary">{{ store.addonModalData.name || 'Wello Addon' }}</span>
            <span class="badge badge-success font-bold text-xs uppercase tracking-wider px-2 py-0.5">100% Free</span>
          </div>
          <p class="text-xs text-secondary leading-relaxed">
            {{ store.addonModalData.description || 'This feature requires activating the official free addon. All Wello addons are 100% free with no subscriptions, trials, or payment processing for Wello itself.' }}
          </p>
        </div>

        <div class="text-xs text-tertiary flex items-center gap-2 px-1">
          <IconShield :size="14" class="text-emerald-500 shrink-0" />
          <span>No credit card or billing details required. Activates instantly.</span>
        </div>
      </div>

      <div class="modal-footer flex items-center justify-end gap-2 pt-4 border-t mt-4">
        <button class="btn btn-secondary btn-sm" @click="closeModal" id="btn-addon-modal-cancel">
          Cancel
        </button>
        <button
          class="btn btn-primary btn-sm flex items-center gap-2 font-bold"
          :disabled="isActivating"
          @click="handleActivate"
          id="btn-addon-modal-activate"
        >
          <span v-if="isActivating" class="spinner-sm"></span>
          <span>{{ isActivating ? 'Activating…' : 'Activate Free Addon' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useWelloStore } from '~/stores/wello'
import IconPackage from '~/components/IconPackage.vue'
import IconShield from '~/components/IconShield.vue'
import IconX from '~/components/IconX.vue'

const store = useWelloStore()
const isActivating = ref(false)

function closeModal() {
  store.showAddonModal = false
}

async function handleActivate() {
  if (!store.addonModalData.key) return
  isActivating.value = true
  try {
    await store.activateAddon(store.addonModalData.key)
  } finally {
    isActivating.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}
.modal-card {
  background: var(--bg-surface, #ffffff);
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  width: 100%;
  padding: 1.5rem;
  border: 1px solid var(--border-color, #e2e8f0);
}
.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
