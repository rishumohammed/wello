<template>
  <div class="store-page animate-fade-in flex flex-col gap-6">
    <!-- Page Header & Banner -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Wello Store</h1>
        <p class="page-subtitle">Extend your Wello experience with powerful modular addons. Wello core services remain 100% FREE.</p>
      </div>
      <NuxtLink to="/invoicing" class="btn btn-secondary btn-sm flex items-center gap-2" id="btn-open-invoices-store">
        <IconReceipt :size="15" />
        <span>My Invoices</span>
      </NuxtLink>
    </div>

    <!-- Store Hero Banner -->
    <div
      class="card store-hero-banner p-6"
      id="store-hero-banner"
    >
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="max-w-xl">
          <div class="badge badge-purple mb-2 font-bold">Wello Addon Platform</div>
          <h2 class="text-xl font-extrabold text-primary mb-2">Supercharge your workflow with official Wello Addons</h2>
          <p class="text-sm text-secondary">
            All addons integrate directly into your authenticated Wello account without separate logins or subscriptions. Core Wello tracking and reporting remains 100% free.
          </p>
        </div>
        <div class="flex items-center gap-3">
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
        class="card store-addon-card hover-lift"
        :id="`addon-card-${addon.slug}`"
      >
        <!-- Top Accent -->
        <div class="store-top-accent"></div>

        <div>
          <!-- Badges Bar -->
          <div class="flex items-center justify-between gap-2 mb-4 mt-1">
            <span
              class="badge"
              :class="addon.isFree ? 'addon-badge-free' : 'addon-badge-pro'"
            >
              {{ addon.isFree ? 'FREE ADDON' : 'PRO' }}
            </span>

            <span
              v-if="addon.isActivated"
              class="badge addon-badge-active"
            >
              <span class="addon-active-dot"></span> Active
            </span>
          </div>

          <!-- Product Icon & Title (Portrait Layout) -->
          <div class="flex flex-col items-center text-center gap-3 mb-4">
            <div class="addon-icon-wrap">
              <component :is="getIconComponent(addon.icon)" :size="30" />
            </div>
            <div>
              <h3 class="font-extrabold text-lg text-primary mb-1">{{ addon.name }}</h3>
              <span class="text-xs text-tertiary font-medium">{{ addon.category }} · v{{ addon.version }}</span>
            </div>
          </div>

          <p class="text-sm text-secondary mb-4 text-center">
            {{ addon.description }}
          </p>

          <!-- Feature Bullet List -->
          <div class="addon-features-box">
            <div v-for="(feat, idx) in addon.features" :key="idx" class="flex items-start gap-2 text-xs text-secondary text-left">
              <IconCheck :size="14" class="text-success flex-shrink-0 mt-1" />
              <span>{{ feat }}</span>
            </div>
          </div>
        </div>

        <!-- Action Footer -->
        <div class="flex flex-col gap-2 pt-3 border-t border-subtle">
          <div class="text-xs text-tertiary text-center font-medium">
            <span v-if="addon.isActivated">Activated on your account</span>
            <span v-else>Available for instant activation</span>
          </div>

          <div class="flex gap-2">
            <!-- Open Addon Button if Activated -->
            <NuxtLink
              v-if="addon.isActivated && addon.slug === 'basic-invoicing'"
              to="/invoicing"
              class="btn btn-primary btn-sm flex-1 justify-center gap-1 font-semibold"
              :id="`btn-open-${addon.slug}`"
            >
              <span>Open Invoicing</span>
              <span>→</span>
            </NuxtLink>

            <!-- Activate / Toggle Button -->
            <button
              type="button"
              class="btn btn-sm flex-1 justify-center font-semibold"
              :class="addon.isActivated ? 'btn-secondary' : 'btn-primary'"
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

import IconReceipt from '~/components/IconReceipt.vue'
import IconPackage from '~/components/IconPackage.vue'

function getIconComponent(iconName) {
  if (iconName === 'IconReceipt') return IconReceipt
  return IconPackage
}

onMounted(() => {
  fetchAddons()
})
</script>
