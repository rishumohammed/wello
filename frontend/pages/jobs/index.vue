<template>
  <div class="p-8 text-center text-tertiary">Redirecting to Work Hub…</div>
</template>

<script setup>
definePageMeta({
  middleware: [
    () => {
      return navigateTo('/work?tab=projects', { replace: true })
    }
  ]
})
</script>

