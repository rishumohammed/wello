<template>
  <div class="store-page animate-fade-in flex flex-col gap-6">
    <!-- Page Header & Banner -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Wello Addon Store</h1>
        <p class="page-subtitle">Customize and extend your workspace with official free modular addons. Zero subscription fees.</p>
      </div>
      <div class="flex items-center gap-2">
        <NuxtLink to="/invoicing" class="btn btn-secondary btn-sm flex items-center gap-2" id="btn-open-invoices-store">
          <IconReceipt :size="15" />
          <span>Invoicing</span>
        </NuxtLink>
        <NuxtLink to="/reports" class="btn btn-secondary btn-sm flex items-center gap-2" id="btn-open-reports-store">
          <IconReport :size="15" />
          <span>Reports</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Store Hero Banner -->
    <div class="card store-hero-banner p-6" id="store-hero-banner">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="max-w-2xl">
          <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
            <span>100% Free Platform Addons</span>
          </div>
          <h2 class="text-xl font-extrabold text-primary mb-2">Modular power without subscriptions or hidden costs</h2>
          <p class="text-sm text-secondary leading-relaxed">
            Every official addon is free forever. Activate only the features you need. Deactivating an addon never deletes your records — your data remains safely stored and will instantly restore whenever you reactivate.
          </p>
        </div>
        <div class="flex items-center gap-6 bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div class="text-center">
            <div class="text-xs text-tertiary font-bold uppercase">Catalog</div>
            <div class="font-extrabold text-2xl text-primary">{{ addons.length }}</div>
          </div>
          <div class="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
          <div class="text-center">
            <div class="text-xs text-tertiary font-bold uppercase">Active on Account</div>
            <div class="font-extrabold text-2xl text-emerald-600">{{ activeCount }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Filter Bar & Search -->
    <div class="flex items-center justify-between flex-wrap gap-3" id="store-filters">
      <div class="filter-strip mb-0">
        <button
          v-for="cat in categories"
          :key="cat"
          class="filter-chip"
          :class="{ active: activeCategory === cat }"
          @click="activeCategory = cat"
        >
          {{ cat }}
        </button>
      </div>

      <div class="flex items-center gap-3">
        <input
          v-model="searchQuery"
          type="text"
          class="form-input text-xs py-1.5 px-3 rounded-lg w-48"
          placeholder="Search addons…"
          id="input-store-search"
        />
        <div class="text-xs text-tertiary whitespace-nowrap">
          {{ filteredAddons.length }} addon(s)
        </div>
      </div>
    </div>

    <!-- Addons Grid -->
    <div v-if="isLoading" class="text-center py-16 text-tertiary">
      <div class="spinner-sm mx-auto mb-2"></div>
      Loading Wello Addon Catalog…
    </div>

    <div v-else-if="filteredAddons.length === 0" class="empty-state py-12 card text-center">
      <div class="empty-icon text-tertiary mb-2"><IconPackage :size="36" /></div>
      <div class="empty-title text-base font-bold text-primary">No matching addons found</div>
      <p class="text-xs text-secondary mt-1">Try clearing your search query or selecting a different category filter.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="addons-grid">
      <div
        v-for="addon in filteredAddons"
        :key="addon.id"
        class="card p-5 flex flex-col justify-between hover-lift relative border transition-all duration-200"
        :class="addon.isActivated ? 'border-emerald-500/40 bg-emerald-500/[0.02]' : 'border-slate-200 dark:border-slate-800'"
        :id="`addon-card-${addon.key || addon.slug}`"
      >
        <div>
          <!-- Header Badges Bar -->
          <div class="flex items-center justify-between gap-2 mb-4">
            <span class="badge badge-success font-bold text-xs uppercase tracking-wider px-2 py-0.5">
              FREE
            </span>

            <div class="flex items-center gap-1.5">
              <span v-if="addon.isKilled" class="badge badge-danger font-bold text-2xs">
                Incident Hold
              </span>
              <span v-else-if="addon.isActivated" class="badge badge-emerald font-bold text-2xs flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
              </span>
              <span v-else-if="addon.status === 'beta'" class="badge badge-warning font-bold text-2xs">
                BETA
              </span>
              <span v-else-if="addon.status === 'deprecated'" class="badge badge-secondary font-bold text-2xs">
                DEPRECATED
              </span>
            </div>
          </div>

          <!-- Addon Icon & Title -->
          <div class="flex items-start gap-3 mb-3">
            <div class="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-primary shrink-0 border border-slate-200 dark:border-slate-700">
              <component :is="getIconComponent(addon.icon)" :size="22" />
            </div>
            <div>
              <h3 class="font-extrabold text-base text-primary leading-tight">{{ addon.name }}</h3>
              <span class="text-xs text-tertiary">{{ addon.category }} · v{{ addon.version }}</span>
            </div>
          </div>

          <!-- Description -->
          <p class="text-xs text-secondary mb-4 leading-relaxed">
            {{ addon.description }}
          </p>

          <!-- Dependencies Info -->
          <div v-if="addon.dependsOn && addon.dependsOn.length > 0" class="mb-4 text-2xs text-tertiary bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
            <span class="font-semibold text-secondary">Requires:</span> {{ addon.dependsOn.join(', ') }}
          </div>
        </div>

        <!-- Action Footer -->
        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 mt-2">
          <!-- Direct Route Link if Active -->
          <NuxtLink
            v-if="addon.isActivated && getRouteForAddon(addon.key || addon.slug)"
            :to="getRouteForAddon(addon.key || addon.slug)"
            class="btn btn-secondary btn-sm flex-1 justify-center gap-1 font-bold text-xs"
            :id="`btn-open-${addon.key || addon.slug}`"
          >
            <span>Open</span>
            <span>→</span>
          </NuxtLink>

          <!-- Toggle Button -->
          <button
            type="button"
            class="btn btn-sm flex-1 justify-center font-bold text-xs"
            :class="addon.isActivated ? 'btn-ghost text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30' : 'btn-primary'"
            :disabled="addon.isKilled || activatingKey === (addon.key || addon.slug)"
            @click="handleAddonAction(addon)"
            :id="`btn-toggle-${addon.key || addon.slug}`"
          >
            <span v-if="activatingKey === (addon.key || addon.slug)" class="spinner-sm"></span>
            <span v-else-if="addon.isKilled">Temporarily Disabled</span>
            <span v-else-if="addon.isActivated">Deactivate</span>
            <span v-else>Activate Free Addon</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Deactivation Notice Modal -->
    <div v-if="deactivatingAddon" class="modal-overlay animate-fade-in" @click.self="deactivatingAddon = null">
      <div class="modal-card max-w-md animate-scale-up" id="deactivation-notice-modal">
        <div class="modal-header flex items-center justify-between border-b pb-3 mb-3">
          <h3 class="font-bold text-base text-primary">Deactivate {{ deactivatingAddon.name }}?</h3>
          <button class="btn btn-ghost btn-sm p-1" @click="deactivatingAddon = null">✕</button>
        </div>
        <div class="modal-body flex flex-col gap-3 text-xs text-secondary">
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-medium">
            🔒 <strong>Zero Data Loss:</strong> All your data will remain safely preserved and will instantly reappear whenever you reactivate this addon.
          </div>
          <p v-if="deactivatingAddon.dependsOn && deactivatingAddon.dependsOn.length > 0">
            This addon has dependencies. Deactivating it will hide its associated menus and reports.
          </p>
        </div>
        <div class="modal-footer flex justify-end gap-2 pt-4 border-t mt-3">
          <button class="btn btn-secondary btn-sm" @click="deactivatingAddon = null">Cancel</button>
          <button class="btn btn-danger btn-sm" @click="confirmDeactivate" id="btn-confirm-deactivate">
            Deactivate & Hide
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useToast } from '~/composables/useToast'
import IconReceipt from '~/components/IconReceipt.vue'
import IconReport from '~/components/IconReport.vue'
import IconPackage from '~/components/IconPackage.vue'
import IconClock from '~/components/IconClock.vue'
import IconBriefcase from '~/components/IconBriefcase.vue'
import IconLayers from '~/components/IconLayers.vue'
import IconShield from '~/components/IconShield.vue'

