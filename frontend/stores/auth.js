// stores/auth.js
// Authentication and session management store for Wello

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useWelloStore } from './wello'

const AUTH_TOKEN_KEY = 'wello_auth_token_v1'
const AUTH_USER_KEY  = 'wello_auth_user_v1'

const DEMO_USER = {
  id: 'u1',
  name: 'Rahul Mehta',
  email: 'rahul@mehtatech.in',
  avatarInitials: 'RM',
  targetHourly: 350,
  role: 'user',
  serviceCategory: 'Independent Professional',
}

const DEMO_ADMIN = {
  id: 'u_admin',
  name: 'System Admin',
  email: 'admin@wello.com',
  avatarInitials: 'SA',
  targetHourly: 500,
  role: 'admin',
  serviceCategory: 'System Administrator',
}

export const useAuthStore = defineStore('auth', () => {
  // Use Nuxt useCookie for SSR & Client session persistence across page refreshes
  const tokenCookie  = useCookie(AUTH_TOKEN_KEY, { maxAge: 60 * 60 * 24 * 30, path: '/' })
  const userCookie   = useCookie(AUTH_USER_KEY,  { maxAge: 60 * 60 * 24 * 30, path: '/' })
  const logoutCookie = useCookie('wello_logged_out', { maxAge: 60 * 60 * 24 * 30, path: '/' })

  let initialToken = tokenCookie.value || null
  let initialUser  = null

  if (userCookie.value) {
    try {
      initialUser = typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
    } catch (e) {
      initialUser = userCookie.value
    }
  }

  // Fallback to localStorage if client-side and cookie not parsed
  if (typeof window !== 'undefined') {
    try {
      if (!initialToken) initialToken = localStorage.getItem(AUTH_TOKEN_KEY)
      if (!initialUser) {
        const userStr = localStorage.getItem(AUTH_USER_KEY)
        if (userStr) initialUser = JSON.parse(userStr)
      }
    } catch (e) {
      console.warn('Could not read auth session from storage', e)
    }
  }

  const isExplicitlyLoggedOut = Boolean(
    logoutCookie.value === 'true' ||
    (typeof window !== 'undefined' && localStorage.getItem('wello_logged_out') === 'true')
  )

  const token = ref(isExplicitlyLoggedOut ? null : (initialToken || 'demo_token_wello'))
  const user  = ref(isExplicitlyLoggedOut ? null : (initialUser  || { ...DEMO_USER }))

  const isAuthenticated = computed(() => Boolean(token.value && user.value))
  const isLoggedIn = computed(() => Boolean(token.value && user.value))
  const isAdmin = computed(() => user.value?.role === 'admin')

  function init() {
    const isLoggedOut = logoutCookie.value === 'true' || (typeof window !== 'undefined' && localStorage.getItem('wello_logged_out') === 'true')
    if (isLoggedOut) {
      token.value = null
      user.value = null
      return
    }

    if (userCookie.value) {
      try {
        const parsed = typeof userCookie.value === 'string' ? JSON.parse(userCookie.value) : userCookie.value
        if (parsed) {
          user.value = parsed
          token.value = tokenCookie.value || token.value
          return
        }
      } catch (e) {}
    }

    if (typeof window !== 'undefined') {
      try {
        const savedToken = localStorage.getItem(AUTH_TOKEN_KEY)
        const userStr = localStorage.getItem(AUTH_USER_KEY)
        if (savedToken && userStr) {
          token.value = savedToken
          user.value = JSON.parse(userStr)
        }
      } catch (e) {
        console.warn('Could not read auth session from storage', e)
      }
    }
  }

  function setSession(newToken, newUser) {
    token.value = newToken
    user.value = newUser

    try {
      logoutCookie.value = null
      tokenCookie.value = newToken
      userCookie.value = newUser
    } catch (e) {}

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('wello_logged_out')
        localStorage.setItem(AUTH_TOKEN_KEY, newToken)
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser))
      } catch (e) {
        console.warn('Could not save auth session to storage', e)
      }
    }

    // Sync with wello store profile
    try {
      const welloStore = useWelloStore()
      if (welloStore?.user) {
        welloStore.user.name = newUser.name
        welloStore.user.email = newUser.email
        welloStore.user.avatarInitials = newUser.avatarInitials
        if (newUser.targetHourly) welloStore.user.targetHourly = newUser.targetHourly
      }
    } catch (e) {
      // Wello store not initialized yet
    }
  }

  async function sendOtp(payload) {
    try {
      const res = await $fetch('/api/auth/send-otp', {
        method: 'POST',
        body: payload,
      })
      return res
    } catch (err) {
      const message = err?.data?.statusMessage || err?.message || 'Failed to send verification code.'
      throw new Error(message)
    }
  }

  async function verifyOtp(payload) {
    try {
      const res = await $fetch('/api/auth/verify-otp', {
        method: 'POST',
        body: payload,
      })

      if (res?.success && res?.token && res?.user) {
        setSession(res.token, res.user)
      }

      return res
    } catch (err) {
      const message = err?.data?.statusMessage || err?.message || 'Invalid or expired verification code.'
      throw new Error(message)
    }
  }

  function loginAsDemo() {
    setSession('demo_token_' + Date.now(), { ...DEMO_USER })
    return { success: true, user: DEMO_USER }
  }

  function loginAsAdminDemo() {
    setSession('admin_token_' + Date.now(), { ...DEMO_ADMIN })
    return { success: true, user: DEMO_ADMIN }
  }

  function logout() {
    token.value = null
    user.value = null

    try {
      logoutCookie.value = 'true'
      tokenCookie.value = null
      userCookie.value = null
    } catch (e) {}

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('wello_logged_out', 'true')
        localStorage.removeItem(AUTH_TOKEN_KEY)
        localStorage.removeItem(AUTH_USER_KEY)
      } catch (e) {
        console.warn('Could not clear auth session from storage', e)
      }
    }

    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    } else {
      navigateTo('/login')
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    isLoggedIn,
    isAdmin,
    init,
    sendOtp,
    verifyOtp,
    loginAsDemo,
    loginAsAdminDemo,
    logout,
    setSession,
  }
})
