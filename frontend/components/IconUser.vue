<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M6 20v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
  </svg>
</template>
<script setup>
defineProps({ size: { default: 16 } })
</script>
