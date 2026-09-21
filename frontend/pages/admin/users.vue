<template>
  <div class="admin-users-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">Platform User Directory</h1>
        <p class="page-subtitle">Inspect registered accounts with privacy-safe default views and audited financial drilldowns.</p>
      </div>

      <div class="flex items-center gap-3">
        <div class="search-input-wrap">
          <input
            v-model="searchQuery"
            type="text"
            class="form-input text-xs w-240 h-36"
            placeholder="Search users by name or email…"
          />
        </div>
        <button @click="fetchUsers" class="btn btn-secondary btn-sm h-36">
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
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Country</th>
              <th>Status</th>
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
                  <div class="user-avatar">
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
              <td class="text-xs text-secondary font-mono">{{ u.countryCode || 'US' }}</td>
              <td>
                <span class="badge" :class="getStatusBadgeClass(u.status)">
                  {{ u.status || 'ACTIVE' }}
                </span>
              </td>
              <td class="text-xs text-tertiary">{{ formatTime(u.lastLoginAt || u.createdAt) }}</td>
              <td class="table-text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    class="btn btn-secondary btn-xs"
                    @click="openInspectModal(u)"
                    :id="`inspect-user-${u.id}`"
                  >
                    🔍 Inspect
                  </button>

                  <button
                    v-if="canImpersonate && u.role !== 'admin'"
                    type="button"
                    class="btn btn-ghost btn-xs text-purple fw-600"
                    @click="openImpersonateModal(u)"
                    :id="`impersonate-user-${u.id}`"
                    title="Start 15-minute read-only support session"
                  >
                    👤 Impersonate
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- USER INSPECT / DRILLDOWN MODAL -->
    <div v-if="selectedUser" class="modal-backdrop" @click="closeInspectModal">
      <div class="modal-box modal-lg animate-fade-in" @click.stop>
        <div class="modal-header flex items-center justify-between border-b pb-3 mb-4">
          <div class="flex items-center gap-3">
            <div class="user-avatar">{{ selectedUser.avatarInitials }}</div>
            <div>
              <h3 class="text-base font-bold text-primary mb-0">{{ selectedUser.name }}</h3>
              <p class="text-xs text-secondary mb-0 font-mono">{{ selectedUser.email }}</p>
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" @click="closeInspectModal">✕</button>
        </div>

        <!-- Modal Tabs -->
        <div class="flex items-center gap-2 border-b pb-2 mb-4">
          <button
            type="button"
            class="admin-tab-btn"
            :class="{ active: modalTab === 'profile' }"
            @click="modalTab = 'profile'"
          >
            👤 Profile & Activity
          </button>
          <button
            type="button"
            class="admin-tab-btn"
            :class="{ active: modalTab === 'financials' }"
            @click="modalTab = 'financials'"
          >
            🔒 Financial Records
          </button>
        </div>

        <!-- TAB 1: Profile & Activity -->
        <div v-if="modalTab === 'profile'" class="tab-content flex flex-col gap-4">
          <div class="grid-1 md:grid-3 gap-3">
            <div class="p-3 bg-off-white border-soft rounded-8">
              <div class="text-2xs text-tertiary uppercase fw-700">Account Status</div>
              <div class="text-sm font-bold text-primary mt-1">{{ selectedUser.status || 'ACTIVE' }}</div>
            </div>
            <div class="p-3 bg-off-white border-soft rounded-8">
              <div class="text-2xs text-tertiary uppercase fw-700">Country / Timezone</div>
              <div class="text-sm font-bold text-primary mt-1">{{ selectedUser.countryCode || 'US' }} · {{ selectedUser.timezone || 'UTC' }}</div>
            </div>
            <div class="p-3 bg-off-white border-soft rounded-8">
              <div class="text-2xs text-tertiary uppercase fw-700">Registered On</div>
              <div class="text-sm font-bold text-primary mt-1">{{ formatTime(selectedUser.createdAt) }}</div>
            </div>
          </div>

          <!-- Activity summary counts -->
          <div v-if="userActivity" class="grid-1 md:grid-3 gap-3">
            <div class="metric-card p-3">
              <div class="text-xs text-secondary">Total Clients</div>
              <div class="text-lg font-bold text-primary mt-1">{{ userActivity.clientsCount }}</div>
            </div>
            <div class="metric-card p-3">
              <div class="text-xs text-secondary">Active Projects</div>
              <div class="text-lg font-bold text-primary mt-1">{{ userActivity.projectsCount }}</div>
            </div>
            <div class="metric-card p-3">
              <div class="text-xs text-secondary">Work Sessions</div>
              <div class="text-lg font-bold text-primary mt-1">{{ userActivity.sessionsCount }}</div>
            </div>
          </div>

          <!-- Status Action -->
          <div class="p-3 border-soft rounded-8 bg-off-white flex items-center justify-between mt-2">
            <div>
              <div class="text-xs font-bold text-primary">Account Management</div>
              <div class="text-2xs text-secondary">Suspend or reactivate this user account</div>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="selectedUser.status === 'SUSPENDED'"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="updateUserStatus(selectedUser, 'ACTIVE')"
              >
                Reactivate Account
              </button>
              <button
                v-else
                type="button"
                class="btn btn-danger-soft btn-sm text-danger"
                @click="openSuspendPrompt(selectedUser)"
              >
                Suspend Account
              </button>
            </div>
          </div>
        </div>

        <!-- TAB 2: Financial Records (Requires users.financial_view + Reason) -->
        <div v-if="modalTab === 'financials'" class="tab-content">
          <!-- Unlocked Financial View -->
          <div v-if="financialData" class="flex flex-col gap-4 animate-fade-in">
            <div class="p-3 bg-purple-subtle border-purple-soft rounded-8 flex items-center justify-between">
              <div class="text-xs text-purple fw-600">
                🛡️ Financial records unlocked with justification reason. Audit trail recorded.
              </div>
              <span class="badge badge-purple-soft font-mono text-xs">users.financial_view</span>
            </div>

            <!-- Financial KPIs -->
            <div class="grid-1 md:grid-3 gap-3">
              <div class="metric-card p-3">
                <div class="text-xs text-secondary">Target Hourly Rate</div>
                <div class="text-lg font-bold text-primary mt-1">
                  {{ financialData.currencyCode || 'USD' }} ${{ financialData.targetHourly || 0 }}/hr
                </div>
              </div>
              <div class="metric-card p-3">
                <div class="text-xs text-secondary">Total Invoiced</div>
                <div class="text-lg font-bold text-primary mt-1">
                  ${{ (financialData.summary?.totalInvoiced || 0).toLocaleString() }}
                </div>
              </div>
              <div class="metric-card p-3">
                <div class="text-xs text-secondary">Total Paid</div>
                <div class="text-lg font-bold text-primary mt-1">
                  ${{ (financialData.summary?.totalPaid || 0).toLocaleString() }}
                </div>
              </div>
            </div>

            <!-- Invoices list -->
            <div class="border-soft rounded-8 overflow-hidden">
              <div class="p-2.5 bg-off-white border-b font-bold text-xs text-primary">Invoices ({{ financialData.invoices?.length || 0 }})</div>
              <div class="table-responsive max-h-48 overflow-y-auto">
                <table class="table text-xs">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Status</th>
                      <th>Issue Date</th>
                      <th class="table-text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!financialData.invoices?.length">
                      <td colspan="4" class="text-center py-4 text-tertiary">No invoices created.</td>
                    </tr>
                    <tr v-for="inv in financialData.invoices" :key="inv.id">
                      <td class="font-mono">{{ inv.invoiceNumber || inv.id }}</td>
                      <td><span class="badge badge-quoted">{{ inv.status }}</span></td>
                      <td class="text-tertiary">{{ inv.issueDate || '—' }}</td>
                      <td class="table-text-right font-bold">${{ Number(inv.totalAmount || 0).toFixed(2) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Payments list -->
            <div class="border-soft rounded-8 overflow-hidden">
              <div class="p-2.5 bg-off-white border-b font-bold text-xs text-primary">Payments Received ({{ financialData.payments?.length || 0 }})</div>
              <div class="table-responsive max-h-48 overflow-y-auto">
                <table class="table text-xs">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Date</th>
                      <th class="table-text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!financialData.payments?.length">
                      <td colspan="3" class="text-center py-4 text-tertiary">No payments received.</td>
                    </tr>
                    <tr v-for="p in financialData.payments" :key="p.id">
                      <td class="font-mono">#{{ p.id }}</td>
                      <td class="text-tertiary">{{ p.paidDate || '—' }}</td>
                      <td class="table-text-right font-bold text-green">${{ Number(p.amount || 0).toFixed(2) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Locked View: Permission Check & Reason Form -->
          <div v-else class="p-6 text-center border-soft rounded-12 bg-off-white flex flex-col items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-purple-subtle flex items-center justify-center text-purple text-xl">
              🔒
            </div>
            <div>
              <h4 class="text-sm font-bold text-primary mb-1">Protected Personal Income Data</h4>
              <p class="text-xs text-secondary max-w-md mx-auto mb-0">
                Viewing individual quotes, invoices, payments, and hourly rates requires the <code>users.financial_view</code> permission and a mandatory business justification reason.
              </p>
            </div>

            <div v-if="!canViewFinancials" class="p-3 bg-danger-subtle text-danger text-xs rounded-8 mt-2">
              ⚠️ Access Denied: Your role ({{ authStore.user?.adminRole || 'ADMIN' }}) does not possess the <code>users.financial_view</code> permission. Only Super Administrators can view personal income data.
            </div>

            <form v-else @submit.prevent="unlockFinancials" class="w-full max-w-md mt-3 flex flex-col gap-3">
              <div class="form-group text-left">
                <label class="form-label text-xs">Business Justification Reason <span class="text-danger">*</span></label>
                <input
                  v-model="financialReason"
                  type="text"
                  class="form-input text-xs"
                  placeholder="e.g. Investigating billing dispute in Ticket #482"
                  required
                  minlength="5"
                />
              </div>
              <button
                type="submit"
                class="btn btn-primary btn-sm w-full"
                :disabled="isUnlocking || !financialReason.trim()"
              >
                <span v-if="isUnlocking">Unlocking & Auditing…</span>
                <span v-else>Unlock Financial Records (Audited)</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- USER IMPERSONATION MODAL -->
    <div v-if="impersonatingUser" class="modal-backdrop" @click="impersonatingUser = null">
      <div class="modal-box modal-md animate-fade-in" @click.stop>
        <div class="modal-header flex items-center justify-between border-b pb-3 mb-4">
          <h3 class="text-base font-bold text-primary mb-0">Start Support Impersonation</h3>
          <button class="btn btn-ghost btn-sm" @click="impersonatingUser = null">✕</button>
        </div>

        <div class="p-3 bg-amber-subtle text-amber border-soft rounded-8 text-xs mb-4">
          ⚠️ <strong>Strict Constraints:</strong> This session will be <strong>strictly read-only</strong> and expire automatically in <strong>15 minutes</strong>. All actions are recorded in the audit trail.
        </div>

        <form @submit.prevent="executeImpersonation" class="flex flex-col gap-4">
          <div class="form-group">
            <label class="form-label text-xs">Target User</label>
            <input :value="`${impersonatingUser.name} (${impersonatingUser.email})`" disabled class="form-input text-xs bg-off-white" />
          </div>

          <div class="form-group">
            <label class="form-label text-xs">Customer Support Reason <span class="text-danger">*</span></label>
            <textarea
              v-model="impersonationReason"
              class="form-textarea text-xs"
              rows="3"
              placeholder="e.g. Assisting customer with invoice preview error reported in Zendesk Ticket #1029"
              required
              minlength="5"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t">
            <button type="button" class="btn btn-secondary btn-sm" @click="impersonatingUser = null">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="isStartingImpersonation || !impersonationReason.trim()">
              <span v-if="isStartingImpersonation">Starting Session…</span>
              <span v-else>Launch Read-Only Session</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const authStore = useAuthStore()
const toast = useToast()

const users = ref([])
const searchQuery = ref('')
const isLoading = ref(false)
const alertMessage = ref('')
const alertType = ref('success')

// Inspect modal states
const selectedUser = ref(null)
const modalTab = ref('profile')
const userActivity = ref(null)
const financialData = ref(null)
const financialReason = ref('')
const isUnlocking = ref(false)

// Impersonation modal states
const impersonatingUser = ref(null)
const impersonationReason = ref('')
const isStartingImpersonation = ref(false)

const canViewFinancials = computed(() => {
  const role = authStore.user?.adminRole
  const perms = authStore.user?.adminPermissions || []
  return role === 'SUPER_ADMIN' || perms.includes('users.financial_view')
})

const canImpersonate = computed(() => {
  const role = authStore.user?.adminRole
  const perms = authStore.user?.adminPermissions || []
  return role === 'SUPER_ADMIN' || role === 'SUPPORT' || perms.includes('users.impersonate')
})

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

async function openInspectModal(u) {
  selectedUser.value = u
  modalTab.value = 'profile'
  financialData.value = null
  financialReason.value = ''
  userActivity.value = null

  try {
    const res = await $fetch(`/api/admin/users/${u.id}`)
    if (res?.user?.activitySummary) {
      userActivity.value = res.user.activitySummary
    }
  } catch (err) {
    console.error('Failed to load user drilldown:', err)
  }
}

function closeInspectModal() {
  selectedUser.value = null
  financialData.value = null
  userActivity.value = null
}

async function unlockFinancials() {
  if (!financialReason.value.trim() || financialReason.value.length < 5) {
    toast.error('Please enter a valid reason (minimum 5 characters).')
    return
  }

  isUnlocking.value = true
  try {
    const res = await $fetch(`/api/admin/users/${selectedUser.value.id}/financials`, {
      query: { reason: financialReason.value.trim() },
    })

    if (res?.financials) {
      financialData.value = res.financials
      toast.success('Financial records unlocked and audited.')
    }
  } catch (err) {
    const msg = err?.data?.statusMessage || 'Access denied to financial records.'
    toast.error(msg)
  } finally {
    isUnlocking.value = false
  }
}

function openImpersonateModal(u) {
  impersonatingUser.value = u
  impersonationReason.value = ''
}

async function executeImpersonation() {
  if (!impersonationReason.value.trim() || impersonationReason.value.length < 5) {
    toast.error('Please enter a valid reason.')
    return
  }

  isStartingImpersonation.value = true
  try {
    const res = await $fetch('/api/admin/users/impersonate', {
      method: 'POST',
      body: {
        userId: impersonatingUser.value.id,
        reason: impersonationReason.value.trim(),
      },
    })

    if (res?.impersonationToken && res?.user) {
      toast.success(`Started read-only session for ${impersonatingUser.value.name}.`)
      // Save session and redirect to user dashboard
      authStore.setSession(res.impersonationToken, {
        ...res.user,
        isImpersonation: true,
        impersonatorEmail: authStore.user?.email,
      })
      impersonatingUser.value = null
      navigateTo('/')
    }
  } catch (err) {
    const msg = err?.data?.statusMessage || 'Failed to start impersonation session.'
    toast.error(msg)
  } finally {
    isStartingImpersonation.value = false
  }
}

async function updateUserStatus(u, newStatus) {
  try {
    await $fetch('/api/admin/users/status', {
      method: 'POST',
      body: { userId: u.id, status: newStatus },
    })
    u.status = newStatus
    toast.success(`User status updated to ${newStatus}.`)
  } catch (err) {
    toast.error(err?.data?.statusMessage || 'Failed to update user status.')
  }
}

function openSuspendPrompt(u) {
  if (confirm(`Are you sure you want to suspend account for ${u.name}?`)) {
    updateUserStatus(u, 'SUSPENDED')
  }
}

function getStatusBadgeClass(st) {
  if (st === 'ACTIVE') return 'badge-approved'
  if (st === 'SUSPENDED' || st === 'BLOCKED') return 'badge-lost'
  return 'badge-potential'
}

function formatTime(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch (e) {
    return isoStr
  }
}
</script>
