<template>
  <div class="admin-settings-page flex flex-col gap-5 animate-fade-in">
    <!-- Page Header & Tab Controls -->
    <div class="card card-padded bg-white border-soft rounded-16">
      <div class="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div>
          <h1 class="text-xl font-bold text-primary mb-1">Admin Console Settings</h1>
          <p class="text-xs text-secondary mb-0">System configuration, email engine, 5-tier RBAC security, and tamper-evident audit logs.</p>
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
          :id="`tab-btn-${tab.id}`"
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
            <div class="card-subtitle text-xs">History of all OTP and transactional email dispatches (Secrets & Codes Redacted)</div>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table text-xs">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Recipient</th>
                <th>Type / Subject</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="emailLogs.length === 0">
                <td colspan="5" class="text-center py-6 text-tertiary">No email dispatches recorded yet.</td>
              </tr>
              <tr v-for="log in emailLogs" :key="log.id">
                <td class="text-tertiary whitespace-nowrap">{{ formatTime(log.timestamp || log.createdAt) }}</td>
                <td class="font-bold text-primary font-mono">{{ log.email || log.recipient }}</td>
                <td class="text-secondary max-w-xs truncate">{{ log.type || log.subject || 'Verification' }}</td>
                <td>
                  <span class="badge" :class="log.status === 'DELIVERED' || log.status === 'success' ? 'badge-completed' : 'badge-lost'">
                    {{ log.status }}
                  </span>
                </td>
                <td class="text-secondary max-w-md truncate">{{ log.details || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 4: Cryptographically Tamper-Evident Audit Trail -->
    <div v-if="activeTab === 'audit'" class="tab-content animate-fade-in flex flex-col gap-4">
      <!-- Chain Verification Action Card -->
      <div class="card card-padded bg-off-white border-soft">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div class="text-sm font-bold text-primary flex items-center gap-2">
              <span>🛡️ Tamper-Evident Append-Only Audit Trail</span>
              <span class="badge badge-purple-soft font-mono text-2xs">SHA-256 Hash Chain</span>
            </div>
            <div class="text-xs text-secondary mt-1">
              Every sensitive read and admin mutation is chained using previous hash pointers to guarantee non-repudiation and cryptographic integrity.
            </div>
          </div>

          <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="runChainVerification"
            :disabled="isVerifyingChain"
            id="verify-chain-btn"
          >
            <span v-if="isVerifyingChain">Verifying Cryptographic Chain…</span>
            <span v-else>🔍 Verify Chain Integrity</span>
          </button>
        </div>

        <!-- Verification Results Banner -->
        <div v-if="chainStatus" class="mt-3 p-3 rounded-8 text-xs flex items-center justify-between animate-fade-in" :class="chainStatus.valid ? 'bg-green-subtle text-green border-green' : 'bg-danger-subtle text-danger border-danger'">
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm">{{ chainStatus.valid ? '✓ Cryptographic Chain Intact' : '⚠ Tampering Detected' }}</span>
            <span>— {{ chainStatus.valid ? `All ${chainStatus.totalEntries} entries verified unaltered from Genesis.` : chainStatus.reason }}</span>
          </div>
          <span class="font-mono text-2xs opacity-75">Verified at {{ formatTime(chainStatus.verifiedAt) }}</span>
        </div>
      </div>

      <!-- Audit Logs Table -->
      <div class="card">
        <div class="table-responsive">
          <table class="table text-xs">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Permission</th>
                <th>Action</th>
                <th>Target</th>
                <th>Reason / Details</th>
                <th>Hash Pointer</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="auditLogs.length === 0">
                <td colspan="7" class="text-center py-6 text-tertiary">No audit events recorded yet.</td>
              </tr>
              <tr v-for="log in auditLogs" :key="log.id" :id="`audit-row-${log.id}`">
                <td class="text-tertiary whitespace-nowrap">{{ formatTime(log.createdAt) }}</td>
                <td class="font-bold text-primary font-mono">{{ log.adminEmail || 'System' }}</td>
                <td>
                  <span class="badge bg-white border-soft text-purple text-2xs font-mono">
                    {{ log.permissionUsed || 'system' }}
                  </span>
                </td>
                <td>
                  <span class="badge" :class="getActionBadgeClass(log.action)">
                    {{ log.action }}
                  </span>
                </td>
                <td class="text-secondary max-w-xs truncate">{{ log.target || '—' }}</td>
                <td class="text-secondary max-w-sm truncate" :title="log.reason || log.newValue || log.prevValue">
                  <span v-if="log.reason" class="fw-600 text-primary">"{{ log.reason }}"</span>
                  <span v-else>{{ log.newValue || log.prevValue || '—' }}</span>
                </td>
                <td>
                  <span class="font-mono text-2xs text-tertiary" :title="`Hash: ${log.hash}\nPrev: ${log.previousHash}`">
                    {{ (log.hash || '').slice(0, 10) }}…
                  </span>
                </td>
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
          <div class="card-title text-base mb-1">5-Tier Admin Roles Matrix</div>
          <div class="card-subtitle text-xs mb-4">Configured RBAC role hierarchies and permissions</div>

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
                <span v-for="p in role.permissions" :key="p" class="badge bg-white border-subtle text-purple text-2xs font-mono">
                  {{ p }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- System Administrators List -->
        <div class="card card-padded">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="card-title text-base mb-0">Active Administrators</div>
              <div class="card-subtitle text-xs">Accounts with administrative RBAC roles</div>
            </div>
            <button class="btn btn-secondary btn-sm" @click="showAddAdminModal = true">
              + Add Admin
            </button>
          </div>

          <div class="flex flex-col gap-2.5">
            <div v-for="admin in admins" :key="admin.id" class="p-3 border-radius-sm flex items-center justify-between border-soft bg-white">
              <div>
                <div class="font-bold text-sm text-primary">{{ admin.name }}</div>
                <div class="text-xs text-tertiary font-mono">{{ admin.email }}</div>
              </div>
              <div class="flex items-center gap-2">
                <span class="badge badge-purple-soft fw-700">
                  {{ admin.roleKey || admin.role }}
                </span>
                <button
                  v-if="admin.email !== 'admin@wello.com'"
                  type="button"
                  class="btn btn-ghost btn-xs text-secondary"
                  @click="openEditAdminRole(admin)"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- STEP-UP RE-AUTH OTP MODAL -->
    <div v-if="pendingRoleAction" class="modal-backdrop" @click="pendingRoleAction = null">
      <div class="modal-box modal-md animate-fade-in" @click.stop>
        <div class="modal-header flex items-center justify-between border-b pb-3 mb-4">
          <h3 class="text-base font-bold text-primary mb-0">Admin Re-Authentication Required</h3>
          <button class="btn btn-ghost btn-sm" @click="pendingRoleAction = null">✕</button>
        </div>

        <div class="p-3 bg-purple-subtle border-purple-soft rounded-8 text-xs text-purple mb-4">
          🔐 Modifying administrator roles is a sensitive action. Enter the 6-digit OTP code dispatched to your email (<strong>{{ authStore.user?.email }}</strong>).
        </div>

        <form @submit.prevent="submitRoleChangeWithOtp" class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label text-xs">Target Action</label>
            <input :value="`Set ${pendingRoleAction.targetEmail} to ${pendingRoleAction.newRoleKey}`" disabled class="form-input text-xs bg-off-white" />
          </div>

          <div class="form-group">
            <label class="form-label text-xs">6-Digit Verification Code <span class="text-danger">*</span></label>
            <div class="flex items-center gap-2">
              <input
                v-model="reauthOtpCode"
                type="text"
                class="form-input text-center font-mono text-base font-bold tracking-wider"
                placeholder="123456"
                maxlength="6"
                required
              />
              <button
                type="button"
                class="btn btn-secondary btn-sm whitespace-nowrap"
                @click="requestReauthOtp"
                :disabled="isRequestingOtp"
              >
                {{ isRequestingOtp ? 'Sending…' : 'Resend Code' }}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t">
            <button type="button" class="btn btn-secondary btn-sm" @click="pendingRoleAction = null">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="isSubmittingRole || reauthOtpCode.length < 6">
              <span v-if="isSubmittingRole">Verifying & Applying…</span>
              <span v-else>Confirm & Update Role</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAuthStore } from '~/stores/auth'
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
const authStore = useAuthStore()

const activeTab = ref(route.query.tab || 'resend')

const tabs = [
  { id: 'resend', label: 'Resend API Settings', icon: IconSettings },
  { id: 'templates', label: 'Email Templates', icon: IconEdit },
  { id: 'email-logs', label: 'Email Delivery Logs', icon: IconClock },
  { id: 'audit', label: 'Tamper-Evident Audit Trail', icon: IconShield },
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

// Chain verification state
const isVerifyingChain = ref(false)
const chainStatus = ref(null)

// Step-up OTP modal state
const pendingRoleAction = ref(null)
const reauthOtpCode = ref('')
const isRequestingOtp = ref(false)
const isSubmittingRole = ref(false)
const showAddAdminModal = ref(false)

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

async function runChainVerification() {
  isVerifyingChain.value = true
  try {
    const res = await $fetch('/api/admin/audit-logs/verify')
    chainStatus.value = res
    if (res?.valid) {
      toast.success(`Cryptographic chain intact: ${res.totalEntries} entries verified.`)
    } else {
      toast.error('Audit chain tampering detected!')
    }
  } catch (err) {
    toast.error('Failed to run chain verification.')
  } finally {
    isVerifyingChain.value = false
  }
}

function openEditAdminRole(admin) {
  const currentRole = admin.roleKey || 'ADMIN'
  const nextRole = currentRole === 'ADMIN' ? 'SUPPORT' : currentRole === 'SUPPORT' ? 'ANALYST' : 'ADMIN'
  pendingRoleAction.value = {
    targetEmail: admin.email,
    targetUserId: admin.userId || admin.id,
    newRoleKey: nextRole,
  }
  reauthOtpCode.value = ''
  requestReauthOtp()
}

async function requestReauthOtp() {
  isRequestingOtp.value = true
  try {
    const res = await $fetch('/api/admin/security/request-otp', {
      method: 'POST',
      body: { actionType: 'roles' },
    })
    toast.success(res?.message || 'Verification code sent to your email.')
    if (res?.devOtp) {
      reauthOtpCode.value = res.devOtp
    }
  } catch (err) {
    toast.error('Failed to dispatch re-authentication code.')
  } finally {
    isRequestingOtp.value = false
  }
}

async function submitRoleChangeWithOtp() {
  if (!reauthOtpCode.value || reauthOtpCode.value.length < 6) {
    toast.error('Please enter 6-digit code.')
    return
  }

  isSubmittingRole.value = true
  try {
    await $fetch('/api/admin/roles', {
      method: 'POST',
      body: {
        action: 'UPDATE_ROLE',
        targetEmail: pendingRoleAction.value.targetEmail,
        targetUserId: pendingRoleAction.value.targetUserId,
        roleKey: pendingRoleAction.value.newRoleKey,
        reauthOtp: reauthOtpCode.value.trim(),
      },
    })
    toast.success(`Role updated for ${pendingRoleAction.value.targetEmail}.`)
    pendingRoleAction.value = null
    await fetchAllSettingsData()
  } catch (err) {
    toast.error(err?.data?.statusMessage || 'Failed to update role.')
  } finally {
    isSubmittingRole.value = false
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
  if (action.includes('APPROVED') || action.includes('CREATED') || action.includes('VERIFIED')) return 'badge-completed'
  if (action.includes('REJECTED') || action.includes('SUSPENDED') || action.includes('FLAG')) return 'badge-lost'
  if (action.includes('FINANCIAL') || action.includes('IMPERSONATION')) return 'badge-purple-soft text-purple'
  return 'badge-quoted'
}
</script>
