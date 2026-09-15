<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16.5 9.4 7.55 4.24a2 2 0 0 0-2.1 0L1.5 6.46a2 2 0 0 0-1 1.73v8.62a2 2 0 0 0 1 1.73l3.95 2.28a2 2 0 0 0 2.1 0l8.95-5.16a2 2 0 0 0 1-1.73V11.2a2 2 0 0 0-1-1.8Z"/>
    <polyline points="3.29 7 12 12.01 20.71 7"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
</template>

<script setup>
defineProps({
  size: { type: [Number, String], default: 18 }
})
</script>
