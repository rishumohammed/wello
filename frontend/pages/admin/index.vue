<template>
  <div class="admin-page animate-fade-in">
    <!-- Access Denied Card for Non-Admin Accounts -->
    <div v-if="!authStore.isAdmin" class="card card-padded text-center py-12" id="admin-access-denied" style="max-width:600px;margin:40px auto;">
      <div style="font-size:48px;margin-bottom:16px;">🛡️</div>
      <h2 style="font-size:22px;font-weight:700;margin-bottom:8px;color:var(--text-primary);">Admin Account Required</h2>
      <p style="font-size:14px;color:var(--text-tertiary);line-height:1.6;margin-bottom:24px;">
        The Admin Configuration Panel is restricted to separate Admin accounts.<br>
        Your active account <strong>({{ authStore.user?.email || 'User' }})</strong> is a standard User account.
      </p>
      <div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;">
        <NuxtLink to="/" class="btn btn-secondary">
          ← Back to Workspace
        </NuxtLink>
        <button @click="switchToAdminAccount" class="btn btn-primary" id="btn-switch-to-admin">
          ⚡ Sign In as Admin
        </button>
      </div>
    </div>

    <!-- Admin Panel (Only for Admin Accounts) -->
    <div v-else>
      <!-- Admin Header -->
      <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <h1 class="page-title">Admin Configuration Panel</h1>
          <span class="badge" :class="config.hasKey ? 'badge-completed' : 'badge-quoted'">
            {{ config.hasKey ? 'Resend API Connected' : 'Resend Key Required' }}
          </span>
          <span v-if="config.devMode" class="badge badge-potential">
            Sandbox Mode Active
          </span>
        </div>
        <p class="page-subtitle">Configure Resend REST API email delivery, test live dispatches, view authentication logs, and manage accounts.</p>
      </div>

      <div class="flex items-center gap-2">
        <NuxtLink to="/" class="btn btn-secondary btn-sm" id="btn-back-to-app">
          ← Back to Workspace
        </NuxtLink>
      </div>
    </div>

    <!-- Admin Navigation Tabs -->
    <div class="filter-strip mb-6" id="admin-tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="filter-chip"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
        :id="`admin-tab-${t.id}`"
      >
        <component :is="t.icon" :size="14" class="mr-1" />
        {{ t.label }}
      </button>
    </div>

    <!-- Alert / Toast in Admin -->
    <div v-if="alertMessage" class="auth-alert mb-5" :class="alertType" id="admin-alert">
      <span>{{ alertMessage }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="alertMessage = ''">✕</button>
    </div>

    <!-- TAB 1: RESEND EMAIL CONFIGURATION -->
    <div v-if="activeTab === 'config'" class="animate-fade-in" id="admin-tab-content-config">
      <div class="grid-2 gap-6">
        <!-- Configuration Form Card -->
        <div class="card card-padded" id="resend-config-card">
          <div class="card-header px-0 pt-0 mb-4">
            <div>
              <div class="card-title">Resend REST API Settings</div>
              <div class="card-subtitle">Direct integration with https://api.resend.com/emails</div>
            </div>
          </div>

          <form @submit.prevent="saveConfiguration" id="form-save-config">
            <!-- Resend API Key -->
            <div class="form-group mb-4">
              <label class="form-label flex items-center justify-between" for="admin-api-key">
                <span>Resend API Key <span class="text-error">*</span></span>
                <a href="https://resend.com/api-keys" target="_blank" class="text-xs text-brand hover-underline">
                  Get Resend Key ↗
                </a>
              </label>
              <div class="relative">
                <input
                  id="admin-api-key"
                  v-model="apiKeyInput"
                  :type="showKey ? 'text' : 'password'"
                  class="form-input font-mono"
                  placeholder="re_12345678_abcdefghijklmnopqrstuvwxyz"
                  autocomplete="off"
                />
                <button
                  type="button"
                  class="btn-toggle-visibility"
                  @click="showKey = !showKey"
                  :title="showKey ? 'Hide key' : 'Show key'"
                >
                  {{ showKey ? 'Hide' : 'Show' }}
                </button>
              </div>
              <div class="text-tertiary text-xs mt-1" v-if="config.maskedKey && !apiKeyInput">
                Currently stored key: <strong class="font-mono text-primary">{{ config.maskedKey }}</strong>
              </div>
            </div>

            <!-- From Email Address -->
            <div class="form-group mb-4">
              <label class="form-label" for="admin-from-email">
                From Email Address <span class="text-error">*</span>
              </label>
              <input
                id="admin-from-email"
                v-model="formConfig.fromEmail"
                type="email"
                class="form-input"
                placeholder="onboarding@resend.dev or auth@yourdomain.com"
                required
              />
              <div class="text-tertiary text-xs mt-1">
                Use <code>onboarding@resend.dev</code> for testing with Resend account email, or your verified domain.
              </div>
            </div>

            <!-- From Name -->
            <div class="form-group mb-4">
              <label class="form-label" for="admin-from-name">From Sender Name</label>
              <input
                id="admin-from-name"
                v-model="formConfig.fromName"
                type="text"
                class="form-input"
                placeholder="Wello or Wello Security"
              />
            </div>

            <!-- OTP Expiry Minutes -->
            <div class="form-group mb-4">
              <label class="form-label" for="admin-otp-expiry">OTP Expiry Time (Minutes)</label>
              <select id="admin-otp-expiry" v-model.number="formConfig.otpExpiryMinutes" class="form-input">
                <option :value="5">5 Minutes</option>
                <option :value="10">10 Minutes (Recommended)</option>
                <option :value="15">15 Minutes</option>
                <option :value="30">30 Minutes</option>
              </select>
            </div>

            <!-- Dev Sandbox Mode Toggle -->
            <div class="form-group mb-5 pt-3 border-t">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="formConfig.devMode" id="check-dev-mode" />
                <span class="fw-600 text-sm">Enable Dev Sandbox Preview Banner</span>
              </label>
              <div class="text-tertiary text-xs mt-1 ml-5">
                Displays the 6-digit code in the UI for instant local testing when Resend API key is missing or in test mode.
              </div>
            </div>

            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSaving"
              id="btn-save-admin-config"
            >
              <span v-if="isSaving" class="btn-spinner"></span>
              <span>{{ isSaving ? 'Saving…' : 'Save Configuration' }}</span>
            </button>
          </form>
        </div>

        <!-- Info & Setup Guide Card -->
        <div class="card card-padded" id="resend-guide-card">
          <div class="card-header px-0 pt-0 mb-3">
            <div class="card-title">How Resend REST API Works</div>
          </div>

          <div class="flex flex-col gap-4 text-xs text-secondary leading-relaxed">
            <div class="guide-step-box">
              <div class="fw-700 text-sm text-primary mb-1">1. Get your Free API Key</div>
              <p>Sign up at <a href="https://resend.com" target="_blank" class="text-brand hover-underline">resend.com</a> and generate an API key with <code>Sending access</code>.</p>
            </div>

            <div class="guide-step-box">
              <div class="fw-700 text-sm text-primary mb-1">2. Default Sandbox Sender</div>
              <p>During testing, set the <strong>From Email</strong> to <code>onboarding@resend.dev</code>. Resend will deliver emails directly to the account email address registered with your Resend account.</p>
            </div>

            <div class="guide-step-box">
              <div class="fw-700 text-sm text-primary mb-1">3. Custom Domain Setup</div>
              <p>To send OTP emails to any external customer, add and verify your custom domain in the Resend dashboard (DKIM & SPF DNS records).</p>
            </div>

            <div class="guide-step-box">
              <div class="fw-700 text-sm text-primary mb-1">4. REST Endpoint</div>
              <p class="font-mono text-xs" style="background:#F1F5F9; padding:6px 8px; border-radius:4px;">
                POST https://api.resend.com/emails
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: TEST EMAIL DISPATCHER -->
    <div v-else-if="activeTab === 'test'" class="animate-fade-in" id="admin-tab-content-test">
      <div class="grid-2 gap-6">
        <!-- Test Email Sender Form -->
        <div class="card card-padded" id="test-email-sender-card">
          <div class="card-header px-0 pt-0 mb-4">
            <div>
              <div class="card-title">Live Email Delivery Test</div>
              <div class="card-subtitle">Dispatch a test message using your configured Resend REST API credentials</div>
            </div>
          </div>

          <form @submit.prevent="handleSendTestEmail" id="form-test-email">
            <div class="form-group mb-4">
              <label class="form-label" for="test-recipient-email">
                Recipient Email Address <span class="text-error">*</span>
              </label>
              <input
                id="test-recipient-email"
                v-model="testRecipient"
                type="email"
                class="form-input"
                placeholder="your-email@example.com"
                required
                :disabled="isSendingTest"
              />
              <div class="text-tertiary text-xs mt-1">
                If using <code>onboarding@resend.dev</code>, send to your verified Resend account email.
              </div>
            </div>

            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSendingTest || !testRecipient"
              id="btn-dispatch-test-email"
            >
              <span v-if="isSendingTest" class="btn-spinner"></span>
              <span>{{ isSendingTest ? 'Dispatching…' : 'Send Test Email via Resend' }}</span>
            </button>
          </form>
        </div>

        <!-- Live Response Inspector -->
        <div class="card card-padded" id="test-response-inspector">
          <div class="card-header px-0 pt-0 mb-3 flex items-center justify-between">
            <div class="card-title">Resend Response Inspector</div>
            <span v-if="testResponseStatus" class="badge" :class="testResponseStatus === 'success' ? 'badge-completed' : 'badge-lost'">
              {{ testResponseStatus === 'success' ? 'HTTP 200 OK' : 'Dispatch Failed' }}
            </span>
          </div>

          <div v-if="!testResponseData && !testResponseError" class="empty-state" style="padding: 32px 16px;">
            <div class="empty-desc">Enter an email and click send to inspect raw Resend REST API responses.</div>
          </div>

          <div v-else>
            <div v-if="testResponseError" class="auth-alert error mb-3">
              {{ testResponseError }}
            </div>

            <div class="text-xs text-tertiary mb-1 fw-600 uppercase">Raw JSON Payload:</div>
            <pre class="json-inspector-box font-mono text-xs">{{ JSON.stringify(testResponseData || testResponseError, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: AUTH & DELIVERY ACTIVITY LOGS -->
    <div v-else-if="activeTab === 'logs'" class="animate-fade-in" id="admin-tab-content-logs">
      <div class="card" id="admin-auth-logs-card">
        <div class="card-header flex items-center justify-between">
          <div>
            <div class="card-title">Authentication & Delivery Activity Logs</div>
            <div class="card-subtitle">Real-time stream of OTP generation, delivery statuses, and verification events</div>
          </div>
          <button class="btn btn-secondary btn-sm text-xs" @click="fetchLogs" :disabled="isLoadingLogs" id="btn-refresh-logs">
            {{ isLoadingLogs ? 'Refreshing…' : '↻ Refresh Stream' }}
          </button>
        </div>

        <div class="table-wrap">
          <table class="table" id="table-auth-logs">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="logs.length === 0">
                <td colspan="5" class="text-center py-6 text-tertiary text-xs">No activity logged yet.</td>
              </tr>
              <tr v-for="log in logs" :key="log.id" :id="`log-row-${log.id}`">
                <td class="text-xs text-secondary whitespace-nowrap">{{ formatTime(log.timestamp) }}</td>
                <td>
                  <span class="badge" :class="getEventBadgeClass(log.type)">
                    {{ formatEventType(log.type) }}
                  </span>
                </td>
                <td class="fw-600 text-xs text-primary">{{ log.email }}</td>
                <td>
                  <span class="badge" :class="log.status === 'success' ? 'badge-completed' : (log.status === 'failed' ? 'badge-lost' : 'badge-quoted')">
                    {{ log.status }}
                  </span>
                </td>
                <td class="text-xs text-secondary" style="max-width: 320px;">{{ log.details }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: REGISTERED USERS DIRECTORY -->
    <div v-else-if="activeTab === 'users'" class="animate-fade-in" id="admin-tab-content-users">
      <div class="card" id="admin-users-card">
        <div class="card-header flex items-center justify-between">
          <div>
            <div class="card-title">Registered Accounts Directory</div>
            <div class="card-subtitle">All users who authenticated via Email OTP</div>
          </div>
          <button class="btn btn-secondary btn-sm text-xs" @click="fetchUsers" :disabled="isLoadingUsers" id="btn-refresh-users">
            {{ isLoadingUsers ? 'Refreshing…' : '↻ Refresh Users' }}
          </button>
        </div>

        <div class="table-wrap">
          <table class="table" id="table-registered-users">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Profession</th>
                <th class="table-text-right">Target Rate</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in users" :key="u.id" :id="`user-row-${u.id}`">
                <td>
                  <div class="flex items-center gap-2">
                    <div class="user-avatar" style="width:28px; height:28px; font-size:11px;">{{ u.avatarInitials }}</div>
                    <span class="fw-600 text-sm text-primary">{{ u.name }}</span>
                  </div>
                </td>
                <td class="text-xs text-secondary">{{ u.email }}</td>
                <td>
                  <span class="badge" :class="u.role === 'admin' ? 'badge-job' : 'badge-approved'">
                    {{ u.role }}
                  </span>
                </td>
                <td class="text-xs text-secondary">{{ u.serviceCategory || 'Professional' }}</td>
                <td class="table-text-right fw-600 tabular text-sm">
                  {{ store.currency }}{{ u.targetHourly }}/hr
                </td>
                <td class="text-xs text-tertiary">{{ formatTime(u.lastLoginAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <!-- End v-else Admin Panel -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'

const store = useWelloStore()
const authStore = useAuthStore()

function switchToAdminAccount() {
  authStore.loginAsAdminDemo()
}

const activeTab = ref('config')
const tabs = [
  { id: 'config', label: 'Resend API Settings', icon: resolveComponent('IconSettings') },
  { id: 'test',   label: 'Test Email Dispatcher', icon: resolveComponent('IconClock') },
  { id: 'logs',   label: 'Auth & Delivery Logs', icon: resolveComponent('IconInsights') },
  { id: 'users',  label: 'User Directory', icon: resolveComponent('IconUser') },
]

const config = ref({
  hasKey: false,
  maskedKey: '',
  fromEmail: 'onboarding@resend.dev',
  fromName: 'Wello',
  otpExpiryMinutes: 10,
  requireOtp: true,
  devMode: true,
})

const formConfig = ref({
  fromEmail: 'onboarding@resend.dev',
  fromName: 'Wello',
  otpExpiryMinutes: 10,
  requireOtp: true,
  devMode: true,
})

const apiKeyInput = ref('')
const showKey = ref(false)
const isSaving = ref(false)
const alertMessage = ref('')
const alertType = ref('success')

// Test email state
const testRecipient = ref('')
const isSendingTest = ref(false)
const testResponseStatus = ref('')
const testResponseData = ref(null)
const testResponseError = ref(null)

// Logs & Users
const logs = ref([])
const isLoadingLogs = ref(false)
const users = ref([])
const isLoadingUsers = ref(false)

onMounted(async () => {
  if (authStore.isAdmin) {
    await fetchConfig()
    await fetchLogs()
    await fetchUsers()
  }
})

async function fetchConfig() {
  try {
    const res = await $fetch('/api/admin/config')
    if (res?.config) {
      config.value = res.config
      formConfig.value.fromEmail = res.config.fromEmail
      formConfig.value.fromName = res.config.fromName
      formConfig.value.otpExpiryMinutes = res.config.otpExpiryMinutes
      formConfig.value.requireOtp = res.config.requireOtp
      formConfig.value.devMode = res.config.devMode
    }
  } catch (err) {
    console.error('Failed to load admin config', err)
  }
}

async function saveConfiguration() {
  isSaving.value = true
  alertMessage.value = ''

  try {
    const payload = {
      fromEmail: formConfig.value.fromEmail,
      fromName: formConfig.value.fromName,
      otpExpiryMinutes: formConfig.value.otpExpiryMinutes,
      requireOtp: formConfig.value.requireOtp,
      devMode: formConfig.value.devMode,
    }

    if (apiKeyInput.value.trim()) {
      payload.apiKey = apiKeyInput.value.trim()
    }

    const res = await $fetch('/api/admin/config', {
      method: 'POST',
      body: payload,
    })

    if (res?.config) {
      config.value = res.config
      apiKeyInput.value = ''
      alertType.value = 'success'
      alertMessage.value = '✓ Resend REST API configuration saved successfully!'
    }
  } catch (err) {
    alertType.value = 'error'
    alertMessage.value = err?.data?.statusMessage || err?.message || 'Failed to save configuration.'
  } finally {
    isSaving.value = false
  }
}

async function handleSendTestEmail() {
  if (!testRecipient.value) return
  isSendingTest.value = true
  testResponseStatus.value = ''
  testResponseData.value = null
  testResponseError.value = null

  try {
    const res = await $fetch('/api/admin/test-email', {
      method: 'POST',
      body: { to: testRecipient.value },
    })

    testResponseStatus.value = 'success'
    testResponseData.value = res?.data || res
    alertType.value = 'success'
    alertMessage.value = `✓ Test email dispatched to ${testRecipient.value} via Resend REST API!`
    await fetchLogs()
  } catch (err) {
    testResponseStatus.value = 'failed'
    testResponseError.value = err?.data?.statusMessage || err?.message || 'Dispatch failed.'
    testResponseData.value = err?.data
  } finally {
    isSendingTest.value = false
  }
}

async function fetchLogs() {
  isLoadingLogs.value = true
  try {
    const res = await $fetch('/api/admin/logs')
    if (res?.logs) logs.value = res.logs
  } catch (err) {
    console.error('Failed to fetch logs', err)
  } finally {
    isLoadingLogs.value = false
  }
}

async function fetchUsers() {
  isLoadingUsers.value = true
  try {
    const res = await $fetch('/api/admin/users')
    if (res?.users) users.value = res.users
  } catch (err) {
    console.error('Failed to fetch users', err)
  } finally {
    isLoadingUsers.value = false
  }
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  const d = new Date(isoStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatEventType(type) {
  const map = {
    send_otp: 'OTP Sent',
    verify_otp: 'OTP Verified',
    login_success: 'Login Success',
    register_success: 'New Registration',
    verify_failed: 'Verify Failed',
    test_email: 'Test Email',
  }
  return map[type] || type
}

function getEventBadgeClass(type) {
  if (type === 'login_success' || type === 'register_success') return 'badge-completed'
  if (type === 'verify_failed') return 'badge-lost'
  if (type === 'test_email') return 'badge-approved'
  return 'badge-quoted'
}
</script>

<style scoped>
.admin-page {
  max-width: 1120px;
  margin: 0 auto;
}

.guide-step-box {
  background: #F8FAFC;
  border: 1px solid #E2E8F0;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.btn-toggle-visibility {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: var(--font-xs);
  cursor: pointer;
}

.btn-toggle-visibility:hover {
  color: var(--text-primary);
}

.json-inspector-box {
  background: #0F172A;
  color: #38BDF8;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  overflow-x: auto;
  max-height: 280px;
}

.auth-alert {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: var(--font-sm);
}

.auth-alert.error {
  background: rgba(239, 68, 68, 0.08);
  color: #DC2626;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.auth-alert.success {
  background: rgba(16, 185, 129, 0.08);
  color: var(--color-success);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #FFF;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
