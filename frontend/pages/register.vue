<template>
  <div class="auth-card" id="register-card">
    <!-- Brand Logo in Card -->
    <div class="auth-logo-row mb-6">
      <NuxtLink to="/" class="auth-logo-link">
        <img src="~/assets/logo.png" alt="Wello" class="auth-logo-img" style="height:42px;width:auto;max-width:150px;object-fit:contain;" />
      </NuxtLink>
    </div>

    <!-- Step 1: Registration Profile Info -->
    <div v-if="step === 1" class="animate-fade-in" id="register-step-1">
      <div class="auth-heading-group mb-8">
        <h1 class="auth-title">Create your account</h1>
        <p class="auth-subtitle">Track your real work value and understand your economic return.</p>
      </div>

      <!-- Error message -->
      <div v-if="errorMessage" class="auth-alert error mb-6">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>{{ errorMessage }}</span>
      </div>

      <form @submit.prevent="handleRegisterNext" class="auth-form-wrap" id="form-register">
        <div class="form-field-group mb-5">
          <label class="form-field-label" for="reg-name">Your Full Name <span class="text-required">*</span></label>
          <input
            id="reg-name"
            v-model="name"
            type="text"
            class="form-field-input"
            placeholder="e.g. Priya Sharma"
            required
            :disabled="isLoading"
          />
        </div>

        <div class="form-field-group mb-5">
          <label class="form-field-label" for="reg-email">Work Email Address <span class="text-required">*</span></label>
          <input
            id="reg-email"
            v-model="email"
            type="email"
            class="form-field-input"
            placeholder="priya@designstudio.com"
            required
            :disabled="isLoading"
          />
        </div>

        <div class="reg-fields-grid mb-6">
          <div class="form-field-group">
            <label class="form-field-label" for="reg-service">Profession / Service</label>
            <input
              id="reg-service"
              v-model="serviceCategory"
              type="text"
              class="form-field-input"
              placeholder="e.g. UX Designer"
              :disabled="isLoading"
            />
          </div>

          <div class="form-field-group">
            <label class="form-field-label" for="reg-target">Target Rate (₹/hr)</label>
            <input
              id="reg-target"
              v-model="targetHourly"
              type="number"
              min="50"
              step="10"
              class="form-field-input"
              placeholder="350"
              :disabled="isLoading"
            />
          </div>
        </div>

        <button
          type="submit"
          class="btn-primary-action mb-6"
          :disabled="isLoading || !email || !name"
          id="btn-register-submit"
        >
          <span v-if="isLoading" class="btn-loader mr-2"></span>
          <span>{{ isLoading ? 'Sending verification code…' : 'Send Verification OTP' }}</span>
        </button>
      </form>

      <div class="auth-bottom-switch">
        Already have an account?
        <NuxtLink to="/login" class="auth-link-highlight ml-1">Sign in</NuxtLink>
      </div>
    </div>

    <!-- Step 2: Verify OTP for Registration -->
    <div v-else class="animate-fade-in" id="register-step-2">
      <div class="auth-heading-group mb-6">
        <h1 class="auth-title">Verify your email</h1>
        <p class="auth-subtitle">
          Enter the 6-digit code sent to <strong class="text-highlight">{{ email }}</strong> to complete setup.
        </p>
      </div>

      <!-- Sleek Dev Sandbox Auto-Fill Helper -->
      <div v-if="devOtp" class="sandbox-pill-box mb-6" id="dev-otp-reg-banner">
        <div class="sandbox-pill-left">
          <span class="sandbox-pulse-indicator"></span>
          <span class="sandbox-label">Dev Code:</span>
          <span class="sandbox-code-number">{{ devOtp }}</span>
        </div>
        <button type="button" class="sandbox-autofill-action" @click="autoFillOtp(devOtp)">
          Auto-fill
        </button>
      </div>

      <!-- Error message -->
      <div v-if="errorMessage" class="auth-alert error mb-6">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>{{ errorMessage }}</span>
      </div>

      <form @submit.prevent="handleVerifyOtp" class="auth-form-wrap" id="form-verify-reg-otp">
        <!-- 6-Digit OTP Inputs Grid -->
        <div class="otp-inputs-grid mb-6" id="reg-otp-inputs-container">
          <input
            v-for="(digit, index) in otpDigits"
            :key="index"
            :ref="el => inputRefs[index] = el"
            v-model="otpDigits[index]"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="1"
            class="otp-digit-field"
            :id="`reg-otp-box-${index}`"
            @input="onDigitInput(index, $event)"
            @keydown="onKeyDown(index, $event)"
            @paste="onPaste"
            :disabled="isLoading"
          />
        </div>

        <button
          type="submit"
          class="btn-primary-action mb-6"
          :disabled="isLoading || fullOtp.length !== 6"
          id="btn-complete-registration"
        >
          <span v-if="isLoading" class="btn-loader mr-2"></span>
          <span>{{ isLoading ? 'Creating account…' : 'Complete Setup & Enter Workspace' }}</span>
        </button>
      </form>

      <!-- Resend and back actions -->
      <div class="auth-footer-nav">
        <button
          type="button"
          class="btn-link-action"
          @click="step = 1; errorMessage = '';"
          id="btn-back-reg-info"
        >
          ← Back to profile details
        </button>

        <button
          type="button"
          class="btn-link-action"
          :class="{ 'is-disabled': countdown > 0 || isLoading, 'is-active': countdown === 0 }"
          :disabled="countdown > 0 || isLoading"
          @click="resendOtp"
          id="btn-resend-reg-otp"
        >
          {{ countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'auth',
})

