<template>
  <div class="admin-dashboard animate-fade-in">
    <!-- Stat Cards Grid (Global Wello Card Style) -->
    <div class="grid-4 gap-4 mb-6" id="admin-stat-cards">
      <!-- Card 1: Total Users -->
      <div class="card card-padded" style="border-left: 4px solid var(--color-purple); box-shadow: var(--shadow-sm);">
        <div class="text-xs text-tertiary fw-600 uppercase tracking-wider mb-1">Total Users</div>
        <div class="text-2xl fw-800 text-primary mb-1">{{ users.length }}</div>
        <div class="text-xs text-secondary flex items-center justify-between">
          <span>Registered Accounts</span>
          <NuxtLink to="/admin/users" class="auth-link-highlight">Manage →</NuxtLink>
        </div>
      </div>

      <!-- Card 2: System Roles -->
      <div class="card card-padded" style="border-left: 4px solid var(--color-info); box-shadow: var(--shadow-sm);">
        <div class="text-xs text-tertiary fw-600 uppercase tracking-wider mb-1">Admins & Staff</div>
        <div class="text-2xl fw-800 text-primary mb-1">{{ adminCount }}</div>
        <div class="text-xs text-secondary flex items-center justify-between">
          <span>System Administrators</span>
          <NuxtLink to="/admin/users" class="auth-link-highlight">View All →</NuxtLink>
        </div>
      </div>

      <!-- Card 3: Resend Connection -->
      <div class="card card-padded" :style="{ borderLeft: config.hasKey ? '4px solid var(--color-success)' : '4px solid var(--color-warning)', boxShadow: 'var(--shadow-sm)' }">
        <div class="text-xs text-tertiary fw-600 uppercase tracking-wider mb-1">Resend API Provider</div>
        <div class="text-lg fw-700 text-primary mb-1 truncate">{{ config.fromEmail }}</div>
        <div class="text-xs text-secondary flex items-center justify-between">
          <span>{{ config.hasKey ? 'Live Production API' : 'Sandbox (Dev Mode)' }}</span>
          <NuxtLink to="/admin/config" class="auth-link-highlight">Settings →</NuxtLink>
        </div>
      </div>

      <!-- Card 4: Total Auth Events -->
      <div class="card card-padded" style="border-left: 4px solid var(--color-pink); box-shadow: var(--shadow-sm);">
        <div class="text-xs text-tertiary fw-600 uppercase tracking-wider mb-1">Auth & OTP Events</div>
        <div class="text-2xl fw-800 text-primary mb-1">{{ logs.length }}</div>
        <div class="text-xs text-secondary flex items-center justify-between">
          <span>Recorded Logs</span>
          <NuxtLink to="/admin/logs" class="auth-link-highlight">View Logs →</NuxtLink>
        </div>
      </div>
    </div>

    <!-- Quick Navigation Shortcuts -->
    <div class="card card-padded mb-6">
      <div class="card-title mb-4">Quick Console Controls</div>
      <div class="grid-3 gap-4" id="admin-quick-actions">
        <NuxtLink to="/admin/users" class="card p-4 hover-lift text-decoration-none" style="border:1px solid var(--border-color);display:flex;align-items:center;gap:14px;box-shadow:var(--shadow-xs);">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(122,63,246,0.1);color:var(--color-purple);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <IconUser :size="20" />
          </div>
          <div>
            <div class="fw-700 text-primary text-sm">User Directory & Roles</div>
            <div class="text-xs text-tertiary">Inspect registered users and update role permissions</div>
          </div>
        </NuxtLink>

        <NuxtLink to="/admin/config" class="card p-4 hover-lift text-decoration-none" style="border:1px solid var(--border-color);display:flex;align-items:center;gap:14px;box-shadow:var(--shadow-xs);">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(0,123,255,0.1);color:var(--color-blue);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <IconSettings :size="20" />
          </div>
          <div>
            <div class="fw-700 text-primary text-sm">Resend API Configuration</div>
            <div class="text-xs text-tertiary">API keys, sender names, and OTP expiration limits</div>
          </div>
        </NuxtLink>

        <NuxtLink to="/admin/test-email" class="card p-4 hover-lift text-decoration-none" style="border:1px solid var(--border-color);display:flex;align-items:center;gap:14px;box-shadow:var(--shadow-xs);">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(16,185,129,0.1);color:var(--color-success);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <IconClock :size="20" />
          </div>
          <div>
            <div class="fw-700 text-primary text-sm">Live Email Dispatcher</div>
            <div class="text-xs text-tertiary">Test OTP dispatching directly via Resend REST API</div>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- Recent Audit Logs Table Preview -->
    <div class="card" id="recent-logs-preview">
      <div class="card-header flex items-center justify-between">
        <div>
          <div class="card-title">Recent System Activity</div>
          <div class="card-subtitle">Latest authentication dispatches and security events</div>
        </div>
        <NuxtLink to="/admin/logs" class="btn btn-secondary btn-sm">View Full Logs →</NuxtLink>
      </div>

      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Email</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="logs.length === 0">
              <td colspan="5" class="text-center py-6 text-tertiary text-sm">No activity events logged yet.</td>
            </tr>
            <tr v-for="log in recentLogs" :key="log.id">
              <td class="text-xs text-tertiary whitespace-nowrap">{{ formatTime(log.timestamp) }}</td>
              <td>
                <span class="badge" :class="getEventTypeBadge(log.type)">
                  {{ log.type }}
                </span>
              </td>
              <td class="text-xs fw-600 text-primary">{{ log.email }}</td>
              <td>
                <span class="badge" :class="log.status === 'success' ? 'badge-completed' : (log.status === 'failed' ? 'badge-lost' : 'badge-quoted')">
                  {{ log.status }}
                </span>
              </td>
              <td class="text-xs text-secondary max-w-md truncate">{{ log.details }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const config = ref({
  hasKey: false,
  fromEmail: 'onboarding@resend.dev',
  devMode: true,
})

const users = ref([])
const logs = ref([])

const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const recentLogs = computed(() => logs.value.slice(0, 5))

onMounted(async () => {
  await fetchOverviewData()
})

async function fetchOverviewData() {
  try {
    const [configRes, usersRes, logsRes] = await Promise.all([
      $fetch('/api/admin/config').catch(() => null),
      $fetch('/api/admin/users').catch(() => null),
      $fetch('/api/admin/logs').catch(() => null),
    ])

    if (configRes?.config) config.value = configRes.config
    if (usersRes?.users) users.value = usersRes.users
    if (logsRes?.logs) logs.value = logsRes.logs
  } catch (err) {
    console.error('Failed to load overview data', err)
  }
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (e) {
    return isoStr
  }
}

function getEventTypeBadge(type) {
  if (type === 'login_success' || type === 'register_success') return 'badge-completed'
  if (type === 'verify_failed') return 'badge-lost'
  if (type === 'send_otp') return 'badge-job'
  return 'badge-quoted'
}
</script>
