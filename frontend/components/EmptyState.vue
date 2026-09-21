<template>
  <div class="empty-state card p-8 sm:p-12 text-center border-dashed border-neutral/80 bg-surface/60 rounded-2xl flex flex-col items-center justify-center max-w-lg mx-auto my-6 animate-fade-in">
    <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl mb-4 text-primary shadow-inner">
      <slot name="icon">
        <span>{{ icon || '✨' }}</span>
      </slot>
    </div>

    <h3 class="font-extrabold text-base text-primary mb-1.5">
      {{ title }}
    </h3>

    <p class="text-xs text-tertiary leading-relaxed max-w-sm mb-6">
      {{ description }}
    </p>

    <div class="flex items-center gap-3 flex-wrap justify-center">
      <button
        v-if="actionText"
        type="button"
        class="btn btn-primary btn-sm font-bold text-xs shadow-sm"
        @click="$emit('action')"
        :id="actionId || 'btn-empty-state-primary'"
      >
        <slot name="action-icon"></slot>
        <span>{{ actionText }}</span>
      </button>

      <button
        v-if="secondaryText"
        type="button"
        class="btn btn-secondary btn-sm text-xs font-semibold"
        @click="$emit('secondaryAction')"
        :id="secondaryActionId || 'btn-empty-state-secondary'"
      >
        <span>{{ secondaryText }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  icon: { type: String, default: '✨' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  actionText: { type: String, default: '' },
  actionId: { type: String, default: '' },
  secondaryText: { type: String, default: '' },
  secondaryActionId: { type: String, default: '' },
})

defineEmits(['action', 'secondaryAction'])
</script>