const store = useWelloStore()
const toast = useToast()

const addons = ref([])
const isLoading = ref(true)
const activatingKey = ref('')
const activeCategory = ref('All')
const searchQuery = ref('')
const deactivatingAddon = ref(null)

const activeCount = computed(() => addons.value.filter(a => a.isActivated).length)

const categories = computed(() => {
  const cats = ['All']
  addons.value.forEach(a => {
    if (a.category && !cats.includes(a.category)) cats.push(a.category)
  })
  return cats
})

const filteredAddons = computed(() => {
  let list = addons.value
  if (activeCategory.value !== 'All') {
    list = list.filter(a => a.category === activeCategory.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(a => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
  }
  return list
})

function getRouteForAddon(key) {
  if (key === 'basic-invoicing' || key === 'recurring-retainers') return '/invoicing'
  if (key === 'executive-reports') return '/reports'
  if (key === 'pricing-calculator') return '/work'
  return null
}

function getIconComponent(icon) {
  if (icon === 'IconReceipt') return IconReceipt
  if (icon === 'IconReport') return IconReport
  if (icon === 'IconLayers') return IconLayers
  if (icon === 'IconClock') return IconClock
  if (icon === 'IconBriefcase') return IconBriefcase
  return IconPackage
}

async function loadAddons() {
  isLoading.value = true
  try {
    const list = await store.fetchAddons()
    addons.value = list || []
  } catch (err) {
    console.error('[Store Catalog] Error loading addons:', err)
  } finally {
    isLoading.value = false
  }
}

async function handleAddonAction(addon) {
  const key = addon.key || addon.slug
  if (addon.isActivated) {
    deactivatingAddon.value = addon
  } else {
    activatingKey.value = key
    try {
      const ok = await store.activateAddon(key)
      if (ok) {
        await loadAddons()
      }
    } finally {
      activatingKey.value = ''
    }
  }
}

async function confirmDeactivate() {
  if (!deactivatingAddon.value) return
  const key = deactivatingAddon.value.key || deactivatingAddon.value.slug
  activatingKey.value = key
  const addonRef = deactivatingAddon.value
  deactivatingAddon.value = null

  try {
    const ok = await store.deactivateAddon(key)
    if (ok) {
      await loadAddons()
    }
  } finally {
    activatingKey.value = ''
  }
}

onMounted(() => {
  loadAddons()
})
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
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
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
