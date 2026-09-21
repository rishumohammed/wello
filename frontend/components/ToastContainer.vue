<template>
  <ClientOnly>
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
  </ClientOnly>
</template>

<script setup>
import { useToast } from '~/composables/useToast'
const { toastQueue } = useToast()
</script>
