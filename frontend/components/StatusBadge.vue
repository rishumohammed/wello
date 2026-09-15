<template>
  <span class="badge" :class="`badge-${normalizedStatus}`">{{ label }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, required: true }
})

const STATUS_LABELS = {
  potential:   'Potential',
  quoted:      'Quoted',
  approved:    'Approved',
  in_progress: 'In Progress',
  completed:   'Completed',
  lost:        'Lost',
  job:         'Job',
}

const normalizedStatus = computed(() => {
  return props.status?.replace(/_/g, '-') || 'potential'
})

const label = computed(() => STATUS_LABELS[props.status] || props.status)
</script>
