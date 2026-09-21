<template>
  <div class="sparkline-container" :style="{ width: width + 'px', height: height + 'px' }">
    <svg :viewBox="`0 0 ${width} ${height}`" class="sparkline-svg">
      <defs>
        <linearGradient :id="gradientId" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.0" />
        </linearGradient>
      </defs>
      <!-- Area fill -->
      <polygon v-if="areaPath" :points="areaPath" :fill="`url(#${gradientId})`" />
      <!-- Line path -->
      <path v-if="linePath" :d="linePath" :stroke="color" :stroke-width="strokeWidth" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      <!-- End dot -->
      <circle v-if="lastPoint" :cx="lastPoint.x" :cy="lastPoint.y" r="3" :fill="color" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    data: number[]
    color?: string
    width?: number
    height?: number
    strokeWidth?: number
  }>(),
  {
    color: '#0D9488', // Emerald/teal brand color
    width: 120,
    height: 36,
    strokeWidth: 2,
  }
)

const gradientId = computed(() => 'sparkline-grad-' + Math.random().toString(36).substring(2, 9))

const points = computed(() => {
  if (!props.data || props.data.length < 2) return []
  const max = Math.max(...props.data, 1)
  const min = Math.min(...props.data, 0)
  const range = max - min || 1
  const stepX = (props.width - 6) / (props.data.length - 1)

  return props.data.map((val, idx) => {
    const x = 3 + idx * stepX
    const y = props.height - 3 - ((val - min) / range) * (props.height - 8)
    return { x, y }
  })
})

const linePath = computed(() => {
  if (points.value.length < 2) return ''
  return points.value.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`
  }, '')
})

const areaPath = computed(() => {
  if (points.value.length < 2) return ''
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  const bottom = props.height
  const pts = points.value.map(p => `${p.x},${p.y}`).join(' ')
  return `${first.x},${bottom} ${pts} ${last.x},${bottom}`
})

const lastPoint = computed(() => {
  return points.value.length > 0 ? points.value[points.value.length - 1] : null
})
</script>

<style scoped>
.sparkline-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.sparkline-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
