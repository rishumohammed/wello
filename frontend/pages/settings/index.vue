<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Settings</h1>
      <p class="page-subtitle">Manage your profile, work preferences, and application defaults.</p>
    </div>

    <div class="grid-2 gap-6">
      <!-- Profile -->
      <div class="card" id="settings-profile-card">
        <div class="card-header">
          <div class="card-title">Your Profile</div>
        </div>
        <div class="card-body">
          <div class="flex items-center gap-4 mb-6">
            <div class="user-avatar" style="width:56px; height:56px; font-size:var(--font-base); border-radius:var(--radius-xl);">
              {{ store.user.avatarInitials }}
            </div>
            <div>
              <div class="fw-700 text-lg">{{ store.user.name }}</div>
              <div class="text-tertiary text-sm">{{ store.user.email }}</div>
            </div>
          </div>
          <div class="flex flex-col gap-4">
            <div class="form-group">
              <label class="form-label" for="settings-name">Full Name</label>
              <input id="settings-name" v-model="profileForm.name" class="form-input" type="text" />
            </div>
            <div class="form-group">
              <label class="form-label" for="settings-email">Email Address</label>
              <input id="settings-email" v-model="profileForm.email" class="form-input" type="email" />
            </div>
            <div class="form-actions" style="padding-top:0; border-top:none;">
              <button class="btn btn-primary btn-sm" @click="saveProfile" id="btn-save-profile">Save Profile</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Work Preferences -->
      <div class="card" id="settings-work-prefs-card">
        <div class="card-header">
          <div class="card-title">Work Value Preferences</div>
        </div>
        <div class="card-body">
          <div class="flex flex-col gap-4">
            <div class="form-group">
              <label class="form-label" for="settings-target-hourly">Target Hourly Value ({{ store.currency }})</label>
              <input
                id="settings-target-hourly"
                v-model.number="prefForm.targetHourly"
                class="form-input"
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 1500"
              />
              <span class="form-hint">Your effective value goal per hour of work.</span>
            </div>
            <div class="form-group">
              <label class="form-label" for="settings-currency">Currency Symbol</label>
              <select id="settings-currency" v-model="prefForm.currency" class="form-select">
                <option value="₹">₹ Indian Rupee</option>
                <option value="$">$ US Dollar</option>
                <option value="€">€ Euro</option>
                <option value="£">£ British Pound</option>
                <option value="¥">¥ Japanese Yen</option>
                <option value="AED">AED</option>
                <option value="SGD">SGD</option>
              </select>
            </div>
            <div class="form-actions" style="padding-top:0; border-top:none;">
              <button class="btn btn-primary btn-sm" @click="savePrefs" id="btn-save-prefs">Save Preferences</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Clients -->
      <div class="card" id="settings-clients-card">
        <div class="card-header">
          <div class="card-title">Clients</div>
          <button class="btn btn-secondary btn-sm" @click="showClientModal = true" id="btn-add-client">
            <IconPlus :size="13" /> Add Client
          </button>
        </div>
        <div class="card-body" style="padding:0;">
          <div v-for="client in store.clients" :key="client.id" class="client-row" :id="`client-row-${client.id}`">
            <div class="user-avatar" style="width:32px;height:32px;font-size:10px;">
              {{ initials(client.name) }}
            </div>
            <div class="flex-1 min-width-0">
              <div class="fw-500 text-sm truncate">{{ client.name }}</div>
              <div class="text-tertiary text-xs">{{ client.company || client.email || '—' }}</div>
            </div>
          </div>
          <div v-if="store.clients.length === 0" class="empty-state" style="padding:24px;">
            <div class="empty-title" style="font-size:var(--font-sm);">No clients yet</div>
          </div>
        </div>
      </div>

      <!-- Account & Session -->
      <div class="card" id="settings-account-card">
        <div class="card-header">
          <div class="card-title">Account & Security</div>
        </div>
        <div class="card-body">
          <div class="value-row">
            <span class="value-row-label">Signed in as</span>
            <span class="value-row-amount">{{ authStore.user?.email || store.user.email }}</span>
          </div>
          <div class="value-row">
            <span class="value-row-label">Authentication Method</span>
            <span class="value-row-amount">Email OTP (Resend REST API)</span>
          </div>
          <div class="value-row">
            <span class="value-row-label">Account Role</span>
            <span class="value-row-amount">{{ authStore.isAdmin ? 'Administrator' : 'User' }}</span>
          </div>
          <div class="mt-6 pt-4 border-t flex items-center justify-between">
            <span class="text-tertiary text-xs">End current authenticated session</span>
            <button class="btn btn-secondary btn-sm" @click="authStore.logout()" id="btn-settings-signout" style="color:#DC2626; border-color:rgba(239,68,68,0.3);">
              <IconLogOut :size="14" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <!-- App info -->
      <div class="card" id="settings-app-info-card">
        <div class="card-header">
          <div class="card-title">About Wello</div>
        </div>
        <div class="card-body">
          <div class="value-row">
            <span class="value-row-label">Version</span>
            <span class="value-row-amount">1.0.0</span>
          </div>
          <div class="value-row">
            <span class="value-row-label">Total Projects</span>
            <span class="value-row-amount">{{ store.projects.length }}</span>
          </div>
          <div class="value-row">
            <span class="value-row-label">Work Sessions Logged</span>
            <span class="value-row-amount">{{ store.sessions.length }}</span>
          </div>
          <div class="value-row">
            <span class="value-row-label">Total Time Tracked</span>
            <span class="value-row-amount">{{ totalTimeTracked }}</span>
          </div>
          <p class="text-tertiary text-xs mt-4">
            Your work value data is stored locally in your browser for this prototype. MySQL persistence is supported — configure your <code>.env</code> file to activate.
          </p>
        </div>
      </div>
    </div>

    <!-- Add client modal -->
    <Teleport to="body">
      <div class="modal-overlay" v-if="showClientModal" @click.self="showClientModal = false">
        <div class="modal modal-sm" role="dialog">
          <div class="modal-header">
            <div class="modal-title">Add Client</div>
            <button class="modal-close" @click="showClientModal = false"><IconX /></button>
          </div>
          <form @submit.prevent="saveClient" novalidate>
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label" for="client-name">Name <span class="required">*</span></label>
                <input id="client-name" v-model="clientForm.name" class="form-input" :class="{ error: clientErrors.name }" type="text" placeholder="Contact or company name" />
                <span v-if="clientErrors.name" class="form-error">{{ clientErrors.name }}</span>
              </div>
              <div class="form-group">
                <label class="form-label" for="client-company">Company</label>
                <input id="client-company" v-model="clientForm.company" class="form-input" type="text" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="client-email">Email</label>
                  <input id="client-email" v-model="clientForm.email" class="form-input" type="email" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="client-phone">Phone</label>
                  <input id="client-phone" v-model="clientForm.phone" class="form-input" type="tel" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="showClientModal = false">Cancel</button>
              <button type="submit" class="btn btn-primary" id="btn-save-client">Add Client</button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

