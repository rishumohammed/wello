<template>
  <div class="settings-page animate-fade-in flex flex-col gap-5">
    <!-- Page Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Manage your personal profile, business branding, target hourly rates, and app defaults.</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-primary btn-sm" @click="saveAll" id="btn-save-all-settings">
          <IconCheck :size="14" />
          <span>Save All Settings</span>
        </button>
      </div>
    </div>

    <!-- Category Tabs Strip -->
    <div class="filter-strip mb-2" id="settings-tabs-strip">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="filter-chip"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
        :id="`tab-settings-${t.id}`"
      >
        <component :is="t.icon" :size="14" />
        <span>{{ t.label }}</span>
      </button>
    </div>

    <!-- TAB 1: PERSONAL PROFILE -->
    <div v-if="activeTab === 'profile'" class="settings-section">
      <div class="card" id="settings-profile-card">
        <div class="card-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="metric-icon-box purple">
              <IconUser :size="16" />
            </div>
            <div>
              <div class="card-title text-base">Personal Profile</div>
              <div class="card-subtitle text-xs">Your account credentials and display name</div>
            </div>
          </div>
        </div>

        <div class="card-body">
          <div class="flex items-center gap-5 mb-6 p-4 bg-off-white border-subtle-box rounded-14">
            <div class="user-avatar avatar-preview-box">
              {{ store.user.avatarInitials || 'U' }}
            </div>
            <div>
              <div class="fw-700 text-base text-primary">{{ profileForm.name || 'User' }}</div>
              <div class="text-tertiary text-xs mt-0.5">{{ profileForm.email }}</div>
              <div class="badge badge-purple text-xs font-semibold mt-2">
                Wello {{ authStore.isAdmin ? 'Administrator' : 'Account Owner' }}
              </div>
            </div>
          </div>

          <div class="grid-2 gap-4">
            <div class="form-group">
              <label class="form-label" for="settings-name">Full Name <span class="required">*</span></label>
              <input id="settings-name" v-model="profileForm.name" class="form-input" type="text" placeholder="e.g. Alex Morgan" />
            </div>

            <div class="form-group">
              <label class="form-label" for="settings-email">Primary Email Address <span class="required">*</span></label>
              <input id="settings-email" v-model="profileForm.email" class="form-input" type="email" placeholder="alex@example.com" />
            </div>
          </div>

          <div class="form-actions mt-4 pt-4 border-t flex justify-end">
            <button class="btn btn-primary btn-sm" @click="saveProfile" id="btn-save-profile">Save Profile</button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: BUSINESS & INVOICING PROFILE -->
    <div v-if="activeTab === 'business'" class="settings-section">
      <div class="grid-1 lg:grid-2 gap-6">
        <!-- Business Form Card -->
        <div class="card" id="settings-business-card">
          <div class="card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="metric-icon-box success">
                <IconReceipt :size="16" />
              </div>
              <div>
                <div class="card-title text-base">Business & Invoice Profile</div>
                <div class="card-subtitle text-xs">Custom logo, tax details & issuer contact information</div>
              </div>
            </div>
          </div>

          <div class="card-body">
            <!-- Logo Uploader & Preview Block -->
            <div class="flex items-start gap-4 mb-6 p-4 bg-off-white border-subtle-box rounded-14">
              <div class="logo-preview-box">
                <img v-if="bizForm.businessLogo" :src="bizForm.businessLogo" alt="Logo Preview" class="max-w-full max-h-full object-contain p-1" />
                <div v-else class="text-center p-2 text-tertiary">
                  <IconPackage :size="20" class="mx-auto opacity-50" />
                  <span class="text-xs block mt-1">No Logo</span>
                </div>
              </div>

              <div class="flex flex-col gap-1.5 flex-1 min-w-0">
                <div class="fw-700 text-sm">Invoice Logo Header</div>
                <div class="text-xs text-tertiary">PNG, JPG, or SVG logo. Automatically formatted at the top of client invoices.</div>
                <div class="flex items-center gap-2 mt-1">
                  <label class="btn btn-secondary btn-sm cursor-pointer" id="btn-upload-logo">
                    <IconPackage :size="13" />
                    <span>{{ bizForm.businessLogo ? 'Replace Logo' : 'Upload Logo' }}</span>
                    <input type="file" accept="image/*" @change="handleLogoUpload" class="hidden" />
                  </label>
                  <button v-if="bizForm.businessLogo" type="button" class="btn btn-ghost btn-sm text-error" @click="bizForm.businessLogo = ''" id="btn-remove-logo">
                    Remove
                  </button>
                </div>
              </div>
            </div>

            <div class="flex flex-col gap-4">
              <div class="form-group">
                <label class="form-label" for="settings-biz-name">Business / Freelancer Display Name</label>
                <input id="settings-biz-name" v-model="bizForm.businessName" class="form-input" type="text" placeholder="e.g. Rahul Mehta Studio" />
              </div>

              <div class="grid-2 gap-4">
                <div class="form-group">
                  <label class="form-label" for="settings-biz-tax">Tax / GST / VAT ID</label>
                  <input id="settings-biz-tax" v-model="bizForm.businessTaxId" class="form-input" type="text" placeholder="e.g. GSTIN: 29AAAAA0000A1Z5" />
                </div>

                <div class="form-group">
                  <label class="form-label" for="settings-biz-phone">Billing Contact Phone</label>
                  <input id="settings-biz-phone" v-model="bizForm.businessPhone" class="form-input" type="text" placeholder="+91 98765 43210" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="settings-biz-email">Billing Contact Email</label>
                <input id="settings-biz-email" v-model="bizForm.businessEmail" class="form-input" type="email" placeholder="billing@yourdomain.com" />
              </div>

              <div class="form-group">
                <label class="form-label" for="settings-biz-address">Issuer Business Address</label>
                <textarea id="settings-biz-address" v-model="bizForm.businessAddress" class="form-input text-xs" rows="2" placeholder="Suite #, Building, Street Address, City, State, Pincode"></textarea>
              </div>

              <div class="form-group">
                <label class="form-label" for="settings-biz-notes">Default Invoice Payment Terms</label>
                <textarea id="settings-biz-notes" v-model="bizForm.defaultInvoiceNotes" class="form-input text-xs" rows="2" placeholder="Payment is due within 14 days of invoice date."></textarea>
              </div>

              <div class="form-actions mt-2 pt-4 border-t flex justify-end">
                <button class="btn btn-primary btn-sm" @click="saveBusinessProfile" id="btn-save-biz-profile">
                  Save Business Profile
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Live Invoice Preview Card -->
        <div class="card bg-off-white" id="settings-invoice-preview-card">
          <div class="card-header flex items-center justify-between">
            <div class="card-title text-sm flex items-center gap-2">
              <IconReceipt :size="16" class="text-purple" />
              <span>Live Client Invoice Header Preview</span>
            </div>
            <span class="badge badge-success text-xs font-bold">Live Preview</span>
          </div>

          <div class="card-body">
            <!-- Simulated Paper Invoice Box -->
            <div class="p-5 bg-card border-card rounded-12 shadow-soft-card">
              <!-- Top Row: Logo & Issuer Details -->
              <div class="flex items-start justify-between flex-wrap gap-4 pb-4 border-b">
                <div>
                  <img v-if="bizForm.businessLogo" :src="bizForm.businessLogo" alt="Logo" class="max-h-11 object-contain mb-2" />
                  <div class="fw-800 text-lg text-primary">{{ bizForm.businessName || 'Your Business Name' }}</div>
                  <div class="text-xs text-tertiary" v-if="bizForm.businessTaxId">Tax ID: {{ bizForm.businessTaxId }}</div>
                </div>
                <div class="text-right">
                  <div class="fw-800 text-xl text-purple">INVOICE</div>
                  <div class="text-xs text-tertiary">#INV-2025-001</div>
                  <div class="text-xs text-tertiary">Date: Sept 16, 2025</div>
                </div>
              </div>

              <!-- Issuer Address & Contact -->
              <div class="py-3 border-b text-xs text-secondary">
                <div class="fw-700 text-primary mb-1">Billed From:</div>
                <div class="text-tertiary whitespace-pre-line">{{ bizForm.businessAddress || 'Street Address, City, State, Pincode' }}</div>
                <div class="mt-1 text-tertiary">
                  <span v-if="bizForm.businessEmail">📧 {{ bizForm.businessEmail }}</span>
                  <span v-if="bizForm.businessPhone" class="ml-2">📞 {{ bizForm.businessPhone }}</span>
                </div>
              </div>

              <!-- Sample Line Item -->
              <div class="py-3 border-b">
                <div class="flex justify-between text-xs font-bold text-primary mb-1">
                  <span>UI/UX & Web Development Services</span>
                  <span>₹25,000.00</span>
                </div>
                <div class="text-xs text-tertiary">Frontend engineering, responsiveness, and performance optimization</div>
              </div>

              <!-- Footer Notes -->
              <div class="pt-3 text-xs text-tertiary">
                <div class="fw-600 text-secondary mb-0.5">Payment Terms & Notes:</div>
                <div>{{ bizForm.defaultInvoiceNotes || 'Payment due within 14 days.' }}</div>
              </div>
            </div>

            <p class="text-tertiary text-xs mt-4 text-center">
              Changes typed on the left update this invoice preview in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: WORK VALUE & CURRENCY -->
    <div v-if="activeTab === 'work'" class="settings-section">
      <div class="card" id="settings-work-prefs-card">
        <div class="card-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="metric-icon-box warning">
              <IconClock :size="16" />
            </div>
            <div>
              <div class="card-title text-base">Work Value Preferences</div>
              <div class="card-subtitle text-xs">Target hourly rate goals and system currency unit</div>
            </div>
          </div>
        </div>

        <div class="card-body">
          <div class="grid-1 md:grid-2 gap-6">
            <div class="flex flex-col gap-4">
              <div class="form-group">
                <label class="form-label" for="settings-target-hourly">Target Hourly Value ({{ prefForm.currency }})</label>
                <div class="relative">
                  <input
                    id="settings-target-hourly"
                    v-model.number="prefForm.targetHourly"
                    class="form-input"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="e.g. 1500"
                  />
                </div>
                <span class="form-hint">Used as your benchmark to calculate target progress and unpaid value.</span>
              </div>

              <div class="form-group">
                <label class="form-label" for="settings-currency">System Currency Symbol</label>
                <select id="settings-currency" v-model="prefForm.currency" class="form-select">
                  <option value="₹">₹ Indian Rupee (INR)</option>
                  <option value="$">$ US Dollar (USD)</option>
                  <option value="€">€ Euro (EUR)</option>
                  <option value="£">£ British Pound (GBP)</option>
                  <option value="¥">¥ Japanese Yen (JPY)</option>
                  <option value="AED">AED UAE Dirham</option>
                  <option value="SGD">SGD Singapore Dollar</option>
                </select>
              </div>

              <div class="form-actions pt-4 border-t flex justify-end">
                <button class="btn btn-primary btn-sm" @click="savePrefs" id="btn-save-prefs">Save Preferences</button>
              </div>
            </div>

            <!-- Target Rate Target Calculator Preview Card -->
            <div class="p-5 bg-off-white border-subtle-box rounded-14 flex flex-col justify-between gap-3">
              <div class="fw-700 text-sm text-primary flex items-center justify-between">
                <span>Calculated Value Benchmarks</span>
                <span class="badge badge-warning font-bold">Rate Targets</span>
              </div>

              <div class="grid-3 gap-2">
                <div class="p-3 bg-card rounded-10 border-card text-center">
                  <div class="text-xs text-tertiary uppercase fw-600">Hourly Target</div>
                  <div class="fw-800 text-base text-primary mt-1">{{ prefForm.currency }}{{ (prefForm.targetHourly || 0).toLocaleString('en-IN') }}</div>
                </div>

                <div class="p-3 bg-card rounded-10 border-card text-center">
                  <div class="text-xs text-tertiary uppercase fw-600">Daily (8 hrs)</div>
                  <div class="fw-800 text-base text-success mt-1">{{ prefForm.currency }}{{ ((prefForm.targetHourly || 0) * 8).toLocaleString('en-IN') }}</div>
                </div>

                <div class="p-3 bg-card rounded-10 border-card text-center">
                  <div class="text-xs text-tertiary uppercase fw-600">Monthly (160h)</div>
                  <div class="fw-800 text-base text-purple mt-1">{{ prefForm.currency }}{{ ((prefForm.targetHourly || 0) * 160).toLocaleString('en-IN') }}</div>
                </div>
              </div>

              <div class="text-xs text-tertiary">
                Your effective hourly value on the Home dashboard is compared against this benchmark rate.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: ACCOUNT & SECURITY -->
    <div v-if="activeTab === 'account'" class="settings-section">
      <div class="card" id="settings-account-card">
        <div class="card-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="metric-icon-box pink">
              <IconShield :size="16" />
            </div>
            <div>
              <div class="card-title text-base">Account & Security</div>
              <div class="card-subtitle text-xs">Active session details, access permissions and authentication status</div>
            </div>
          </div>
        </div>

        <div class="card-body">
          <div class="grid-1 md:grid-3 gap-4 mb-6">
            <div class="p-4 bg-off-white rounded-12 border-subtle-box">
              <div class="text-xs text-tertiary uppercase fw-600">Signed In As</div>
              <div class="fw-700 text-sm text-primary mt-1 truncate">{{ authStore.user?.email || store.user.email }}</div>
            </div>

            <div class="p-4 bg-off-white rounded-12 border-subtle-box">
              <div class="text-xs text-tertiary uppercase fw-600">Authentication Method</div>
              <div class="fw-700 text-sm text-success mt-1">OTP Authenticated</div>
            </div>

            <div class="p-4 bg-off-white rounded-12 border-subtle-box">
              <div class="text-xs text-tertiary uppercase fw-600">Account Access Role</div>
              <div class="fw-700 text-sm text-purple mt-1">{{ authStore.isAdmin ? 'Administrator' : 'Standard User' }}</div>
            </div>
          </div>

          <div class="pt-4 border-t flex items-center justify-between flex-wrap gap-4">
            <div>
              <div class="fw-700 text-sm text-primary">End Authenticated Session</div>
              <div class="text-xs text-tertiary">Sign out of your Wello account on this browser.</div>
            </div>
            <button class="btn btn-secondary btn-sm text-error border-error-subtle" @click="authStore.logout()" id="btn-settings-signout">
              <IconLogOut :size="14" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 5: SYSTEM & ABOUT -->
    <div v-if="activeTab === 'about'" class="settings-section">
      <div class="card" id="settings-app-info-card">
        <div class="card-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="metric-icon-box blue">
              <IconPackage :size="16" />
            </div>
            <div>
              <div class="card-title text-base">System & Application Info</div>
              <div class="card-subtitle text-xs">Wello platform version, data stats, and database storage engines</div>
            </div>
          </div>
          <span class="badge badge-info text-xs font-bold">v1.0.0</span>
        </div>

        <div class="card-body">
          <div class="grid-2 md:grid-4 gap-4 mb-4">
            <div class="p-4 bg-off-white rounded-12 border-subtle-box">
              <div class="text-xs text-tertiary uppercase fw-600">Total Projects</div>
              <div class="fw-800 text-xl text-primary mt-1">{{ store.projects.length }}</div>
            </div>

            <div class="p-4 bg-off-white rounded-12 border-subtle-box">
              <div class="text-xs text-tertiary uppercase fw-600">Work Sessions</div>
              <div class="fw-800 text-xl text-primary mt-1">{{ store.sessions.length }}</div>
            </div>

            <div class="p-4 bg-off-white rounded-12 border-subtle-box">
              <div class="text-xs text-tertiary uppercase fw-600">Total Tracked Time</div>
              <div class="fw-800 text-xl text-purple mt-1">{{ totalTimeTracked }}</div>
            </div>

            <div class="p-4 bg-off-white rounded-12 border-subtle-box">
              <div class="text-xs text-tertiary uppercase fw-600">Core Pricing</div>
              <div class="fw-800 text-xl text-success mt-1">100% FREE</div>
            </div>
          </div>

          <div class="p-4 text-xs text-tertiary bg-off-white rounded-12 border-subtle-box">
            💡 <strong>Storage Engine Notice:</strong> Wello stores user state locally in Pinia reactive stores with optional MySQL backend synchronisation. Configure MySQL credentials in your <code>.env</code> file to enable server persistence.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

