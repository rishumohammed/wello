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

      <div class="sidebar-footer">
        <div class="sidebar-user" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <div class="user-avatar">{{ displayAvatar }}</div>
            <div class="user-info" style="min-width:0;">
              <div class="user-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ displayName }}</div>
              <div class="user-role" style="font-size:11px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ displayEmail || 'Independent' }}</div>
            </div>
          </div>
          <button
            v-if="authStore.isAuthenticated"
            @click="handleLogout"
            class="btn-icon"
            title="Sign Out"
            style="width:30px;height:30px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-tertiary);cursor:pointer;display:flex;align-items:center;justify-content:center;"
          >
            <IconLogOut :size="15" />
          </button>
          <NuxtLink
            v-else
            to="/login"
            class="btn-icon"
            title="Sign In"
            style="width:30px;height:30px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-primary);cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;"
          >
            <IconUser :size="15" />
          </NuxtLink>
        </div>
      </div>
    </aside>

    <!-- Main area -->
    <div class="app-main">
      <!-- Topbar -->
      <header class="app-topbar">
        <div class="topbar-left">
          <NuxtLink to="/" class="topbar-mobile-logo" style="text-decoration:none;">
            <img src="~/assets/logo.png" alt="Wello" style="height:26px;width:auto;object-fit:contain;" />
          </NuxtLink>
          <div class="topbar-breadcrumb">
            <span class="current">{{ currentPageTitle }}</span>
          </div>
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
          <div v-else style="display:flex;align-items:center;gap:8px;">
            <button
              @click="handleLogout"
              class="btn btn-secondary btn-sm"
              style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;height:34px;"
              id="topbar-signout-btn"
            >
              <IconLogOut :size="13" />
              <span>Sign Out</span>
            </button>
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
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'

const store = useWelloStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const showTimerModal = ref(false)

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
  { id: 'home',     to: '/',          label: 'Home',          icon: resolveComponent('IconHome') },
  { id: 'tracking', to: '/tracking',  label: 'Work Tracking', icon: resolveComponent('IconClock') },
  { id: 'projects', to: '/projects',  label: 'Projects',      icon: resolveComponent('IconFolders') },
  { id: 'jobs',     to: '/jobs',      label: 'Jobs',          icon: resolveComponent('IconBriefcase') },
  { id: 'insights', to: '/insights',  label: 'Insights',      icon: resolveComponent('IconInsights') },
  { id: 'admin',    to: '/admin',     label: 'Admin Panel',   icon: resolveComponent('IconShield') },
  { id: 'settings', to: '/settings',  label: 'Settings',      icon: resolveComponent('IconSettings') },
]

const mobileNavItems = [
  { id: 'home',     to: '/',          label: 'Home',     icon: resolveComponent('IconHome') },
  { id: 'tracking', to: '/tracking',  label: 'Work',     icon: resolveComponent('IconClock') },
  { id: 'projects', to: '/projects',  label: 'Projects', icon: resolveComponent('IconFolders') },
  { id: 'jobs',     to: '/jobs',      label: 'Jobs',     icon: resolveComponent('IconBriefcase') },
  { id: 'admin',    to: '/admin',     label: 'Admin',    icon: resolveComponent('IconShield') },
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
