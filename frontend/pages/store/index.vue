<template>
  <div class="store-page animate-fade-in" style="display:flex;flex-direction:column;gap:24px;">
    <!-- Page Header & Banner -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Wello Store</h1>
        <p class="page-subtitle">Extend your Wello experience with powerful modular addons. Wello core services remain 100% FREE.</p>
      </div>
      <NuxtLink to="/invoicing" class="btn btn-secondary btn-sm" style="display:inline-flex;align-items:center;gap:6px;" id="btn-open-invoices-store">
        <IconReceipt :size="15" />
        <span>My Invoices</span>
      </NuxtLink>
    </div>

    <!-- Store Hero Banner -->
    <div
      class="card p-6"
      style="background:linear-gradient(135deg, rgba(255,159,28,0.06) 0%, rgba(122,63,246,0.08) 100%);border:1px solid rgba(122,63,246,0.18);border-radius:16px;"
      id="store-hero-banner"
    >
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div style="max-width:560px;">
          <div class="badge mb-2" style="background:rgba(122,63,246,0.12);color:var(--color-purple);font-weight:700;">Wello Addon Platform</div>
          <h2 class="text-xl font-extrabold text-primary mb-2" style="letter-spacing:-0.5px;">Supercharge your workflow with official Wello Addons</h2>
          <p class="text-sm text-secondary" style="line-height:1.5;">
            All addons integrate directly into your authenticated Wello account without separate logins or subscriptions. Core Wello tracking and reporting remains 100% free.
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="text-right">
            <div class="text-xs text-tertiary fw-600 uppercase">Available Addons</div>
            <div class="font-extrabold text-2xl kpi-val-1">{{ addons.length }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Category Filter Bar -->
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

      <div class="text-xs text-tertiary">
        Showing {{ filteredAddons.length }} addon(s)
      </div>
    </div>

    <!-- Addons Grid -->
    <div v-if="isLoading" class="text-center py-12 text-tertiary">
      Loading Wello Store catalog…
    </div>

    <div v-else-if="filteredAddons.length === 0" class="empty-state py-12">
      <div class="empty-icon"><IconPackage :size="32" /></div>
      <div class="empty-title text-base mt-2">No addons match your selected filter</div>
    </div>

    <div v-else class="store-products-grid" id="addons-grid">
      <div
        v-for="addon in filteredAddons"
        :key="addon.id"
        class="card store-product-card hover-lift"
        style="background:white;border:1px solid var(--border-color);border-radius:20px;box-shadow:0 4px 20px rgba(0,0,0,0.04);display:flex;flex-direction:column;justify-content:space-between;padding:24px;position:relative;overflow:hidden;transition:all 0.25s ease;"
        :id="`addon-card-${addon.slug}`"
      >
        <!-- Top Accent -->
        <div style="position:absolute;top:0;left:0;right:0;height:6px;background:linear-gradient(90deg, var(--color-purple), var(--color-brand));"></div>

        <div>
          <!-- Badges Bar -->
          <div class="flex items-center justify-between gap-2 mb-4" style="margin-top:4px;">
            <span
              class="badge"
              :style="addon.isFree ? 'background:rgba(16,185,129,0.12);color:var(--color-success);font-weight:700;' : 'background:rgba(122,63,246,0.12);color:var(--color-purple);font-weight:700;'"
              style="padding:4px 12px;border-radius:12px;font-size:11px;letter-spacing:0.3px;"
            >
              {{ addon.isFree ? 'FREE ADDON' : 'PRO' }}
            </span>

            <span
              v-if="addon.isActivated"
              class="badge"
              style="background:rgba(16,185,129,0.15);color:var(--color-success);font-weight:700;font-size:11px;padding:4px 10px;border-radius:12px;display:inline-flex;align-items:center;gap:4px;"
            >
              <span style="width:6px;height:6px;border-radius:50%;background:var(--color-success);"></span> Active
            </span>
          </div>

          <!-- Product Icon & Title (Portrait Layout) -->
          <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;margin-bottom:16px;">
            <div
              style="width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg, rgba(255,159,28,0.15) 0%, rgba(122,63,246,0.15) 100%);color:var(--color-purple);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(122,63,246,0.15);"
            >
              <component :is="getIconComponent(addon.icon)" :size="30" />
            </div>
            <div>
              <h3 class="font-extrabold text-lg text-primary" style="line-height:1.2;margin-bottom:2px;">{{ addon.name }}</h3>
              <span class="text-xs text-tertiary font-medium">{{ addon.category }} · v{{ addon.version }}</span>
            </div>
          </div>

          <p class="text-sm text-secondary mb-4 text-center" style="line-height:1.5;min-height:42px;">
            {{ addon.description }}
          </p>

          <!-- Feature Bullet List -->
          <div class="features-list" style="display:flex;flex-direction:column;gap:8px;background:var(--color-off-white);padding:14px;border-radius:12px;border:1px solid var(--border-subtle);margin-bottom:16px;">
            <div v-for="(feat, idx) in addon.features" :key="idx" class="flex items-start gap-2 text-xs text-secondary" style="text-align:left;">
              <IconCheck :size="14" style="color:var(--color-success);flex-shrink:0;margin-top:2px;" />
              <span style="line-height:1.4;">{{ feat }}</span>
            </div>
          </div>
        </div>

        <!-- Action Footer -->
        <div style="display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--border-subtle);">
          <div class="text-xs text-tertiary text-center font-medium">
            <span v-if="addon.isActivated">Activated on your account</span>
            <span v-else>Available for instant activation</span>
          </div>

          <div style="display:flex;gap:8px;">
            <!-- Open Addon Button if Activated -->
            <NuxtLink
              v-if="addon.isActivated && addon.slug === 'basic-invoicing'"
              to="/invoicing"
              class="btn btn-primary btn-sm"
              style="flex:1;justify-content:center;gap:4px;height:38px;font-weight:600;"
              :id="`btn-open-${addon.slug}`"
            >
              <span>Open Invoicing</span>
              <span>→</span>
            </NuxtLink>

            <!-- Activate / Toggle Button -->
            <button
              type="button"
              class="btn btn-sm"
              :class="addon.isActivated ? 'btn-secondary' : 'btn-primary'"
              style="flex:1;justify-content:center;height:38px;font-weight:600;"
              @click="toggleAddon(addon)"
              :disabled="activatingId === addon.id"
              :id="`btn-toggle-${addon.slug}`"
            >
              <span v-if="activatingId === addon.id">Updating…</span>
              <span v-else-if="addon.isActivated">Deactivate</span>
              <span v-else>Activate Addon</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()

const addons = ref([])
const isLoading = ref(true)
const activatingId = ref('')
const activeCategory = ref('All')

const categories = computed(() => {
  const cats = ['All']
  addons.value.forEach(a => {
    if (a.category && !cats.includes(a.category)) cats.push(a.category)
  })
  return cats
})

const filteredAddons = computed(() => {
  if (activeCategory.value === 'All') return addons.value
  return addons.value.filter(a => a.category === activeCategory.value)
})

async function fetchAddons() {
  isLoading.value = true
  try {
    const res = await $fetch('/api/store/addons', {
      params: { userId: authStore.user?.id || 'u1' }
    })
    if (res?.addons) {
      addons.value = res.addons
    }
  } catch (err) {
    console.error('Failed to fetch store addons:', err)
  } finally {
    isLoading.value = false
  }
}

async function toggleAddon(addon) {
  activatingId.value = addon.id
  try {
    const res = await $fetch('/api/store/addons/activate', {
      method: 'POST',
      body: {
        userId: authStore.user?.id || 'u1',
        addonId: addon.id,
      }
    })
    if (res?.success) {
      await fetchAddons()
    }
  } catch (err) {
    console.error('Failed to toggle addon:', err)
  } finally {
    activatingId.value = ''
  }
}

function getIconComponent(iconName) {
  if (iconName === 'IconReceipt') return resolveComponent('IconReceipt')
  return resolveComponent('IconPackage')
}

onMounted(() => {
  fetchAddons()
})
</script>

<style scoped>
.store-products-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}
@media (max-width: 992px) {
  .store-products-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 640px) {
  .store-products-grid {
    grid-template-columns: 1fr;
  }
}
</style>
