<template>
  <div class="admin-config-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">Resend REST API Configuration</h1>
        <p class="page-subtitle">Configure HTTP dispatch parameters, default email senders, and OTP security expiration rules.</p>
      </div>
    </div>

    <!-- Alert / Toast in Admin -->
    <div v-if="alertMessage" class="auth-alert mb-5" :class="alertType" id="admin-alert">
      <span>{{ alertMessage }}</span>
      <button class="btn btn-ghost btn-sm p-0 ml-auto" @click="alertMessage = ''">✕</button>
    </div>

    <div class="grid-2 gap-6">
      <!-- Configuration Form Card -->
      <div class="card card-padded" id="resend-config-card">
        <div class="card-header px-0 pt-0 mb-4">
          <div>
            <div class="card-title">Resend REST API Credentials</div>
            <div class="card-subtitle">Endpoint integration with https://api.resend.com/emails</div>
          </div>
        </div>

        <form @submit.prevent="saveConfiguration" id="form-save-config">
          <!-- Resend API Key -->
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
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                @click="showKey = !showKey"
                style="height:38px;padding:0 12px;"
              >
                {{ showKey ? 'Hide' : 'Show' }}
              </button>
            </div>
            <div class="text-xs text-tertiary mt-1">
              Get your API key from <a href="https://resend.com/api-keys" target="_blank" class="auth-link-highlight">Resend Dashboard</a>.
            </div>
          </div>

          <!-- From Email -->
          <div class="form-group mb-4">
            <label class="form-label" for="admin-from-email">Sender Email Address</label>
            <input
              id="admin-from-email"
              v-model="formConfig.fromEmail"
              type="email"
              class="form-input"
              placeholder="onboarding@resend.dev"
              required
            />
            <div class="text-xs text-tertiary mt-1">
              Use <code>onboarding@resend.dev</code> for testing, or your verified custom domain.
            </div>
          </div>

          <!-- Sender Name -->
          <div class="form-group mb-4">
            <label class="form-label" for="admin-from-name">From Sender Name</label>
            <input
              id="admin-from-name"
              v-model="formConfig.fromName"
              type="text"
              class="form-input"
              placeholder="Wello Verification"
              required
            />
          </div>

          <!-- OTP Expiry Duration -->
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
          <div class="form-group mb-6">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" v-model="formConfig.devMode" />
              <span class="text-sm font-semibold">Dev Sandbox Banner Mode</span>
            </label>
            <div class="text-xs text-tertiary mt-1">
              When enabled, generated OTP codes are displayed directly on the login screen for developer testing.
            </div>
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="isSaving"
            id="btn-save-admin-config"
          >
            <span v-if="isSaving">Saving Settings…</span>
            <span v-else>Save Resend Configuration</span>
          </button>
        </form>
      </div>

      <!-- Resend Status & Instructions Card -->
      <div class="card card-padded">
        <div class="card-title mb-2">Integration Status</div>
        <div class="p-4 border-radius-sm mb-4" :style="{ background: config.hasKey ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: config.hasKey ? '1px solid #10B981' : '1px solid #F59E0B' }">
          <div class="fw-700 text-sm mb-1" :style="{ color: config.hasKey ? '#10B981' : '#D97706' }">
            {{ config.hasKey ? '✓ Live Resend API Connected' : '⚡ Local Dev Sandbox Active' }}
          </div>
          <div class="text-xs text-secondary">
            {{ config.hasKey ? 'Dispatches will be delivered to real recipient inboxes via Resend HTTP API.' : 'Without a Resend API key, the system generates 6-digit codes in local dev mode.' }}
          </div>
        </div>

        <div class="card-title mb-2 text-sm">Resend Domain Verification Notice</div>
        <div class="text-xs text-tertiary leading-relaxed mb-4">
          When using the default Resend key without domain verification, emails can only be sent to the email address registered with your Resend account. Verify your custom domain in Resend for unlimited dispatches.
        </div>

        <div class="flex items-center gap-2">
          <NuxtLink to="/admin/test-email" class="btn btn-secondary btn-sm w-full">
            Go to Email Dispatcher →
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

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

onMounted(async () => {
  await fetchConfig()
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

    if (res?.success && res?.config) {
      config.value = res.config
      apiKeyInput.value = ''
      alertMessage.value = 'Resend REST API configuration saved successfully!'
      alertType.value = 'success'
    }
  } catch (err) {
    alertMessage.value = err?.data?.statusMessage || 'Failed to update Resend configuration.'
    alertType.value = 'error'
  } finally {
    isSaving.value = false
  }
}
</script>
