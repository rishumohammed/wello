// composables/useToast.js
// Simple toast system using a shared reactive ref

import { ref } from 'vue'

const toastQueue = ref([])
let counter = 0

export function useToast() {
  function show(message, type = 'info', duration = 3500) {
    const id = ++counter
    toastQueue.value.push({ id, message, type })
    setTimeout(() => {
      toastQueue.value = toastQueue.value.filter(t => t.id !== id)
    }, duration)
  }

  return {
    toastQueue,
    success: (msg) => show(msg, 'success'),
    error:   (msg) => show(msg, 'error'),
    info:    (msg) => show(msg, 'info'),
    warning: (msg) => show(msg, 'warning'),
  }
}
