<template>
  <div class="p-8 text-center text-tertiary">Redirecting to Settings…</div>
</template>

<script setup>
definePageMeta({
  layout: 'admin',
  middleware: [
    'admin',
    function () {
      return navigateTo('/admin/settings?tab=email-logs')
    }
  ]
})
</script>
