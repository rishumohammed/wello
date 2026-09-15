<template>
  <div class="app-shell">
    <!-- Desktop Admin Sidebar (Matching Global Wello Design Style) -->
    <aside class="app-sidebar">
      <div class="sidebar-logo">
        <NuxtLink to="/admin" class="sidebar-logo-link" style="display:flex;align-items:center;gap:8px;text-decoration:none;">
          <img src="~/assets/logo.png" alt="Wello" style="height:30px;width:auto;object-fit:contain;" />
          <span class="admin-badge">ADMIN</span>
        </NuxtLink>
      </div>

      <nav class="sidebar-nav" style="padding-top:16px;">
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
          <NuxtLink to="/admin" class="topbar-mobile-logo" style="text-decoration:none;">
            <img src="~/assets/logo.png" alt="Wello" style="height:26px;width:auto;object-fit:contain;" />
          </NuxtLink>
        </div>

        <div class="topbar-right" style="display:flex;align-items:center;gap:14px;position:relative;">
          <!-- User Profile Dropdown Menu Trigger -->
          <div ref="dropdownContainer" style="position:relative;">
            <button
              type="button"
              @click.stop="showDropdown = !showDropdown"
              class="header-user-dropdown-btn"
              style="display:flex;align-items:center;gap:8px;background:var(--color-off-white);border:1px solid var(--border-color);padding:4px 12px 4px 6px;border-radius:24px;cursor:pointer;transition:all 0.15s ease;"
              id="topbar-user-dropdown-trigger"
            >
              <div class="user-avatar" style="background:var(--grad-brand);color:#FFFFFF;font-weight:700;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 6px rgba(255,159,28,0.25);">
                {{ displayAvatar }}
              </div>
              <div style="display:flex;flex-direction:column;line-height:1.2;text-align:left;">
                <span style="font-weight:600;font-size:13px;color:var(--text-primary);">{{ displayName }}</span>
                <span style="font-size:10px;color:var(--color-purple);font-weight:700;letter-spacing:0.3px;">SYSTEM ADMIN</span>
              </div>
              <IconChevronDown :size="13" style="color:var(--text-tertiary);margin-left:2px;" />
            </button>

            <!-- Dropdown Menu Box -->
            <div
              v-if="showDropdown"
              class="profile-dropdown-menu animate-fade-in"
              style="position:absolute;right:0;top:calc(100% + 8px);width:230px;background:white;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.12);border:1px solid var(--border-color);z-index:1000;overflow:hidden;"
              @click.stop
            >
              <div style="padding:12px 16px;border-bottom:1px solid var(--border-color);background:var(--color-off-white);">
                <div style="font-weight:700;font-size:13px;color:var(--text-primary);">{{ displayName }}</div>
                <div style="font-size:11px;color:var(--color-purple);font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ authStore.user?.email || 'admin@wello.com' }}</div>
              </div>

              <div style="padding:6px 0;">
                <NuxtLink
                  to="/"
                  @click="showDropdown = false"
                  class="dropdown-menu-item"
                  style="display:flex;align-items:center;gap:10px;padding:9px 16px;font-size:13px;color:var(--text-primary);text-decoration:none;transition:background 0.12s;"
                >
                  <IconHome :size="15" style="color:var(--text-tertiary);" />
                  <span>User Workspace</span>
                </NuxtLink>

                <NuxtLink
                  to="/admin/roles"
                  @click="showDropdown = false"
                  class="dropdown-menu-item"
                  style="display:flex;align-items:center;gap:10px;padding:9px 16px;font-size:13px;color:var(--text-primary);text-decoration:none;transition:background 0.12s;"
                >
                  <IconShield :size="15" style="color:var(--text-tertiary);" />
                  <span>Admin Security</span>
                </NuxtLink>
              </div>

              <div style="border-top:1px solid var(--border-color);padding:6px 0;background:rgba(239,68,68,0.02);">
                <button
                  type="button"
                  @click="handleLogout"
                  class="dropdown-menu-item"
                  style="width:100%;display:flex;align-items:center;gap:10px;padding:9px 16px;font-size:13px;color:#EF4444;background:none;border:none;cursor:pointer;text-align:left;font-weight:600;"
                  id="topbar-dropdown-signout"
                >
                  <IconLogOut :size="15" style="color:#EF4444;" />
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'

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
  { id: 'overview',     to: '/admin',                      label: 'Dashboard',         icon: resolveComponent('IconGrid') },
  { id: 'store',        to: '/admin/store',                label: 'Store Addons',      icon: resolveComponent('IconPackage') },
  { id: 'users',        to: '/admin/users',                label: 'Users',             icon: resolveComponent('IconUser') },
  { id: 'funnel',       to: '/admin/registration-pipeline', label: 'User Funnel',      icon: resolveComponent('IconClock') },
  { id: 'categories',   to: '/admin/categories',           label: 'Categories',        icon: resolveComponent('IconFolders') },
  { id: 'requests',     to: '/admin/category-requests',     label: 'Category Requests', icon: resolveComponent('IconAlert') },
  { id: 'jobs',         to: '/admin/jobs',                 label: 'Jobs',              icon: resolveComponent('IconBriefcase') },
  { id: 'analytics',    to: '/admin/analytics',            label: 'Analytics',         icon: resolveComponent('IconInsights') },
  { id: 'settings',     to: '/admin/settings',             label: 'Settings',          icon: resolveComponent('IconSettings') },
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

const currentPageTitle = computed(() => pageTitles[route.path] || 'Admin Console')

function isActive(path) {
  if (path === '/admin') return route.path === '/admin'
  return route.path.startsWith(path)
}
</script>

<style scoped>
.admin-badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.8px;
  background: var(--grad-brand);
  color: #FFFFFF;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
