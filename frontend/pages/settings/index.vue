<template>
  <div class="settings-page animate-fade-in flex flex-col gap-5">
    <!-- Page Header -->
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-0">
      <div>
        <h1 class="page-title">Settings</h1>
        <p class="page-subtitle">Manage your personal profile, global timezones, base currency, tax regime, and business invoicing identity.</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-primary btn-sm" @click="saveAll" id="btn-save-all-settings" :disabled="isSaving">
          <IconCheck :size="14" />
          <span>{{ isSaving ? 'Saving...' : 'Save All Settings' }}</span>
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

    <!-- TAB 1: PERSONAL PROFILE & TIMEZONE -->
    <div v-if="activeTab === 'profile'" class="settings-section">
      <div class="card" id="settings-profile-card">
        <div class="card-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="metric-icon-box purple">
              <IconUser :size="16" />
            </div>
            <div>
              <div class="card-title text-base">Personal Profile & Timezone</div>
              <div class="card-subtitle text-xs">Your account credentials, display name, and IANA timezone for date math</div>
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

          <!-- Timezone Configuration -->
          <div class="mt-4 pt-4 border-t">
            <div class="flex items-center justify-between mb-2">
              <label class="form-label mb-0" for="settings-timezone">
                Account Timezone (IANA) <span class="required">*</span>
              </label>
              <button type="button" class="btn btn-ghost btn-xs text-primary" @click="detectBrowserTz" id="btn-detect-tz">
                Auto-detect ({{ browserTz }})
              </button>
            </div>
            <select id="settings-timezone" v-model="profileForm.timezone" class="form-select">
              <option v-for="tz in IANA_TIMEZONES" :key="tz.value" :value="tz.value">
                {{ tz.label }}
              </option>
            </select>
            <span class="form-hint mt-1">
              All "today/this week/this month" boundaries, work timer logs, and reports are calculated in this timezone.
            </span>
          </div>

          <div class="form-actions mt-6 pt-4 border-t flex justify-end">
            <button class="btn btn-primary btn-sm" @click="saveProfile" id="btn-save-profile" :disabled="isSaving">
              Save Profile
            </button>
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
                <div class="card-subtitle text-xs">Custom branding, international address & tax registration</div>
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
                <input id="settings-biz-name" v-model="bizForm.businessName" class="form-input" type="text" placeholder="e.g. Morgan Global Consulting" />
              </div>

              <!-- Tax ID & Custom Tax Label -->
              <div class="grid-2 gap-4">
                <div class="form-group">
                  <label class="form-label" for="settings-biz-tax-label">Tax ID Label</label>
                  <input id="settings-biz-tax-label" v-model="bizForm.taxIdLabel" class="form-input" type="text" placeholder="e.g. VAT ID, TRN, GSTIN, EIN" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="settings-biz-tax">Tax Registration Number</label>
                  <input id="settings-biz-tax" v-model="bizForm.businessTaxId" class="form-input" type="text" placeholder="e.g. 100234567800003" />
                </div>
              </div>

              <div class="grid-2 gap-4">
                <div class="form-group">
                  <label class="form-label" for="settings-biz-phone">Billing Contact Phone (E.164)</label>
                  <input id="settings-biz-phone" v-model="bizForm.businessPhone" class="form-input" type="text" placeholder="+1 415 555 0199" />
                </div>
                <div class="form-group">
                  <label class="form-label" for="settings-biz-email">Billing Contact Email</label>
                  <input id="settings-biz-email" v-model="bizForm.businessEmail" class="form-input" type="email" placeholder="billing@yourdomain.com" />
                </div>
              </div>

              <!-- Generic International Address Fields -->
              <div class="border-t pt-3">
                <div class="fw-700 text-xs text-primary mb-2 uppercase">Business Registered Address</div>
                <div class="form-group mb-2">
                  <label class="form-label" for="settings-addr-line1">Address Line 1</label>
                  <input id="settings-addr-line1" v-model="bizForm.addressLine1" class="form-input" type="text" placeholder="Suite #, Building, Street Address" />
                </div>
                <div class="form-group mb-2">
                  <label class="form-label" for="settings-addr-line2">Address Line 2 (Optional)</label>
                  <input id="settings-addr-line2" v-model="bizForm.addressLine2" class="form-input" type="text" placeholder="Apartment, Floor, Unit" />
                </div>
                <div class="grid-3 gap-2 mb-2">
                  <div class="form-group">
                    <label class="form-label" for="settings-addr-city">City</label>
                    <input id="settings-addr-city" v-model="bizForm.city" class="form-input" type="text" placeholder="City" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="settings-addr-state">State / Province / Region</label>
                    <input id="settings-addr-state" v-model="bizForm.stateProvince" class="form-input" type="text" placeholder="State/Region" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="settings-addr-zip">Postal / Zip Code</label>
                    <input id="settings-addr-zip" v-model="bizForm.postalCode" class="form-input" type="text" placeholder="Postal Code" />
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label" for="settings-addr-country">Country</label>
                  <input id="settings-addr-country" v-model="bizForm.country" class="form-input" type="text" placeholder="e.g. United States, Germany, UAE" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="settings-biz-notes">Default Invoice Payment Terms</label>
                <textarea id="settings-biz-notes" v-model="bizForm.defaultInvoiceNotes" class="form-input text-xs" rows="2" placeholder="Payment is due within 14 days of invoice date."></textarea>
              </div>

              <div class="form-actions mt-2 pt-4 border-t flex justify-end">
                <button class="btn btn-primary btn-sm" @click="saveBusinessProfile" id="btn-save-biz-profile" :disabled="isSaving">
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
                  <div class="text-xs text-tertiary" v-if="bizForm.businessTaxId">
                    {{ bizForm.taxIdLabel || 'Tax ID' }}: {{ bizForm.businessTaxId }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="fw-800 text-xl text-purple">INVOICE</div>
                  <div class="text-xs text-tertiary">#INV-2026-001</div>
                  <div class="text-xs text-tertiary">Date: {{ fmtDate(new Date()) }}</div>
                </div>
              </div>

              <!-- Issuer Address & Contact -->
              <div class="py-3 border-b text-xs text-secondary">
                <div class="fw-700 text-primary mb-1">Billed From:</div>
                <div class="text-tertiary whitespace-pre-line">{{ formattedAddress || 'Street Address, City, Country' }}</div>
                <div class="mt-1 text-tertiary">
                  <span v-if="bizForm.businessEmail">📧 {{ bizForm.businessEmail }}</span>
                  <span v-if="bizForm.businessPhone" class="ml-2">📞 {{ bizForm.businessPhone }}</span>
                </div>
              </div>

              <!-- Sample Line Item -->
              <div class="py-3 border-b">
                <div class="flex justify-between text-xs font-bold text-primary mb-1">
                  <span>Technical & Strategic Consulting Services</span>
                  <span>{{ fmtCurrency(2500) }}</span>
                </div>
                <div class="text-xs text-tertiary">Architecture review, optimization, and implementation</div>
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

    <!-- TAB 3: WORK VALUE, BASE CURRENCY & TAX RATES -->
    <div v-if="activeTab === 'work'" class="settings-section">
      <div class="grid-1 lg:grid-2 gap-6">
        <!-- Work Value & Base Currency Card -->
        <div class="card" id="settings-work-prefs-card">
          <div class="card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="metric-icon-box warning">
                <IconClock :size="16" />
              </div>
              <div>
                <div class="card-title text-base">Rate Targets & Base Currency</div>
                <div class="card-subtitle text-xs">Target hourly rate benchmark and ISO 4217 reporting currency</div>
              </div>
            </div>
          </div>

          <div class="card-body">
            <div class="flex flex-col gap-4">
              <div class="form-group">
                <label class="form-label" for="settings-currency">Account Base Currency (ISO 4217)</label>
                <select id="settings-currency" v-model="prefForm.baseCurrency" class="form-select">
                  <option v-for="c in ISO_CURRENCIES" :key="c.code" :value="c.code">
                    {{ c.code }} – {{ c.name }} ({{ c.symbol }}) · {{ c.decimals }} decimals
                  </option>
                </select>
                <span class="form-hint">
                  All multi-currency projects, payments, expenses, and dashboard aggregates are automatically converted into this currency.
                </span>
              </div>

              <div class="form-group">
                <label class="form-label" for="settings-target-hourly">
                  Target Hourly Benchmark ({{ prefForm.baseCurrency }})
                </label>
                <input
                  id="settings-target-hourly"
                  v-model.number="prefForm.targetHourly"
                  class="form-input"
                  type="number"
                  min="0"
                  step="10"
                  placeholder="e.g. 100"
                />
                <span class="form-hint">Used as your benchmark to calculate target progress and unpaid value.</span>
              </div>

              <!-- Headline Rate Metric Preference -->
              <div class="form-group">
                <label class="form-label" for="settings-headline-metric">
                  Headline Rate Metric Preference
                </label>
                <select id="settings-headline-metric" v-model="prefForm.headlineRateMetric" class="form-select">
                  <option value="client_work">Client-Work Rate (Net income / Paid + Unpaid client hours)</option>
                  <option value="all_in">All-In Rate (Net income / All hours including intentional unpaid)</option>
                </select>
                <span class="form-hint">
                  Determines the primary hourly rate displayed on your dashboard hero and overview cards.
                </span>
              </div>


              <!-- Calculated Value Benchmarks -->
              <div class="p-4 bg-off-white border-subtle-box rounded-12 flex flex-col gap-2">
                <div class="fw-700 text-xs text-primary uppercase">Calculated Benchmarks</div>
                <div class="grid-3 gap-2">
                  <div class="p-2.5 bg-card rounded-8 text-center">
                    <div class="text-xs text-tertiary">Hourly Target</div>
                    <div class="fw-800 text-sm text-primary mt-0.5">{{ fmtCurrency(prefForm.targetHourly || 0, prefForm.baseCurrency) }}</div>
                  </div>
                  <div class="p-2.5 bg-card rounded-8 text-center">
                    <div class="text-xs text-tertiary">Daily (8h)</div>
                    <div class="fw-800 text-sm text-success mt-0.5">{{ fmtCurrency((prefForm.targetHourly || 0) * 8, prefForm.baseCurrency) }}</div>
                  </div>
                  <div class="p-2.5 bg-card rounded-8 text-center">
                    <div class="text-xs text-tertiary">Monthly (160h)</div>
                    <div class="fw-800 text-sm text-purple mt-0.5">{{ fmtCurrency((prefForm.targetHourly || 0) * 160, prefForm.baseCurrency) }}</div>
                  </div>
                </div>
              </div>

              <div class="form-actions pt-4 border-t flex justify-end">
                <button class="btn btn-primary btn-sm" @click="savePrefs" id="btn-save-prefs" :disabled="isSaving">
                  Save Currency & Rate Targets
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tax Rates Management Card -->
        <div class="card" id="settings-tax-card">
          <div class="card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="metric-icon-box purple">
                <IconReceipt :size="16" />
              </div>
              <div>
                <div class="card-title text-base">Configured Tax Rates</div>
                <div class="card-subtitle text-xs">Generic global tax presets (VAT, GST, Sales Tax, Zero-Rated)</div>
              </div>
            </div>
            <button class="btn btn-secondary btn-xs" @click="showAddTaxModal = true" id="btn-add-tax-rate">
              + Add Tax Rate
            </button>
          </div>

          <div class="card-body">
            <!-- Preset Quick-Fill Bar -->
            <div class="mb-4 p-3 bg-off-white border-subtle-box rounded-10 flex items-center justify-between flex-wrap gap-2">
              <div class="text-xs text-tertiary">Quick-add global tax standard:</div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <button type="button" class="btn btn-ghost btn-xs" @click="addPresetTax('UAE VAT', 5, 'AE')">UAE VAT 5%</button>
                <button type="button" class="btn btn-ghost btn-xs" @click="addPresetTax('EU Standard VAT', 20, 'DE')">EU VAT 20%</button>
                <button type="button" class="btn btn-ghost btn-xs" @click="addPresetTax('UK VAT', 20, 'GB')">UK VAT 20%</button>
                <button type="button" class="btn btn-ghost btn-xs" @click="addPresetTax('US Sales Tax', 8.25, 'US')">US Tax 8.25%</button>
                <button type="button" class="btn btn-ghost btn-xs" @click="addPresetTax('Australia GST', 10, 'AU')">AU GST 10%</button>
              </div>
            </div>

            <!-- Tax Rates List -->
            <div v-if="store.taxRates.length === 0" class="p-6 text-center text-tertiary text-xs">
              No custom tax rates configured yet. Click "+ Add Tax Rate" or choose a quick preset above.
            </div>

            <div v-else class="flex flex-col gap-2">
              <div
                v-for="tax in store.taxRates"
                :key="tax.id"
                class="p-3 bg-card border-card rounded-10 flex items-center justify-between flex-wrap gap-2"
              >
                <div>
                  <div class="fw-700 text-sm text-primary flex items-center gap-2">
                    <span>{{ tax.name }}</span>
                    <span class="badge badge-purple text-xs">{{ Number(tax.rate).toFixed(2) }}%</span>
                    <span v-if="tax.isDefault" class="badge badge-success text-xs">Default</span>
                    <span v-if="tax.isInclusive" class="badge badge-info text-xs">Inclusive</span>
                  </div>
                  <div class="text-xs text-tertiary mt-0.5">
                    {{ tax.countryCode ? `Region: ${tax.countryCode} · ` : '' }}{{ tax.isCompound ? 'Compound Tax' : 'Simple Tax' }}
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button class="btn btn-ghost btn-xs text-error" @click="removeTaxRate(tax.id)">
                    Delete
                  </button>
                </div>
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
              <div class="card-title text-base">System & Global Architecture Info</div>
              <div class="card-subtitle text-xs">Wello platform version, multi-currency engine, and storage backend</div>
            </div>
          </div>
          <span class="badge badge-info text-xs font-bold">v1.0.0 Global</span>
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
              <div class="text-xs text-tertiary uppercase fw-600">Base Currency</div>
              <div class="fw-800 text-xl text-success mt-1">{{ store.user.baseCurrency || 'USD' }}</div>
            </div>
          </div>

          <div class="p-4 text-xs text-tertiary bg-off-white rounded-12 border-subtle-box">
            🌐 <strong>Global Engine:</strong> Wello supports all ISO 4217 currencies, real-time triangular FX conversion, IANA timezone boundaries, and configurable tax regimes without region-specific assumptions.
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Add Tax Rate -->
    <div v-if="showAddTaxModal" class="modal-backdrop">
      <div class="modal-box p-6 bg-card rounded-14 max-w-md w-full shadow-soft-xl">
        <div class="flex items-center justify-between mb-4">
          <div class="fw-700 text-base text-primary">Add Custom Tax Rate</div>
          <button class="btn btn-ghost btn-xs" @click="showAddTaxModal = false">✕</button>
        </div>

        <div class="flex flex-col gap-3">
          <div class="form-group">
            <label class="form-label" for="new-tax-name">Tax Name <span class="required">*</span></label>
            <input id="new-tax-name" v-model="newTaxForm.name" class="form-input" type="text" placeholder="e.g. Standard VAT, Sales Tax" />
          </div>

          <div class="form-group">
            <label class="form-label" for="new-tax-rate">Rate Percentage (%) <span class="required">*</span></label>
            <input id="new-tax-rate" v-model.number="newTaxForm.rate" class="form-input" type="number" step="0.01" min="0" max="100" placeholder="e.g. 20.00" />
          </div>

          <div class="form-group">
            <label class="form-label" for="new-tax-country">Country Code (Optional)</label>
            <input id="new-tax-country" v-model="newTaxForm.countryCode" class="form-input" type="text" maxlength="2" placeholder="e.g. US, DE, AE, GB" />
          </div>

          <div class="flex items-center gap-4 mt-2">
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" v-model="newTaxForm.isInclusive" />
              <span>Tax is inclusive in quoted prices</span>
            </label>
            <label class="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" v-model="newTaxForm.isDefault" />
              <span>Set as default tax</span>
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
          <button class="btn btn-secondary btn-sm" @click="showAddTaxModal = false">Cancel</button>
          <button class="btn btn-primary btn-sm" @click="saveNewTaxRate">Save Tax Rate</button>
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
import { useFormatters } from '~/composables/useFormatters'
import { ISO_CURRENCIES } from '~/utils/currencyUtils'
import { IANA_TIMEZONES, getBrowserTimezone } from '~/utils/dateUtils'
import IconUser from '~/components/IconUser.vue'
import IconReceipt from '~/components/IconReceipt.vue'
import IconClock from '~/components/IconClock.vue'
import IconShield from '~/components/IconShield.vue'
import IconPackage from '~/components/IconPackage.vue'

const store = useWelloStore()
const authStore = useAuthStore()
const toast = useToast()
const { formatMoney } = useFormatters()

const activeTab = ref('profile')
const isSaving = ref(false)
const showAddTaxModal = ref(false)
const browserTz = computed(() => getBrowserTimezone())

const tabs = [
  { id: 'profile', label: 'Profile & Timezone', icon: IconUser },
  { id: 'business', label: 'Business & Invoice', icon: IconReceipt },
  { id: 'work', label: 'Rate Targets & Tax Rates', icon: IconClock },
  { id: 'account', label: 'Account & Security', icon: IconShield },
  { id: 'about', label: 'System Info', icon: IconPackage },
]

// Personal Profile Form
const profileForm = ref({
  name: authStore.user?.name || store.user.name || '',
  email: authStore.user?.email || store.user.email || '',
  timezone: store.user.timezone || getBrowserTimezone(),
})

// Business Profile Form
const bizForm = ref({
  businessName: store.user.businessName || '',
  businessLogo: store.user.businessLogo || '',
  taxIdLabel: store.user.taxIdLabel || 'Tax ID',
  businessTaxId: store.user.businessTaxId || '',
  addressLine1: store.user.addressLine1 || store.user.businessAddress || '',
  addressLine2: store.user.addressLine2 || '',
  city: store.user.city || '',
  stateProvince: store.user.stateProvince || store.user.state || '',
  postalCode: store.user.postalCode || '',
  country: store.user.country || store.user.countryCode || '',
  businessPhone: store.user.businessPhone || '',
  businessEmail: store.user.businessEmail || store.user.email || '',
  defaultInvoiceNotes: store.user.defaultInvoiceNotes || '',
})

// Work Preferences Form
const prefForm = ref({
  targetHourly: store.user.targetHourly || 100,
  baseCurrency: store.user.baseCurrency || store.user.currencyCode || 'USD',
  headlineRateMetric: store.user.headlineRateMetric || 'client_work',
})

// New Tax Rate Form
const newTaxForm = ref({
  name: '',
  rate: 20,
  countryCode: '',
  isInclusive: false,
  isDefault: false,
  isCompound: false,
})

const formattedAddress = computed(() => {
  const parts = [
    bizForm.value.addressLine1,
    bizForm.value.addressLine2,
    bizForm.value.city,
    bizForm.value.stateProvince,
    bizForm.value.postalCode,
    bizForm.value.country,
  ].filter(Boolean)
  return parts.join(', ')
})

const totalTimeTracked = computed(() => {
  const totalMin = store.sessions.reduce((acc, s) => acc + (s.durationMin || 0), 0)
  return store.minutesToHM(totalMin)
})

function detectBrowserTz() {
  profileForm.value.timezone = getBrowserTimezone()
  toast.info(`Timezone set to browser location: ${profileForm.value.timezone}`)
}

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

async function saveProfile() {
  if (!profileForm.value.name.trim()) {
    toast.error('Full Name is required.')
    return false
  }
  isSaving.value = true
  try {
    const ok = await store.updateProfile({
      name: profileForm.value.name.trim(),
      email: profileForm.value.email.trim(),
      timezone: profileForm.value.timezone,
    })
    if (ok) {
      toast.success('Personal profile & timezone saved!')
      return true
    }
    return false
  } finally {
    isSaving.value = false
  }
}

async function saveBusinessProfile() {
  isSaving.value = true
  try {
    const ok = await store.updateProfile({
      businessName: bizForm.value.businessName.trim(),
      businessLogo: bizForm.value.businessLogo,
      taxIdLabel: bizForm.value.taxIdLabel.trim(),
      businessTaxId: bizForm.value.businessTaxId.trim(),
      businessAddress: formattedAddress.value,
      addressLine1: bizForm.value.addressLine1.trim(),
      addressLine2: bizForm.value.addressLine2.trim(),
      city: bizForm.value.city.trim(),
      stateProvince: bizForm.value.stateProvince.trim(),
      postalCode: bizForm.value.postalCode.trim(),
      country: bizForm.value.country.trim(),
      businessPhone: bizForm.value.businessPhone.trim(),
      businessEmail: bizForm.value.businessEmail.trim(),
      defaultInvoiceNotes: bizForm.value.defaultInvoiceNotes.trim(),
    })
    if (ok) {
      toast.success('Business & Invoicing profile updated!')
      return true
    }
    return false
  } finally {
    isSaving.value = false
  }
}

async function savePrefs() {
  isSaving.value = true
  try {
    const ok = await store.updateProfile({
      targetHourly: Number(prefForm.value.targetHourly) || 100,
      baseCurrency: prefForm.value.baseCurrency,
      currency: prefForm.value.baseCurrency,
      currencyCode: prefForm.value.baseCurrency,
      headlineRateMetric: prefForm.value.headlineRateMetric,
    })
    if (ok) {
      await store.fetchFxRates(prefForm.value.baseCurrency)
      toast.success('Base currency and rate targets saved!')
      return true
    }
    return false
  } finally {
    isSaving.value = false
  }
}

async function saveAll() {
  if (!profileForm.value.name.trim()) {
    toast.error('Full Name is required.')
    return
  }
  isSaving.value = true
  try {
    const unifiedPayload = {
      name: profileForm.value.name.trim(),
      email: profileForm.value.email.trim(),
      timezone: profileForm.value.timezone,
      businessName: bizForm.value.businessName.trim(),
      businessLogo: bizForm.value.businessLogo,
      taxIdLabel: bizForm.value.taxIdLabel.trim(),
      businessTaxId: bizForm.value.businessTaxId.trim(),
      businessAddress: formattedAddress.value,
      addressLine1: bizForm.value.addressLine1.trim(),
      addressLine2: bizForm.value.addressLine2.trim(),
      city: bizForm.value.city.trim(),
      stateProvince: bizForm.value.stateProvince.trim(),
      postalCode: bizForm.value.postalCode.trim(),
      country: bizForm.value.country.trim(),
      businessPhone: bizForm.value.businessPhone.trim(),
      businessEmail: bizForm.value.businessEmail.trim(),
      defaultInvoiceNotes: bizForm.value.defaultInvoiceNotes.trim(),
      targetHourly: Number(prefForm.value.targetHourly) || 100,
      baseCurrency: prefForm.value.baseCurrency,
      currency: prefForm.value.baseCurrency,
      currencyCode: prefForm.value.baseCurrency,
      headlineRateMetric: prefForm.value.headlineRateMetric,
    }
    const ok = await store.updateProfile(unifiedPayload)
    if (ok) {
      await store.fetchFxRates(prefForm.value.baseCurrency)
      toast.success('All settings saved successfully!')
    }
  } finally {
    isSaving.value = false
  }
}

async function addPresetTax(name, rate, countryCode) {
  try {
    await store.createTaxRate({
      name,
      rate,
      countryCode,
      isInclusive: false,
      isDefault: store.taxRates.length === 0,
      isCompound: false,
    })
    toast.success(`Added tax preset: ${name}`)
  } catch (e) {
    toast.error('Failed to add tax preset.')
  }
}

async function saveNewTaxRate() {
  if (!newTaxForm.value.name.trim()) {
    toast.error('Tax name is required.')
    return
  }
  try {
    await store.createTaxRate({
      name: newTaxForm.value.name.trim(),
      rate: Number(newTaxForm.value.rate) || 0,
      countryCode: newTaxForm.value.countryCode.trim().toUpperCase(),
      isInclusive: newTaxForm.value.isInclusive,
      isDefault: newTaxForm.value.isDefault,
      isCompound: newTaxForm.value.isCompound,
    })
    showAddTaxModal.value = false
    newTaxForm.value = { name: '', rate: 20, countryCode: '', isInclusive: false, isDefault: false, isCompound: false }
    toast.success('Custom tax rate created!')
  } catch (e) {
    toast.error('Failed to create tax rate.')
  }
}

async function removeTaxRate(id) {
  try {
    await store.deleteTaxRate(id)
    toast.success('Tax rate removed.')
  } catch (e) {
    toast.error('Failed to delete tax rate.')
  }
}
</script>