const store = useWelloStore()
const authStore = useAuthStore()
const toast = useToast()
const showClientModal = ref(false)

const profileForm = reactive({ name: store.user.name, email: store.user.email })
const prefForm    = reactive({ targetHourly: store.user.targetHourly, currency: store.user.currency })
const clientForm  = reactive({ name: '', company: '', email: '', phone: '' })
const clientErrors = reactive({ name: '' })

const totalTimeTracked = computed(() => {
  const total = store.sessions.reduce((s, x) => s + (x.durationMin || 0), 0)
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}h ${m}m`
})

function saveProfile() {
  store.user.name  = profileForm.name
  store.user.email = profileForm.email
  const parts = profileForm.name.split(' ')
  store.user.avatarInitials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '')
  toast.success('Profile updated.')
}

function savePrefs() {
  store.user.targetHourly = prefForm.targetHourly
  store.user.currency     = prefForm.currency
  toast.success('Preferences saved.')
}

function saveClient() {
  clientErrors.name = ''
  if (!clientForm.name.trim()) { clientErrors.name = 'Name is required.'; return }
  store.createClient({ ...clientForm })
  toast.success(`Client "${clientForm.name}" added.`)
  clientForm.name = ''; clientForm.company = ''; clientForm.email = ''; clientForm.phone = ''
  showClientModal.value = false
}

function initials(name) {
  const p = name.split(' ')
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()
}
</script>

<style scoped>
.client-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-5);
  border-bottom: var(--border-subtle);
  transition: background var(--transition-fast);
}
.client-row:last-child { border-bottom: none; }
.client-row:hover { background: var(--color-off-white); }
</style>
