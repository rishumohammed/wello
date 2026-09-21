<template>
  <div class="app-shell">
    <!-- Desktop Admin Sidebar (Matching Global Wello Design Style) -->
    <aside class="app-sidebar">
      <div class="sidebar-logo">
        <NuxtLink to="/admin" class="sidebar-logo-link flex items-center gap-2 text-decoration-none">
          <img src="~/assets/logo.png" alt="Wello" class="h-8 w-auto object-contain" />
          <span class="admin-badge">ADMIN</span>
        </NuxtLink>
      </div>

      <nav class="sidebar-nav pt-4">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          :class="{ active: isActive(item.to) }"
          :id="`admin-nav-${item.id}`"
        >
          <component :is="item.icon" class="nav-icon" />
          <span class="nav-label">{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </aside>

    <!-- Admin Main Content Area -->
    <div class="app-main">
      <!-- Admin Topbar -->
      <header class="app-topbar">
        <div class="topbar-left">
          <NuxtLink to="/admin" class="topbar-mobile-logo text-decoration-none">
            <img src="~/assets/logo.png" alt="Wello" class="h-26 w-auto object-contain" />
          </NuxtLink>
        </div>

        <div class="topbar-right flex items-center gap-3.5 relative">
          <!-- User Profile Dropdown Menu Trigger -->
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
                <span class="fw-600 text-xs text-primary">{{ displayName }}</span>
                <span class="text-2xs text-purple fw-700 tracking-wide">SYSTEM ADMIN</span>
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
                <div class="text-2xs text-purple fw-600 mt-0.5 truncate">{{ authStore.user?.email || 'admin@wello.com' }}</div>
              </div>

              <div class="py-1.5">
                <NuxtLink
                  to="/"
                  @click="showDropdown = false"
                  class="dropdown-menu-item"
                >
                  <IconHome :size="15" class="text-tertiary" />
                  <span>User Workspace</span>
                </NuxtLink>

                <NuxtLink
                  to="/admin/roles"
                  @click="showDropdown = false"
                  class="dropdown-menu-item"
                >
                  <IconShield :size="15" class="text-tertiary" />
                  <span>Admin Security</span>
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
      </header>

      <!-- Main Admin Content Slot -->
      <main class="app-content">
        <slot />
      </main>
    </div>

    <!-- Global Toast Notifications -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import IconGrid from '~/components/IconGrid.vue'
import IconPackage from '~/components/IconPackage.vue'
import IconUser from '~/components/IconUser.vue'
import IconClock from '~/components/IconClock.vue'
import IconFolders from '~/components/IconFolders.vue'
import IconAlert from '~/components/IconAlert.vue'
import IconBriefcase from '~/components/IconBriefcase.vue'
import IconInsights from '~/components/IconInsights.vue'
import IconSettings from '~/components/IconSettings.vue'
import IconHome from '~/components/IconHome.vue'
import IconShield from '~/components/IconShield.vue'
import IconLogOut from '~/components/IconLogOut.vue'
import IconChevronDown from '~/components/IconChevronDown.vue'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

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

const displayName = computed(() => authStore.user?.name || 'System Admin')
const displayAvatar = computed(() => {
  if (authStore.user?.name) {
    const parts = authStore.user.name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  return 'SA'
})

function handleLogout() {
  showDropdown.value = false
  authStore.logout()
  router.push('/login')
}

const navItems = [
  { id: 'overview',     to: '/admin',                      label: 'Dashboard',         icon: IconGrid },
  { id: 'store',        to: '/admin/store',                label: 'Store Addons',      icon: IconPackage },
  { id: 'users',        to: '/admin/users',                label: 'Users',             icon: IconUser },
  { id: 'funnel',       to: '/admin/registration-pipeline', label: 'User Funnel',      icon: IconClock },
  { id: 'categories',   to: '/admin/categories',           label: 'Categories',        icon: IconFolders },
  { id: 'requests',     to: '/admin/category-requests',     label: 'Category Requests', icon: IconAlert },
  { id: 'jobs',         to: '/admin/jobs',                 label: 'Jobs',              icon: IconBriefcase },
  { id: 'analytics',    to: '/admin/analytics',            label: 'Analytics',         icon: IconInsights },
  { id: 'settings',     to: '/admin/settings',             label: 'Settings',          icon: IconSettings },
]

const pageTitles = {
  '/admin': 'Admin Overview Dashboard',
  '/admin/store': 'Wello Store Addons Management',
  '/admin/users': 'Platform User Directory',
  '/admin/registration-pipeline': 'User Registration Pipeline & Funnel',
  '/admin/categories': 'Job & Service Category Management',
  '/admin/category-requests': 'User Category Request Queue',
  '/admin/jobs': 'Jobs & Services Moderation',
  '/admin/analytics': 'Wello Platform Analytics Center',
  '/admin/settings': 'Admin Console Settings',
}

const currentPageTitle = computed(() => pageTitles[route?.path] || 'Admin Console')

function isActive(path) {
  if (!route?.path) return false
  if (path === '/admin') return route.path === '/admin'
  return route.path.startsWith(path)
}
</script>
