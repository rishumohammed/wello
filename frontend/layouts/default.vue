<template>
  <div class="app-shell">
    <!-- Desktop Sidebar -->
    <aside class="app-sidebar">
      <div class="sidebar-logo">
        <NuxtLink to="/" class="sidebar-logo-link" style="display:flex;align-items:center;text-decoration:none;">
          <img src="~/assets/logo.png" alt="Wello" style="height:32px;width:auto;object-fit:contain;" />
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
          <NuxtLink to="/" class="topbar-mobile-logo" style="text-decoration:none;">
            <img src="~/assets/logo.png" alt="Wello" style="height:26px;width:auto;object-fit:contain;" />
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
            <span v-if="store.isTimerPaused" class="badge" style="padding:1px 5px;font-size:9px;background:rgba(245,158,11,0.15);color:#D97706;">Paused</span>
          </div>

          <!-- Quick link to Admin (Only visible for Admin accounts) -->
          <NuxtLink
            v-if="authStore.isAdmin"
            to="/admin"
            class="btn btn-ghost btn-sm"
            style="display:flex;align-items:center;gap:6px;font-size:12px;text-decoration:none;height:34px;"
            id="topbar-admin-btn"
          >
            <IconShield :size="14" />
            <span>Admin</span>
          </NuxtLink>

          <!-- Auth state badge / action -->
          <div v-if="!authStore.isAuthenticated" style="display:flex;align-items:center;gap:6px;">
            <NuxtLink to="/login" class="btn btn-secondary btn-sm" style="text-decoration:none;font-size:12px;height:34px;">Sign In</NuxtLink>
            <NuxtLink to="/register" class="btn btn-primary btn-sm" style="text-decoration:none;font-size:12px;height:34px;">Register</NuxtLink>
          </div>
          <div v-else style="display:flex;align-items:center;gap:12px;position:relative;">
            <!-- Profile Dropdown Trigger -->
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
                  <span style="font-size:10px;color:var(--text-tertiary);font-weight:600;">{{ displayEmail || 'Independent' }}</span>
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
                  <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ displayEmail || 'user@example.com' }}</div>
                </div>

                <div style="padding:6px 0;">
                  <NuxtLink
                    v-if="authStore.isAdmin"
                    to="/admin"
                    @click="showDropdown = false"
                    class="dropdown-menu-item"
                    style="display:flex;align-items:center;gap:10px;padding:9px 16px;font-size:13px;color:var(--text-primary);text-decoration:none;transition:background 0.12s;"
                  >
                    <IconShield :size="15" style="color:var(--color-purple);" />
                    <span style="font-weight:600;color:var(--color-purple);">Admin Console</span>
                  </NuxtLink>

                  <NuxtLink
                    to="/store"
                    @click="showDropdown = false"
                    class="dropdown-menu-item"
                    style="display:flex;align-items:center;gap:10px;padding:9px 16px;font-size:13px;color:var(--text-primary);text-decoration:none;transition:background 0.12s;"
                    id="topbar-dropdown-store"
                  >
                    <IconPackage :size="15" style="color:var(--color-purple);" />
                    <span style="font-weight:600;color:var(--color-purple);">Wello Store</span>
                  </NuxtLink>

                  <NuxtLink
                    to="/settings"
                    @click="showDropdown = false"
                    class="dropdown-menu-item"
                    style="display:flex;align-items:center;gap:10px;padding:9px 16px;font-size:13px;color:var(--text-primary);text-decoration:none;transition:background 0.12s;"
                  >
                    <IconSettings :size="15" style="color:var(--text-tertiary);" />
                    <span>Settings & Profile</span>
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

// Nav items
const navItems = [
  { id: 'home',     to: '/',          label: 'Home',     icon: resolveComponent('IconHome') },
  { id: 'tracking', to: '/tracking',  label: 'Work',     icon: resolveComponent('IconClock') },
  { id: 'projects', to: '/projects',  label: 'Projects', icon: resolveComponent('IconFolders') },
  { id: 'jobs',     to: '/jobs',      label: 'Jobs',     icon: resolveComponent('IconBriefcase') },
  { id: 'clients',  to: '/clients',   label: 'Clients',  icon: resolveComponent('IconUser') },
  { id: 'invoicing', to: '/invoicing', label: 'Invoices', icon: resolveComponent('IconReceipt') },
  { id: 'insights', to: '/insights',  label: 'Insights', icon: resolveComponent('IconInsights') },
  { id: 'admin',    to: '/admin',     label: 'Admin',    icon: resolveComponent('IconShield') },
  { id: 'settings', to: '/settings',  label: 'Settings', icon: resolveComponent('IconSettings') },
]

const mobileNavItems = [
  { id: 'home',     to: '/',          label: 'Home',     icon: resolveComponent('IconHome') },
  { id: 'tracking', to: '/tracking',  label: 'Work',     icon: resolveComponent('IconClock') },
  { id: 'projects', to: '/projects',  label: 'Projects', icon: resolveComponent('IconFolders') },
  { id: 'invoicing', to: '/invoicing', label: 'Invoices', icon: resolveComponent('IconReceipt') },
]

// Filter nav items based on user role (Admin Panel requires Admin account)
const visibleNavItems = computed(() => {
  return navItems.filter(item => item.id !== 'admin' || authStore.isAdmin)
})

const visibleMobileNavItems = computed(() => {
  return mobileNavItems.filter(item => item.id !== 'admin' || authStore.isAdmin)
})

const pageNames = {
  '/': 'Home',
  '/tracking': 'Work Tracking & History',
  '/projects': 'Projects',
  '/clients': 'Clients Directory',
  '/jobs': 'Jobs',
  '/insights': 'Insights',
  '/admin': 'Admin & Resend Configuration',
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
