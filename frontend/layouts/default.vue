<template>
  <div class="app-shell">
    <!-- Desktop Sidebar -->
    <aside class="app-sidebar">
      <div class="sidebar-logo">
        <NuxtLink to="/" class="sidebar-logo-link flex items-center text-decoration-none">
          <img src="~/assets/logo.png" alt="Wello" class="h-8 w-auto object-contain" />
        </NuxtLink>
      </div>

      <nav class="sidebar-nav">
        <NuxtLink
          v-for="item in visibleNavItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: isActive(item) }"
          :id="`nav-${item.id}`"
        >
          <component :is="item.icon" class="nav-icon" />
          <span class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </aside>

    <!-- Main area -->
    <div class="app-main">
      <!-- Topbar -->
      <header class="app-topbar">
        <div class="topbar-left">
          <NuxtLink to="/" class="topbar-mobile-logo text-decoration-none">
            <img src="~/assets/logo.png" alt="Wello" class="h-26 w-auto object-contain" />
          </NuxtLink>
        </div>
        <div class="topbar-right">
          <!-- Active timer pill -->
          <div
            v-if="store.activeTimer"
            class="quick-timer-pill running"
            @click="showTimerModal = true"
            id="topbar-timer-pill"
          >
            <span class="timer-running-indicator" :style="{ background: store.isTimerPaused ? '#F59E0B' : 'var(--color-success)' }"></span>
            <span class="fw-700">{{ store.timerDisplay() }}</span>
            <span class="text-tertiary">· {{ getTimerProject }}</span>
            <span v-if="store.isTimerPaused" class="badge badge-paused">Paused</span>
          </div>

          <!-- Auth state badge / action -->
          <div v-if="!authStore.isAuthenticated" class="flex items-center gap-1.5">
            <NuxtLink to="/login" class="btn btn-secondary btn-sm text-decoration-none text-xs h-34">Sign In</NuxtLink>
            <NuxtLink to="/register" class="btn btn-primary btn-sm text-decoration-none text-xs h-34">Register</NuxtLink>
          </div>
          <div v-else class="flex items-center gap-3 relative">
            <!-- Profile Dropdown Trigger -->
            <div ref="dropdownContainer" class="relative">
              <button
                type="button"
                @click.stop="showDropdown = !showDropdown"
                class="header-user-dropdown-btn"
                id="topbar-user-dropdown-trigger"
              >
                <div class="user-avatar-sm">
                  {{ displayAvatar }}
                </div>
                <div class="flex flex-col lh-tight text-left">
                  <span class="text-xs fw-600 text-primary">{{ displayName }}</span>
                  <span class="text-2xs text-tertiary fw-600">{{ displayEmail || 'Independent' }}</span>
                </div>
                <IconChevronDown :size="13" class="text-tertiary ml-0.5" />
              </button>

              <!-- Dropdown Menu Box -->
              <div
                v-if="showDropdown"
                class="profile-dropdown-menu animate-fade-in"
                @click.stop
              >
                <div class="p-3 border-b bg-off-white">
                  <div class="fw-700 text-xs text-primary">{{ displayName }}</div>
                  <div class="text-2xs text-tertiary mt-0.5 truncate">{{ displayEmail }}</div>
                </div>

                <div class="py-1.5">
                  <NuxtLink
                    v-if="authStore.isAdmin"
                    to="/admin"
                    @click="showDropdown = false"
                    class="dropdown-menu-item"
                  >
                    <IconShield :size="15" class="text-purple" />
                    <span class="fw-600 text-purple">Admin Console</span>
                  </NuxtLink>

                  <NuxtLink
                    to="/store"
                    @click="showDropdown = false"
                    class="dropdown-menu-item"
                    id="topbar-dropdown-store"
                  >
                    <IconPackage :size="15" class="text-purple" />
                    <span class="fw-600 text-purple">Wello Store</span>
                  </NuxtLink>

                  <NuxtLink
                    to="/settings"
                    @click="showDropdown = false"
                    class="dropdown-menu-item"
                  >
                    <IconSettings :size="15" class="text-tertiary" />
                    <span>Settings & Profile</span>
                  </NuxtLink>
                </div>

                <div class="border-t py-1.5 bg-danger-subtle">
                  <button
                    type="button"
                    @click="handleLogout"
                    class="dropdown-menu-item text-danger fw-600"
                    id="topbar-dropdown-signout"
                  >
                    <IconLogOut :size="15" class="text-danger" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="app-content">
        <slot />
      </main>
    </div>

    <!-- Mobile bottom nav -->
    <nav class="mobile-nav">
      <div class="mobile-nav-inner">
        <NuxtLink
          v-for="item in visibleMobileNavItems"
          :key="item.to"
          :to="item.to"
          class="mobile-nav-item"
          :class="{ active: isActive(item) }"
          :id="`mobile-nav-${item.id}`"
        >
          <component :is="item.icon" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </div>
    </nav>

    <!-- Global timer modal for running pill -->
    <TimerModal
      v-if="showTimerModal"
      @close="showTimerModal = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'

