<template>
  <div class="settings-page animate-fade-in" style="display:flex;flex-direction:column;gap:20px;">
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
            <div class="metric-icon-box purple" style="width:32px;height:32px;">
              <IconUser :size="16" />
            </div>
            <div>
              <div class="card-title text-base">Personal Profile</div>
              <div class="card-subtitle text-xs">Your account credentials and display name</div>
            </div>
          </div>
        </div>

        <div class="card-body">
          <div class="flex items-center gap-5 mb-6 p-4" style="background:var(--color-off-white);border:1px solid var(--border-subtle);border-radius:14px;">
            <div class="user-avatar" style="width:64px;height:64px;font-size:20px;font-weight:700;border-radius:20px;box-shadow:0 4px 12px rgba(122,63,246,0.15);">
              {{ store.user.avatarInitials || 'U' }}
            </div>
            <div>
              <div class="fw-700 text-base text-primary">{{ profileForm.name || 'User' }}</div>
              <div class="text-tertiary text-xs mt-0.5">{{ profileForm.email }}</div>
              <div class="badge mt-2" style="background:rgba(122,63,246,0.1);color:var(--color-purple);font-size:11px;font-weight:600;">
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
              <div class="metric-icon-box success" style="width:32px;height:32px;">
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
            <div class="flex items-start gap-4 mb-6 p-4" style="background:var(--color-off-white);border:1px solid var(--border-subtle);border-radius:14px;">
              <div style="width:110px;height:70px;border:2px dashed var(--border-color);border-radius:10px;display:flex;align-items:center;justify-content:center;background:white;overflow:hidden;position:relative;flex-shrink:0;">
                <img v-if="bizForm.businessLogo" :src="bizForm.businessLogo" alt="Logo Preview" style="max-width:100%;max-height:100%;object-fit:contain;padding:4px;" />
                <div v-else class="text-center p-2 text-tertiary">
                  <IconPackage :size="20" style="margin:0 auto;opacity:0.5;" />
                  <span style="font-size:10px;display:block;margin-top:2px;">No Logo</span>
                </div>
              </div>

              <div class="flex flex-col gap-1.5 flex-1 min-w-0">
                <div class="fw-700 text-sm">Invoice Logo Header</div>
                <div class="text-xs text-tertiary">PNG, JPG, or SVG logo. Automatically formatted at the top of client invoices.</div>
                <div class="flex items-center gap-2 mt-1">
                  <label class="btn btn-secondary btn-sm" style="cursor:pointer;" id="btn-upload-logo">
                    <IconPackage :size="13" />
                    <span>{{ bizForm.businessLogo ? 'Replace Logo' : 'Upload Logo' }}</span>
                    <input type="file" accept="image/*" @change="handleLogoUpload" style="display:none;" />
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
        <div class="card" id="settings-invoice-preview-card" style="background:var(--color-off-white);">
          <div class="card-header flex items-center justify-between">
            <div class="card-title text-sm flex items-center gap-2">
              <IconReceipt :size="16" style="color:var(--color-purple);" />
              <span>Live Client Invoice Header Preview</span>
            </div>
            <span class="badge" style="background:rgba(16,185,129,0.1);color:var(--color-success);font-size:10px;font-weight:700;">Live Preview</span>
          </div>

          <div class="card-body">
            <!-- Simulated Paper Invoice Box -->
            <div class="p-5" style="background:white;border:1px solid var(--border-color);border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.03);">
              <!-- Top Row: Logo & Issuer Details -->
              <div class="flex items-start justify-between flex-wrap gap-4 pb-4 border-b">
                <div>
                  <img v-if="bizForm.businessLogo" :src="bizForm.businessLogo" alt="Logo" style="max-height:44px;object-fit:contain;margin-bottom:8px;" />
                  <div class="fw-800 text-lg text-primary">{{ bizForm.businessName || 'Your Business Name' }}</div>
                  <div class="text-xs text-tertiary" v-if="bizForm.businessTaxId">Tax ID: {{ bizForm.businessTaxId }}</div>
                </div>
                <div class="text-right">
                  <div class="fw-800 text-xl text-purple" style="letter-spacing:-0.5px;">INVOICE</div>
                  <div class="text-xs text-tertiary">#INV-2025-001</div>
                  <div class="text-xs text-tertiary">Date: Sept 16, 2025</div>
                </div>
              </div>

              <!-- Issuer Address & Contact -->
              <div class="py-3 border-b text-xs text-secondary">
                <div class="fw-700 text-primary mb-1">Billed From:</div>
                <div style="white-space:pre-line;" class="text-tertiary">{{ bizForm.businessAddress || 'Street Address, City, State, Pincode' }}</div>
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
            <div class="metric-icon-box warning" style="width:32px;height:32px;">
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
            <div class="p-5" style="background:var(--color-off-white);border:1px solid var(--border-subtle);border-radius:14px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;">
              <div class="fw-700 text-sm text-primary flex items-center justify-between">
                <span>Calculated Value Benchmarks</span>
                <span class="badge" style="background:rgba(245,158,11,0.12);color:#D97706;font-weight:700;">Rate Targets</span>
              </div>

              <div class="grid-3 gap-2">
                <div class="p-3" style="background:white;border-radius:10px;border:1px solid var(--border-color);text-align:center;">
                  <div class="text-xs text-tertiary uppercase fw-600">Hourly Target</div>
                  <div class="fw-800 text-base text-primary mt-1">{{ prefForm.currency }}{{ (prefForm.targetHourly || 0).toLocaleString('en-IN') }}</div>
                </div>

                <div class="p-3" style="background:white;border-radius:10px;border:1px solid var(--border-color);text-align:center;">
                  <div class="text-xs text-tertiary uppercase fw-600">Daily (8 hrs)</div>
                  <div class="fw-800 text-base text-success mt-1">{{ prefForm.currency }}{{ ((prefForm.targetHourly || 0) * 8).toLocaleString('en-IN') }}</div>
                </div>

                <div class="p-3" style="background:white;border-radius:10px;border:1px solid var(--border-color);text-align:center;">
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
            <div class="metric-icon-box pink" style="width:32px;height:32px;">
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
            <div class="p-4" style="background:var(--color-off-white);border-radius:12px;border:1px solid var(--border-subtle);">
              <div class="text-xs text-tertiary uppercase fw-600">Signed In As</div>
              <div class="fw-700 text-sm text-primary mt-1 truncate">{{ authStore.user?.email || store.user.email }}</div>
            </div>

            <div class="p-4" style="background:var(--color-off-white);border-radius:12px;border:1px solid var(--border-subtle);">
              <div class="text-xs text-tertiary uppercase fw-600">Authentication Method</div>
              <div class="fw-700 text-sm text-success mt-1">OTP Authenticated</div>
            </div>

            <div class="p-4" style="background:var(--color-off-white);border-radius:12px;border:1px solid var(--border-subtle);">
              <div class="text-xs text-tertiary uppercase fw-600">Account Access Role</div>
              <div class="fw-700 text-sm text-purple mt-1">{{ authStore.isAdmin ? 'Administrator' : 'Standard User' }}</div>
            </div>
          </div>

          <div class="pt-4 border-t flex items-center justify-between flex-wrap gap-4">
            <div>
              <div class="fw-700 text-sm text-primary">End Authenticated Session</div>
              <div class="text-xs text-tertiary">Sign out of your Wello account on this browser.</div>
            </div>
            <button class="btn btn-secondary btn-sm" @click="authStore.logout()" id="btn-settings-signout" style="color:#DC2626; border-color:rgba(239,68,68,0.3);">
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
            <div class="metric-icon-box blue" style="width:32px;height:32px;">
              <IconPackage :size="16" />
            </div>
            <div>
              <div class="card-title text-base">System & Application Info</div>
              <div class="card-subtitle text-xs">Wello platform version, data stats, and database storage engines</div>
            </div>
          </div>
          <span class="badge" style="background:rgba(0,123,255,0.1);color:var(--color-blue);font-size:11px;font-weight:700;">v1.0.0</span>
        </div>

        <div class="card-body">
          <div class="grid-2 md:grid-4 gap-4 mb-4">
            <div class="p-4" style="background:var(--color-off-white);border-radius:12px;border:1px solid var(--border-subtle);">
              <div class="text-xs text-tertiary uppercase fw-600">Total Projects</div>
              <div class="fw-800 text-xl text-primary mt-1">{{ store.projects.length }}</div>
            </div>

            <div class="p-4" style="background:var(--color-off-white);border-radius:12px;border:1px solid var(--border-subtle);">
              <div class="text-xs text-tertiary uppercase fw-600">Work Sessions</div>
              <div class="fw-800 text-xl text-primary mt-1">{{ store.sessions.length }}</div>
            </div>

            <div class="p-4" style="background:var(--color-off-white);border-radius:12px;border:1px solid var(--border-subtle);">
              <div class="text-xs text-tertiary uppercase fw-600">Total Tracked Time</div>
              <div class="fw-800 text-xl text-purple mt-1">{{ totalTimeTracked }}</div>
            </div>

            <div class="p-4" style="background:var(--color-off-white);border-radius:12px;border:1px solid var(--border-subtle);">
              <div class="text-xs text-tertiary uppercase fw-600">Core Pricing</div>
              <div class="fw-800 text-xl text-success mt-1">100% FREE</div>
            </div>
          </div>

          <div class="p-4 text-xs text-tertiary" style="background:var(--color-off-white);border-radius:12px;border:1px solid var(--border-subtle);">
            💡 <strong>Storage Engine Notice:</strong> Wello stores user state locally in Pinia reactive stores with optional MySQL backend synchronisation. Configure MySQL credentials in your <code>.env</code> file to enable server persistence.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useWelloStore } from '~/stores/wello'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'
