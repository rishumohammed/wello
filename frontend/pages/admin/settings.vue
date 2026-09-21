<template>
  <div class="admin-settings-page flex flex-col gap-5 animate-fade-in">
    <!-- Page Header & Tab Controls -->
    <div class="card card-padded bg-white border-soft rounded-16">
      <div class="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div>
          <h1 class="text-xl font-bold text-primary mb-1">Admin Console Settings</h1>
          <p class="text-xs text-secondary mb-0">System configuration, email engine, security RBAC, and audit logs.</p>
        </div>
      </div>

      <!-- Settings Sub-Tabs Navigation -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 border-b">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          @click="activeTab = tab.id"
          class="admin-tab-btn"
          :class="{ active: activeTab === tab.id }"
        >
          <component :is="tab.icon" :size="14" />
          <span>{{ tab.label }}</span>
        </button>
      </div>
    </div>

    <!-- TAB 1: Resend API Configuration -->
    <div v-if="activeTab === 'resend'" class="tab-content animate-fade-in">
      <div class="grid-1 md:grid-2 gap-6">
        <!-- Configuration Form Card -->
        <div class="card card-padded">
          <div class="card-title text-base mb-1">Resend REST API Credentials</div>
          <div class="card-subtitle text-xs mb-4">Endpoint integration with https://api.resend.com/emails</div>

          <form @submit.prevent="saveConfiguration">
            <div class="form-group mb-4">
              <label class="form-label flex items-center justify-between" for="admin-api-key">
                <span>Resend API Key</span>
                <span class="text-xs text-tertiary">Starts with <code>re_</code></span>
              </label>
              <div class="flex items-center gap-2">
                <input
                  id="admin-api-key"
                  v-model="apiKeyInput"
                  :type="showKey ? 'text' : 'password'"
                  class="form-input"
                  :placeholder="config.hasKey ? config.maskedKey : 're_123456789...'"
                  autocomplete="off"
                />
                <button type="button" class="btn btn-secondary btn-sm" @click="showKey = !showKey">
                  {{ showKey ? 'Hide' : 'Show' }}
                </button>
              </div>
            </div>

            <div class="form-group mb-4">
              <label class="form-label" for="admin-from-email">Sender Email Address</label>
              <input id="admin-from-email" v-model="formConfig.fromEmail" type="email" class="form-input" placeholder="onboarding@resend.dev" required />
            </div>

            <div class="form-group mb-4">
              <label class="form-label" for="admin-from-name">From Sender Name</label>
              <input id="admin-from-name" v-model="formConfig.fromName" type="text" class="form-input" placeholder="Wello Verification" required />
            </div>

            <div class="form-group mb-4">
              <label class="form-label" for="admin-otp-expiry">OTP Expiry Time (Minutes)</label>
              <select id="admin-otp-expiry" v-model.number="formConfig.otpExpiryMinutes" class="form-select">
                <option :value="5">5 Minutes</option>
                <option :value="10">10 Minutes (Recommended)</option>
                <option :value="15">15 Minutes</option>
                <option :value="30">30 Minutes</option>
              </select>
            </div>

            <div class="form-group mb-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="formConfig.devMode" />
                <span class="text-sm font-semibold">Dev Sandbox Banner Mode</span>
              </label>
            </div>

            <button type="submit" class="btn btn-primary w-full" :disabled="isSaving">
              <span v-if="isSaving">Saving Settings…</span>
              <span v-else>Save Resend Configuration</span>
            </button>
          </form>
        </div>

        <!-- Status Card -->
        <div class="card card-padded">
          <div class="card-title text-base mb-2">Integration Status</div>
          <div class="p-4 border-radius-sm mb-4" :class="config.hasKey ? 'status-box-connected' : 'status-box-sandbox'">
            <div class="status-box-title font-bold text-sm mb-1">
              {{ config.hasKey ? '✓ Live Resend API Connected' : '⚡ Local Dev Sandbox Active' }}
            </div>
            <div class="text-xs text-secondary">
              {{ config.hasKey ? 'Dispatches will be delivered to real recipient inboxes via Resend HTTP API.' : 'Without an API key, generated OTP codes display in local dev mode.' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: Email Templates -->
    <div v-if="activeTab === 'templates'" class="tab-content animate-fade-in">
      <div class="card card-padded">
        <div class="flex items-center justify-between mb-4">
          <div>
            <div class="card-title text-base">Transactional Email Templates</div>
            <div class="card-subtitle text-xs">Manage HTML template layouts and placeholders</div>
          </div>
          <button type="button" @click="saveTemplates" class="btn btn-primary btn-sm" :disabled="savingTmpl">
            {{ savingTmpl ? 'Saving…' : 'Save Templates' }}
          </button>
        </div>

        <div class="grid-1 md:grid-2 gap-4">
          <div v-for="tmpl in emailTemplates" :key="tmpl.id" class="p-4 border-radius-sm border-soft bg-off-white">
            <div class="font-bold text-sm text-primary mb-1">{{ tmpl.name }}</div>
            <div class="text-xs text-tertiary mb-3">{{ tmpl.description }}</div>
            <div class="form-group mb-2">
              <label class="form-label text-xs">Subject Line</label>
              <input v-model="tmpl.subject" type="text" class="form-input text-xs" />
            </div>
            <div class="form-group">
              <label class="form-label text-xs">HTML Body</label>
              <textarea v-model="tmpl.bodyHtml" class="form-textarea text-xs" rows="4"></textarea>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: Email Delivery Logs -->
    <div v-if="activeTab === 'email-logs'" class="tab-content animate-fade-in">
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <div>
            <div class="card-title text-base">Transactional Email Delivery Logs</div>
            <div class="card-subtitle text-xs">History of all OTP and transactional email dispatches</div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table text-xs">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Recipient Email</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Provider ID</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="emailLogs.length === 0">
                <td colspan="5" class="text-center py-6 text-tertiary">No email dispatches recorded yet.</td>
              </tr>
              <tr v-for="log in emailLogs" :key="log.id">
                <td class="text-tertiary whitespace-nowrap">{{ formatTime(log.timestamp || log.createdAt) }}</td>
                <td class="font-bold text-primary">{{ log.recipient || log.email }}</td>
                <td class="text-secondary max-w-xs truncate">{{ log.subject || 'Wello Verification' }}</td>
                <td>
                  <span class="badge" :class="log.status === 'DELIVERED' || log.status === 'success' ? 'badge-completed' : 'badge-lost'">
                    {{ log.status }}
                  </span>
                </td>
                <td class="font-mono text-tertiary text-xs">{{ log.resendId || log.id }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: Immutable Audit Trail -->
    <div v-if="activeTab === 'audit'" class="tab-content animate-fade-in">
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <div>
            <div class="card-title text-base">Immutable System Audit Log</div>
            <div class="card-subtitle text-xs">Complete event audit trail across all administrative operations</div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table text-xs">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Module</th>
                <th>Action</th>
                <th>Admin Email</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="auditLogs.length === 0">
                <td colspan="5" class="text-center py-6 text-tertiary">No audit events recorded yet.</td>
              </tr>
              <tr v-for="log in auditLogs" :key="log.id">
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
                <td class="font-bold text-primary">{{ log.adminEmail || 'System' }}</td>
                <td class="text-secondary max-w-md truncate">{{ log.details || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 5: Admin Roles & RBAC -->
    <div v-if="activeTab === 'roles'" class="tab-content animate-fade-in">
      <div class="grid-1 md:grid-2 gap-6">
        <!-- Roles List Card -->
        <div class="card card-padded">
          <div class="card-title text-base mb-1">Admin Roles Definition</div>
          <div class="card-subtitle text-xs mb-4">Configured RBAC role hierarchies</div>

          <div class="flex flex-col gap-3">
            <div
              v-for="role in roles"
              :key="role.roleKey || role.id"
              class="p-4 border-radius-sm border-soft bg-off-white"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="font-bold text-sm text-primary">{{ role.name }}</span>
                <span class="badge badge-completed font-mono text-xs">{{ role.roleKey }}</span>
              </div>
              <p class="text-xs text-secondary mb-2">{{ role.description }}</p>
              <div class="text-xs text-tertiary font-semibold">Permissions ({{ role.permissions?.length || 0 }}):</div>
              <div class="flex flex-wrap gap-1 mt-1">
                <span v-for="p in role.permissions" :key="p" class="badge bg-white border-subtle text-purple text-2xs">
                  {{ p }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- System Administrators List -->
        <div class="card card-padded">
          <div class="card-title text-base mb-1">Active Administrators</div>
          <div class="card-subtitle text-xs mb-4">Platform accounts with administrative privileges</div>

          <div class="flex flex-col gap-2.5">
            <div v-for="admin in admins" :key="admin.id" class="p-3 border-radius-sm flex items-center justify-between border-soft bg-white">
              <div>
                <div class="font-bold text-sm text-primary">{{ admin.name }}</div>
                <div class="text-xs text-tertiary">{{ admin.email }}</div>
              </div>
              <span class="badge badge-purple-soft fw-700">
                {{ admin.roleKey || admin.role }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useToast } from '~/composables/useToast'
import IconSettings from '~/components/IconSettings.vue'
import IconEdit from '~/components/IconEdit.vue'
import IconClock from '~/components/IconClock.vue'
import IconShield from '~/components/IconShield.vue'
import IconUser from '~/components/IconUser.vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

const activeTab = ref(route.query.tab || 'resend')

const tabs = [
  { id: 'resend', label: 'Resend API Settings', icon: IconSettings },
  { id: 'templates', label: 'Email Templates', icon: IconEdit },
  { id: 'email-logs', label: 'Email Delivery Logs', icon: IconClock },
  { id: 'audit', label: 'Immutable Audit Trail', icon: IconShield },
  { id: 'roles', label: 'Admin Roles & RBAC', icon: IconUser },
]

// Data states
const config = ref({})
const formConfig = ref({ fromEmail: '', fromName: '', otpExpiryMinutes: 10, devMode: true })
const apiKeyInput = ref('')
const showKey = ref(false)
const isSaving = ref(false)

const emailTemplates = ref([])
const savingTmpl = ref(false)
const emailLogs = ref([])
const auditLogs = ref([])
const roles = ref([])
const admins = ref([])

watch(activeTab, (newTab) => {
  router.replace({ query: { ...route.query, tab: newTab } })
})

onMounted(async () => {
  if (route.query.tab) {
    activeTab.value = route.query.tab
  }
  await fetchAllSettingsData()
})

async function fetchAllSettingsData() {
  try {
    const [configRes, tmplRes, logsRes, auditRes, rolesRes] = await Promise.all([
      $fetch('/api/admin/config').catch(() => null),
      $fetch('/api/admin/email-templates').catch(() => null),
      $fetch('/api/admin/logs').catch(() => null),
      $fetch('/api/admin/audit-logs').catch(() => null),
      $fetch('/api/admin/roles').catch(() => null),
    ])

    if (configRes?.config) {
      config.value = configRes.config
      formConfig.value.fromEmail = configRes.config.fromEmail
      formConfig.value.fromName = configRes.config.fromName
      formConfig.value.otpExpiryMinutes = configRes.config.otpExpiryMinutes
      formConfig.value.devMode = configRes.config.devMode
    }
    if (tmplRes?.templates) emailTemplates.value = tmplRes.templates
    if (logsRes?.logs) emailLogs.value = logsRes.logs
    if (auditRes?.logs) auditLogs.value = auditRes.logs
    if (rolesRes?.roles) {
      roles.value = rolesRes.roles
      admins.value = rolesRes.admins || []
    }
  } catch (err) {
    console.error('Failed to load settings data:', err)
  }
}

async function saveConfiguration() {
  isSaving.value = true
  try {
    const payload = { ...formConfig.value }
    if (apiKeyInput.value.trim()) payload.apiKey = apiKeyInput.value.trim()
    const res = await $fetch('/api/admin/config', { method: 'POST', body: payload })
    if (res?.config) {
      config.value = res.config
      apiKeyInput.value = ''
      toast.success('Resend configuration saved!')
    }
  } catch (err) {
    toast.error('Failed to save configuration.')
  } finally {
    isSaving.value = false
  }
}

async function saveTemplates() {
  savingTmpl.value = true
  try {
    await $fetch('/api/admin/email-templates', {
      method: 'POST',
      body: { templates: emailTemplates.value },
    })
    toast.success('Email templates updated!')
  } catch (err) {
    toast.error('Failed to update email templates.')
  } finally {
    savingTmpl.value = false
  }
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch (e) {
    return isoStr
  }
}

function getActionBadgeClass(action) {
  if (!action) return 'badge-secondary'
  if (action.includes('APPROVED') || action.includes('CREATED')) return 'badge-completed'
  if (action.includes('REJECTED') || action.includes('SUSPENDED')) return 'badge-lost'
  return 'badge-quoted'
}
</script>
