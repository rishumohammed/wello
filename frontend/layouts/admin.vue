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

      <div class="sidebar-footer">
        <div class="sidebar-user" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;min-width:0;">
            <div class="user-avatar" style="background:var(--grad-brand);color:#FFFFFF;font-weight:700;">{{ displayAvatar }}</div>
            <div class="user-info" style="min-width:0;">
              <div class="user-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ displayName }}</div>
              <div class="user-role" style="font-size:11px;color:var(--color-purple);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">System Admin</div>
            </div>
          </div>
          <button
            @click="handleLogout"
            class="btn-icon"
            title="Sign Out"
            style="width:30px;height:30px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-secondary);color:var(--text-tertiary);cursor:pointer;display:flex;align-items:center;justify-content:center;"
            id="admin-logout-btn"
          >
            <IconLogOut :size="15" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Admin Main Content Area -->
    <div class="app-main">
      <!-- Admin Topbar -->
      <header class="app-topbar">
        <div class="topbar-left">
          <NuxtLink to="/admin" class="topbar-mobile-logo" style="text-decoration:none;">
            <img src="~/assets/logo.png" alt="Wello" style="height:26px;width:auto;object-fit:contain;" />
          </NuxtLink>
          <div class="topbar-breadcrumb">
            <span class="current" style="display:flex;align-items:center;gap:8px;">
              <IconShield :size="16" style="color:var(--color-purple);" />
              {{ currentPageTitle }}
            </span>
          </div>
        </div>

        <div class="topbar-right">
          <!-- Switch to User Workspace -->
          <NuxtLink
            to="/"
            class="btn btn-secondary btn-sm"
            style="display:flex;align-items:center;gap:6px;font-size:12px;text-decoration:none;height:34px;"
            id="admin-to-user-workspace"
          >
            <IconHome :size="14" />
            <span>User Workspace</span>
          </NuxtLink>

          <!-- Admin Profile / Sign Out -->
          <button
            @click="handleLogout"
            class="btn btn-ghost btn-sm"
            style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;height:34px;"
            id="topbar-admin-signout"
          >
            <IconLogOut :size="14" />
            <span>Sign Out</span>
          </button>
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
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

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
  authStore.logout()
  router.push('/login')
}

const navItems = [
  { id: 'overview',   to: '/admin',             label: 'Overview Dashboard', icon: resolveComponent('IconGrid') },
  { id: 'users',      to: '/admin/users',       label: 'User Directory',     icon: resolveComponent('IconUser') },
  { id: 'config',     to: '/admin/config',      label: 'Resend & API Settings', icon: resolveComponent('IconSettings') },
  { id: 'test-email', to: '/admin/test-email',  label: 'Email Dispatcher',   icon: resolveComponent('IconClock') },
  { id: 'logs',       to: '/admin/logs',        label: 'Audit & Auth Logs',  icon: resolveComponent('IconInsights') },
]

const pageTitles = {
  '/admin': 'Admin Overview Dashboard',
  '/admin/users': 'Platform User Directory',
  '/admin/config': 'Resend REST API Configuration',
  '/admin/test-email': 'Live Email Dispatcher & Tester',
  '/admin/logs': 'Audit Trail & Authentication Event Logs',
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
