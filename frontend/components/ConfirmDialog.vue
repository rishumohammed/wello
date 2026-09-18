<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="$emit('cancel')" id="modal-confirm-overlay">
      <div class="modal confirm-dialog" id="modal-confirm" role="alertdialog" aria-modal="true">
        <div class="modal-body pt-6">
          <div class="confirm-icon" :class="iconType">
            <IconAlert v-if="iconType === 'danger' || iconType === 'warning'" :size="22" />
            <IconCheck v-else :size="22" />
          </div>
          <div>
            <div class="modal-title text-base">{{ title }}</div>
            <p class="mt-2 text-sm text-secondary">{{ message }}</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary btn-sm" @click="$emit('cancel')" :id="`btn-confirm-cancel-${uid}`">{{ cancelLabel }}</button>
          <button
            class="btn btn-sm"
            :class="confirmClass"
            @click="$emit('confirm')"
            :id="`btn-confirm-ok-${uid}`"
          >{{ confirmLabel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title:        { type: String, default: 'Are you sure?' },
  message:      { type: String, default: 'This action cannot be undone.' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel:  { type: String, default: 'Cancel' },
  type:         { type: String, default: 'danger' }, // danger | warning | info
  uid:          { type: String, default: 'dlg' },
})

defineEmits(['confirm', 'cancel'])

const iconType = computed(() => props.type)
const confirmClass = computed(() => ({
  'btn-danger': props.type === 'danger',
  'btn-primary': props.type === 'info',
  'btn-secondary': props.type === 'warning',
}))
</script>
