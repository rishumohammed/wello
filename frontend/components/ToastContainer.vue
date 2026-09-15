<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast-anim">
        <div
          v-for="toast in toastQueue"
          :key="toast.id"
          class="toast"
          :class="toast.type"
        >
          <span class="toast-icon">
            <IconCheck v-if="toast.type === 'success'" :size="15" />
            <IconX     v-else-if="toast.type === 'error'" :size="15" />
            <IconAlert v-else :size="15" />
          </span>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '~/composables/useToast'
const { toastQueue } = useToast()
</script>

<style scoped>
.toast-anim-enter-active { animation: slideInRight 280ms cubic-bezier(0.34,1.56,0.64,1); }
.toast-anim-leave-active { animation: fadeOut 200ms ease forwards; position: absolute; }

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes fadeOut {
  to { opacity: 0; transform: translateX(20px); }
}
</style>