import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useWelloStore } from '~/stores/wello'

const authStore = useAuthStore()
const welloStore = useWelloStore()
const router = useRouter()

const step = ref(1)
const name = ref('')
const email = ref('')
const serviceCategory = ref('Consulting & Services')
const targetHourly = ref(350)
const otpDigits = ref(['', '', '', '', '', ''])
const inputRefs = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const devOtp = ref('')
const countdown = ref(0)
let timerInterval = null

const fullOtp = computed(() => otpDigits.value.join(''))

function startCountdown(seconds = 60) {
  countdown.value = seconds
  if (timerInterval) clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    } else {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }, 1000)
}

async function handleRegisterNext() {
  if (!name.value || !email.value) return
  isLoading.value = true
  errorMessage.value = ''

  try {
    const res = await authStore.sendOtp({
      email: email.value,
      name: name.value,
      type: 'register',
    })

    if (res?.devOtp) {
      devOtp.value = res.devOtp
    }
    step.value = 2
    startCountdown(60)

    // Auto-focus first OTP input
    await nextTick()
    if (inputRefs.value[0]) {
      inputRefs.value[0].focus()
    }
  } catch (err) {
    errorMessage.value = err?.message || 'Could not send verification code.'
  } finally {
    isLoading.value = false
  }
}

async function resendOtp() {
  if (countdown.value > 0 || isLoading.value) return
  isLoading.value = true
  errorMessage.value = ''

  try {
    const res = await authStore.sendOtp({
      email: email.value,
      name: name.value,
      type: 'register',
    })
    if (res?.devOtp) devOtp.value = res.devOtp
    startCountdown(60)
  } catch (err) {
    errorMessage.value = err?.message || 'Could not resend code.'
  } finally {
    isLoading.value = false
  }
}

function autoFillOtp(code) {
  if (!code || code.length !== 6) return
  const chars = code.split('')
  for (let i = 0; i < 6; i++) {
    otpDigits.value[i] = chars[i] || ''
  }
  nextTick(() => {
    if (inputRefs.value[5]) {
      inputRefs.value[5].focus()
    }
  })
}

function onDigitInput(index, event) {
  const val = event.target.value.replace(/[^0-9]/g, '')
  if (val.length > 0) {
    otpDigits.value[index] = val.slice(-1)
    if (index < 5 && inputRefs.value[index + 1]) {
      inputRefs.value[index + 1].focus()
    }
  } else {
    otpDigits.value[index] = ''
  }
}

function onKeyDown(index, event) {
  if (event.key === 'Backspace') {
    if (!otpDigits.value[index] && index > 0) {
      inputRefs.value[index - 1].focus()
    }
  } else if (event.key === 'ArrowLeft' && index > 0) {
    inputRefs.value[index - 1].focus()
  } else if (event.key === 'ArrowRight' && index < 5) {
    inputRefs.value[index + 1].focus()
  }
}

function onPaste(event) {
  event.preventDefault()
  const text = (event.clipboardData || window.clipboardData).getData('text').trim()
  const digitsOnly = text.replace(/[^0-9]/g, '').slice(0, 6)
  if (digitsOnly.length > 0) {
    for (let i = 0; i < 6; i++) {
      otpDigits.value[i] = digitsOnly[i] || ''
    }
    const nextIdx = Math.min(digitsOnly.length, 5)
    if (inputRefs.value[nextIdx]) {
      inputRefs.value[nextIdx].focus()
    }
  }
}

