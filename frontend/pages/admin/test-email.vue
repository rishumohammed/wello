<template>
  <div class="admin-test-email-page animate-fade-in">
    <div class="page-header flex items-center justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="page-title">Live Email Dispatcher & Tester</h1>
        <p class="page-subtitle">Send live test dispatches to verify Resend API integration and inspect JSON response headers.</p>
      </div>
    </div>

    <div class="grid-2 gap-6">
      <!-- Test Email Dispatch Card -->
      <div class="card card-padded" id="resend-test-card">
        <div class="card-header px-0 pt-0 mb-4">
          <div>
            <div class="card-title">Test Dispatcher</div>
            <div class="card-subtitle">Dispatch a live test email payload to your inbox</div>
          </div>
        </div>

        <form @submit.prevent="sendTestEmail" id="form-test-email">
          <div class="form-group mb-4">
            <label class="form-label" for="test-recipient">Recipient Email Address</label>
            <input
              id="test-recipient"
              v-model="testRecipient"
              type="email"
              class="form-input"
              placeholder="yourname@domain.com"
              required
            />
            <div class="text-xs text-tertiary mt-1">
              Enter an email address to receive the test verification code layout.
            </div>
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="isSendingTest || !testRecipient"
            id="btn-dispatch-test-email"
          >
            <span v-if="isSendingTest">Dispatching Email…</span>
            <span v-else>🚀 Send Test Verification Email</span>
          </button>
        </form>
      </div>

      <!-- Response Inspector Card -->
      <div class="card card-padded">
        <div class="card-title mb-2">Live Response Inspector</div>
        <div v-if="testResponseStatus" class="mb-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="badge" :class="testResponseStatus === 'success' ? 'badge-completed' : 'badge-lost'">
              {{ testResponseStatus.toUpperCase() }}
            </span>
          </div>
          <div v-if="testResponseError" class="auth-alert error mb-3">
            {{ testResponseError }}
          </div>
          <div v-if="testResponseData" style="padding:14px;background:#1E293B;color:#F8FAFC;border-radius:10px;font-size:12px;font-family:monospace;overflow-x:auto;margin-top:12px;">
            <pre style="margin:0;white-space:pre-wrap;word-break:break-all;">{{ JSON.stringify(testResponseData, null, 2) }}</pre>
          </div>
        </div>
        <div v-else class="text-xs text-tertiary py-8 text-center border-dashed border border-radius-sm">
          No test dispatch executed yet. Fill in a recipient email to inspect response logs.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const testRecipient = ref('')
const isSendingTest = ref(false)
const testResponseStatus = ref('')
const testResponseData = ref(null)
const testResponseError = ref(null)

async function sendTestEmail() {
  if (!testRecipient.value) return
  isSendingTest.value = true
  testResponseStatus.value = ''
  testResponseData.value = null
  testResponseError.value = null

  try {
    const res = await $fetch('/api/admin/test-email', {
      method: 'POST',
      body: { to: testRecipient.value },
    })

    if (res?.success) {
      testResponseStatus.value = 'success'
      testResponseData.value = res
    } else {
      testResponseStatus.value = 'failed'
      testResponseError.value = res?.error || 'Test email failed to send.'
      testResponseData.value = res
    }
  } catch (err) {
    testResponseStatus.value = 'failed'
    testResponseError.value = err?.data?.statusMessage || err?.message || 'Failed to dispatch test email.'
    testResponseData.value = err?.data || null
  } finally {
    isSendingTest.value = false
  }
}
</script>