import IconUser from '~/components/IconUser.vue'
import IconReceipt from '~/components/IconReceipt.vue'
import IconClock from '~/components/IconClock.vue'
import IconShield from '~/components/IconShield.vue'
import IconPackage from '~/components/IconPackage.vue'
import IconCheck from '~/components/IconCheck.vue'
import IconLogOut from '~/components/IconLogOut.vue'

const store = useWelloStore()
const authStore = useAuthStore()
const toast = useToast()

const activeTab = ref('profile')

const tabs = [
  { id: 'profile',  label: 'Personal Profile', icon: IconUser },
  { id: 'business', label: 'Business & Invoicing', icon: IconReceipt },
  { id: 'work',     label: 'Work & Currency', icon: IconClock },
  { id: 'account',  label: 'Account & Security', icon: IconShield },
  { id: 'about',    label: 'System Info', icon: IconPackage }
]

const profileForm = reactive({ name: store.user.name, email: store.user.email })
const prefForm    = reactive({ targetHourly: store.user.targetHourly, currency: store.user.currency })
const bizForm     = reactive({
  businessName: store.user.businessName || store.user.name || '',
  businessLogo: store.user.businessLogo || '',
  businessAddress: store.user.businessAddress || '',
  businessPhone: store.user.businessPhone || '',
  businessEmail: store.user.businessEmail || store.user.email || '',
  businessTaxId: store.user.businessTaxId || '',
  defaultInvoiceNotes: store.user.defaultInvoiceNotes || 'Payment is due within 14 days of invoice date. Thank you for your business!',
})

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
  store.user.avatarInitials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase()
  toast.success('Personal profile updated successfully.')
}

function savePrefs() {
  store.user.targetHourly = prefForm.targetHourly
  store.user.currency     = prefForm.currency
  toast.success('Work preferences & currency saved successfully.')
}

function handleLogoUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (file.size > 3 * 1024 * 1024) {
    toast.error('Logo image must be under 3MB.')
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    bizForm.businessLogo = e.target.result
    toast.success('Logo uploaded! Click "Save Business Profile" to apply.')
  }
  reader.readAsDataURL(file)
}

function saveBusinessProfile() {
  store.user.businessName = bizForm.businessName
  store.user.businessLogo = bizForm.businessLogo
  store.user.businessAddress = bizForm.businessAddress
  store.user.businessPhone = bizForm.businessPhone
  store.user.businessEmail = bizForm.businessEmail
  store.user.businessTaxId = bizForm.businessTaxId
  store.user.defaultInvoiceNotes = bizForm.defaultInvoiceNotes
  toast.success('Business profile & invoice branding saved successfully!')
}

function saveAll() {
  saveProfile()
  saveBusinessProfile()
  savePrefs()
  toast.success('All settings saved successfully!')
}
</script>

<style scoped>
.settings-section {
  animation: fadeIn 0.2s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
