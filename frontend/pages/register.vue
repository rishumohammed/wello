<template>
  <div class="auth-card" id="register-card">
    <!-- Brand Logo in Card -->
    <div class="auth-logo-row mb-6">
      <NuxtLink to="/" class="auth-logo-link">
        <img src="~/assets/logo.png" alt="Wello" class="auth-logo-img" />
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

        <div class="reg-fields-grid mb-4">
          <div class="form-field-group">
            <label class="form-field-label" for="reg-service">Profession / Service</label>
            <input
              id="reg-service"
              v-model="serviceCategory"
              type="text"
              class="form-field-input"
              placeholder="e.g. UX Designer, Software Engineer"
              :disabled="isLoading"
            />
          </div>

          <div class="form-field-group">
            <label class="form-field-label" for="reg-currency">Base Currency</label>
            <select id="reg-currency" v-model="baseCurrency" class="form-field-input" :disabled="isLoading">
              <option v-for="c in ISO_CURRENCIES" :key="c.code" :value="c.code">
                {{ c.code }} – {{ c.name }} ({{ c.symbol }})
              </option>
            </select>
          </div>
        </div>

        <div class="reg-fields-grid mb-6">
          <div class="form-field-group">
            <label class="form-field-label" for="reg-target">Target Rate ({{ baseCurrency }}/hr)</label>
            <input
              id="reg-target"
              v-model="targetHourly"
              type="number"
              min="1"
              step="5"
              class="form-field-input"
              placeholder="100"
              :disabled="isLoading"
            />
          </div>

          <div class="form-field-group">
            <label class="form-field-label" for="reg-tz">Timezone (IANA)</label>
            <select id="reg-tz" v-model="timezone" class="form-field-input" :disabled="isLoading">
              <option v-for="tz in IANA_TIMEZONES" :key="tz.value" :value="tz.value">
                {{ tz.label }}
              </option>
            </select>
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
import { useAuthStore } from '~/stores/auth'
import { useWelloStore } from '~/stores/wello'
import { ISO_CURRENCIES } from '~/utils/currencyUtils'
import { IANA_TIMEZONES, getBrowserTimezone } from '~/utils/dateUtils'

const authStore = useAuthStore()
const welloStore = useWelloStore()
const router = useRouter()

const step = ref(1)
const name = ref('')
const email = ref('')
const serviceCategory = ref('Consulting & Services')
const targetHourly = ref(100)
const baseCurrency = ref('USD')
const timezone = ref(getBrowserTimezone())
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
      targetHourly: Number(targetHourly.value) || 100,
      baseCurrency: baseCurrency.value,
      timezone: timezone.value,
    })

    if (res.success) {
      if (welloStore.user) {
        welloStore.user.name = name.value
        welloStore.user.targetHourly = Number(targetHourly.value) || 100
        welloStore.user.baseCurrency = baseCurrency.value
        welloStore.user.currency = baseCurrency.value
        welloStore.user.currencyCode = baseCurrency.value
        welloStore.user.timezone = timezone.value
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