const store = useWelloStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const showTimerModal = ref(false)
const showDropdown = ref(false)
const dropdownContainer = ref(null)

function handleClickOutside(event) {
  if (dropdownContainer.value && !dropdownContainer.value.contains(event.target)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('click', handleClickOutside)
  }
})

const displayName = computed(() => {
  if (authStore.user?.name) return authStore.user.name
  return store.user?.name || 'Alex Morgan'
})

const displayEmail = computed(() => {
  return authStore.user?.email || ''
})

const displayAvatar = computed(() => {
  if (authStore.user?.name) {
    const parts = authStore.user.name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return store.user?.avatarInitials || 'AM'
})

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

// Nav items for User Account Workspace
const navItems = [
  { id: 'home',     to: '/',          label: 'Home',     icon: resolveComponent('IconHome') },
  { id: 'work',     to: '/work',      label: 'Work Hub', icon: resolveComponent('IconBriefcase') },
  { id: 'clients',  to: '/clients',   label: 'Clients',  icon: resolveComponent('IconUser') },
  { id: 'invoicing', to: '/invoicing', label: 'Invoices', icon: resolveComponent('IconReceipt') },
  { id: 'insights', to: '/insights',  label: 'Insights', icon: resolveComponent('IconInsights') },
  { id: 'settings', to: '/settings',  label: 'Settings', icon: resolveComponent('IconSettings') },
]

const mobileNavItems = [
  { id: 'home',     to: '/',          label: 'Home',     icon: resolveComponent('IconHome') },
  { id: 'work',     to: '/work',      label: 'Work Hub', icon: resolveComponent('IconBriefcase') },
  { id: 'clients',  to: '/clients',   label: 'Clients',  icon: resolveComponent('IconUser') },
  { id: 'invoicing', to: '/invoicing', label: 'Invoices', icon: resolveComponent('IconReceipt') },
]

const visibleNavItems = computed(() => navItems)
const visibleMobileNavItems = computed(() => mobileNavItems)

const pageNames = {
  '/': 'Home',
  '/work': 'Work Hub',
  '/clients': 'Clients Directory',
  '/invoicing': 'Invoices',
  '/insights': 'Insights',
  '/settings': 'Settings',
}

const currentPageTitle = computed(() => {
  const matched = route.matched
  for (const m of matched) {
    const path = m.path
    if (pageNames[path]) return pageNames[path]
  }
  return pageNames[route.path] || 'Wello'
})

function isActive(item) {
  if (item.to === '/') return route.path === '/'
  return route.path.startsWith(item.to)
}

const getTimerProject = computed(() => {
  if (!store.activeTimer) return ''
  const proj = store.getProject(store.activeTimer.projectId)
  return proj?.name || 'Project'
})
</script>