const store = useWelloStore()
const authStore = useAuthStore()
const toast = useToast()

const activeTab = ref('profile')

const tabs = [
  { id: 'profile', label: 'Profile', icon: resolveComponent('IconUser') },
  { id: 'business', label: 'Business & Invoice', icon: resolveComponent('IconReceipt') },
  { id: 'work', label: 'Rate Targets & Value', icon: resolveComponent('IconClock') },
  { id: 'account', label: 'Account & Security', icon: resolveComponent('IconShield') },
  { id: 'about', label: 'System Info', icon: resolveComponent('IconPackage') },
]

// Personal Profile Form
const profileForm = ref({
  name: authStore.user?.name || store.user.name || '',
  email: authStore.user?.email || store.user.email || '',
})

// Business Profile Form
const bizForm = ref({
  businessName: store.user.businessName || '',
  businessLogo: store.user.businessLogo || '',
  businessTaxId: store.user.businessTaxId || '',
  businessAddress: store.user.businessAddress || '',
  businessPhone: store.user.businessPhone || '',
  businessEmail: store.user.businessEmail || store.user.email || '',
  defaultInvoiceNotes: store.user.defaultInvoiceNotes || '',
})

// Work Preferences Form
const prefForm = ref({
  targetHourly: store.user.targetHourly || 350,
  currency: store.user.currency || '₹',
})

