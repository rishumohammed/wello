<template>
  <div class="admin-users-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">Platform User Directory</h1>
        <p class="page-subtitle">Inspect registered accounts, update user roles between Standard User and Admin Console Access.</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="search-input-wrap">
          <input
            v-model="searchQuery"
            type="text"
            class="form-input text-xs"
            placeholder="Search users by name or email…"
            style="width:240px;height:36px;"
          />
        </div>
        <button @click="fetchUsers" class="btn btn-secondary btn-sm" style="height:36px;">
          🔄 Refresh
        </button>
      </div>
    </div>

    <!-- Alert / Toast -->
    <div v-if="alertMessage" class="auth-alert mb-5" :class="alertType" id="users-alert">
      <span>{{ alertMessage }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="alertMessage = ''">✕</button>
    </div>

    <!-- Users Table Card -->
    <div class="card" id="admin-users-card">
      <div class="card-header flex items-center justify-between">
        <div>
          <div class="card-title">Registered Accounts ({{ filteredUsers.length }})</div>
          <div class="card-subtitle">Showing all active user profiles across Wello platform</div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Profession</th>
              <th class="table-text-right">Target Rate</th>
              <th>Last Active</th>
              <th class="table-text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-8 text-tertiary">Loading user directory…</td>
            </tr>
            <tr v-else-if="filteredUsers.length === 0">
              <td colspan="7" class="text-center py-8 text-tertiary">No users found matching your search.</td>
            </tr>
            <tr v-for="u in filteredUsers" :key="u.id" :id="`user-row-${u.id}`">
              <td>
                <div class="flex items-center gap-2">
                  <div class="user-avatar" style="width:32px; height:32px; font-size:12px; background:linear-gradient(135deg, #7A3FF6 0%, #FF387D 100%); color:#FFF;">
                    {{ u.avatarInitials }}
                  </div>
                  <span class="fw-600 text-sm text-primary">{{ u.name }}</span>
                </div>
              </td>
              <td class="text-xs text-secondary font-mono">{{ u.email }}</td>
              <td>
                <span class="badge" :class="u.role === 'admin' ? 'badge-job' : 'badge-approved'">
                  {{ u.role === 'admin' ? '🛡️ Admin' : '👤 User' }}
                </span>
              </td>
              <td class="text-xs text-secondary">{{ u.serviceCategory || 'Independent Professional' }}</td>
              <td class="table-text-right fw-600 tabular text-sm">
                {{ store.currency }}{{ u.targetHourly }}/hr
              </td>
              <td class="text-xs text-tertiary">{{ formatTime(u.lastLoginAt) }}</td>
              <td class="table-text-right">
                <button
                  v-if="u.email !== authStore.user?.email"
                  @click="toggleUserRole(u)"
                  class="btn btn-ghost btn-sm text-xs"
                  :title="`Switch role to ${u.role === 'admin' ? 'user' : 'admin'}`"
                >
                  Switch to {{ u.role === 'admin' ? 'User' : 'Admin' }}
                </button>
                <span v-else class="text-xs text-tertiary italic">Active Admin</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const store = useWelloStore()
const authStore = useAuthStore()

const users = ref([])
const searchQuery = ref('')
const isLoading = ref(false)
const alertMessage = ref('')
const alertType = ref('success')

const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) return users.value
  const q = searchQuery.value.toLowerCase().trim()
  return users.value.filter(u =>
    (u.name && u.name.toLowerCase().includes(q)) ||
    (u.email && u.email.toLowerCase().includes(q))
  )
})

onMounted(async () => {
  await fetchUsers()
})

async function fetchUsers() {
  isLoading.value = true
  try {
    const res = await $fetch('/api/admin/users')
    if (res?.users) {
      users.value = res.users
    }
  } catch (err) {
    console.error('Failed to load users', err)
    alertMessage.value = 'Failed to load user directory.'
    alertType.value = 'error'
  } finally {
    isLoading.value = false
  }
}

function toggleUserRole(user) {
  const newRole = user.role === 'admin' ? 'user' : 'admin'
  user.role = newRole
  alertMessage.value = `Updated ${user.name}'s role to ${newRole.toUpperCase()}.`
  alertType.value = 'success'
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch (e) {
    return isoStr
  }
}
</script>
