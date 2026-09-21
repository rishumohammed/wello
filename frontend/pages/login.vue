<template>
  <div class="auth-card" id="login-card">
    <!-- Brand Logo in Card -->
    <div class="auth-logo-row mb-6">
      <NuxtLink to="/" class="auth-logo-link">
        <img src="~/assets/logo.png" alt="Wello" class="auth-logo-img" />
      </NuxtLink>
    </div>

    <!-- Step 1: Request OTP -->
    <div v-if="step === 1" class="animate-fade-in" id="login-step-1">
      <div class="auth-heading-group mb-8">
        <h1 class="auth-title">Sign in to Wello</h1>
        <p class="auth-subtitle">Enter your email to receive a secure 6-digit one-time code.</p>
      </div>

      <!-- Error message -->
      <div v-if="errorMessage" class="auth-alert error mb-6">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>{{ errorMessage }}</span>
      </div>

      <form @submit.prevent="handleSendOtp" class="auth-form-wrap" id="form-send-otp">
        <div class="form-field-group mb-6">
          <label class="form-field-label" for="login-email">Email address</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            class="form-field-input"
            placeholder="name@workplace.com"
            required
            autocomplete="email"
            :disabled="isLoading"
          />
        </div>

        <button
          type="submit"
          class="btn-primary-action mb-6"
          :disabled="isLoading || !email"
          id="btn-submit-send-otp"
        >
          <span v-if="isLoading" class="btn-loader mr-2"></span>
          <span>{{ isLoading ? 'Sending code…' : 'Send Verification Code' }}</span>
        </button>
      </form>



      <!-- Switch to Register -->
      <div class="auth-bottom-switch mt-6">
        Don't have an account?
        <NuxtLink to="/register" class="auth-link-highlight ml-1">Create an account</NuxtLink>
      </div>
    </div>

    <!-- Step 2: Verify OTP -->
    <div v-else class="animate-fade-in" id="login-step-2">
      <div class="auth-heading-group mb-6">
        <h1 class="auth-title">Check your inbox</h1>
        <p class="auth-subtitle">
          We sent a 6-digit code to <strong class="text-highlight">{{ email }}</strong>
        </p>
      </div>

      <!-- Sleek Dev Sandbox Auto-Fill Helper -->
      <div v-if="devOtp" class="sandbox-pill-box mb-6" id="dev-otp-banner">
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

      <form @submit.prevent="handleVerifyOtp" class="auth-form-wrap" id="form-verify-otp">
        <!-- 6-Digit OTP Inputs Grid -->
        <div class="otp-inputs-grid mb-6" id="otp-inputs-container">
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
            :id="`otp-box-${index}`"
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
          id="btn-verify-otp-submit"
        >
          <span v-if="isLoading" class="btn-loader mr-2"></span>
          <span>{{ isLoading ? 'Verifying…' : 'Verify & Continue' }}</span>
        </button>
      </form>

      <!-- Resend and change email actions -->
      <div class="auth-footer-nav">
        <button
          type="button"
          class="btn-link-action"
          @click="step = 1; errorMessage = '';"
          id="btn-change-email"
        >
          ← Change email
        </button>

        <button
          type="button"
          class="btn-link-action"
          :class="{ 'is-disabled': countdown > 0 || isLoading, 'is-active': countdown === 0 }"
          :disabled="countdown > 0 || isLoading"
          @click="resendOtp"
          id="btn-resend-otp"
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

import { ref, computed, onMounted, nextTick } from 'vue'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const router = useRouter()


const step = ref(1)
const email = ref('')
const otpDigits = ref(['', '', '', '', '', ''])
const inputRefs = ref([])
const isLoading = ref(false)
const errorMessage = ref('')
const devOtp = ref('')
const countdown = ref(0)
let timerInterval = null

const fullOtp = computed(() => otpDigits.value.join(''))

onMounted(() => {
  if (authStore.user?.email) {
    email.value = authStore.user.email
  }
})

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

async function handleSendOtp() {
  if (!email.value) return
  isLoading.value = true
  errorMessage.value = ''

  try {
    const res = await authStore.sendOtp({
      email: email.value,
      type: 'login',
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
    errorMessage.value = err?.message || 'Failed to send verification code. Please try again.'
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
      type: 'login',
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
    })

    if (res.success) {
      if (authStore.isAdmin) {
        router.push('/admin')
      } else {
        router.push('/')
      }
    }
  } catch (err) {
    errorMessage.value = err?.message || 'Invalid or expired OTP code.'
  } finally {
    isLoading.value = false
  }
}


</script>
