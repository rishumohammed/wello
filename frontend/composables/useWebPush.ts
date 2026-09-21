// frontend/composables/useWebPush.ts
import { ref, onMounted } from 'vue'
import { useToast } from './useToast'
import { useAuthStore } from '~/stores/auth'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function useWebPush() {
  const toast = useToast()
  const authStore = useAuthStore()

  const isSupported = ref(false)
  const isSubscribed = ref(false)
  const isLoading = ref(false)
  const permission = ref('default')

  async function checkSubscription() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      isSupported.value = false
      return
    }

    isSupported.value = true
    permission.value = Notification.permission

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      isSubscribed.value = Boolean(sub)
    } catch (err) {
      console.warn('[Web Push] Check subscription error:', err)
    }
  }

  onMounted(() => {
    checkSubscription()
  })

  async function subscribe() {
    if (!isSupported.value) {
      toast.error('Web Push is not supported on this browser.')
      return false
    }

    isLoading.value = true
    try {
      const perm = await Notification.requestPermission()
      permission.value = perm
      if (perm !== 'granted') {
        toast.error('Notification permission was denied.')
        return false
      }

      // Fetch VAPID public key
      const keyRes = await $fetch<{ data?: { publicKey?: string }; publicKey?: string }>('/api/notifications/push/vapid-key')
      const publicKey = keyRes?.data?.publicKey || keyRes?.publicKey

      if (!publicKey) {
        throw new Error('VAPID public key not received from server.')
      }

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const subJson = subscription.toJSON()

      // Post to backend
      await $fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
          },
        },
      })

      isSubscribed.value = true
      toast.success('Web push notifications enabled!')
      return true
    } catch (err: any) {
      console.error('[Web Push] Subscription error:', err)
      toast.error('Failed to enable push notifications: ' + (err instanceof Error ? err.message : String(err || 'Unknown error')))
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function unsubscribe() {
    isLoading.value = true
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        await $fetch('/api/notifications/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authStore.token}`,
          },
          body: { endpoint: subscription.endpoint },
        })
      }
      isSubscribed.value = false
      toast.info('Push notifications disabled.')
      return true
    } catch (err) {
      console.error('[Web Push] Unsubscribe error:', err)
      toast.error('Failed to disable push notifications.')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function sendTest() {
    try {
      const res = await $fetch('/api/notifications/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: {
          title: 'Wello Test Alert',
          body: 'This is a test web push notification from Wello!',
        },
      })
      toast.success('Test notification dispatched!')
      return res
    } catch (err: any) {
      toast.error('Failed to send test push: ' + (err instanceof Error ? err.message : String(err || 'Error')))
    }
  }

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    checkSubscription,
    subscribe,
    unsubscribe,
    sendTest,
  }
}
