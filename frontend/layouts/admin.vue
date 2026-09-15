<template>
  <div class="admin-shell">
    <!-- Admin Sidebar -->
    <aside class="admin-sidebar">
      <div class="sidebar-logo">
        <NuxtLink to="/admin" class="sidebar-logo-link">
          <img src="~/assets/logo.png" alt="Wello" style="height:28px;width:auto;object-fit:contain;" />
          <span class="admin-console-badge">CONSOLE</span>
        </NuxtLink>
      </div>

      <div class="sidebar-section-title">ADMINISTRATION</div>

      <nav class="sidebar-nav">
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
        <div class="sidebar-user">
          <div class="user-avatar-admin">{{ displayAvatar }}</div>
          <div class="user-info">
            <div class="user-name">{{ displayName }}</div>
            <div class="user-role-badge">System Administrator</div>
          </div>
          <button
            @click="handleLogout"
            class="btn-icon"
            title="Sign Out"
            id="admin-logout-btn"
          >
            <IconLogOut :size="15" />
          </button>
        </div>
      </div>
    </aside>

    <!-- Admin Main Content Area -->
    <div class="admin-main">
      <!-- Admin Topbar -->
      <header class="admin-topbar">
        <div class="topbar-left">
          <div class="topbar-title flex items-center gap-2">
            <IconShield :size="18" style="color:var(--color-purple);" />
            <span class="fw-700 text-primary">{{ currentPageTitle }}</span>
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
      <main class="admin-content">
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
.admin-shell {
  display: flex;
  min-height: 100vh;
  background-color: #0F172A;
  color: #F8FAFC;
}

.admin-sidebar {
  width: 250px;
  background: #1E293B;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 100;
}

.sidebar-logo {
  padding: 20px 20px 16px;
  border-bottom: 1px solid #334155;
}

.sidebar-logo-link {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.admin-console-badge {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.8px;
  background: linear-gradient(135deg, #7A3FF6 0%, #FF387D 100%);
  color: #FFFFFF;
  padding: 2px 6px;
  border-radius: 4px;
}

.sidebar-section-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #64748B;
  padding: 20px 20px 8px;
}

.sidebar-nav {
  padding: 0 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  color: #94A3B8;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #F8FAFC;
}

.nav-item.active {
  background: linear-gradient(135deg, rgba(122, 63, 246, 0.25) 0%, rgba(122, 63, 246, 0.1) 100%);
  color: #A78BFA;
  font-weight: 600;
  border-left: 3px solid #7A3FF6;
}

.nav-icon {
  width: 18px;
  height: 18px;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #334155;
  background: #0F172A;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar-admin {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: linear-gradient(135deg, #7A3FF6 0%, #FF387D 100%);
  color: #FFFFFF;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: #F8FAFC;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role-badge {
  font-size: 10px;
  color: #A78BFA;
  font-weight: 500;
}

.btn-icon {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1E293B;
  color: #94A3B8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #334155;
  color: #F8FAFC;
}

.admin-main {
  margin-left: 250px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background-color: #F8FAFC;
  color: #0F172A;
}

.admin-topbar {
  height: 64px;
  background: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 90;
}

.admin-content {
  padding: 24px;
  flex: 1;
}

@media (max-width: 768px) {
  .admin-sidebar {
    width: 60px;
  }
  .sidebar-section-title, .nav-label, .user-info, .admin-console-badge {
    display: none;
  }
  .admin-main {
    margin-left: 60px;
  }
}
</style>
