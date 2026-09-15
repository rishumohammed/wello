<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
    <path d="M22.54 6.08a14 14 0 010 11.84M1.46 6.08a14 14 0 000 11.84"/>
  </svg>
</template>
<script setup>
defineProps({ size: { default: 18 } })
</script>
