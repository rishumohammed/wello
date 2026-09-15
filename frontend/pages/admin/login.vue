<template>
  <div class="admin-login-wrapper flex items-center justify-center min-h-screen" style="background: var(--color-off-white);">
    <div class="card card-padded shadow-lg" style="width: 100%; max-width: 440px; background: white; border-radius: var(--radius-lg);">
      <!-- Header -->
      <div class="text-center mb-6">
        <div class="inline-flex items-center justify-center p-3 rounded-full mb-3" style="background: var(--color-purple-light);">
          <IconShield style="width: 32px; height: 32px; color: var(--color-purple);" />
        </div>
        <h2 class="text-2xl font-bold text-primary">Wello Admin Console</h2>
        <p class="text-secondary text-sm mt-1">Internal Management & Intelligence Portal</p>
      </div>

      <!-- Login Form -->
      <form @submit.prevent="handleAdminLogin" novalidate>
        <div class="form-group mb-4">
          <label class="form-label" for="admin-email">Admin Email Address</label>
          <input
            id="admin-email"
            v-model="email"
            type="email"
            class="form-input"
            placeholder="admin@wello.app"
            required
            autocomplete="email"
          />
        </div>

        <div class="form-group mb-6">
          <label class="form-label" for="admin-pass">Password</label>
          <input
            id="admin-pass"
            v-model="password"
            type="password"
            class="form-input"
            placeholder="••••••••••••"
            required
            autocomplete="current-password"
          />
        </div>

        <button
          type="submit"
          class="btn btn-primary w-full py-3 text-base font-semibold"
          :disabled="loading"
          style="background: var(--color-purple); border-color: var(--color-purple);"
        >
          <span v-if="loading">Authenticating…</span>
          <span v-else>Sign In to Admin Console</span>
        </button>
      </form>

      <div class="mt-6 pt-4 border-t text-center text-xs text-secondary flex items-center justify-between">
        <span>Protected Admin System</span>
        <NuxtLink to="/login" class="text-purple hover:underline">User Sign In</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '~/stores/auth'
import { useToast } from '~/composables/useToast'

definePageMeta({
  layout: 'auth',
})

const email = ref('')
const password = ref('')
const loading = ref(false)

const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()

async function handleAdminLogin() {
  if (!email.value.trim() || !password.value.trim()) {
    toast.error('Please enter admin email and password.')
    return
  }

  loading.value = true
  try {
    const success = await authStore.login({
      email: email.value.trim(),
      password: password.value.trim(),
    })

    if (success) {
      if (authStore.isAdmin) {
        toast.success(`Welcome back, ${authStore.user?.firstName || 'Admin'}!`)
        router.push('/admin')
      } else {
        toast.error('This account does not have Admin access privileges.')
      }
    } else {
      toast.error('Invalid credentials.')
    }
  } catch (err) {
    toast.error(err?.message || 'Admin authentication failed.')
  } finally {
    loading.value = false
  }
}
</script>