async function handleVerifyOtp() {
  if (fullOtp.value.length !== 6) return
  isLoading.value = true
  errorMessage.value = ''

  try {
    const res = await authStore.verifyOtp({
      email: email.value,
      code: fullOtp.value,
      name: name.value,
      serviceCategory: serviceCategory.value,
      targetHourly: Number(targetHourly.value) || 350,
    })

    if (res.success) {
      if (welloStore.user) {
        welloStore.user.name = name.value
        welloStore.user.targetHourly = Number(targetHourly.value) || 350
        const parts = name.value.trim().split(' ')
        welloStore.user.avatarInitials = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0].slice(0, 2).toUpperCase()
      }
      router.push('/')
    }
  } catch (err) {
    errorMessage.value = err?.message || 'Invalid or expired OTP code.'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.auth-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 20px;
  padding: 44px 40px;
  box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 2px 6px rgba(0, 0, 0, 0.02);
  width: 100%;
}

.auth-logo-row {
  display: flex;
  justify-content: center;
}

.auth-logo-link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
}

.auth-logo-img {
  height: 42px;
  width: auto;
  object-fit: contain;
}

.auth-heading-group {
  text-align: center;
}

.auth-title {
  font-size: 24px;
  font-weight: 700;
  color: #0F172A;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
  line-height: 1.25;
}

.auth-subtitle {
  font-size: 14px;
  color: #64748B;
  line-height: 1.5;
}

.text-highlight {
  color: #0F172A;
  font-weight: 600;
}

.text-required {
  color: #EF4444;
}

.auth-form-wrap {
  display: flex;
  flex-direction: column;
}

.form-field-group {
  display: flex;
  flex-direction: column;
}

.form-field-label {
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  margin-bottom: 8px;
}

.form-field-input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border-radius: 12px;
  border: 1.5px solid #E2E8F0;
  background: #FAFAFB;
  font-size: 15px;
  color: #0F172A;
  transition: all 0.2s ease;
}

.form-field-input:focus {
  outline: none;
  border-color: #7A3FF6;
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(122, 63, 246, 0.12);
}

.reg-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.btn-primary-action {
  width: 100%;
  height: 48px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #FF9F1C 0%, #FF387D 50%, #7A3FF6 100%);
  color: #FFFFFF;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(122, 63, 246, 0.25);
}

.btn-primary-action:hover:not(:disabled) {
  opacity: 0.92;
  box-shadow: 0 6px 18px rgba(122, 63, 246, 0.35);
  transform: translateY(-1px);
}

.btn-primary-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.auth-bottom-switch {
  text-align: center;
  font-size: 14px;
  color: #64748B;
}

.auth-link-highlight {
  color: #7A3FF6;
  font-weight: 600;
  text-decoration: none;
}

.auth-link-highlight:hover {
  text-decoration: underline;
}

/* Sandbox banner */
.sandbox-pill-box {
  background: #FAF5FF;
  border: 1px solid #E9D5FF;
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sandbox-pill-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.sandbox-pulse-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9333EA;
  box-shadow: 0 0 0 3px rgba(147, 51, 234, 0.2);
}

.sandbox-label {
  color: #6B21A8;
  font-weight: 500;
}

.sandbox-code-number {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
  color: #7E22CE;
  letter-spacing: 1px;
}

.sandbox-autofill-action {
  background: #7E22CE;
  color: #FFFFFF;
  border: none;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.sandbox-autofill-action:hover {
  opacity: 0.88;
}

/* OTP Grid */
.otp-inputs-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}

.otp-digit-field {
  width: 100%;
  height: 56px;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 24px;
  font-weight: 700;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  background: #FAFAFB;
  color: #0F172A;
  transition: all 0.2s ease;
}

.otp-digit-field:focus {
  outline: none;
  border-color: #7A3FF6;
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(122, 63, 246, 0.15);
}

/* Alert */
.auth-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.4;
}

.auth-alert.error {
  background: #FEF2F2;
  color: #DC2626;
  border: 1px solid #FECACA;
}

/* Footer nav */
.auth-footer-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 18px;
  border-top: 1px solid #F1F5F9;
}

.btn-link-action {
  background: none;
  border: none;
  font-size: 13px;
  color: #64748B;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}

.btn-link-action:hover {
  color: #0F172A;
}

.btn-link-action.is-active {
  color: #7A3FF6;
  font-weight: 600;
}

.btn-link-action.is-active:hover {
  text-decoration: underline;
}

.btn-link-action.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn-loader {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #FFF;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 480px) {
  .auth-card {
    padding: 32px 20px;
    border-radius: 16px;
  }
  .reg-fields-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
  .otp-inputs-grid {
    gap: 6px;
  }
  .otp-digit-field {
    height: 48px;
    font-size: 20px;
    border-radius: 10px;
  }
}
</style>
