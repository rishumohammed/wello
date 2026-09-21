<template>
  <div class="admin-dashboard flex flex-col gap-6 animate-fade-in">
    <!-- 5 KPI Metric Cards Grid (Matching Wello Global UI Design Style) -->
    <div class="grid-2 md:grid-5 gap-4" id="admin-stat-cards">
      <!-- Card 1: Total Users -->
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Total Users</span>
          <div class="metric-icon-box kpi-icon-1">
            <IconUser :size="18" />
          </div>
        </div>
        <div>
          <div class="metric-value kpi-val-1 mb-2">
            {{ stats.totalUsers || 0 }}
          </div>
          <div class="flex items-center justify-between">
            <span class="badge badge-completed">
              ● Active: {{ stats.activeUsers || 0 }}
            </span>
            <NuxtLink
              to="/admin/users"
              class="btn btn-ghost btn-sm"
            >
              <span>View</span>
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Card 2: Category Queue -->
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Category Queue</span>
          <div class="metric-icon-box kpi-icon-2">
            <IconAlert :size="18" />
          </div>
        </div>
        <div>
          <div class="metric-value kpi-val-2 mb-2">
            {{ stats.pendingCategoryRequests || 0 }}
          </div>
          <div class="flex items-center justify-between">
            <span
              class="badge"
              :class="stats.pendingCategoryRequests > 0 ? 'badge-quoted' : 'badge-potential'"
            >
              {{ stats.pendingCategoryRequests > 0 ? 'Action Needed' : 'All Clear' }}
            </span>
            <NuxtLink
              to="/admin/category-requests"
              class="btn btn-ghost btn-sm"
            >
              <span>Review</span>
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Card 3: Jobs & Services -->
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Jobs & Services</span>
          <div class="metric-icon-box kpi-icon-3">
            <IconBriefcase :size="18" />
          </div>
        </div>
        <div>
          <div class="metric-value kpi-val-3 mb-2">
            {{ stats.totalJobs || 0 }}
          </div>
          <div class="flex items-center justify-between">
            <span class="badge badge-approved">
              {{ stats.activeJobs || 0 }} Active
            </span>
            <NuxtLink
              to="/admin/jobs"
              class="btn btn-ghost btn-sm"
            >
              <span>Moderate</span>
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Card 4: Funnel Rate -->
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Funnel Rate</span>
          <div class="metric-icon-box kpi-icon-4">
            <IconInsights :size="18" />
          </div>
        </div>
        <div>
          <div class="metric-value kpi-val-4 mb-2">
            {{ funnelSummary.overallConversionRate || 0 }}%
          </div>
          <div class="flex items-center justify-between">
            <span class="badge badge-completed">
              Completion Rate
            </span>
            <NuxtLink
              to="/admin/registration-pipeline"
              class="btn btn-ghost btn-sm"
            >
              <span>Funnel</span>
              <span>→</span>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Card 5: Audit Activity -->
      <div class="metric-card hover-lift">
        <div class="metric-header">
          <span class="metric-label">Audit Activity</span>
          <div class="metric-icon-box kpi-icon-5">
            <IconShield :size="18" />
          </div>
        </div>
        <div>
          <div class="metric-value kpi-val-5 mb-2">
            {{ stats.auditLogsCount || 0 }}
          </div>
          <div class="flex items-center justify-between">
            <span class="badge badge-in-progress">
              Recorded Events
            </span>
            <button
              @click="activeTab = 'audit'"
              class="btn btn-ghost btn-sm"
            >
              <span>Logs</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Middle Split: Registration Funnel Visualizer & Category Request Queue -->
    <div class="grid-1 md:grid-2 gap-6">
      <!-- Onboarding Funnel Progress -->
      <div class="card card-padded">
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="card-title text-base">Registration Funnel Overview</div>
            <div class="card-subtitle text-xs">Conversion across key user onboarding stages</div>
          </div>
          <NuxtLink to="/admin/registration-pipeline" class="btn btn-secondary btn-sm text-xs">Full Pipeline →</NuxtLink>
        </div>

        <div class="flex flex-col gap-3">
          <div v-for="stage in keyFunnelStages" :key="stage.stageName" class="flex flex-col gap-1">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-primary">{{ stage.stageLabel }}</span>
              <span class="text-secondary font-mono">{{ stage.count }} users ({{ stage.conversionRate }}%)</span>
            </div>
            <div class="progress-track-sm">
              <div
                class="progress-fill-gradient rounded-4 h-full transition-width"
                :style="{ width: `${stage.conversionRate}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pending Category Requests Queue -->
      <div class="card card-padded">
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="card-title text-base">Pending Category Requests</div>
            <div class="card-subtitle text-xs">User taxonomy submissions awaiting review</div>
          </div>
          <NuxtLink to="/admin/category-requests" class="btn btn-secondary btn-sm text-xs">Manage Queue →</NuxtLink>
        </div>

        <div v-if="pendingRequests.length === 0" class="text-center py-8 text-tertiary text-xs">
          ✨ All category requests have been processed!
        </div>

        <div v-else class="flex flex-col gap-2.5">
          <div
            v-for="req in pendingRequests.slice(0, 3)"
            :key="req.id"
            class="flex items-center justify-between p-2.5 bg-off-white rounded-8 border-soft"
          >
            <div>
              <div class="font-bold text-sm text-primary">{{ req.requestedName }}</div>
              <div class="text-xs text-tertiary">Requested by {{ req.userEmail }} · {{ req.requestCount }} request(s)</div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="quickApproveCategory(req.id)"
                class="btn btn-primary btn-sm btn-xs-pad text-xs"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Console Shortcuts Grid (8 Color-Coded Module Cards) -->
    <div class="card card-padded">
      <div class="card-title text-base mb-4">Console Management Modules</div>
      <div class="grid-2 md:grid-4 gap-4" id="admin-quick-actions">
        <NuxtLink
          v-for="module in consoleModules"
          :key="module.to"
          :to="module.to"
          class="card p-3 hover-lift text-decoration-none border-soft flex items-center gap-3"
        >
          <div
            :style="{ background: module.bg, color: module.color }"
            class="icon-box-40 rounded-10 flex items-center justify-center flex-shrink-0"
          >
            <component :is="module.icon" :size="18" />
          </div>
          <div class="min-w-0">
            <div class="font-bold text-primary text-xs truncate">{{ module.title }}</div>
            <div class="text-xs text-tertiary truncate">{{ module.desc }}</div>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- Recent System Audit Activity Table -->
    <div class="card" id="recent-logs-preview">
      <div class="card-header flex items-center justify-between">
        <div>
          <div class="card-title text-base">Recent Audit Trail</div>
          <div class="card-subtitle text-xs">Latest system changes and administrative security logs</div>
        </div>
        <NuxtLink to="/admin/audit-logs" class="btn btn-secondary btn-sm text-xs">View All Audit Logs →</NuxtLink>
      </div>

      <div class="table-responsive">
        <table class="table text-xs">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Module</th>
              <th>Action</th>
              <th>Admin / User</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="auditLogs.length === 0">
              <td colspan="5" class="text-center py-6 text-tertiary">No audit activity recorded yet.</td>
            </tr>
            <tr v-for="log in recentAuditLogs" :key="log.id">
              <td class="text-tertiary whitespace-nowrap">{{ formatTime(log.createdAt) }}</td>
              <td>
                <span class="badge bg-off-white border-soft text-secondary text-2xs">
                  {{ log.module }}
                </span>
              </td>
              <td>
                <span class="badge" :class="getActionBadgeClass(log.action)">
                  {{ log.action }}
                </span>
              </td>
              <td class="font-medium text-primary">{{ log.adminEmail || 'System' }}</td>
              <td class="text-secondary max-w-md truncate">{{ log.details || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useToast } from '~/composables/useToast'
import IconUser from '~/components/IconUser.vue'
import IconAlert from '~/components/IconAlert.vue'
import IconBriefcase from '~/components/IconBriefcase.vue'
import IconInsights from '~/components/IconInsights.vue'
import IconClock from '~/components/IconClock.vue'
import IconFolders from '~/components/IconFolders.vue'
import IconEdit from '~/components/IconEdit.vue'
import IconShield from '~/components/IconShield.vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const toast = useToast()
const refreshing = ref(false)

const stats = ref({})
const funnel = ref([])
const funnelSummary = ref({})
const categoryRequests = ref([])
const auditLogs = ref([])
const config = ref({})

const currentDateStr = computed(() => {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
})

const pendingRequests = computed(() => {
  return categoryRequests.value.filter(r => r.status === 'PENDING')
})

const keyFunnelStages = computed(() => {
  if (!funnel.value || funnel.value.length === 0) return []
  const labelsMap = {
    'registration_started': '1. Registration Started',
    'email_entered': '2. Email Entered',
    'password_created': '3. Password Created',
    'service_selected': '4. Service Selected',
    'first_project_created': '5. First Project Created',
  }
  return funnel.value
    .filter(s => labelsMap[s.stageName])
    .map(s => ({
      ...s,
      stageLabel: labelsMap[s.stageName],
    }))
})

const recentAuditLogs = computed(() => {
  return auditLogs.value.slice(0, 6)
})

const consoleModules = [
  { title: 'User Directory', desc: 'Accounts & status', to: '/admin/users', icon: IconUser, bg: 'rgba(122,63,246,0.1)', color: 'var(--color-purple)' },
  { title: 'Registration Funnel', desc: 'Drop-off analytics', to: '/admin/registration-pipeline', icon: IconClock, bg: 'rgba(16,185,129,0.1)', color: 'var(--color-success)' },
  { title: 'Categories', desc: 'Master taxonomy', to: '/admin/categories', icon: IconFolders, bg: 'rgba(255,159,28,0.1)', color: 'var(--color-sunrise)' },
  { title: 'Category Requests', desc: 'User request queue', to: '/admin/category-requests', icon: IconAlert, bg: 'rgba(255,56,125,0.1)', color: 'var(--color-pink)' },
  { title: 'Jobs & Services', desc: 'Listing moderation', to: '/admin/jobs', icon: IconBriefcase, bg: 'rgba(0,123,255,0.1)', color: 'var(--color-blue)' },
  { title: 'Analytics Center', desc: 'Platform intelligence', to: '/admin/analytics', icon: IconInsights, bg: 'rgba(59,130,246,0.1)', color: 'var(--color-info)' },
  { title: 'Resend & Email Engine', desc: 'API keys & templates', to: '/admin/settings?tab=resend', icon: IconEdit, bg: 'rgba(122,63,246,0.1)', color: 'var(--color-purple)' },
  { title: 'Security & Roles', desc: 'Admin RBAC', to: '/admin/settings?tab=roles', icon: IconShield, bg: 'rgba(16,185,129,0.1)', color: 'var(--color-success)' },
]

onMounted(async () => {
  await fetchOverviewData()
})

async function fetchOverviewData() {
  refreshing.value = true
  try {
    const [statsRes, funnelRes, requestsRes, logsRes, configRes] = await Promise.all([
      $fetch('/api/admin/stats').catch(() => null),
      $fetch('/api/admin/funnel').catch(() => null),
      $fetch('/api/admin/category-requests').catch(() => null),
      $fetch('/api/admin/audit-logs').catch(() => null),
      $fetch('/api/admin/config').catch(() => null),
    ])

    if (statsRes?.stats) stats.value = statsRes.stats
    if (funnelRes?.funnel) {
      funnel.value = funnelRes.funnel
      funnelSummary.value = funnelRes.summary || {}
    }
    if (requestsRes?.requests) categoryRequests.value = requestsRes.requests
    if (logsRes?.logs) auditLogs.value = logsRes.logs
    if (configRes?.config) config.value = configRes.config
  } catch (err) {
    console.error('Failed to load admin overview data:', err)
  } finally {
    refreshing.value = false
  }
}

async function refreshData() {
  await fetchOverviewData()
  toast.success('Admin Dashboard updated.')
}

async function quickApproveCategory(requestId) {
  try {
    const res = await $fetch('/api/admin/category-requests', {
      method: 'POST',
      body: {
        requestId,
        action: 'APPROVE',
        adminEmail: 'admin@wello.com',
      },
    })
    toast.success(res?.message || 'Category approved!')
    await fetchOverviewData()
  } catch (err) {
    toast.error('Failed to approve category request.')
  }
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (e) {
    return isoStr
  }
}

function getActionBadgeClass(action) {
  if (!action) return 'badge-secondary'
  if (action.includes('APPROVED') || action.includes('CREATED') || action.includes('SUCCESS')) return 'badge-completed'
  if (action.includes('REJECTED') || action.includes('SUSPENDED') || action.includes('BLOCKED')) return 'badge-lost'
  return 'badge-quoted'
}
</script>
