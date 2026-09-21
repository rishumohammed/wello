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

              <!-- Earning Persona Selection -->
              <div class="form-group">
                <label class="form-label" for="settings-earning-persona">
                  Earning Persona
                </label>
                <select id="settings-earning-persona" v-model="prefForm.earningPersona" class="form-select">
                  <option value="freelancer_projects">💼 Freelancer / Project-Based (Clients, quotes, project billing)</option>
                  <option value="salaried">🏢 Salaried Employee (Contract salary, true rate, commute drag)</option>
                  <option value="daily_hourly_wage">⏱️ Daily & Hourly Worker (Multiple employers, shifts, quick entry)</option>
                  <option value="gig_retainer">🛵 Gig Worker & Retainers (Dynamic tasks, recurring retainers)</option>
                  <option value="mixed_hybrid">⚡ Mixed / Hybrid Portfolio (Combined salary, freelance & gigs)</option>
                </select>
                <span class="form-hint">
                  Customizes terminology, quick actions, and dashboard intelligence cards to fit how you earn.
                </span>
              </div>

              <!-- Overhead Costs Inclusion Toggle -->
              <div class="form-group">
                <label class="form-label">Overhead & Non-Project Cost Allocations</label>
                <label class="flex items-center gap-2 text-xs cursor-pointer p-3 bg-card border rounded-8">
                  <input
                    type="checkbox"
                    v-model="prefForm.includeOverheadInMetrics"
                    id="toggle-overhead-in-metrics"
                  />
                  <div>
                    <span class="fw-700 text-primary">Factor overhead expenses into effective hourly rate</span>
                    <span class="text-tertiary block text-2xs mt-0.5">Deducts commute fares, software tools, licenses, and equipment based on their allocation rules</span>
                  </div>
                </label>
              </div>

              <!-- Forgotten-Timer Max Hours Limit -->
              <div class="form-group">
                <label class="form-label" for="settings-max-timer-hours">
                  Max Active Timer Duration (Forgotten-Timer Protection)
                </label>
                <div class="flex items-center gap-3">
                  <input
                    id="settings-max-timer-hours"
                    v-model.number="prefForm.maxTimerHours"
                    class="form-input max-w-xs"
                    type="number"
                    min="1"
                    max="24"
                    step="1"
                    placeholder="8"
                  />
                  <span class="text-sm font-semibold text-secondary">hours</span>
                </div>
                <span class="form-hint">
                  If an active timer exceeds this threshold, Wello will flag it as potentially forgotten and offer one-click trimming to your last active time. Default is 8 hours.
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

          <!-- Danger Zone: Reset Work Data & Account Deletion -->
          <div class="pt-6 border-t mt-4 space-y-4">
            <div class="card border border-error/30 bg-error/5 p-4 rounded-xl">
              <div class="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div class="font-bold text-sm text-error">Delete All Work Data (Keep Account)</div>
                  <div class="text-xs text-tertiary mt-0.5">
                    Permanently wipes all sessions, invoices, clients, payments, and projects while keeping your user login and free addons.
                  </div>
                </div>
                <button
                  class="btn btn-secondary btn-sm text-error border-error-subtle font-bold"
                  @click="handleResetWorkData"
                  id="btn-reset-work-data"
                >
                  Wipe Work Data
                </button>
              </div>
            </div>

            <div class="card border border-error/30 bg-error/5 p-4 rounded-xl">
              <div class="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div class="font-bold text-sm text-error">Delete Account & All Personal Data</div>
                  <div class="text-xs text-tertiary mt-0.5">
                    Schedules permanent erasure of your account with a 14-day grace period. All records across all tables will be purged.
                  </div>
                  <div v-if="store.user.status === 'pending_deletion'" class="mt-2 text-xs text-error font-bold">
                    ⚠️ Account scheduled for permanent erasure on {{ formatDate(store.user.scheduledDeletionAt) }}.
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    v-if="store.user.status === 'pending_deletion'"
                    class="btn btn-primary btn-sm font-bold text-xs"
                    @click="handleCancelDeletion"
                    id="btn-cancel-deletion"
                  >
                    Cancel Account Deletion
                  </button>
                  <button
                    v-else
                    class="btn btn-danger btn-sm font-bold text-xs"
                    @click="handleDeleteAccount"
                    id="btn-delete-account"
                  >
                    Delete Account (14-day grace)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: DATA EXPORT & IMPORT -->
    <div v-if="activeTab === 'data'" class="settings-section flex flex-col gap-6">
      <!-- Card 1: Data Export -->
      <div class="card" id="settings-export-card">
        <div class="card-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="metric-icon-box purple">
              <IconDownload :size="16" />
            </div>
            <div>
              <div class="card-title text-base">Export Your Personal Data</div>
              <div class="card-subtitle text-xs">Download complete backups in standard JSON and individual CSV files</div>
            </div>
          </div>
        </div>
        <div class="card-body flex flex-col gap-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 bg-off-white rounded-12 border-subtle-box flex flex-col justify-between">
              <div>
                <div class="fw-700 text-sm text-primary mb-1">📦 Complete Archive (ZIP)</div>
                <div class="text-xs text-tertiary">All your sessions, invoices, payments, clients, expenses, and full JSON metadata bundled in a single ZIP file.</div>
              </div>
              <button class="btn btn-primary btn-sm font-bold mt-4 self-start" @click="store.exportAllZip()" id="btn-export-zip">
                Download Complete ZIP
              </button>
            </div>

            <div class="p-4 bg-off-white rounded-12 border-subtle-box flex flex-col justify-between">
              <div>
                <div class="fw-700 text-sm text-primary mb-1">📄 Full JSON Backup</div>
                <div class="text-xs text-tertiary">Portable machine-readable JSON backup containing every database record linked to your user account.</div>
              </div>
              <button class="btn btn-secondary btn-sm font-semibold mt-4 self-start" @click="store.exportJson()" id="btn-export-json">
                Download JSON
              </button>
            </div>
          </div>

          <div class="pt-4 border-t">
            <div class="fw-700 text-xs text-secondary uppercase mb-3">Download Per-Entity CSV Spreadsheets</div>
            <div class="flex items-center gap-2 flex-wrap">
              <button class="btn btn-ghost btn-xs border text-xs" @click="store.exportCsv('sessions')" id="btn-export-csv-sessions">⏱️ Work Sessions (.csv)</button>
              <button class="btn btn-ghost btn-xs border text-xs" @click="store.exportCsv('payments')" id="btn-export-csv-payments">💳 Payments (.csv)</button>
              <button class="btn btn-ghost btn-xs border text-xs" @click="store.exportCsv('expenses')" id="btn-export-csv-expenses">🧾 Expenses (.csv)</button>
              <button class="btn btn-ghost btn-xs border text-xs" @click="store.exportCsv('invoices')" id="btn-export-csv-invoices">📄 Invoices (.csv)</button>
              <button class="btn btn-ghost btn-xs border text-xs" @click="store.exportCsv('clients')" id="btn-export-csv-clients">👥 Clients (.csv)</button>
              <button class="btn btn-ghost btn-xs border text-xs" @click="store.exportCsv('projects')" id="btn-export-csv-projects">📁 Projects (.csv)</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 2: Universal CSV Importer -->
      <div class="card" id="settings-import-card">
        <div class="card-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="metric-icon-box blue">
              <span>📥</span>
            </div>
            <div>
              <div class="card-title text-base">Universal CSV Importer (Toggl, Clockify & Wello)</div>
              <div class="card-subtitle text-xs">Import your work history with automatic column mapping and validation preview</div>
            </div>
          </div>
        </div>
        <div class="card-body flex flex-col gap-5">
          <!-- Preset and Entity Select -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label">Data Entity to Import</label>
              <select v-model="importForm.entityType" class="form-select text-xs">
                <option value="sessions">⏱️ Work Sessions & Timers</option>
                <option value="payments">💳 Payments & Cash Income</option>
                <option value="clients">👥 Clients Roster</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Source Format Preset</label>
              <div class="flex items-center gap-1.5 pt-1 flex-wrap">
                <button
                  type="button"
                  class="filter-chip text-2xs"
                  :class="{ active: importForm.preset === 'toggl' }"
                  @click="importForm.preset = 'toggl'"
                >
                  Toggl Track
                </button>
                <button
                  type="button"
                  class="filter-chip text-2xs"
                  :class="{ active: importForm.preset === 'clockify' }"
                  @click="importForm.preset = 'clockify'"
                >
                  Clockify
                </button>
                <button
                  type="button"
                  class="filter-chip text-2xs"
                  :class="{ active: importForm.preset === 'wello' }"
                  @click="importForm.preset = 'wello'"
                >
                  Wello Export
                </button>
                <button
                  type="button"
                  class="filter-chip text-2xs"
                  :class="{ active: importForm.preset === 'generic' }"
                  @click="importForm.preset = 'generic'"
                >
                  Generic CSV
                </button>
              </div>
            </div>
          </div>

          <!-- File Upload & Text Input -->
          <div class="form-group">
            <div class="flex items-center justify-between mb-1.5">
              <label class="form-label mb-0">CSV Content</label>
              <label class="btn btn-ghost btn-xs text-primary font-bold cursor-pointer">
                <span>📁 Upload .CSV File</span>
                <input type="file" accept=".csv,text/csv" class="hidden" @change="handleCsvFileUpload" />
              </label>
            </div>
            <textarea
              v-model="importForm.csvText"
              class="form-input text-xs font-mono h-28 resize-none"
              placeholder="Paste raw CSV content here or upload a file above..."
              id="textarea-import-csv"
            ></textarea>
          </div>

          <div class="flex justify-start">
            <button
              type="button"
              class="btn btn-primary btn-sm font-bold text-xs"
              @click="handleAnalyzeCsv"
              :disabled="!importForm.csvText.trim() || importForm.isPreviewing"
              id="btn-analyze-csv"
            >
              <span>{{ importForm.isPreviewing ? 'Analyzing...' : 'Analyze & Preview Mapping' }}</span>
            </button>
          </div>

          <!-- Live Preview & Mapping Section -->
          <div v-if="importPreview" class="p-4 bg-off-white rounded-12 border-subtle-box space-y-4 animate-fade-in">
            <div class="flex items-center justify-between">
              <div class="font-bold text-xs text-primary">
                Found {{ importPreview.totalRows }} rows &bull; Detected format: <span class="uppercase text-primary font-bold">{{ importPreview.preset }}</span>
              </div>
              <span class="badge text-2xs font-bold" :class="importPreview.isValid ? 'badge-success' : 'badge-warning'">
                {{ importPreview.isValid ? 'Valid Structure' : `${importPreview.validationErrors.length} Warnings` }}
              </span>
            </div>

            <!-- Column Mapping -->
            <div>
              <div class="text-2xs uppercase text-tertiary font-bold mb-2">Column Header Mapping</div>
              <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                <div
                  v-for="h in importPreview.headers"
                  :key="h"
                  class="p-2 rounded border bg-surface text-2xs"
                >
                  <div class="font-bold text-primary truncate" :title="h">{{ h }}</div>
                  <div class="text-tertiary mt-0.5">&darr; maps to &darr;</div>
                  <div class="font-mono text-secondary truncate font-semibold">
                    {{ importForm.mapping[h] || '(Skip)' }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Sample Preview Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-2xs">
                <thead>
                  <tr class="border-b text-tertiary">
                    <th class="py-1 px-2">#</th>
                    <th v-for="h in importPreview.headers.slice(0, 5)" :key="h" class="py-1 px-2">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in importPreview.previewRows.slice(0, 5)" :key="idx" class="border-b">
                    <td class="py-1 px-2 font-mono text-tertiary">{{ idx + 1 }}</td>
                    <td v-for="h in importPreview.headers.slice(0, 5)" :key="h" class="py-1 px-2 text-secondary truncate max-w-[150px]">
                      {{ row.raw[h] }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex items-center justify-between pt-2 border-t">
              <div class="text-xs text-tertiary">
                Ready to import into <strong>{{ importForm.entityType }}</strong>
              </div>
              <button
                class="btn btn-primary btn-sm font-bold text-xs"
                @click="handleExecuteImport"
                :disabled="importForm.isImporting"
                id="btn-execute-import"
              >
                <span>{{ importForm.isImporting ? 'Importing...' : `Import ${importPreview.totalRows} Records` }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: PRIVACY & CONSENT -->
    <div v-if="activeTab === 'privacy'" class="settings-section flex flex-col gap-6">
      <div class="card" id="settings-privacy-card">
        <div class="card-header flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="metric-icon-box purple">
              <IconShield :size="16" />
            </div>
            <div>
              <div class="card-title text-base">Privacy & Telemetry Controls</div>
              <div class="card-subtitle text-xs">Manage non-essential telemetry, cookie consent, and read our privacy policies</div>
            </div>
          </div>
        </div>
        <div class="card-body flex flex-col gap-5">
          <!-- Telemetry Toggle -->
          <div class="p-4 bg-off-white rounded-12 border-subtle-box flex items-center justify-between gap-4">
            <div>
              <div class="fw-700 text-sm text-primary">Anonymous Analytics & Product Telemetry</div>
              <div class="text-xs text-tertiary mt-0.5">
                Allows Wello to collect privacy-preserving aggregated feature usage data. Never includes financial figures or client names.
              </div>
            </div>
            <label class="toggle-switch">
              <input
                v-model="privacyForm.analyticsConsent"
                type="checkbox"
                id="toggle-analytics-consent"
                @change="savePrivacySettings"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>

          <!-- Legal Links -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <NuxtLink to="/privacy" class="p-4 rounded-xl border border-neutral hover:border-primary bg-surface flex items-center justify-between transition-all group">
              <div>
                <div class="font-bold text-xs text-primary group-hover:text-primary">🔒 Privacy Policy</div>
                <div class="text-2xs text-tertiary mt-0.5">Learn how we protect and never monetize your income data.</div>
              </div>
              <span class="text-xs text-primary font-bold">&rarr;</span>
            </NuxtLink>

            <NuxtLink to="/terms" class="p-4 rounded-xl border border-neutral hover:border-primary bg-surface flex items-center justify-between transition-all group">
              <div>
                <div class="font-bold text-xs text-primary group-hover:text-primary">📜 Terms of Service</div>
                <div class="text-2xs text-tertiary mt-0.5">Read our free product terms and fair-use guidelines.</div>
              </div>
              <span class="text-xs text-primary font-bold">&rarr;</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 4: NOTIFICATIONS & EMAIL DIGEST -->
    <div v-if="activeTab === 'notifications'" class="settings-section">
      <div class="grid-1 lg:grid-2 gap-6">
        <!-- Card 1: Email Digests & Unsubscribe Status -->
        <div class="card" id="settings-email-digest-card">
          <div class="card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="metric-icon-box purple">
                <IconBell :size="16" />
              </div>
              <div>
                <div class="card-title text-base">Executive Email Digests</div>
                <div class="card-subtitle text-xs">Automated summaries delivered to your inbox</div>
              </div>
            </div>
          </div>

          <div class="card-body flex flex-col gap-4">
            <!-- Unsubscribe status banner if unsubscribed -->
            <div v-if="store.user.emailUnsubscribedAt" class="p-3 bg-danger-subtle border-error-subtle rounded-12 text-xs flex items-center justify-between">
              <div>
                <strong class="text-error">Currently Unsubscribed:</strong>
                <span class="text-tertiary block mt-0.5">You opted out of non-transactional digests.</span>
              </div>
              <button type="button" class="btn btn-primary btn-xs" @click="handleResubscribeDigest" id="btn-resubscribe-digest">
                Resubscribe
              </button>
            </div>

            <div class="form-group">
              <label class="form-label" for="settings-digest-frequency">Digest Frequency</label>
              <select id="settings-digest-frequency" v-model="digestForm.digestFrequency" class="form-select">
                <option value="weekly">Weekly Executive Digest (Recommended)</option>
                <option value="daily">Daily Morning Digest</option>
                <option value="none">Disabled (No automated digests)</option>
              </select>
              <span class="form-hint">
                Summarizes billable hours, cash collected, and top leakage reasons directly to your inbox.
              </span>
            </div>

            <div v-if="digestForm.digestFrequency === 'weekly'" class="grid-2 gap-3">
              <div class="form-group">
                <label class="form-label" for="settings-digest-day">Delivery Day</label>
                <select id="settings-digest-day" v-model.number="digestForm.digestDayOfWeek" class="form-select">
                  <option :value="1">Monday</option>
                  <option :value="2">Tuesday</option>
                  <option :value="3">Wednesday</option>
                  <option :value="4">Thursday</option>
                  <option :value="5">Friday</option>
                  <option :value="6">Saturday</option>
                  <option :value="0">Sunday</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="settings-digest-hour">Delivery Time (Your Timezone)</label>
                <select id="settings-digest-hour" v-model.number="digestForm.digestHourLocal" class="form-select">
                  <option :value="8">08:00 AM</option>
                  <option :value="9">09:00 AM</option>
                  <option :value="10">10:00 AM</option>
                  <option :value="18">06:00 PM</option>
                </select>
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <button type="button" class="btn btn-primary btn-sm" @click="saveDigestSettings" :disabled="isSaving">
                Save Digest Schedule
              </button>
            </div>

            <!-- Web Push Notifications -->
            <div class="pt-4 border-t">
              <div class="fw-700 text-sm text-primary mb-1">Web Push Notifications</div>
              <div class="text-xs text-tertiary mb-3">
                Receive instant browser alerts for forgotten active timers and overdue invoice milestones.
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  @click="handleWebPushSubscribe"
                  id="btn-enable-web-push"
                >
                  <IconBell :size="14" />
                  <span>{{ pushSubscribed ? 'Web Push Active ✓' : 'Enable Web Push' }}</span>
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm text-primary"
                  @click="handleSendTestPush"
                  id="btn-test-push"
                >
                  Send Test Alert
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Card 2: Notification Channel Matrix -->
        <div class="card" id="settings-notifications-matrix-card">
          <div class="card-header flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="metric-icon-box success">
                <IconShield :size="16" />
              </div>
              <div>
                <div class="card-title text-base">Channel Routing & Event Triggers</div>
                <div class="card-subtitle text-xs">Configure where each alert type is delivered</div>
              </div>
            </div>
          </div>

          <div class="card-body p-4">
            <div class="table-container">
              <table class="data-table text-xs">
                <thead>
                  <tr>
                    <th>Alert Event</th>
                    <th class="text-center w-20">In-App</th>
                    <th class="text-center w-20">Email</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in channelPreferences" :key="item.type">
                    <td>
                      <div class="fw-600 text-primary">{{ item.label }}</div>
                      <div class="text-2xs text-tertiary">{{ item.description }}</div>
                    </td>
                    <td class="text-center">
                      <input type="checkbox" v-model="item.inApp" />
                    </td>
                    <td class="text-center">
                      <input type="checkbox" v-model="item.email" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-4 pt-3 border-t flex justify-end">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                @click="savePreferencesMatrix"
                id="btn-save-notif-prefs"
                :disabled="isSaving"
              >
                Save Notification Matrix
              </button>
            </div>
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
import IconBell from '~/components/IconBell.vue'
import IconDownload from '~/components/IconDownload.vue'

const store = useWelloStore()
const authStore = useAuthStore()
const route = useRoute()
const toast = useToast()
const { formatMoney } = useFormatters()

const activeTab = ref(route?.query?.tab ? String(route.query.tab) : 'profile')
const isSaving = ref(false)
const showAddTaxModal = ref(false)
const browserTz = computed(() => getBrowserTimezone())

const tabs = [
  { id: 'profile', label: 'Profile & Timezone', icon: IconUser },
  { id: 'business', label: 'Business & Invoice', icon: IconReceipt },
  { id: 'work', label: 'Rate Targets & Tax Rates', icon: IconClock },
  { id: 'data', label: 'Data Management & CSV', icon: IconDownload },
  { id: 'privacy', label: 'Privacy & Consent', icon: IconShield },
  { id: 'notifications', label: 'Notifications & Email Digest', icon: IconBell },
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
  earningPersona: store.user.earningPersona || 'freelancer_projects',
  includeOverheadInMetrics: store.user.includeOverheadInMetrics ?? true,
  maxTimerHours: store.user.maxTimerHours || 8,
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
      earningPersona: prefForm.value.earningPersona,
      includeOverheadInMetrics: prefForm.value.includeOverheadInMetrics,
      maxTimerHours: Number(prefForm.value.maxTimerHours) || 8,
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
      earningPersona: prefForm.value.earningPersona,
      includeOverheadInMetrics: prefForm.value.includeOverheadInMetrics,
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

// Digest & Notification Matrix State
const digestForm = ref({
  digestFrequency: store.user.digestFrequency || 'weekly',
  digestDayOfWeek: store.user.digestDayOfWeek !== undefined ? store.user.digestDayOfWeek : 1,
  digestHourLocal: 9,
})

const pushSubscribed = ref(false)

const channelPreferences = ref([
  { type: 'forgotten_timer', label: 'Forgotten Active Timer', description: 'Alert when a work timer runs past your threshold', inApp: true, email: true },
  { type: 'invoice_due_soon', label: 'Invoice Due Soon', description: 'Reminder 3 days before an issued invoice reaches due date', inApp: true, email: true },
  { type: 'invoice_overdue', label: 'Invoice Overdue Alert', description: 'Immediate alert when an unpaid invoice becomes overdue', inApp: true, email: true },
  { type: 'quote_awaiting_response', label: 'Quote Follow-Up Needed', description: 'Reminder 5 days after sending a quote without client acceptance', inApp: true, email: false },
  { type: 'weekly_leakage_alert', label: 'Weekly Unpaid Time Leakage', description: 'Flagged when unbilled hours exceed 25% of total time in a week', inApp: true, email: true },
  { type: 'target_rate_milestone', label: 'Target Rate Benchmark Milestone', description: 'Celebrates when your effective hourly rate exceeds your goal', inApp: true, email: true },
])

async function loadNotificationPreferences() {
  const prefs = await store.fetchNotificationPreferences()
  if (Array.isArray(prefs) && prefs.length > 0) {
    prefs.forEach(p => {
      const match = channelPreferences.value.find(item => item.type === p.type)
      if (match) {
        match.inApp = Boolean(p.inApp)
        match.email = Boolean(p.email)
      }
    })
  }
}

async function saveDigestSettings() {
  isSaving.value = true
  try {
    const ok = await store.updateProfile({
      digestFrequency: digestForm.value.digestFrequency,
      digestDayOfWeek: Number(digestForm.value.digestDayOfWeek),
      digestHourUtc: Number(digestForm.value.digestHourLocal),
    })
    if (ok) {
      toast.success('Email digest schedule updated!')
    }
  } finally {
    isSaving.value = false
  }
}

async function handleResubscribeDigest() {
  try {
    const token = authStore.token
    await $fetch('/api/auth/unsubscribe', {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: { resubscribe: true }
    })
    store.user.emailUnsubscribedAt = null
    toast.success('Successfully resubscribed to email digests!')
  } catch (err) {
    toast.error('Failed to resubscribe.')
  }
}

async function savePreferencesMatrix() {
  isSaving.value = true
  try {
    const payload = channelPreferences.value.map(p => ({
      type: p.type,
      inApp: p.inApp,
      email: p.email,
    }))
    const ok = await store.saveNotificationPreferences(payload)
    if (ok) {
      toast.success('Notification channels saved!')
    }
  } finally {
    isSaving.value = false
  }
}

const webPush = useWebPush()

async function handleWebPushToggle() {
  if (webPush.isSubscribed.value) {
    await webPush.unsubscribe()
  } else {
    await webPush.subscribe()
  }
}

async function handleSendTestPush() {
  await webPush.sendTest()
}

// ── Data Management & CSV Importer ──────────────────────────────────────────
const importForm = ref({
  entityType: 'sessions',
  preset: 'toggl',
  csvText: '',
  mapping: {},
  isPreviewing: false,
  isImporting: false,
})

const importPreview = ref(null)

function handleCsvFileUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    importForm.value.csvText = ev.target.result || ''
    handleAnalyzeCsv()
  }
  reader.readAsText(file)
}

async function handleAnalyzeCsv() {
  if (!importForm.value.csvText.trim()) return
  importForm.value.isPreviewing = true
  try {
    const res = await store.previewImport(importForm.value.csvText, importForm.value.entityType, importForm.value.mapping)
    if (res?.success) {
      importPreview.value = res.data
      importForm.value.preset = res.data.preset || importForm.value.preset
      importForm.value.mapping = { ...res.data.detectedMapping }
      toast.info(`Analyzed CSV: ${res.data.totalRows} records found.`)
    } else {
      toast.error(res?.message || 'Failed to parse CSV.')
    }
  } catch (err) {
    toast.error(err?.data?.message || err?.message || 'Failed to analyze CSV preview.')
  } finally {
    importForm.value.isPreviewing = false
  }
}

async function handleExecuteImport() {
  if (!importForm.value.csvText.trim()) return
  importForm.value.isImporting = true
  try {
    const res = await store.executeImport(importForm.value.csvText, importForm.value.entityType, importForm.value.mapping)
    if (res?.success) {
      toast.success(`Import complete! ${res.data.createdCount} records imported, ${res.data.skippedCount} skipped.`)
      importForm.value.csvText = ''
      importPreview.value = null
    } else {
      toast.error(res?.message || 'Import failed.')
    }
  } catch (err) {
    toast.error(err?.data?.message || err?.message || 'Failed to execute import.')
  } finally {
    importForm.value.isImporting = false
  }
}

// ── Privacy & Telemetry ─────────────────────────────────────────────────────
const privacyForm = ref({
  analyticsConsent: store.user?.analyticsConsent ?? true,
})

async function loadPrivacySettings() {
  try {
    const data = await store.fetchPrivacySettings()
    if (data) {
      privacyForm.value.analyticsConsent = Boolean(data.analyticsConsent)
    }
  } catch (err) {
    // Non-blocking
  }
}

async function savePrivacySettings() {
  try {
    await store.updatePrivacySettings({
      analyticsConsent: privacyForm.value.analyticsConsent,
      cookieConsent: privacyForm.value.analyticsConsent,
    })
    toast.success('Privacy preferences updated.')
  } catch (err) {
    toast.error('Failed to save privacy preferences.')
  }
}

// ── Account Lifecycle & Danger Zone ─────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateStr
  }
}

async function handleResetWorkData() {
  if (!confirm('Are you sure you want to delete all work data? This will permanently delete your sessions, projects, clients, invoices, and payments. Your account login and free addons will be preserved.')) {
    return
  }
  try {
    await store.resetWorkData()
    toast.success('All work data has been wiped.')
  } catch (err) {
    toast.error(err?.data?.message || err?.message || 'Failed to reset work data.')
  }
}

async function handleDeleteAccount() {
  if (!confirm('Are you sure you want to schedule your account for permanent deletion? You will have a 14-day grace period to cancel before all data across all tables is irreversibly erased.')) {
    return
  }
  try {
    await store.deleteAccount(14)
    toast.warning('Account scheduled for permanent erasure in 14 days.')
  } catch (err) {
    toast.error(err?.data?.message || err?.message || 'Failed to schedule deletion.')
  }
}

async function handleCancelDeletion() {
  try {
    await store.cancelAccountDeletion()
    toast.success('Account deletion cancelled. Your account is active.')
  } catch (err) {
    toast.error(err?.data?.message || err?.message || 'Failed to cancel deletion.')
  }
}

onMounted(() => {
  loadNotificationPreferences()
  loadPrivacySettings()
  webPush.checkSubscription()
})
</script>