const totalTimeTracked = computed(() => {
  const totalMin = store.sessions.reduce((acc, s) => acc + (s.durationMin || 0), 0)
  return store.minutesToHM(totalMin)
})

function handleLogoUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return

  if (file.size > 2 * 1024 * 1024) {
    toast.error('Logo file size must be less than 2MB.')
    return
  }

  const reader = new FileReader()
  reader.onload = (ev) => {
    bizForm.value.businessLogo = ev.target.result
    toast.success('Logo uploaded and preview generated!')
  }
  reader.readAsDataURL(file)
}

function saveProfile() {
  if (!profileForm.value.name.trim()) {
    toast.error('Full Name is required.')
    return
  }
  store.updateUser({
    name: profileForm.value.name.trim(),
    email: profileForm.value.email.trim(),
  })
  toast.success('Personal profile saved!')
}

function saveBusinessProfile() {
  store.updateUser({
    businessName: bizForm.value.businessName.trim(),
    businessLogo: bizForm.value.businessLogo,
    businessTaxId: bizForm.value.businessTaxId.trim(),
    businessAddress: bizForm.value.businessAddress.trim(),
    businessPhone: bizForm.value.businessPhone.trim(),
    businessEmail: bizForm.value.businessEmail.trim(),
    defaultInvoiceNotes: bizForm.value.defaultInvoiceNotes.trim(),
  })
  toast.success('Business & Invoice profile updated!')
}

function savePrefs() {
  store.updateUser({
    targetHourly: Number(prefForm.value.targetHourly) || 350,
    currency: prefForm.value.currency,
  })
  toast.success('Rate target & currency preferences saved!')
}

function saveAll() {
  saveProfile()
  saveBusinessProfile()
  savePrefs()
  toast.success('All settings saved successfully!')
}
</script>
